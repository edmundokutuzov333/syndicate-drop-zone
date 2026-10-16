#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, openSync, readSync, closeSync, statSync, readFileSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

export const GROUPS = ["shell", "production", "photo", "left", "right"];
export const TIERS = { ultra: { px: 4096, samples: 2048 }, high: { px: 2048, samples: 1024 }, mid: { px: 1024, samples: 512 } };
export const EXPECTED_OUTPUT_COUNT = GROUPS.length * Object.keys(TIERS).length;

function readCString(buffer, start) {
  const end = buffer.indexOf(0, start);
  if (end < 0) throw new Error("OpenEXR header string terminator missing");
  return { value: buffer.toString("ascii", start, end), next: end + 1 };
}

export function parseExrDataWindow(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16 || buffer.readUInt32LE(0) !== 0x01312f76) throw new Error("invalid OpenEXR magic/header");
  let offset = 8;
  while (offset < buffer.length) {
    const name = readCString(buffer, offset); offset = name.next;
    if (!name.value) break;
    const type = readCString(buffer, offset); offset = type.next;
    if (offset + 4 > buffer.length) throw new Error("truncated OpenEXR attribute size");
    const size = buffer.readInt32LE(offset); offset += 4;
    if (size < 0 || offset + size > buffer.length) throw new Error("truncated OpenEXR attribute payload");
    if (name.value === "dataWindow" && type.value === "box2i" && size === 16) {
      const minX = buffer.readInt32LE(offset), minY = buffer.readInt32LE(offset + 4);
      const maxX = buffer.readInt32LE(offset + 8), maxY = buffer.readInt32LE(offset + 12);
      return { width: maxX - minX + 1, height: maxY - minY + 1, minX, minY, maxX, maxY };
    }
    offset += size;
  }
  throw new Error("OpenEXR dataWindow attribute missing");
}

export function pngDimensions(buffer) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (!Buffer.isBuffer(buffer) || buffer.length < 24 || !buffer.subarray(0,8).equals(signature)) throw new Error("invalid PNG header");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function sha256File(path) {
  const hash = createHash("sha256"), fd = openSync(path, "r"), chunk = Buffer.allocUnsafe(1024 * 1024);
  try { let n; do { n = readSync(fd, chunk, 0, chunk.length, null); if (n > 0) hash.update(chunk.subarray(0,n)); } while (n > 0); }
  finally { closeSync(fd); }
  return hash.digest("hex");
}

function safeFile(root, filePath, label, failures) {
  if (typeof filePath !== "string" || !filePath || isAbsolute(filePath) || normalize(filePath).startsWith("..")) { failures.push(label + ": path inválido"); return null; }
  const full = join(root, filePath);
  if (!existsSync(full)) { failures.push(label + ": ficheiro em falta " + filePath); return null; }
  return full;
}

function checkImage(root, record, format, expected, label, failures) {
  if (!record || typeof record !== "object") { failures.push(label + ": metadata em falta"); return; }
  const full = safeFile(root, record.path, label, failures);
  if (!full) return;
  const bytes = statSync(full).size;
  if (bytes !== Number(record.bytes) || bytes <= 128) failures.push(label + ": bytes divergentes ou ficheiro vazio (" + bytes + "/" + record.bytes + ")");
  if (sha256File(full) !== record.sha256) failures.push(label + ": SHA-256 divergente");
  const fd = openSync(full, "r"), header = Buffer.alloc(65536); let length;
  try { length = readSync(fd, header, 0, header.length, 0); } finally { closeSync(fd); }
  let dimensions;
  try { dimensions = format === "exr" ? parseExrDataWindow(header.subarray(0,length)) : pngDimensions(header.subarray(0,length)); }
  catch (error) { failures.push(label + ": " + (error instanceof Error ? error.message : String(error))); return; }
  if (dimensions.width !== expected.width || dimensions.height !== expected.height) failures.push(label + ": dimensões " + dimensions.width + "x" + dimensions.height + ", esperado " + expected.width + "x" + expected.height);
  if (Number(record.width) !== dimensions.width || Number(record.height) !== dimensions.height) failures.push(label + ": dimensões do relatório não correspondem ao ficheiro");
}

