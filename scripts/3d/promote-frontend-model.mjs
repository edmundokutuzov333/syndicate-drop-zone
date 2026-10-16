#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { certifiedPhase7BaselineTriangles } from "./phase-baseline.mjs";

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
const targetPhase = Number(process.env.CAMPING_PHASE || 9);
if (!Number.isInteger(targetPhase) || targetPhase < 1 || targetPhase > 22) {
  throw new Error("CAMPING_PHASE must be an integer between 1 and 22");
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
if (targetPhase >= 6) {
  if (!extensions.has("KHR_texture_basisu")) throw new Error("Refusing promotion: frontend GLB has no KTX2/Basis textures from Phase 06");
  if (!extensions.has("EXT_meshopt_compression")) throw new Error("Refusing promotion: frontend GLB has no Meshopt compression from Phase 06");
}

const nodes = gltf.nodes || [];
const interactions = new Set(nodes.map((node) => node.extras && node.extras.interactionId).filter((value) => typeof value === "string" && value));
const missingInteractions = [];
for (const id of ["studio.imac", "studio.artists-wall", "studio.merch-rack", "studio.photo-backdrop", "studio.production-desk", "studio.audio-system", "studio.inner-door"]) {
  if (!interactions.has(id)) missingInteractions.push(id);
}
if (missingInteractions.length) {
  throw new Error("Refusing promotion: interaction IDs missing: " + missingInteractions.join(", "));
}

// Blender's frame objects retain SDT_* names in the GLB while interactionId
// extras carry the stable studio.artist-slot-NNN contract. The runtime maps those
// IDs to object names before mounting portraits, so accept either representation.
const slotContracts = new Set(nodes.flatMap((node) => [
  node.name,
  node.extras && node.extras.interactionId,
]).filter((value) => typeof value === "string" && /^studio\.artist-slot-\d{3}$/.test(value)));
const requiredSlots = Array.from({ length: 17 }, (_, index) => "studio.artist-slot-" + String(index + 1).padStart(3, "0"));
const missingSlots = requiredSlots.filter((name) => !slotContracts.has(name));
if (missingSlots.length || slotContracts.has("studio.artist-slot-018")) {
  throw new Error("Refusing promotion: artist slot contract failed: " + JSON.stringify({
    missing: missingSlots,
    unexpected018: slotContracts.has("studio.artist-slot-018"),
  }));
}

let phase7Surfaces = null;
if (targetPhase >= 7) {
  function findPhaseNode(elementId, namePattern) {
    return nodes.find((node) => node.extras?.elementId === elementId && node.extras?.surfacePhase === 7) ||
      nodes.find((node) => namePattern.test(String(node.name || "")) && node.extras?.surfacePhase === 7);
  }
  const floorNode = findPhaseNode("floor.wood", /floor_wood_hero/i);
  const vinylNode = findPhaseNode("floor.vinyl_sweep", /vinyl_sweep_hero/i);
  const bambooNode = findPhaseNode("arch.vault_ceiling", /vault_ceiling/i);
  const paperWallNode = nodes.find((node) => /paper_cyclorama_wall/i.test(String(node.name || "")) && node.extras?.surfacePhase === 7);
  const paperCurveNode = nodes.find((node) => /paper_cyclorama_curve/i.test(String(node.name || "")) && node.extras?.surfacePhase === 7);
  if (!floorNode || !Number.isInteger(floorNode.extras?.phase7BoardCount) || floorNode.extras.phase7BoardCount < 100) {
    throw new Error("Refusing promotion: Phase 07 floor plank contract missing or has fewer than 100 physical boards");
  }
  const floorPrimitives = (gltf.meshes?.[floorNode.mesh]?.primitives) || [];
  if (!floorPrimitives.length || !floorPrimitives.every((primitive) => primitive.attributes?.COLOR_0 !== undefined)) {
    throw new Error("Refusing promotion: floor mesh must export COLOR_0 per-plank tonal variation on every primitive");
  }
  if (!floorPrimitives.every((primitive) => primitive.attributes?.TEXCOORD_0 !== undefined && primitive.attributes?.TEXCOORD_1 !== undefined)) {
    throw new Error("Refusing promotion: floor mesh must preserve both UVMap and UV_Lightmap");
  }
  if (!vinylNode || Math.abs(Number(vinylNode.extras?.phase7VinylRadiusM) - 2.3) > 0.003 ||
      Math.abs(Number(vinylNode.extras?.phase7VinylThicknessM) - 0.0012) > 0.0001 ||
      Math.abs(Number(vinylNode.extras?.phase7VinylEdgeLiftM) - 0.004) > 0.0001) {
    throw new Error("Refusing promotion: Phase 07 circular vinyl dimensions/rim contract missing");
  }
  if (!bambooNode || Math.abs(Number(bambooNode.extras?.phase7BambooTileMeters) - 1.2) > 0.0001) {
    throw new Error("Refusing promotion: Phase 07 bamboo ceiling tiling metadata missing");
  }
  if (!paperWallNode || !paperCurveNode ||
      Math.abs(Number(paperCurveNode.extras?.phase7CycloramaRadiusM) - 0.35) > 0.0001 ||
      paperCurveNode.extras?.phase7PaperContinuousToFloor !== true) {
    throw new Error("Refusing promotion: Phase 07 black-paper cyclorama contract missing");
  }
  phase7Surfaces = {
    floorBoards: floorNode.extras.phase7BoardCount,
    floorMeshIndex: floorNode.mesh,
    floorHasColor0: floorPrimitives.every((primitive) => primitive.attributes?.COLOR_0 !== undefined),
    floorHasUv0Uv1: floorPrimitives.every((primitive) => primitive.attributes?.TEXCOORD_0 !== undefined && primitive.attributes?.TEXCOORD_1 !== undefined),
    vinylRadiusM: Number(vinylNode.extras.phase7VinylRadiusM),
    vinylThicknessM: Number(vinylNode.extras.phase7VinylThicknessM),
    vinylEdgeLiftM: Number(vinylNode.extras.phase7VinylEdgeLiftM),
    bambooTileMeters: Number(bambooNode.extras.phase7BambooTileMeters),
    cycloramaRadiusM: Number(paperCurveNode.extras.phase7CycloramaRadiusM),
    cycloramaContinuousToFloor: paperCurveNode.extras.phase7PaperContinuousToFloor,
  };

}

let phase8Production = null;
let phase9Photo = null;
let phase12Lightmaps = null;
if (targetPhase >= 8) {
  // Phase 08 can only build on a published, checksum-verified Phase 07 asset.
  const productionReportPath = resolve("art/xoyens-studio.phase08.report.json");
  if (!existsSync(productionReportPath)) throw new Error("Refusing promotion: Phase 08 production report is missing");
  const phase8Report = JSON.parse(readFileSync(productionReportPath, "utf8"));
  const production = phase8Report.productionZone || {};
  if (phase8Report.version !== 1 || phase8Report.phase !== 8 || phase8Report.status !== "source-validated") {
    throw new Error("Refusing promotion: Phase 08 source report is not certified");
  }
  for (const [field, expected] of Object.entries({
    requiredElements: 19, midiWhiteKeys: 36, midiBlackKeys: 25,
    acousticFabricPanels: 3, acousticFoamTiles: 30, pendants: 4, edisonBulbs: 4,
  })) {
    if (production[field] !== expected) throw new Error("Refusing promotion: Phase 08 " + field + " expected " + expected + ", got " + production[field]);
  }
  if (!Number.isInteger(production.chairUpholsteryTrianglesSource) ||
      production.chairUpholsteryTrianglesSource < 14000 || production.chairUpholsteryTrianglesSource > 18000) {
    throw new Error("Refusing promotion: chair upholstery must contain 14k–18k source triangles");
  }
  const productionScreen = nodes.find((node) => node.name === "SDT_production_monitor_daw_screen" && Number.isInteger(node.mesh));
  if (!productionScreen) throw new Error("Refusing promotion: live 16:9 DAW screen mesh is missing");
  for (const id of ["studio.production-desk", "studio.imac", "studio.audio-system"]) {
    if (!interactions.has(id)) throw new Error("Refusing promotion: Phase 08 interaction missing: " + id);
  }
  const phase8MaterialNames = new Set((gltf.materials || []).map((material) => material.name).filter(Boolean));
  const requiredPhase8Materials = ["ceramic_red", "glass_mirror", "led_warm_emissive"];
  const missingPhase8Materials = requiredPhase8Materials.filter((name) => !phase8MaterialNames.has(name));
  if (missingPhase8Materials.length) {
    throw new Error("Refusing promotion: Phase 08 materials are not linked: " + missingPhase8Materials.join(", "));
  }

  const previousPhase7 = existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, "utf8")) : {};
  const previousModelPath = resolve("public/models/camping/xoyens-studio.glb");
  if (!existsSync(previousModelPath)) {
    throw new Error("Refusing Phase 08 promotion: the certified Phase 07 canonical GLB is missing");
  }
  const previousBytes = readFileSync(previousModelPath);
  const previousDigest = sha256(previousBytes);
  if (previousPhase7.geometry?.bytes !== previousBytes.length ||
      previousPhase7.frontendDelivery?.bytes !== previousBytes.length ||
      previousPhase7.geometry?.sha256 !== previousDigest ||
      previousPhase7.frontendDelivery?.sha256 !== previousDigest ||
      previousPhase7.frontendDelivery?.canonicalUrl !== previousPhase7.model ||
      previousPhase7.frontendDelivery?.hashAlgorithm !== "SHA-256") {
    throw new Error("Refusing Phase 08 promotion: the published canonical GLB does not match its SHA-256/byte metadata");
  }
  let baselineTriangles;
  try {
    baselineTriangles = certifiedPhase7BaselineTriangles(previousPhase7);
  } catch (error) {
    throw new Error("Refusing Phase 08 promotion: " + (error instanceof Error ? error.message : String(error)));
  }
  const phase8Triangles = countTriangles(gltf);
  if (!Number.isInteger(baselineTriangles) || baselineTriangles <= 0 || phase8Triangles <= baselineTriangles) {
    throw new Error("Refusing promotion: high-tier GLB must add geometry over the certified Phase 07 baseline (" +
      phase8Triangles + " <= " + baselineTriangles + " triangles)");
  }
  phase8Production = {
    sourceStatus: phase8Report.status,
    requiredElements: production.requiredElements,
    taggedProductionObjects: production.taggedProductionObjects,
    chairUpholsteryTrianglesSource: production.chairUpholsteryTrianglesSource,
    midiWhiteKeys: production.midiWhiteKeys,
    midiBlackKeys: production.midiBlackKeys,
    acousticFabricPanels: production.acousticFabricPanels,
    acousticFoamTiles: production.acousticFoamTiles,
    reclaimedWallBoards: production.reclaimedWallBoards,
    upperLed: production.upperLed,
    lowerLed: production.lowerLed,
    pendants: production.pendants,
    edisonBulbs: production.edisonBulbs,
    cableSegments: production.cableSegments,
    cableMaximumY: production.cableMaximumY,
    requiredPbrMaterialsLinked: requiredPhase8Materials,
    requiredInteractionsPreserved: ["studio.production-desk", "studio.imac", "studio.audio-system"],
    productionScreenNode: productionScreen.name,
    baselineTriangles,
    publishedTriangles: phase8Triangles,
    trianglesAddedFromPhase7: phase8Triangles - baselineTriangles,
  };
}

