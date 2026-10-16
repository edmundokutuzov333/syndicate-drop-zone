#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
export function inspectGlb(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("invalid GLB header");
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error("GLB byte length mismatch");
  let offset = 12, json = null;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + length > bytes.length) throw new Error("GLB chunk exceeds file length");
    if (type === 0x4e4f534a) json = JSON.parse(bytes.subarray(start, start + length).toString("utf8").replace(/\0+$/g, "").trim());
    offset = start + length;
  }
  if (!json) throw new Error("GLB JSON chunk missing");
  return json;
}
function triangles(json) {
  let total = 0;
  for (const mesh of json.meshes || []) for (const primitive of mesh.primitives || []) {
    const accessor = json.accessors?.[primitive.indices ?? primitive.attributes?.POSITION];
    const count = Number(accessor?.count || 0), mode = primitive.mode ?? 4;
    total += mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
  }
  return total;
}
export function glbMetrics(bytes) {
  const json = inspectGlb(bytes), nodes = json.nodes || [];
  return {
    triangles: triangles(json),
    materials: (json.materials || []).length,
    primitives: (json.meshes || []).reduce((sum, mesh) => sum + (mesh.primitives || []).length, 0),
    hasColliderNodes: nodes.some((node) => String(node.name || "").startsWith("COL_")),
    colliderNodes: nodes.filter((node) => String(node.name || "").startsWith("COL_")),
    meshNodes: nodes.filter((node) => Number.isInteger(node.mesh)),
    json,
  };
}
function publicPath(path) { return "/" + String(path || "").replace(/^\/+/, ""); }
function localPath(root, path) {
  const normalized = String(path || "").replace(/^\/+/, "");
  return resolve(root, normalized.startsWith("models/camping/") ? normalized.slice("models/camping/".length) : normalized);
}
function failure(list, message) { list.push(message); }
function checkRecord(bytes, record, label, failures) {
  if (!bytes) { failure(failures, label + ": missing bytes"); return null; }
  const digest = sha256(bytes), metrics = glbMetrics(bytes);
  if (bytes.length !== Number(record.bytes)) failure(failures, label + ": bytes " + bytes.length + "/" + record.bytes);
  if (digest !== String(record.sha256 || "").toLowerCase()) failure(failures, label + ": SHA-256 mismatch");
  for (const key of ["triangles", "materials", "primitives"]) {
    if (Number(record[key]) !== Number(metrics[key])) failure(failures, label + ": " + key + " mismatch");
  }
  if (record.role === "visual" && metrics.hasColliderNodes) failure(failures, label + ": visual GLB contains COL_* nodes");
  if (record.role === "collider") {
    const colliderNodes = metrics.colliderNodes;
    if (colliderNodes.length < 12) failure(failures, label + ": fewer than 12 collider nodes");
    if (metrics.meshNodes.some((node) => !String(node.name || "").startsWith("COL_"))) failure(failures, label + ": non-COL mesh node in collider GLB");
    if (colliderNodes.some((node) => typeof node.extras?.collider !== "string" || !node.extras.collider || node.extras.collider === "none")) {
      failure(failures, label + ": collider extras missing");
    }
  }
  return metrics;
}

export async function verifyLocal(root, expectedPhase, legacyFile) {
  const failures = [], manifestPath = join(root, "manifest.json");
  if (!existsSync(manifestPath)) return ["manifest missing: " + manifestPath];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.schema !== 1) failure(failures, "manifest schema must be 1");
  if (Number(manifest.phase) !== expectedPhase) failure(failures, "manifest phase " + manifest.phase + "/" + expectedPhase);
  if (!/^[0-9a-f]{40}$/i.test(String(manifest.commit || ""))) failure(failures, "manifest commit is not a SHA");
  if (!/^[0-9a-f]{64}$/i.test(String(manifest.sceneBibleSha256 || ""))) failure(failures, "scene Bible SHA-256 missing");
  const records = Array.isArray(manifest.files) ? manifest.files : [];
  if (!records.some((record) => record.role === "visual" && record.tier === "high")) failure(failures, "high visual tier missing");
  if (!records.some((record) => record.role === "collider" && record.tier === "canonical")) failure(failures, "canonical collider missing");
  for (const record of records) {
    try { checkRecord(readFileSync(localPath(root, record.path)), record, "local " + record.path, failures); }
    catch (error) { failure(failures, "local " + record.path + ": " + (error instanceof Error ? error.message : String(error))); }
  }
  const legacyPath = localPath(root, "models/camping/xoyens-studio.legacy.glb");
  if (existsSync(legacyPath)) failure(failures, "legacy public GLB exists: " + legacyPath);
  if (legacyFile && !existsSync(resolve(legacyFile))) failure(failures, "legacy SHA record missing: " + legacyFile);
  return failures;
}

async function fetchBytes(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("HTTP " + response.status + " for " + url);
  return Buffer.from(await response.arrayBuffer());
}
export async function verifyRemote(base, expectedPhase) {
  const failures = [], origin = base.replace(/\/+$/, ""), manifestUrl = origin + "/models/camping/manifest.json?verify=" + Date.now();
  let manifest;
  try { manifest = JSON.parse((await fetchBytes(manifestUrl)).toString("utf8")); }
  catch (error) { return ["manifest fetch failed: " + (error instanceof Error ? error.message : String(error))]; }
  if (manifest.schema !== 1) failure(failures, "manifest schema must be 1");
  if (Number(manifest.phase) !== expectedPhase) failure(failures, "manifest phase " + manifest.phase + "/" + expectedPhase);
  if (!/^[0-9a-f]{40}$/i.test(String(manifest.commit || ""))) failure(failures, "manifest commit is not a SHA");
  for (const record of manifest.files || []) {
    try { checkRecord(await fetchBytes(origin + publicPath(record.path) + "?verify=" + Date.now()), record, "remote " + record.path, failures); }
    catch (error) { failure(failures, "remote " + record.path + ": " + (error instanceof Error ? error.message : String(error))); }
  }
  const legacyResponse = await fetch(origin + "/models/camping/xoyens-studio.legacy.glb?verify=" + Date.now(), { cache: "no-store" });
  if (legacyResponse.ok) failure(failures, "legacy public GLB responds HTTP " + legacyResponse.status);
  return failures;
}

function optionValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index++) if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[++index]);
  return values;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const expectedPhase = Number(optionValues("--expect-phase")[0] || process.env.CAMPING_PHASE || 14);
  const local = optionValues("--local")[0], bases = optionValues("--base"), legacy = optionValues("--legacy")[0];
  if (!Number.isInteger(expectedPhase)) throw new Error("--expect-phase must be an integer");
  const failures = [];
  if (local) failures.push(...await verifyLocal(resolve(local), expectedPhase, legacy));
  for (const base of bases) failures.push(...await verifyRemote(base, expectedPhase));
  if (!local && bases.length === 0) throw new Error("use --local and/or --base");
  if (failures.length) { for (const item of failures) console.error("FAIL", item); process.exitCode = 1; }
  else console.log("PUBLIC MODEL VERIFIED", JSON.stringify({ phase: expectedPhase, local: local || null, bases }, null, 2));
}
