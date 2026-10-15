import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const MODEL_PATH = "public/models/camping/xoyens-studio.glb";
const METADATA_PATH = "public/models/camping/xoyens-studio.model.json";
const MAX_BYTES = 16 * 1024 * 1024;
const REQUIRED_EXTENSIONS = ["KHR_texture_basisu", "EXT_meshopt_compression"];
const REQUIRED_INTERACTIONS = [
  "studio.imac",
  "studio.artists-wall",
  "studio.merch-rack",
  "studio.photo-backdrop",
  "studio.production-desk",
  "studio.audio-system",
  "studio.inner-door",
];

function readGlb(bytes: Buffer): Record<string, any> {
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "glTF") {
    throw new Error("canonical asset is not a binary glTF file");
  }
  if (bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error("canonical GLB version or total byte length is invalid");
  }

  let offset = 12;
  let json: Record<string, any> | null = null;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + length > bytes.length) throw new Error("GLB chunk exceeds file length");
    if (type === 0x4e4f534a) {
      json = JSON.parse(bytes.subarray(start, start + length).toString("utf8").replace(/\0+$/g, "").trim());
    }
    offset = start + length;
  }
  if (offset !== bytes.length || !json || json.asset?.version !== "2.0") {
    throw new Error("GLB has a malformed container or no glTF 2.0 JSON chunk");
  }
  return json;
}

function countPrimitives(gltf: Record<string, any>): number {
  return (gltf.meshes ?? []).reduce(
    (sum: number, mesh: { primitives?: unknown[] }) => sum + (mesh.primitives?.length ?? 0),
    0,
  );
}

function countTriangles(gltf: Record<string, any>): number {
  let total = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
      const accessor = gltf.accessors?.[accessorIndex];
      if (!accessor) continue;
      const count = accessor.count ?? 0;
      const mode = primitive.mode ?? 4;
      total += mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
    }
  }
  return total;
}

