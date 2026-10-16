#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, join, resolve } from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const phase = Number(option("--phase", process.env.CAMPING_PHASE || 14));
const publicDir = resolve(option("--public-dir", "public/models/camping"));
const optimizedDir = resolve(option("--optimized-dir", "art/out/optimized"));
const colliderSource = resolve(option("--collider", "art/out/xoyens-studio.colliders.glb"));
const canonical = resolve(option("--canonical", join(publicDir, "xoyens-studio.glb")));
const canonicalCollider = resolve(option("--canonical-collider", join(publicDir, "xoyens-studio.colliders.glb")));
const biblePath = resolve(option("--scene-bible", "docs/camping-v3/scene-bible.json"));

if (!Number.isInteger(phase) || phase < 14 || phase > 22) throw new Error("public model manifest requires CAMPING_PHASE 14..22");
mkdirSync(publicDir, { recursive: true });

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function parseGlb(bytes) {
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error("invalid GLB: " + bytes.length + " bytes");
  }
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
function counts(bytes) {
  const json = parseGlb(bytes);
  return {
    triangles: triangles(json),
    materials: (json.materials || []).length,
    primitives: (json.meshes || []).reduce((sum, mesh) => sum + (mesh.primitives || []).length, 0),
    nodes: (json.nodes || []).length,
  };
}
function record(sourcePath, role, tier, publicName) {
  if (!existsSync(sourcePath)) throw new Error("manifest source missing: " + sourcePath);
  const bytes = readFileSync(sourcePath), digest = sha256(bytes), metrics = counts(bytes);
  const destination = join(publicDir, publicName);
  if (resolve(sourcePath) !== resolve(destination)) copyFileSync(sourcePath, destination);
  return {
    role, ...(tier ? { tier } : {}), path: "models/camping/" + publicName,
    sha256: digest, bytes: bytes.length, ...metrics,
  };
}
function hashedTier(tier) {
  const source = join(optimizedDir, "xoyens-studio." + tier + ".glb");
  if (!existsSync(source)) throw new Error("optimized " + tier + " GLB missing: " + source);
  const digest = sha256(readFileSync(source));
  return record(source, "visual", tier, "xoyens-studio." + tier + "." + digest.slice(0, 8) + ".glb");
}

const high = hashedTier("high");
const mid = hashedTier("mid");
const low = hashedTier("low");
const collider = record(colliderSource, "collider", "hashed", "xoyens-studio.colliders." + sha256(readFileSync(colliderSource)).slice(0, 8) + ".glb");
const canonicalEntry = record(canonical, "visual", "canonical", basename(canonical));
const canonicalColliderEntry = record(canonicalCollider, "collider", "canonical", basename(canonicalCollider));
if (canonicalEntry.sha256 !== high.sha256 || canonicalEntry.bytes !== high.bytes) throw new Error("canonical GLB differs from high-tier source");
if (canonicalColliderEntry.sha256 !== collider.sha256 || canonicalColliderEntry.bytes !== collider.bytes) throw new Error("canonical collider differs from hashed collider source");

const sourceCommit = process.env.GITHUB_SHA || (() => {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return "unknown"; }
})();
if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) throw new Error("manifest source commit is not a SHA: " + sourceCommit);
const manifest = {
  schema: 1,
  phase,
  commit: sourceCommit,
  builtAt: new Date().toISOString(),
  sceneBibleSha256: sha256(readFileSync(biblePath)),
  files: [high, mid, low, collider, canonicalEntry, canonicalColliderEntry],
  legacy: { path: "models/camping/xoyens-studio.legacy.glb", sha256File: "docs/camping-v3/legacy-glb-sha256.txt", publicStatus: "must-404" },
};
writeFileSync(join(publicDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ manifest: join(publicDir, "manifest.json"), phase, commit: sourceCommit, files: manifest.files }, null, 2));
