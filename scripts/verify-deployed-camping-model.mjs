#!/usr/bin/env node
import { createHash } from "node:crypto";

const BASE_URL = process.env.CAMPING_PRODUCTION_URL || "https://syndicate-drop-zone.vercel.app";
const MODEL_PATH = "/models/camping/xoyens-studio.glb";
const METADATA_PATH = "/models/camping/xoyens-studio.model.json";
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

async function verifyPublishedAsset(metadata) {
  const modelUrl = new URL(MODEL_PATH, BASE_URL);
  const response = await fetch(modelUrl, { cache: "no-store" });
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

  const nodeNames = new Set((gltf.nodes ?? []).map((node) => node.name).filter((name) => typeof name === "string"));
  const requiredSlots = Array.from({ length: 17 }, (_, index) => "studio.artist-slot-" + String(index + 1).padStart(3, "0"));
  const missingSlots = requiredSlots.filter((name) => !nodeNames.has(name));
  if (missingSlots.length) throw new Error("served GLB is missing artist slot nodes: " + missingSlots.join(", "));
  if (nodeNames.has("studio.artist-slot-018")) throw new Error("unexpected artist slot 018 is present");

  const primitives = (gltf.meshes ?? []).reduce((sum, mesh) => sum + (mesh.primitives ?? []).length, 0);
  const actual = {
    meshes: (gltf.meshes ?? []).length,
    primitives,
    materials: (gltf.materials ?? []).length,
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
    const response = await fetch(metadataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("metadata returned HTTP " + response.status);
    const metadata = await response.json();

    // Do not request the model URL while the public manifest still declares a
    // legacy phase. This avoids treating the old GLB as a valid candidate.
    if (metadata.version !== 3 || metadata.phase !== 6 || metadata.status !== "blender-v3-published") {
      lastError = "public metadata still declares version=" + metadata.version + ", phase=" + metadata.phase + ", status=" + metadata.status;
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