if (targetPhase >= 9) {
  const photoReportPath = resolve("art/xoyens-studio.phase09.report.json");
  if (!existsSync(photoReportPath)) throw new Error("Refusing promotion: Phase 09 photo report is missing");
  const report = JSON.parse(readFileSync(photoReportPath, "utf8"));
  if (report.phase !== 9 || report.status !== "source-validated" || report.photoElements !== 9 ||
      report.photoRootsFound !== 9 || report.garments !== 5 || report.sealDiameterM !== 2.2) {
    throw new Error("Refusing promotion: Phase 09 photo source report is not certified");
  }
  const photoIds = ["photo.roller_backdrop", "photo.backdrop_seal", "photo.rack", "photo.garments",
    "photo.softbox_octa", "photo.led_panel_1", "photo.light_grid", "photo.led_panel_barn_doors", "photo.rack_wheels"];
  for (const id of photoIds) {
    if (!nodes.some(node => node.extras?.elementId === id)) throw new Error("Refusing promotion: Phase 09 element missing from optimized GLB: " + id);
  }
  const photoMaterials = new Set((gltf.materials || []).map(material => material.name).filter(Boolean));
  const requiredPhotoMaterials = ["print_official_seal", "print_official_xoyens", "led_panel_emissive", "led_warm_emissive"];
  const missingPhotoMaterials = requiredPhotoMaterials.filter(name => !photoMaterials.has(name));
  if (missingPhotoMaterials.length) throw new Error("Refusing promotion: Phase 09 materials missing from optimized GLB: " + missingPhotoMaterials.join(", "));
  const garments = nodes.filter(node => /^SDT_photo_garments_garment_\d+$/.test(String(node.name || "")) && Number.isInteger(node.mesh));
  if (garments.length !== 5) throw new Error("Refusing promotion: optimized GLB must contain exactly five garment meshes, found " + garments.length);
  phase9Photo = {
    sourceStatus: report.status,
    requiredElements: report.photoElements,
    taggedPhotoObjects: report.photoRootsFound,
    garments: report.garments,
    garmentTypes: ["tee-seal", "tee-seal", "tee-xoyens", "hoodie", "hoodie-grey-sleeve"],
    sealDiameterM: report.sealDiameterM,
    rackWidthM: report.rackWidthM,
    requiredMaterialsLinked: requiredPhotoMaterials,
    requiredInteractionsPreserved: ["studio.photo-backdrop", "studio.merch-rack"],
    garmentMeshNodes: garments.map(node => node.name),
  };
}

