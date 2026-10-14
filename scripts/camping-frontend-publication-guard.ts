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
  if (metadata.version !== 3 || metadata.phase !== 6 || metadata.status !== "blender-v3-published") {
    throw new Error("metadata is stale: expected version=3, phase=6, status=blender-v3-published");
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
    ]).filter((value: unknown): value is string => typeof value === "string" && /^studio\\.artist-slot-\\d{3}$/.test(value)),
  );
  const requiredSlots = Array.from({ length: 17 }, (_, index) => "studio.artist-slot-" + String(index + 1).padStart(3, "0"));
  const missingSlots = requiredSlots.filter((name) => !slotContracts.has(name));
  if (missingSlots.length) throw new Error("optimized GLB is missing artist slot contracts: " + missingSlots.join(", "));
  if (slotContracts.has("studio.artist-slot-018")) throw new Error("unexpected artist slot 018 is present");

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
