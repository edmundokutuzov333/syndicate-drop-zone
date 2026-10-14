#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

function parseGlb(bytes) {
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Frontend source is not a GLB");
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error("GLB total byte length mismatch");
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
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function gitCommit() {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return process.env.GITHUB_SHA || "unknown"; }
}
function countPrimitives(json) {
  return (json.meshes || []).reduce((sum, mesh) => sum + (mesh.primitives || []).length, 0);
}
function countTriangles(json) {
  const accessors = json.accessors || [];
  let total = 0;
  for (const mesh of json.meshes || []) for (const primitive of mesh.primitives || []) {
    const accessor = accessors[primitive.indices === undefined ? primitive.attributes && primitive.attributes.POSITION : primitive.indices];
    if (!accessor) continue;
    const count = accessor.count || 0;
    const mode = primitive.mode === undefined ? 4 : primitive.mode;
    total += mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
  }
  return total;
}

const args = process.argv.slice(2);
const sourceArg = args[0] || "art/out/optimized/xoyens-studio.high.glb";
const targetArg = args[1] || "public/models/camping/xoyens-studio.glb";
const metadataArg = args[2] || "public/models/camping/xoyens-studio.model.json";
const bibleArg = args[3] || "docs/camping-v3/scene-bible.json";
const source = resolve(sourceArg), target = resolve(targetArg), metadataPath = resolve(metadataArg), biblePath = resolve(bibleArg);
if (!existsSync(source)) throw new Error("Optimized high-tier source is missing: " + source);
const bytes = readFileSync(source);
const gltf = parseGlb(bytes);
const extensions = new Set(gltf.extensionsUsed || []);
if (!extensions.has("KHR_texture_basisu")) throw new Error("Refusing promotion: frontend GLB has no KTX2/Basis textures");
if (!extensions.has("EXT_meshopt_compression")) throw new Error("Refusing promotion: frontend GLB has no Meshopt compression");

const nodes = gltf.nodes || [];
const interactions = new Set(nodes.map((node) => node.extras && node.extras.interactionId).filter((value) => typeof value === "string" && value));
const missingInteractions = [];
for (const id of ["studio.imac", "studio.artists-wall", "studio.merch-rack", "studio.photo-backdrop", "studio.production-desk", "studio.audio-system", "studio.inner-door"]) {
  if (!interactions.has(id)) missingInteractions.push(id);
}
if (missingInteractions.length) {
  throw new Error("Refusing promotion: interaction IDs missing: " + missingInteractions.join(", "));
}

// Each portrait frame is contracted by its stable node name. Its actual photo
// mesh may use studio.artist-photo.NNN as the separate runtime interaction ID.
const nodeNames = new Set(nodes.map((node) => node.name).filter((value) => typeof value === "string"));
const requiredSlots = Array.from({ length: 17 }, (_, index) => "studio.artist-slot-" + String(index + 1).padStart(3, "0"));
const missingSlots = requiredSlots.filter((name) => !nodeNames.has(name));
if (missingSlots.length || nodeNames.has("studio.artist-slot-018")) {
  throw new Error("Refusing promotion: artist slot node contract failed: " + JSON.stringify({
    missing: missingSlots,
    unexpected018: nodeNames.has("studio.artist-slot-018"),
  }));
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
const published = readFileSync(target);
const digest = sha256(published);
if (digest !== sha256(bytes)) throw new Error("Promoted frontend GLB checksum does not match optimized source");
const bible = JSON.parse(readFileSync(biblePath, "utf8"));
const room = bible.metricPlan && bible.metricPlan.room;
if (!room) throw new Error("Scene Bible metricPlan.room is missing");
const previous = existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, "utf8")) : {};
const modelNodes = nodes.map((node, nodeIndex) => ({
  name: node.name || ("node-" + nodeIndex),
  nodeIndex,
  meshIndex: Number.isInteger(node.mesh) ? node.mesh : null,
  interactionId: node.extras && node.extras.interactionId || null,
})).filter((node) => node.meshIndex !== null || node.interactionId);
const generatedAt = new Date().toISOString();
const materials = gltf.materials || [];
const updated = {
  ...previous,
  version: 3,
  phase: 6,
  status: "blender-v3-published",
  model: "/models/camping/xoyens-studio.glb",
  sourceCommit: process.env.GITHUB_SHA || gitCommit(),
  format: "glTF 2.0 binary · KTX2/Basis + Meshopt",
  units: "metres",
  boundsMeters: {
    width: Number(room.clearWidthM),
    length: Number(room.clearDepthM),
    wallHeight: Number(room.wallHeightM),
    ceilingApex: Number(room.vaultCrownY),
  },
  geometry: {
    objectGroups: nodes.filter((node) => Number.isInteger(node.mesh)).length,
    meshes: (gltf.meshes || []).length,
    primitives: countPrimitives(gltf),
    triangles: countTriangles(gltf),
    materials: materials.length,
    embeddedImages: (gltf.images || []).length,
    bytes: published.length,
    sha256: digest,
    extensionsUsed: Array.from(extensions).sort(),
    officialBrandImages: previous.geometry && previous.geometry.officialBrandImages || [],
  },
  objects: modelNodes,
  frontendDelivery: {
    generatedAt,
    sourceGlb: sourceArg.split(String.fromCharCode(92)).join("/"),
    canonicalUrl: "/models/camping/xoyens-studio.glb",
    hashAlgorithm: "SHA-256",
    sha256: digest,
    bytes: published.length,
    browserLoader: "GLTFLoader + KTX2Loader + MeshoptDecoder",
  },
};
updated.interactions = (previous.interactions || []).map((interaction) => {
  if (interaction.id === "studio.artist-photo.001..017") {
    return { ...interaction, id: "studio.artist-slot-001..017", node: "studio.artist-slot-001..017", placeholder: true };
  }
  return interaction;
});
writeFileSync(metadataPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  promoted: targetArg, bytes: published.length, sha256: digest,
  meshes: updated.geometry.meshes, primitives: updated.geometry.primitives,
  triangles: updated.geometry.triangles, materials: materials.length,
  images: updated.geometry.embeddedImages, extensions: Array.from(extensions).sort(),
  interactions: interactions.size, sourceCommit: updated.sourceCommit,
}, null, 2));