export function validateBakeReport(report, root = ".") {
  const failures = [], add = (ok, msg) => { if (!ok) failures.push(msg); };
  add(report?.phase === 13, "relatório não identifica a Fase 13");
  add(report?.status === "baked", "estado do bake não é baked");
  add(/^[0-9a-f]{40}$/i.test(String(report?.sourceCommit || "")), "sourceCommit inválido");
  add(Number(report?.durationSeconds) > 0, "tempo de bake não foi medido");
  add(report?.bakeType === "DIFFUSE", "tipo de bake deve ser DIFFUSE");
  add(report?.direct === true && report?.indirect === true, "passes direct/indirect em falta");
  add(report?.usePassColor === false, "o bake deve excluir albedo");
  add(Number(report?.lmScale) === 4, "LM_SCALE deve ser 4.0");
  add(Number(report?.dilateMarginPx) >= 8, "dilatação/padding deve ser pelo menos 8 px");
  add(report?.denoiser === "OPENIMAGEDENOISE", "OpenImageDenoise não está registado");
  add(Array.isArray(report?.failures) && report.failures.length === 0, "relatório contém falhas de bake");
  const outputs = Array.isArray(report?.outputs) ? report.outputs : [];
  add(outputs.length === EXPECTED_OUTPUT_COUNT, "esperados 15 outputs, encontrados " + outputs.length);
  const seen = new Set();
  for (const tier of Object.keys(TIERS)) for (const group of GROUPS) {
    const key = tier + ":" + group, entry = outputs.find(item => item?.tier + ":" + item?.group === key);
    add(Boolean(entry), "output em falta " + key);
    if (!entry) continue;
    if (seen.has(key)) failures.push("output duplicado " + key);
    seen.add(key);
    const px = TIERS[tier].px;
    add(Number(entry.samples) === TIERS[tier].samples, key + ": amostras incorrectas");
    add(Number(entry.lmScale) === 4, key + ": LM_SCALE incorrecto");
    add(Number(entry.dilateMarginPx) >= 8, key + ": margin inferior a 8 px");
    add(entry.bakeType === "DIFFUSE" && entry.direct === true && entry.indirect === true && entry.usePassColor === false, key + ": contrato de irradiância inválido");
    add(entry.denoiser === "OPENIMAGEDENOISE", key + ": denoiser inválido");
    add(Number(entry.histogram?.clippedOccupiedPct) <= 0.5, key + ": clipping >0.5%");
    add(Number(entry.histogram?.blackOccupiedPct) <= 1, key + ": ilhas UV pretas >1%");
    checkImage(root, entry.exr, "exr", {width:px,height:px}, key + " EXR", failures);
    checkImage(root, entry.png, "png", {width:px,height:px}, key + " PNG", failures);
  }
  const requiredLights = ["prod.plank_wall","prod.pendant_cage_1","prod.pendant_cage_2","prod.pendant_cage_3","prod.pendant_cage_4","photo.softbox_octa","photo.led_panel_1"];
  const lighting = report?.lightingInventory;
  add(Number(lighting?.sourceLightCount) >= 7, "inventário precisa de pelo menos 7 fontes");
  for (const id of requiredLights) add(Array.isArray(lighting?.sourceElementIds) && lighting.sourceElementIds.includes(id), "fonte de luz em falta: " + id);
  add(Array.isArray(lighting?.missingSourceElementIds) && lighting.missingSourceElementIds.length === 0, "inventário reporta fontes de luz em falta");
  checkImage(root, report?.ibl, "exr", {width:4096,height:2048}, "IBL equirectangular", failures);
  add(report?.ibl?.projection === "EQUIRECTANGULAR", "IBL deve ser equirectangular");
  add(Number(report?.ibl?.samples) >= 64, "amostras IBL insuficientes");
  const captureWidth = Math.ceil(170 / 360 * 4096) - Math.floor(100 / 360 * 4096);
  checkImage(root, report?.capture, "png", {width:captureWidth,height:456}, "captura sector 100..170", failures);
  add(JSON.stringify(report?.capture?.azimuthRange) === JSON.stringify([100,170]), "captura não corresponde ao sector 100..170°");
  add(JSON.stringify(report?.capture?.elevationRange) === JSON.stringify([-15,25]), "captura não corresponde à banda -15..25°");
  return { ok: failures.length === 0, failures };
}

function arg(name, fallback) { const i = process.argv.indexOf(name); return i >= 0 && process.argv[i+1] ? process.argv[i+1] : fallback; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = arg("--root","."), reportPath = join(root,arg("--report","art/xoyens-studio.phase13.report.json"));
  try {
    const report = JSON.parse(readFileSync(reportPath,"utf8")), result = validateBakeReport(report,root);
    for (const failure of result.failures) console.error("FAIL",failure);
    if (result.ok) console.log("Phase 13 bake verified: 15 EXR/PNG pairs, IBL 4096x2048, sector capture and checksums.");
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) { console.error("Phase 13 bake verification failed:",error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
