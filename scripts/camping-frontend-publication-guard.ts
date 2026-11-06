import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const MODEL_PATH = "public/models/camping/xoyens-studio.glb";
const METADATA_PATH = "public/models/camping/xoyens-studio.model.json";
const MAX_BYTES = 16 * 1024 * 1024;
const REQUIRED_EXTENSIONS = ["KHR_texture_basisu", "EXT_meshopt_compression"];
type Primitive = { attributes?: Record<string, number>; indices?: number; mode?: number };
type Node = { name?: string; mesh?: number; extras?: Record<string, unknown> };
type Glb = {
  asset?: { version?: string }; accessors?: Array<{ count?: number }>;
  meshes?: Array<{ primitives?: Primitive[] }>; nodes?: Node[];
  materials?: Array<{ name?: string; normalTexture?: unknown }>;
  images?: Array<{ mimeType?: string; bufferView?: number }>;
  textures?: Array<{ extensions?: Record<string, { source?: number }> }>;
  bufferViews?: Array<{ target?: number; extensions?: Record<string, unknown> }>;
  buffers?: Array<{ byteLength?: number; extensions?: Record<string, { fallback?: boolean }> }>;
  extensionsUsed?: string[]; extensionsRequired?: string[];
};

function readGlb(bytes: Buffer): Glb {
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error("canonical asset is not a valid GLB v2 file");
  }
  let offset = 12;
  let json: Glb | null = null;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + length > bytes.length) throw new Error("GLB chunk exceeds file length");
    if (type === 0x4e4f534a) json = JSON.parse(bytes.subarray(start, start + length).toString("utf8").replace(/\0+$/g, "").trim()) as Glb;
    offset = start + length;
  }
  if (offset !== bytes.length || json?.asset?.version !== "2.0") throw new Error("malformed GLB or missing glTF 2.0 JSON");
  return json;
}

function geometryCounts(gltf: Glb) {
  let primitives = 0, triangles = 0;
  for (const mesh of gltf.meshes ?? []) for (const primitive of mesh.primitives ?? []) {
    primitives += 1;
    const index = primitive.indices ?? primitive.attributes?.POSITION;
    const count = gltf.accessors?.[Number(index)]?.count ?? 0;
    const mode = primitive.mode ?? 4;
    triangles += mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
  }
  return { meshes: gltf.meshes?.length ?? 0, primitives, triangles, materials: gltf.materials?.length ?? 0, embeddedImages: gltf.images?.length ?? 0 };
}

export function verifyCampingFrontendPublication(root = process.cwd()): void {
  const modelPath = resolve(root, MODEL_PATH), metadataPath = resolve(root, METADATA_PATH);
  if (!existsSync(modelPath) || !existsSync(metadataPath)) throw new Error("missing canonical studio model or metadata");
  const bytes = readFileSync(modelPath), metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  if (bytes.length > MAX_BYTES) throw new Error("reference studio GLB exceeds the 16 MiB web transfer budget");
  if (metadata.version !== 3 || metadata.phase !== 9 || metadata.productionPhase !== 9 || metadata.surfacePhase !== 7 ||
      metadata.status !== "blender-v3-published" || metadata.assetType !== "single-room-reference-studio" ||
      metadata.model !== "/models/camping/xoyens-studio.glb") throw new Error("studio metadata is stale or does not describe the single-room reference model");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (metadata.geometry?.sha256 !== sha256 || metadata.frontendDelivery?.sha256 !== sha256 ||
      metadata.geometry?.bytes !== bytes.length || metadata.frontendDelivery?.bytes !== bytes.length ||
      metadata.frontendDelivery?.canonicalUrl !== metadata.model || metadata.frontendDelivery?.hashAlgorithm !== "SHA-256" ||
      !/^[a-f0-9]{40}$/i.test(String(metadata.sourceCommit ?? ""))) throw new Error("studio GLB digest, byte count or source commit does not match metadata");
  const gltf = readGlb(bytes), used = new Set(gltf.extensionsUsed ?? []), required = new Set(gltf.extensionsRequired ?? []);
  for (const ext of REQUIRED_EXTENSIONS) {
    if (!used.has(ext) || !required.has(ext) || !(metadata.geometry?.extensionsUsed ?? []).includes(ext)) throw new Error("optimized studio GLB is missing required " + ext);
  }
  const images = gltf.images ?? [];
  if (!images.length || images.some((image) => image.mimeType !== "image/ktx2" || !Number.isInteger(image.bufferView))) throw new Error("studio textures must be embedded KTX2 Basis textures");
  if ((gltf.textures ?? []).some((texture) => !Number.isInteger(texture.extensions?.KHR_texture_basisu?.source))) throw new Error("a studio texture is missing its KHR_texture_basisu source");
  const compressedViews = (gltf.bufferViews ?? []).filter((view) => view.target === 34962 || view.target === 34963);
  if (!compressedViews.length || compressedViews.some((view) => !view.extensions?.EXT_meshopt_compression)) throw new Error("studio vertex/index buffers are not all meshopt compressed");
  if (!gltf.buffers?.some((buffer) => buffer.extensions?.EXT_meshopt_compression?.fallback === true && !buffer.uri)) throw new Error("meshopt placeholder buffer is missing");

  const nodes = gltf.nodes ?? [], meshNode = (name: string) => nodes.some((node) => node.name === name && Number.isInteger(node.mesh));
  for (const name of ["SDT_shell_wall_entry", "SDT_shell_wall_rear", "SDT_shell_wall_left", "SDT_shell_wall_right", "SDT_shell_ceiling_flat", "SDT_shell_door_main", "studio.parquet", "studio.imac-screen"]) {
    if (!meshNode(name)) throw new Error("reference studio is missing real mesh " + name);
  }
  const interactions = new Set(nodes.map((node) => node.extras?.interactionId).filter((id): id is string => typeof id === "string"));
  for (const id of ["studio.imac", "studio.merch-rack", "studio.photo-backdrop", "studio.production-desk", "studio.chair", "studio.light-switch", "studio.red-switch"]) {
    if (!interactions.has(id)) throw new Error("studio is missing clickable interaction " + id);
  }
  if (!(gltf.materials ?? []).some((material) => /cotton.*jersey|jersey.*cotton/i.test(material.name ?? "") && material.normalTexture)) throw new Error("real cotton jersey material is missing its normal map");
  if (metadata.designConstraints?.oneRoom !== true || metadata.designConstraints?.ceiling !== "flat horizontal wood ceiling") throw new Error("reference constraints for the single room and flat ceiling are missing");
  const actual = geometryCounts(gltf);
  for (const [key, value] of Object.entries(actual)) if (metadata.geometry?.[key] !== value) throw new Error(`metadata geometry.${key} mismatch: expected ${value}, found ${metadata.geometry?.[key]}`);
  console.info("[CAMPING publication gate] verified single-room studio", JSON.stringify({ url: metadata.model, bytes: statSync(modelPath).size, sha256, ...actual, compressedViews: compressedViews.length, ktx2Textures: images.length }));
}

export function campingFrontendPublicationGuard(): Plugin {
  return { name: "camping-frontend-publication-guard", apply: "build", buildStart() {
    try { verifyCampingFrontendPublication(); }
    catch (error) { this.error("[CAMPING publication gate] refusing to build an invalid studio scene. " + (error instanceof Error ? error.message : String(error))); }
  } };
}
