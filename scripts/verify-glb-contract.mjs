#!/usr/bin/env node
import { readFileSync, statSync } from "node:fs";
import { decodeAccessorBounds, getNodeWorldBounds } from "./3d/glb-world-bounds.mjs";

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

// Phase 07 is not merely a Blender-source change. Each raw/high/mid/low/public GLB
// must carry the actual hero-surface geometry and its dimensions to the frontend.
const findPhaseNode = (elementId, namePattern) =>
  nodes.find(node => node.extras?.elementId === elementId && node.extras?.surfacePhase === 7) ??
  nodes.find(node => namePattern.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
const floorNode = findPhaseNode("floor.wood", /floor_wood_hero/i);
const vinylNode = findPhaseNode("floor.vinyl_sweep", /vinyl_sweep_hero/i);
const bambooNode = findPhaseNode("arch.vault_ceiling", /vault_ceiling/i);
const paperWallNode = nodes.find(node => /paper_cyclorama_wall/i.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
const paperCurveNode = nodes.find(node => /paper_cyclorama_curve/i.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
if (!floorNode || !Number.isInteger(floorNode.extras?.phase7BoardCount) || floorNode.extras.phase7BoardCount < 100) {
  throw new Error("Phase 07 floor: certified real-plank geometry (100+ boards) is missing");
}
const floorMeshForAxis = json.meshes?.[floorNode.mesh];
const floorPositionAccessors = (floorMeshForAxis?.primitives ?? [])
  .map((primitive) => json.accessors?.[primitive.attributes?.POSITION])
  .filter(Boolean);
if (!floorPositionAccessors.length || floorPositionAccessors.some((accessor) =>
  !Array.isArray(accessor.min) || !Array.isArray(accessor.max) ||
  accessor.min.length !== 3 || accessor.max.length !== 3 ||
  ![...accessor.min, ...accessor.max].every(Number.isFinite)
)) {
  throw new Error("CAMPING coordinate contract: floor POSITION accessors must expose finite XYZ bounds");
}
// Decode each accessor independently before merging bounds. With KHR_mesh_quantization,
// normalized SHORT values are stored as integer min/max in JSON and must be divided
// by 32767 before node/ancestor transforms restore the metric dimensions.
const decodedFloorBounds = floorPositionAccessors.map(decodeAccessorBounds);
const floorPositionMin = [0, 1, 2].map((axis) =>
  Math.min(...decodedFloorBounds.map((bounds) => bounds.min[axis])));
const floorPositionMax = [0, 1, 2].map((axis) =>
  Math.max(...decodedFloorBounds.map((bounds) => bounds.max[axis])));
const floorWorldBounds = getNodeWorldBounds(json, nodes.indexOf(floorNode), floorPositionMin, floorPositionMax);
const floorSizeMeters = floorWorldBounds.size;
const floorRotation = floorNode.rotation ?? [0, 0, 0, 1];
const floorRotationIsIdentity = Math.abs(floorRotation[0]) < 1e-4 &&
  Math.abs(floorRotation[1]) < 1e-4 && Math.abs(floorRotation[2]) < 1e-4 &&
  Math.abs(Math.abs(floorRotation[3]) - 1) < 1e-4;
const floorArea = floorSizeMeters[0] * floorSizeMeters[2];
if (!floorSizeMeters.every(Number.isFinite) ||
    floorSizeMeters[0] < 3.8 || floorSizeMeters[2] < 3.8 ||
    floorSizeMeters[1] > 0.35 || floorArea < 30 || floorArea > 180) {
  throw new Error("CAMPING coordinate contract failed in world space: Scene Bible requires +Y up and a floor spanning X/Z with thickness on Y. " +
    JSON.stringify({
      floorSizeMeters,
      floorRotation,
      localAccessorBounds: { min: floorPositionMin, max: floorPositionMax },
      floorWorldBounds,
    }));
}
const floorCoordinateContract = {
  upAxis: "+Y",
  footprintAxes: ["X", "Z"],
  sizeMeters: floorSizeMeters.map((value) => Number(value.toFixed(5))),
  worldBoundsMeters: {
    min: floorWorldBounds.min.map((value) => Number(value.toFixed(5))),
    max: floorWorldBounds.max.map((value) => Number(value.toFixed(5))),
  },
  localAccessorBounds: { min: floorPositionMin, max: floorPositionMax },
  nodeRotationIdentity: floorRotationIsIdentity,
  worldTransformApplied: true,
};
const floorPrimitives = json.meshes?.[floorNode.mesh]?.primitives ?? [];
if (!floorPrimitives.length || !floorPrimitives.every(primitive =>
  primitive.attributes?.COLOR_0 !== undefined &&
  primitive.attributes?.TEXCOORD_0 !== undefined &&
  primitive.attributes?.TEXCOORD_1 !== undefined
)) {
  throw new Error("Phase 07 floor must retain COLOR_0, UV0 and UV1 on every primitive");
}
if (!vinylNode ||
    Math.abs(Number(vinylNode.extras?.phase7VinylRadiusM) - 2.3) > 0.003 ||
    Math.abs(Number(vinylNode.extras?.phase7VinylThicknessM) - 0.0012) > 0.0001 ||
    Math.abs(Number(vinylNode.extras?.phase7VinylEdgeLiftM) - 0.004) > 0.0001) {
  throw new Error("Phase 07 vinyl: circular 2.3 m radius, 1.2 mm thickness or 4 mm edge-lift contract missing");
}
if (!bambooNode || Math.abs(Number(bambooNode.extras?.phase7BambooTileMeters) - 1.2) > 0.0001) {
  throw new Error("Phase 07 bamboo ceiling tiling metadata (1.2 m) missing");
}
if (!paperWallNode || !paperCurveNode ||
    Math.abs(Number(paperCurveNode.extras?.phase7CycloramaRadiusM) - 0.35) > 0.0001 ||
    paperCurveNode.extras?.phase7PaperContinuousToFloor !== true) {
  throw new Error("Phase 07 continuous black-paper cyclorama contract missing");
}
const phase8Materials = new Set((json.materials ?? []).map((material) => material.name).filter(Boolean));
for (const materialName of ["ceramic_red", "glass_mirror", "led_warm_emissive"]) {
  if (!phase8Materials.has(materialName)) throw new Error("Phase 08 material is not linked to GLB geometry: " + materialName);
}
if (!nodes.some((node) => node.name === "SDT_production_monitor_daw_screen" && Number.isInteger(node.mesh))) {
  throw new Error("Phase 08 live DAW screen mesh is missing from the GLB");
}
for (const interactionId of ["studio.production-desk", "studio.imac", "studio.audio-system"]) {
  if (!seen.has(interactionId)) throw new Error("Phase 08 production interaction is missing: " + interactionId);
}
if (Number(process.env.CAMPING_PHASE || 8) >= 9) {
  const requiredPhotoIds = ["photo.roller_backdrop", "photo.backdrop_seal", "photo.rack", "photo.garments",
    "photo.softbox_octa", "photo.led_panel_1", "photo.light_grid", "photo.led_panel_barn_doors", "photo.rack_wheels"];
  for (const id of requiredPhotoIds) {
    if (!nodes.some(node => node.extras?.elementId === id)) throw new Error("Phase 09 photo element missing: " + id);
  }
  const photoMaterials = new Set((json.materials ?? []).map(material => material.name).filter(Boolean));
  for (const name of ["print_official_seal", "print_official_xoyens", "led_panel_emissive", "led_warm_emissive"]) {
    if (!photoMaterials.has(name)) throw new Error("Phase 09 material is not linked to GLB geometry: " + name);
  }
  const garmentMeshes = nodes.filter(node => /^SDT_photo_garments_garment_\d+$/.test(String(node.name ?? "")) && Number.isInteger(node.mesh));
  if (garmentMeshes.length !== 5) throw new Error("Phase 09 requires five garment meshes; found " + garmentMeshes.length);
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
  floorCoordinateContract,
  missingMaterial, missingUv0, missingUv1,
  extensionsUsed: json.extensionsUsed ?? [],
};
console.log(JSON.stringify(report, null, 2));
