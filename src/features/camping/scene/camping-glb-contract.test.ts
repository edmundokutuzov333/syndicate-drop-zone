import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applyCampingReferenceComposition,
  CAMPING_REFERENCE_COMPOSITION,
} from "./camping-reference-composition";

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

describe("CAMPING reference composition corrections", () => {
  function makeScene() {
    const root = new THREE.Group();
    const names = [
      "studio.vaulted-timber-ceiling",
      "studio.ceiling-arches",
      "studio.ceiling-cross-beams",
      "studio.parquet",
      "studio.photo-floor",
      "studio.photo-backdrop",
      "studio.left-wall",
      "studio.right-wall",
      "studio.back-wall",
      "studio.rack-uprights",
      "studio.rack-feet",
      "studio.rack-rail",
      "studio.hangers",
      "studio.hanger-hooks",
      "studio.garments",
      "studio.clothing-rack",
    ];
    for (const name of names) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ name: name.includes("wall") ? "plaster" : "test-material" }),
      );
      mesh.name = name;
      root.add(mesh);
    }
    return root;
  }

  it("removes the flat ceiling slab, exposes the vaulted underside and seats the parquet", () => {
    const root = makeScene();
    const report = applyCampingReferenceComposition(root);

    expect(report.applied).toBe(true);
    expect(root.getObjectByName("studio.ceiling-cross-beams")?.visible).toBe(false);
    expect((root.getObjectByName("studio.vaulted-timber-ceiling") as THREE.Mesh).material).toMatchObject({
      side: THREE.DoubleSide,
    });
    expect((root.getObjectByName("studio.ceiling-arches") as THREE.Mesh).material).toMatchObject({
      side: THREE.DoubleSide,
    });
    const parquet = root.getObjectByName("studio.parquet")!;
    expect(parquet.scale.y).toBeCloseTo(CAMPING_REFERENCE_COMPOSITION.parquetScaleY);
    expect(parquet.position.y).toBeCloseTo(CAMPING_REFERENCE_COMPOSITION.parquetOffsetY);
  });

  it("makes the photography surface matte black and shifts the rack away from the seal centre", () => {
    const root = makeScene();
    applyCampingReferenceComposition(root);

    const photoFloor = root.getObjectByName("studio.photo-floor") as THREE.Mesh;
    const floorMaterial = photoFloor.material as THREE.MeshStandardMaterial;
    expect(floorMaterial.color.getHex()).toBe(CAMPING_REFERENCE_COMPOSITION.photoFloorColor);
    expect(floorMaterial.roughness).toBeCloseTo(0.96);

    const rack = root.getObjectByName("studio.rack-uprights")!;
    expect(rack.scale.x).toBeCloseTo(CAMPING_REFERENCE_COMPOSITION.rackScaleX);
    expect(rack.position.x).toBeCloseTo(
      CAMPING_REFERENCE_COMPOSITION.rackCenterX * (1 - CAMPING_REFERENCE_COMPOSITION.rackScaleX) +
        CAMPING_REFERENCE_COMPOSITION.rackShiftX,
    );
  });

  it("isolates local material corrections from other meshes sharing the GLB material", () => {
    const root = new THREE.Group();
    const shared = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const photoFloor = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shared);
    photoFloor.name = "studio.photo-floor";
    const unrelated = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
    unrelated.name = "studio.unrelated-object";
    root.add(photoFloor, unrelated);

    applyCampingReferenceComposition(root);

    expect((photoFloor.material as THREE.MeshStandardMaterial).color.getHex())
      .toBe(CAMPING_REFERENCE_COMPOSITION.photoFloorColor);
    expect(unrelated.material).toBe(shared);
    expect(shared.color.getHex()).toBe(0xffffff);
  });

  it("is idempotent so scene corrections cannot compound after a retry", () => {
    const root = makeScene();
    applyCampingReferenceComposition(root);
    const beforeScale = root.getObjectByName("studio.rack-uprights")!.scale.x;
    const beforePosition = root.getObjectByName("studio.rack-uprights")!.position.x;

    const second = applyCampingReferenceComposition(root);
    expect(second.applied).toBe(false);
    expect(root.getObjectByName("studio.rack-uprights")!.scale.x).toBe(beforeScale);
    expect(root.getObjectByName("studio.rack-uprights")!.position.x).toBe(beforePosition);
  });
});

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
    expect(nodeNames.has("studio.photo-floor")).toBe(true);
    expect(nodeNames.has("studio.ceiling-cross-beams")).toBe(true);
    expect(nodeNames.has("studio.rack-uprights")).toBe(true);
    expect(nodeNames.has("studio.garments")).toBe(true);
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