export function verifyCampingFrontendPublication(root = process.cwd()): void {
  const modelPath = resolve(root, MODEL_PATH);
  const metadataPath = resolve(root, METADATA_PATH);
  if (!existsSync(modelPath)) throw new Error("missing canonical frontend GLB: " + MODEL_PATH);
  if (!existsSync(metadataPath)) throw new Error("missing canonical model metadata: " + METADATA_PATH);

  const bytes = readFileSync(modelPath);
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  if (bytes.length > MAX_BYTES) throw new Error("frontend GLB exceeds the 16 MiB transfer budget");
  if (metadata.version !== 3 || !Number.isInteger(metadata.phase) || metadata.phase < 8 || metadata.phase > 22 ||
      metadata.productionPhase !== metadata.phase || metadata.surfacePhase !== 7 || metadata.status !== "blender-v3-published") {
    throw new Error("metadata is stale: expected version=3, phase=8..22, productionPhase=phase, surfacePhase=7, status=blender-v3-published");
  }
  if (metadata.model !== "/models/camping/xoyens-studio.glb") {
    throw new Error("metadata does not point to the canonical /camping asset URL");
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (metadata.geometry?.sha256 !== sha256 || metadata.frontendDelivery?.sha256 !== sha256) {
    throw new Error("GLB SHA-256 differs from certified geometry/frontendDelivery metadata");
  }
  if (metadata.geometry?.bytes !== bytes.length || metadata.frontendDelivery?.bytes !== bytes.length) {
    throw new Error("GLB byte count differs from certified metadata");
  }
  if (metadata.frontendDelivery?.canonicalUrl !== metadata.model || metadata.frontendDelivery?.hashAlgorithm !== "SHA-256") {
    throw new Error("frontend delivery metadata is incomplete or points to a different URL");
  }
  if (!/^[a-f0-9]{40}$/i.test(String(metadata.sourceCommit ?? ""))) {
    throw new Error("metadata is missing the source commit that produced the model");
  }

  const gltf = readGlb(bytes);
  const extensions = new Set<string>(gltf.extensionsUsed ?? []);
  for (const extension of REQUIRED_EXTENSIONS) {
    if (!extensions.has(extension)) throw new Error("optimized GLB is missing required extension " + extension);
    if (!(metadata.geometry?.extensionsUsed ?? []).includes(extension)) {
      throw new Error("metadata does not record required extension " + extension);
    }
  }

  const nodes = gltf.nodes ?? [];
  const materialNames = new Set<string>((gltf.materials ?? []).map((material: { name?: unknown }) => material.name)
    .filter((name: unknown): name is string => typeof name === "string"));
  for (const materialName of ["ceramic_red", "glass_mirror", "led_warm_emissive"]) {
    if (!materialNames.has(materialName)) throw new Error("optimized GLB is missing Phase 08 material " + materialName);
  }
  if (!nodes.some((node: { name?: unknown; mesh?: unknown }) =>
    node.name === "SDT_production_monitor_daw_screen" && Number.isInteger(node.mesh))) {
    throw new Error("optimized GLB is missing the Phase 08 live DAW screen mesh");
  }
  const interactions = new Set<string>(
    nodes.map((node: { extras?: { interactionId?: unknown } }) => node.extras?.interactionId)
      .filter((id: unknown): id is string => typeof id === "string"),
  );
  const missing = REQUIRED_INTERACTIONS.filter((id) => !interactions.has(id));
  if (missing.length) throw new Error("optimized GLB is missing required interaction IDs: " + missing.join(", "));

  // Blender exports slot frame meshes under SDT_* names and stores each
  // stable studio.artist-slot-NNN ID in extras.interactionId. The runtime maps
  // these IDs to node names before portrait mounting.
  const slotContracts = new Set<string>(
    nodes.flatMap((node: { name?: unknown; extras?: { interactionId?: unknown } }) => [
      node.name,
      node.extras?.interactionId,
    ]).filter((value: unknown): value is string => typeof value === "string" && /^studio\.artist-slot-\d{3}$/.test(value)),
  );
  const requiredSlots = Array.from({ length: 17 }, (_, index) => "studio.artist-slot-" + String(index + 1).padStart(3, "0"));
  const missingSlots = requiredSlots.filter((name) => !slotContracts.has(name));
  if (missingSlots.length) throw new Error("optimized GLB is missing artist slot contracts: " + missingSlots.join(", "));
  if (slotContracts.has("studio.artist-slot-018")) throw new Error("unexpected artist slot 018 is present");

  const productionZone = metadata.geometry?.productionZone;
  if (metadata.productionPhase < 8 ||
      productionZone?.sourceStatus !== "source-validated" ||
      productionZone?.requiredElements !== 19 ||
      productionZone?.chairUpholsteryTrianglesSource < 14000 ||
      productionZone?.chairUpholsteryTrianglesSource > 18000 ||
      productionZone?.midiWhiteKeys !== 36 || productionZone?.midiBlackKeys !== 25 ||
      productionZone?.acousticFabricPanels !== 3 || productionZone?.acousticFoamTiles !== 30 ||
      productionZone?.pendants !== 4 || productionZone?.edisonBulbs !== 4 ||
      !(productionZone?.trianglesAddedFromPhase7 > 0)) {
    throw new Error("metadata does not certify Phase 08 production geometry");
  }

  if (metadata.phase >= 9) {
    const photoZone = metadata.geometry?.photoZone;
    if (photoZone?.sourceStatus !== "source-validated" ||
        photoZone?.requiredElements !== 9 || photoZone?.taggedPhotoObjects !== 9 ||
        photoZone?.garments !== 5 || photoZone?.sealDiameterM !== 2.2 ||
        photoZone?.rackWidthM !== 1.6 ||
        !Array.isArray(photoZone?.requiredMaterialsLinked)) {
      throw new Error("metadata does not certify Phase 09 photography geometry");
    }
    const requiredPhotoIds = [
      "photo.roller_backdrop", "photo.backdrop_seal", "photo.rack", "photo.garments",
      "photo.softbox_octa", "photo.led_panel_1", "photo.light_grid",
      "photo.led_panel_barn_doors", "photo.rack_wheels",
    ];
    for (const id of requiredPhotoIds) {
      if (!nodes.some((node: { extras?: Record<string, unknown> }) => node.extras?.elementId === id)) {
        throw new Error("optimized GLB is missing Phase 09 element " + id);
      }
    }
    for (const materialName of ["print_official_seal", "print_official_xoyens", "led_panel_emissive", "led_warm_emissive"]) {
      if (!materialNames.has(materialName)) throw new Error("optimized GLB is missing Phase 09 material " + materialName);
    }
    const garmentNodes = nodes.filter((node: { name?: unknown; mesh?: unknown }) =>
      /^SDT_photo_garments_garment_\\d+$/.test(String(node.name ?? "")) && Number.isInteger(node.mesh));
    if (garmentNodes.length !== 5) {
      throw new Error("optimized GLB must contain exactly five Phase 09 garment meshes, found " + garmentNodes.length);
    }
    for (const id of ["studio.photo-backdrop", "studio.merch-rack"]) {
      if (!photoZone.requiredInteractionsPreserved?.includes(id)) {
        throw new Error("Phase 09 metadata does not certify preserved interaction " + id);
      }
    }
  }

  const findPhaseNode = (elementId: string, namePattern: RegExp) =>
    nodes.find((node: { name?: unknown; mesh?: unknown; extras?: Record<string, unknown> }) =>
      node.extras?.elementId === elementId && node.extras?.surfacePhase === 7) ??
    nodes.find((node: { name?: unknown; mesh?: unknown; extras?: Record<string, unknown> }) =>
      namePattern.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
  const floorNode = findPhaseNode("floor.wood", /floor_wood_hero/i);
  const vinylNode = findPhaseNode("floor.vinyl_sweep", /vinyl_sweep_hero/i);
  const bambooNode = findPhaseNode("arch.vault_ceiling", /vault_ceiling/i);
  const paperWallNode = nodes.find((node: { name?: unknown; extras?: Record<string, unknown> }) =>
    /paper_cyclorama_wall/i.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
  const paperCurveNode = nodes.find((node: { name?: unknown; extras?: Record<string, unknown> }) =>
    /paper_cyclorama_curve/i.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
  if (!floorNode || !Number.isInteger(floorNode.extras?.phase7BoardCount) ||
      Number(floorNode.extras?.phase7BoardCount) < 100) {
    throw new Error("optimized GLB is missing 100+ real walnut boards from Phase 07");
  }
  const floorPrimitives = gltf.meshes?.[Number(floorNode.mesh)]?.primitives ?? [];
  if (!floorPrimitives.length || !floorPrimitives.every((primitive: { attributes?: Record<string, unknown> }) =>
    primitive.attributes?.COLOR_0 !== undefined &&
    primitive.attributes?.TEXCOORD_0 !== undefined &&
    primitive.attributes?.TEXCOORD_1 !== undefined)) {
    throw new Error("Phase 07 floor has lost per-plank COLOR_0, UV0 or UV1");
  }
  if (!vinylNode ||
      Math.abs(Number(vinylNode.extras?.phase7VinylRadiusM) - 2.3) > 0.003 ||
      Math.abs(Number(vinylNode.extras?.phase7VinylThicknessM) - 0.0012) > 0.0001 ||
      Math.abs(Number(vinylNode.extras?.phase7VinylEdgeLiftM) - 0.004) > 0.0001) {
    throw new Error("Phase 07 circular vinyl dimensions/rim contract is missing");
  }
  if (!bambooNode || Math.abs(Number(bambooNode.extras?.phase7BambooTileMeters) - 1.2) > 0.0001) {
    throw new Error("Phase 07 bamboo tiling metadata is missing");
  }
  if (!paperWallNode || !paperCurveNode ||
      Math.abs(Number(paperCurveNode.extras?.phase7CycloramaRadiusM) - 0.35) > 0.0001 ||
      paperCurveNode.extras?.phase7PaperContinuousToFloor !== true) {
    throw new Error("Phase 07 black-paper cyclorama contract is missing");
  }
  const surfaces = metadata.geometry?.heroSurfaces;
  if (metadata.surfacePhase !== 7 ||
      surfaces?.floorBoards !== floorNode.extras?.phase7BoardCount ||
      surfaces?.floorHasColor0 !== true ||
      surfaces?.floorHasUv0Uv1 !== true ||
      Math.abs(Number(surfaces?.vinylRadiusM) - 2.3) > 0.003 ||
      Math.abs(Number(surfaces?.bambooTileMeters) - 1.2) > 0.0001 ||
      Math.abs(Number(surfaces?.cycloramaRadiusM) - 0.35) > 0.0001) {
    throw new Error("Phase 07 manifest metrics do not match the optimized hero surfaces");
  }

  const actual = {
    meshes: (gltf.meshes ?? []).length,
    primitives: countPrimitives(gltf),
    triangles: countTriangles(gltf),
    materials: (gltf.materials ?? []).length,
    embeddedImages: (gltf.images ?? []).length,
  };
  for (const [key, value] of Object.entries(actual)) {
    if (metadata.geometry?.[key] !== value) {
      throw new Error("metadata geometry." + key + " mismatch: expected " + value + ", found " + metadata.geometry?.[key]);
    }
  }

  console.info(
    "[CAMPING publication gate] certified V3 GLB",
    JSON.stringify({
      url: metadata.model,
      bytes: statSync(modelPath).size,
      sha256,
      meshes: actual.meshes,
      primitives: actual.primitives,
      triangles: actual.triangles,
      materials: actual.materials,
      artistSlots: 17,
      phase: metadata.phase,
      productionPhase: metadata.productionPhase,
      surfacePhase: 7,
      heroSurfaces: metadata.geometry.heroSurfaces,
      productionZone,
      extensions: [...extensions].filter((extension) => REQUIRED_EXTENSIONS.includes(extension)),
    }),
  );
}

export function campingFrontendPublicationGuard(): Plugin {
  return {
    name: "camping-frontend-publication-guard",
    apply: "build",
    buildStart() {
      try {
        verifyCampingFrontendPublication();
      } catch (error) {
        this.error(
          "[CAMPING publication gate] refusing to build frontend with an old, incomplete or uncertified public GLB. " +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    },
  };
}
