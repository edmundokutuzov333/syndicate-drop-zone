#!/usr/bin/env node
import { readFileSync, statSync } from "node:fs";

const args = process.argv.slice(2);
const frontendOptimized = args.includes("--frontend-optimized");
const positional = args.filter((arg) => !arg.startsWith("--"));
const [glbPath = "art/out/xoyens-studio.raw.glb", biblePath = "docs/camping-v3/scene-bible.json"] = positional;
const bytes = readFileSync(glbPath);
if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Output is not a GLB: " + glbPath);
let offset = 12, json = null;
while (offset + 8 <= bytes.length) {
  const length = bytes.readUInt32LE(offset);
  const type = bytes.readUInt32LE(offset + 4);
  const chunk = bytes.subarray(offset + 8, offset + 8 + length);
  if (type === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8"));
  offset += 8 + length;
}
if (!json) throw new Error("GLB has no JSON chunk");
const bible = JSON.parse(readFileSync(biblePath, "utf8"));
if (frontendOptimized) {
  const extensions = new Set(json.extensionsUsed ?? []);
  const required = ["KHR_texture_basisu", "EXT_meshopt_compression"];
  const missingExtensions = required.filter((name) => !extensions.has(name));
  if (missingExtensions.length) throw new Error("Optimized frontend GLB is missing required extensions: " + missingExtensions.join(", "));
}
const nodes = json.nodes ?? [];
const seen = new Set();
for (const node of nodes) {
  const extras = node.extras ?? {};
  if (extras.interactionId) seen.add(extras.interactionId);
}
const expectedInteractions = new Set(bible.elements.map(e => e.interactionId).filter(Boolean));
const missing = [...expectedInteractions].filter(id => !seen.has(id));
if (missing.length) {
  console.error("Missing GLB interaction extras:", missing.join(", "));
  process.exit(1);
}

// Blender exports artist frames with their SDT_* mesh names and the stable slot
// contract in extras.interactionId. The Three.js compatibility layer promotes these
// IDs to runtime object names before portrait mounting, so validate both encodings.
const slotIds = new Set(nodes.flatMap(node => [node.name, node.extras?.interactionId])
  .filter(value => typeof value === "string")
  .map(value => /^studio\.artist-slot-(\d{3})$/.exec(value)?.[1])
  .filter(Boolean));
const expectedSlots = Array.from({ length: 17 }, (_, index) => "studio.artist-slot-" + String(index + 1).padStart(3, "0"));
const missingSlots = expectedSlots.filter(name => !slotIds.has(name.slice(-3)));
if (missingSlots.length || slotIds.has("018")) {
  console.error("Artist slot contract failed:", JSON.stringify({
    missing: missingSlots,
    unexpected018: slotIds.has("018"),
  }));
  process.exit(1);
}
let primitives = 0, missingMaterial = 0, missingUv0 = 0, missingUv1 = 0;
for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives ?? []) {
  primitives++;
  if (primitive.material === undefined) missingMaterial++;
  if (primitive.attributes?.TEXCOORD_0 === undefined) missingUv0++;
  if (primitive.attributes?.TEXCOORD_1 === undefined) missingUv1++;
}
if (!primitives) throw new Error("GLB has no mesh primitives");
if (missingMaterial || missingUv0 || missingUv1) {
  console.error(JSON.stringify({ primitives, missingMaterial, missingUv0, missingUv1 }, null, 2));
  process.exit(1);
}
const report = {
  file: glbPath, bytes: statSync(glbPath).size,
  nodes: nodes.length, meshes: (json.meshes ?? []).length, primitives,
  materials: (json.materials ?? []).length, interactions: seen.size,
  requiredInteractionIds: expectedInteractions.size,
  artistSlots: expectedSlots.length,
  missingMaterial, missingUv0, missingUv1,
  extensionsUsed: json.extensionsUsed ?? [],
};
console.log(JSON.stringify(report, null, 2));
