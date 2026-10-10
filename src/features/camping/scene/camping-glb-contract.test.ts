import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStudioGlb() {
  const path = fileURLToPath(new URL("../../../../public/models/camping/xoyens-studio.glb", import.meta.url));
  const buffer = readFileSync(path);

  if (buffer.toString("ascii", 0, 4) !== "glTF") {
    throw new Error("CAMPING studio asset is not a binary glTF file.");
  }
  if (buffer.readUInt32LE(4) !== 2) {
    throw new Error("CAMPING studio asset must use glTF 2.0.");
  }

  const jsonChunkLength = buffer.readUInt32LE(12);
  const jsonChunkType = buffer.readUInt32LE(16);
  if (jsonChunkType !== 0x4e4f534a) {
    throw new Error("CAMPING studio GLB is missing its JSON chunk.");
  }

  const jsonChunk = buffer.subarray(20, 20 + jsonChunkLength).toString("utf8").replace(/\0+\s*$/, "").trim();
  return { buffer, gltf: JSON.parse(jsonChunk) as {
    asset?: { version?: string };
    nodes?: Array<{ name?: string; mesh?: number }>;
    meshes?: Array<{ primitives?: unknown[] }>;
    materials?: Array<{ name?: string }>;
  } };
}

describe("CAMPING real GLB composition contract", () => {
  it("ships a valid glTF 2.0 binary with the architectural elements required by the reference", () => {
    const { buffer, gltf } = readStudioGlb();
    const nodeNames = new Set((gltf.nodes ?? []).map((node) => node.name).filter(Boolean));

    expect(gltf.asset?.version).toBe("2.0");
    expect(buffer.length).toBeGreaterThan(1_000_000);
    expect(nodeNames.has("studio.floor")).toBe(true);
    expect(nodeNames.has("studio.vaulted-timber-ceiling")).toBe(true);
    expect(nodeNames.has("studio.ceiling-arches")).toBe(true);
    expect(nodeNames.has("studio.parquet")).toBe(true);
    expect(nodeNames.has("studio.production-desk")).toBe(true);
    expect(nodeNames.has("studio.photo-backdrop")).toBe(true);
  });

  it("contains all 17 physical artist portrait frames in the model before any interaction", () => {
    const { gltf } = readStudioGlb();
    const nodeNames = new Set((gltf.nodes ?? []).map((node) => node.name).filter(Boolean));
    const slots = Array.from({ length: 17 }, (_, index) =>
      "studio.artist-slot-" + String(index + 1).padStart(3, "0"),
    );

    expect(slots.every((name) => nodeNames.has(name))).toBe(true);
    expect(new Set(slots).size).toBe(17);
  });

  it("contains physical geometry and PBR material families for the actual studio set", () => {
    const { gltf } = readStudioGlb();
    const meshes = gltf.meshes ?? [];
    const materialNames = new Set((gltf.materials ?? []).map((material) => material.name?.toLowerCase()));

    expect(meshes.length).toBeGreaterThanOrEqual(100);
    expect(meshes.reduce((total, mesh) => total + (mesh.primitives?.length ?? 0), 0)).toBeGreaterThanOrEqual(140);
    for (const name of ["wood", "floor", "plaster", "fabric", "leather", "metal"]) {
      expect(materialNames.has(name), "missing source material: " + name).toBe(true);
    }
  });
});