if (targetPhase >= 12) {
  const reportPath = resolve("art/xoyens-studio.phase12.report.json");
  const planPath = resolve("art/xoyens-studio.phase12.plan.json");
  if (!existsSync(reportPath) || !existsSync(planPath)) throw new Error("Phase 12 promotion blocked: missing report/plan");
  const r = JSON.parse(readFileSync(reportPath, "utf8"));
  const p = JSON.parse(readFileSync(planPath, "utf8"));
  if (r.phase !== 12 || r.status !== "source-validated" || r.uv2Independent !== true ||
      !Number.isFinite(r.maxIslandStretch) || r.maxIslandStretch > 1.15 || p.phase !== 12 || p.status !== "within-budget") {
    throw new Error("Phase 12 promotion blocked: UV2/stretch/budget gates failed");
  }
  for (const [name, budget] of Object.entries({ high: 24, mid: 10, low: 4 })) {
    const tier = p.tiers?.[name];
    if (!tier || tier.budgetMB !== budget || tier.totalMemoryMB > budget ||
        Object.keys(tier.groups ?? {}).length !== 5 ||
        Object.values(tier.groups ?? {}).some((g) => g.fits !== true || g.atlases !== 1 || g.atlasPx > tier.maxPx)) {
      throw new Error("Phase 12 promotion blocked: " + name + " atlas/budget contract failed");
    }
  }
  const primitives = (gltf.meshes || []).flatMap((mesh) => mesh.primitives || []);
  const uv2Primitives = primitives.filter((primitive) => primitive.attributes?.TEXCOORD_1 !== undefined).length;
  if (!primitives.length || uv2Primitives !== primitives.length) throw new Error("Phase 12 promotion blocked: missing TEXCOORD_1");
  phase12Lightmaps = { sourceStatus: r.status, meshCount: r.meshCount, primitives: primitives.length, uv2Primitives, uv2Independent: r.uv2Independent, maxIslandStretch: r.maxIslandStretch, tiers: p.tiers };
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
  phase: targetPhase,
  productionPhase: targetPhase >= 8 ? targetPhase : null,
  surfacePhase: targetPhase >= 7 ? 7 : null,
  status: "blender-v3-published",
  model: "/models/camping/xoyens-studio.glb",
  sourceCommit: process.env.GITHUB_SHA || gitCommit(),
  format: targetPhase >= 6 ? "glTF 2.0 binary · KTX2/Basis + Meshopt" : "glTF 2.0 binary",
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
    heroSurfaces: phase7Surfaces,
    productionZone: phase8Production,
    photoZone: phase9Photo,
    lightmapUV: phase12Lightmaps,
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
  interactions: interactions.size, phase: updated.phase, productionPhase: updated.productionPhase,
  productionZone: phase8Production, photoZone: phase9Photo, sourceCommit: updated.sourceCommit,
}, null, 2));
