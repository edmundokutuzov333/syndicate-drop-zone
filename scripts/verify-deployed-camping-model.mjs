#!/usr/bin/env node
import { createHash } from "node:crypto";

const BASE_URL = process.env.CAMPING_PRODUCTION_URL || "https://syndicate-drop-zone.vercel.app";
const MODEL_PATH = "/models/camping/xoyens-studio.glb";
const METADATA_PATH = "/models/camping/xoyens-studio.model.json";
const EXPECTED_MODEL_PHASE = Number(process.env.CAMPING_EXPECTED_MODEL_PHASE || process.env.CAMPING_PHASE || 9);
if (!Number.isInteger(EXPECTED_MODEL_PHASE) || EXPECTED_MODEL_PHASE < 9 || EXPECTED_MODEL_PHASE > 22) {
  throw new Error("CAMPING_EXPECTED_MODEL_PHASE must be an integer between 9 and 22; pre-Phase-09 models are not accepted");
}
const REQUIRED_EXTENSIONS = ["KHR_texture_basisu", "EXT_meshopt_compression"];
const REQUIRED_PHASE08_MATERIALS = ["ceramic_red", "glass_mirror", "led_warm_emissive"];
const REQUIRED_PHASE09_MATERIALS = ["print_official_seal", "print_official_xoyens", "led_panel_emissive", "led_warm_emissive"];
const REQUIRED_INTERACTIONS = [
  "studio.imac",
  "studio.artists-wall",
  "studio.merch-rack",
  "studio.photo-backdrop",
  "studio.production-desk",
  "studio.audio-system",
  "studio.inner-door",
];
const timeoutMs = Number(process.env.CAMPING_PRODUCTION_VERIFY_TIMEOUT_MS || 300_000);
const pollMs = 5_000;
const deadline = Date.now() + timeoutMs;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseGlb(bytes) {
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("response is not a GLB");
  if (bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error("GLB header or length is invalid");
  let offset = 12;
  let gltf = null;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + length > bytes.length) throw new Error("GLB chunk exceeds the downloaded file");
    if (type === 0x4e4f534a) {
      gltf = JSON.parse(bytes.subarray(start, start + length).toString("utf8").replace(/\0+$/g, "").trim());
    }
    offset = start + length;
  }
  if (offset !== bytes.length || gltf?.asset?.version !== "2.0") throw new Error("GLB is not a valid glTF 2.0 container");
  return gltf;
}

function countTriangles(gltf) {
  const accessors = gltf.accessors ?? [];
  let total = 0;
  for (const mesh of gltf.meshes ?? []) for (const primitive of mesh.primitives ?? []) {
    const accessor = accessors[primitive.indices === undefined ? primitive.attributes?.POSITION : primitive.indices];
    if (!accessor) continue;
    const count = accessor.count ?? 0;
    const mode = primitive.mode === undefined ? 4 : primitive.mode;
    total += mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
  }
  return total;
}

