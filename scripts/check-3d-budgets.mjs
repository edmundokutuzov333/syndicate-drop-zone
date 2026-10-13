#!/usr/bin/env node
// Mede um GLB sem dependências e compara-o com docs/camping-v3/perf-budgets.json.
// Uso: node scripts/check-3d-budgets.mjs public/models/camping/xoyens-studio.glb [high|mid|low]
import { readFileSync, statSync } from "node:fs";

const [file = "public/models/camping/xoyens-studio.glb", tier = "high"] = process.argv.slice(2);
const budgets = JSON.parse(readFileSync(new URL("../docs/camping-v3/perf-budgets.json", import.meta.url), "utf8")).glb[tier];
if (!budgets) {
  console.error("tier desconhecido: " + tier);
  process.exit(2);
}

const buf = readFileSync(file);
if (buf.toString("ascii", 0, 4) !== "glTF") {
  console.error("não é GLB");
  process.exit(2);
}
let off = 12, json = null, bin = Buffer.alloc(0);
while (off < buf.length) {
  const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4), data = buf.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
  else if (type === 0x004e4942) bin = data;
  off += 8 + len;
}
if (!json) {
  console.error("GLB sem chunk JSON");
  process.exit(2);
}
const accessors = json.accessors ?? [];
let tris = 0, prims = 0, hasUv1 = false, hasTangent = false;
for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives ?? []) {
  prims += 1;
  const accessorIndex = primitive.indices !== undefined ? primitive.indices : primitive.attributes.POSITION;
  const accessor = accessors[accessorIndex];
  if (!accessor) continue;
  const count = accessor.count ?? 0;
  const mode = primitive.mode ?? 4;
  tris += mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
  if (primitive.attributes.TEXCOORD_1 !== undefined) hasUv1 = true;
  if (primitive.attributes.TANGENT !== undefined) hasTangent = true;
}
function dimensions(bytes, mime) {
  if (mime === "image/png" && bytes.length > 24) return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (mime === "image/ktx2" && bytes.length > 28) return [bytes.readUInt32LE(20), bytes.readUInt32LE(24)];
  if (mime === "image/jpeg") {
    let i = 2;
    while (i < bytes.length) {
      if (bytes[i] !== 0xff) { i += 1; continue; }
      const marker = bytes[i + 1], length = bytes.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return [bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)];
      i += 2 + length;
    }
  }
  return null;
}
const images = (json.images ?? []).map((image, index) => {
  let bytes = null;
  if (image.bufferView !== undefined) {
    const view = json.bufferViews[image.bufferView];
    if (view) bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  }
  const mime = image.mimeType ?? (image.uri?.endsWith(".ktx2") ? "image/ktx2" : image.uri?.match(/\.jpe?g$/) ? "image/jpeg" : "image/png");
  const dims = bytes ? dimensions(bytes, mime) : null;
  return { index, mime, dims, external: image.uri ?? null };
});
const extensions = new Set([...(json.extensionsUsed ?? [])]);
const embedded = images.filter((image) => image.dims);
const minHero = embedded.length ? Math.min(...embedded.map((image) => Math.max(...image.dims))) : 0;
const maxHero = embedded.length ? Math.max(...embedded.map((image) => Math.max(...image.dims))) : 0;
const sizeMB = statSync(file).size / 1048576;
const materialsWithNormals = (json.materials ?? []).filter((material) => material.normalTexture).length;

const checks = [
  ["triângulos", tris, "≤ " + budgets.maxTriangles, tris <= budgets.maxTriangles],
  ["materiais", json.materials?.length ?? 0, "≤ " + budgets.maxMaterials, (json.materials?.length ?? 0) <= budgets.maxMaterials],
  ["primitivas", prims, "≤ " + budgets.maxPrimitives, prims <= budgets.maxPrimitives],
  ["tamanho do GLB (MB)", sizeMB.toFixed(2), "≤ " + budgets.maxTransferMB, sizeMB <= budgets.maxTransferMB],
  ["textura embebida mais pequena (px)", minHero, "≥ " + budgets.minHeroTexturePx, minHero >= budgets.minHeroTexturePx],
  ["textura embebida maior (px)", maxHero, "≤ " + budgets.maxTexturePx, maxHero <= budgets.maxTexturePx],
  ["UV1 para lightmaps", hasUv1, budgets.requireUv1 ? "obrigatório" : "opcional", !budgets.requireUv1 || hasUv1],
  ["KTX2/BasisU", extensions.has("KHR_texture_basisu"), budgets.requireKtx2 ? "obrigatório" : "opcional", !budgets.requireKtx2 || extensions.has("KHR_texture_basisu")],
  ["Meshopt", extensions.has("EXT_meshopt_compression"), budgets.requireMeshopt ? "obrigatório" : "opcional", !budgets.requireMeshopt || extensions.has("EXT_meshopt_compression")],
  ["mapas de normais/tangentes", materialsWithNormals + " materiais com normal map; tangentes=" + hasTangent, budgets.requireTangentsOrNormalMaps ? "obrigatório" : "opcional", !budgets.requireTangentsOrNormalMaps || materialsWithNormals > 0 || hasTangent],
];
console.log(file + " [tier " + tier + "] gerador: " + (json.asset?.generator ?? "?"));
console.log("imagens: " + images.length + " (" + (embedded.map((image) => image.dims.join("×")).join(", ") || "sem dimensões embebidas") + ")");
let failures = 0;
for (const [label, value, rule, ok] of checks) {
  console.log((ok ? "OK   " : "FALHA") + " " + String(label).padEnd(34) + String(value).padEnd(42) + rule);
  if (!ok) failures += 1;
}
console.log(failures ? "\n" + failures + " violação(ões) de orçamento" : "\nTodos os orçamentos cumpridos");
process.exit(failures ? 1 : 0);