async function verifyPublishedAsset(metadata) {
  const modelUrl = new URL(MODEL_PATH, BASE_URL);
  // Bind the request cache key to the expected digest. If a CDN serves an old
  // object for this canonical path, the SHA-256 gate below rejects it.
  modelUrl.searchParams.set("_sdt_sha256", String(metadata.geometry?.sha256 ?? ""));
  const response = await fetch(modelUrl, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" },
  });
  if (!response.ok) throw new Error("canonical model returned HTTP " + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 16 * 1024 * 1024) throw new Error("model size is outside the allowed 1 B to 16 MiB range");

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (metadata.geometry?.sha256 !== sha256 || metadata.frontendDelivery?.sha256 !== sha256) {
    throw new Error("served GLB SHA-256 does not match its metadata");
  }
  if (metadata.geometry?.bytes !== bytes.length || metadata.frontendDelivery?.bytes !== bytes.length) {
    throw new Error("served GLB byte count does not match its metadata");
  }
  if (metadata.model !== MODEL_PATH || metadata.frontendDelivery?.canonicalUrl !== MODEL_PATH) {
    throw new Error("production metadata does not point to the canonical CAMPING URL");
  }
  if (!/^[a-f0-9]{40}$/i.test(String(metadata.sourceCommit ?? ""))) throw new Error("sourceCommit is missing or malformed");

  const gltf = parseGlb(bytes);
  const extensions = new Set(gltf.extensionsUsed ?? []);
  for (const extension of REQUIRED_EXTENSIONS) {
    if (!extensions.has(extension)) throw new Error("served GLB is missing " + extension);
    if (!(metadata.geometry?.extensionsUsed ?? []).includes(extension)) throw new Error("metadata does not certify " + extension);
  }

  const interactionIds = new Set((gltf.nodes ?? [])
    .map((node) => node.extras?.interactionId)
    .filter((id) => typeof id === "string"));
  const missing = REQUIRED_INTERACTIONS.filter((id) => !interactionIds.has(id));
  if (missing.length) throw new Error("served GLB is missing interaction IDs: " + missing.join(", "));

  // The Blender exporter keeps SDT_* frame names; extras.interactionId is the
  // stable slot contract consumed by normalizeCampingModel at runtime.
  const slotContracts = new Set((gltf.nodes ?? []).flatMap((node) => [
    node.name,
    node.extras?.interactionId,
  ]).filter((value) => typeof value === "string" && /^studio\.artist-slot-\d{3}$/.test(value)));
  const requiredSlots = Array.from({ length: 17 }, (_, index) => "studio.artist-slot-" + String(index + 1).padStart(3, "0"));
  const missingSlots = requiredSlots.filter((name) => !slotContracts.has(name));
  if (missingSlots.length) throw new Error("served GLB is missing artist slot contracts: " + missingSlots.join(", "));
  if (slotContracts.has("studio.artist-slot-018")) throw new Error("unexpected artist slot 018 is present");

  const findPhaseNode = (elementId, namePattern) =>
    (gltf.nodes ?? []).find(node => node.extras?.elementId === elementId && node.extras?.surfacePhase === 7) ??
    (gltf.nodes ?? []).find(node => namePattern.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
  const floorNode = findPhaseNode("floor.wood", /floor_wood_hero/i);
  const vinylNode = findPhaseNode("floor.vinyl_sweep", /vinyl_sweep_hero/i);
  const bambooNode = findPhaseNode("arch.vault_ceiling", /vault_ceiling/i);
  const paperWallNode = (gltf.nodes ?? []).find(node => /paper_cyclorama_wall/i.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
  const paperCurveNode = (gltf.nodes ?? []).find(node => /paper_cyclorama_curve/i.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
  if (!floorNode || !Number.isInteger(floorNode.extras?.phase7BoardCount) || floorNode.extras.phase7BoardCount < 100) {
    throw new Error("served GLB is not the Phase 07 real-plank floor");
  }
  const floorPrimitives = gltf.meshes?.[floorNode.mesh]?.primitives ?? [];
  if (!floorPrimitives.length || !floorPrimitives.every(primitive =>
    primitive.attributes?.COLOR_0 !== undefined && primitive.attributes?.TEXCOORD_0 !== undefined && primitive.attributes?.TEXCOORD_1 !== undefined)) {
    throw new Error("served Phase 07 floor lost per-plank COLOR_0 or UV0/UV1");
  }
  if (!vinylNode || Math.abs(Number(vinylNode.extras?.phase7VinylRadiusM) - 2.3) > 0.003 ||
      Math.abs(Number(vinylNode.extras?.phase7VinylThicknessM) - 0.0012) > 0.0001 ||
      Math.abs(Number(vinylNode.extras?.phase7VinylEdgeLiftM) - 0.004) > 0.0001) {
    throw new Error("served GLB has incorrect/missing Phase 07 vinyl geometry");
  }
  if (!bambooNode || Math.abs(Number(bambooNode.extras?.phase7BambooTileMeters) - 1.2) > 0.0001) {
    throw new Error("served GLB is missing 1.2 m bamboo weave tiling");
  }
  if (!paperWallNode || !paperCurveNode ||
      Math.abs(Number(paperCurveNode.extras?.phase7CycloramaRadiusM) - 0.35) > 0.0001 ||
      paperCurveNode.extras?.phase7PaperContinuousToFloor !== true) {
    throw new Error("served GLB is missing the seamless Phase 07 paper cyclorama");
  }
  const surfaces = metadata.geometry?.heroSurfaces;
  if (metadata.surfacePhase !== 7 ||
      surfaces?.floorBoards !== floorNode.extras?.phase7BoardCount ||
      surfaces?.floorHasColor0 !== true || surfaces?.floorHasUv0Uv1 !== true ||
      Math.abs(Number(surfaces?.vinylRadiusM) - 2.3) > 0.003 ||
      Math.abs(Number(surfaces?.bambooTileMeters) - 1.2) > 0.0001 ||
      Math.abs(Number(surfaces?.cycloramaRadiusM) - 0.35) > 0.0001) {
    throw new Error("served model manifest does not certify the Phase 07 hero surfaces");
  }

  const materials = gltf.materials ?? [];
  const materialNames = new Set(materials.map((material) => material.name).filter(Boolean));
  const missingPhase08Materials = REQUIRED_PHASE08_MATERIALS.filter((name) => !materialNames.has(name));
  if (missingPhase08Materials.length) throw new Error("served GLB is missing Phase 08 assigned materials: " + missingPhase08Materials.join(", "));
  const productionScreen = (gltf.nodes ?? []).find(node => node.name === "SDT_production_monitor_daw_screen" && Number.isInteger(node.mesh));
  if (!productionScreen) throw new Error("served GLB is missing the live monitor DAW screen mesh");
  const productionZone = metadata.geometry?.productionZone;
  if (metadata.phase !== EXPECTED_MODEL_PHASE || metadata.productionPhase !== EXPECTED_MODEL_PHASE ||
      productionZone?.sourceStatus !== "source-validated" ||
      productionZone?.requiredElements !== 19 ||
      productionZone?.chairUpholsteryTrianglesSource < 14000 ||
      productionZone?.chairUpholsteryTrianglesSource > 18000 ||
      productionZone?.midiWhiteKeys !== 36 || productionZone?.midiBlackKeys !== 25 ||
      productionZone?.acousticFabricPanels !== 3 || productionZone?.acousticFoamTiles !== 30 ||
      productionZone?.pendants !== 4 || productionZone?.edisonBulbs !== 4 ||
      !(productionZone?.trianglesAddedFromPhase7 > 0)) {
    throw new Error("served model metadata does not certify the complete Phase 08 production zone");
  }

  let photoZone = null;
  if (EXPECTED_MODEL_PHASE >= 9) {
    const photoIds = ["photo.roller_backdrop", "photo.backdrop_seal", "photo.rack", "photo.garments",
      "photo.softbox_octa", "photo.led_panel_1", "photo.light_grid", "photo.led_panel_barn_doors", "photo.rack_wheels"];
    for (const id of photoIds) {
      if (!(gltf.nodes ?? []).some(node => node.extras?.elementId === id)) throw new Error("served GLB is missing Phase 09 element " + id);
    }
    const missingPhotoMaterials = REQUIRED_PHASE09_MATERIALS.filter(name => !materialNames.has(name));
    if (missingPhotoMaterials.length) throw new Error("served GLB is missing Phase 09 materials: " + missingPhotoMaterials.join(", "));
    const garments = (gltf.nodes ?? []).filter(node => /^SDT_photo_garments_garment_\d+$/.test(String(node.name ?? "")) && Number.isInteger(node.mesh));
    if (garments.length !== 5) throw new Error("served GLB must contain five Phase 09 garment meshes, found " + garments.length);
    photoZone = metadata.geometry?.photoZone;
    if (photoZone?.sourceStatus !== "source-validated" ||
        photoZone?.requiredElements !== 9 || photoZone?.taggedPhotoObjects !== 9 ||
        photoZone?.garments !== 5 || photoZone?.sealDiameterM !== 2.2 ||
        photoZone?.rackWidthM !== 1.6 ||
        JSON.stringify(photoZone?.garmentTypes) !== JSON.stringify(["tee-seal", "tee-seal", "tee-xoyens", "hoodie", "hoodie-grey-sleeve"]) ||
        REQUIRED_PHASE09_MATERIALS.some(name => !(photoZone.requiredMaterialsLinked ?? []).includes(name)) ||
        !["studio.photo-backdrop", "studio.merch-rack"].every(id => photoZone.requiredInteractionsPreserved?.includes(id))) {
      throw new Error("served model metadata does not certify all Phase 09 geometry, garments, materials and interactions");
    }
  }

  const primitives = (gltf.meshes ?? []).reduce((sum, mesh) => sum + (mesh.primitives ?? []).length, 0);
  const actual = {
    meshes: (gltf.meshes ?? []).length,
    primitives,
    triangles: countTriangles(gltf),
    materials: materials.length,
    embeddedImages: (gltf.images ?? []).length,
  };
  for (const [key, count] of Object.entries(actual)) {
    if (metadata.geometry?.[key] !== count) throw new Error("metadata geometry." + key + " does not match the live GLB");
  }

  return {
    url: modelUrl.href,
    bytes: bytes.length,
    sha256,
    version: metadata.version,
    phase: metadata.phase,
    surfacePhase: metadata.surfacePhase,
    productionPhase: metadata.productionPhase,
    heroSurfaces: surfaces,
    productionZone,
    sourceCommit: metadata.sourceCommit,
    ...actual,
    artistSlots: 17,
    extensions: REQUIRED_EXTENSIONS,
  };
}

let lastError = "production metadata is not certified V3 yet";
while (Date.now() < deadline) {
  try {
    const metadataUrl = new URL(METADATA_PATH, BASE_URL);
    // Avoid reusing a CDN/browser-cached manifest while checking a new deployment.
    metadataUrl.searchParams.set("_sdt_verify", String(Date.now()));
    const response = await fetch(metadataUrl, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" },
    });
    if (!response.ok) throw new Error("metadata returned HTTP " + response.status);
    const metadata = await response.json();

    // Do not request the model URL while the public manifest still declares a
    // legacy phase. This avoids treating the old GLB as a valid candidate.
    if (metadata.version !== 3 || metadata.phase !== EXPECTED_MODEL_PHASE || metadata.productionPhase !== EXPECTED_MODEL_PHASE ||
        metadata.surfacePhase !== 7 || metadata.status !== "blender-v3-published") {
      lastError = "public metadata is not certified for expected phase " + EXPECTED_MODEL_PHASE + ": version=" + metadata.version + ", phase=" + metadata.phase +
        ", productionPhase=" + metadata.productionPhase + ", surfacePhase=" + metadata.surfacePhase + ", status=" + metadata.status;
    } else {
      const result = await verifyPublishedAsset(metadata);
      console.log("CAMPING PRODUCTION MODEL CERTIFIED", JSON.stringify(result, null, 2));
      process.exit(0);
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
  console.log("[CAMPING production verification] waiting for certified deployment: " + lastError);
  await wait(pollMs);
}

console.error("CAMPING PRODUCTION MODEL VERIFICATION FAILED after " + timeoutMs + " ms: " + lastError);
process.exit(1);
