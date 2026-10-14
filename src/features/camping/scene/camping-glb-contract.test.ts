import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applyCampingReferenceComposition,
  CAMPING_REFERENCE_COMPOSITION,
} from "./camping-reference-composition";

function readStudioGlb() {
  // Use the repository root rather than import.meta.url, which Vitest's jsdom
  // transform may rewrite to an http: URL instead of a file: URL.
  const path = resolve(process.cwd(), "public/models/camping/xoyens-studio.glb");
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
    nodes?: Array<{
      name?: string;
      mesh?: number;
      extras?: { elementId?: string; interactionId?: string };
    }>;
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

    const plaster = root.getObjectByName("studio.left-wall") as THREE.Mesh;
    const plasterMaterial = plaster.material as THREE.MeshStandardMaterial;
    expect(plasterMaterial.color.getHex()).toBe(CAMPING_REFERENCE_COMPOSITION.plasterColor);
    expect(plasterMaterial.roughness).toBeGreaterThanOrEqual(0.9);
    expect(plasterMaterial.normalScale.x).toBeCloseTo(0.12);
    expect(plasterMaterial.normalScale.y).toBeCloseTo(0.12);
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
    const nodes = gltf.nodes ?? [];
    const contracts = new Set(
      nodes.flatMap((node) => [node.name, node.extras?.elementId, node.extras?.interactionId])
        .filter((value): value is string => typeof value === "string"),
    );
    const hasAny = (...values: string[]) => values.some((value) => contracts.has(value));

    expect(gltf.asset?.version).toBe("2.0");
    expect(buffer.length).toBeGreaterThan(1_000_000);
    // Legacy GLBs use runtime aliases as node names. Blender V3 stores source
    // element IDs and stable interaction IDs in extras, then normalizes aliases
    // in camping-model-compatibility.ts before the scene is mounted.
    expect(hasAny("studio.floor", "floor.wood")).toBe(true);
    expect(hasAny("studio.vaulted-timber-ceiling", "arch.vault_ceiling")).toBe(true);
    expect(hasAny("studio.ceiling-arches", "arch.vault_ceiling") ||
      nodes.some((node) => (node.name ?? "").startsWith("SDT_shell_vault_rib_"))).toBe(true);
    expect(hasAny("studio.parquet", "floor.wood")).toBe(true);
    expect(hasAny("studio.production-desk", "prod.desk_l")).toBe(true);
    expect(hasAny("studio.photo-backdrop", "photo.backdrop_seal")).toBe(true);
    expect(hasAny("studio.photo-floor", "floor.vinyl_sweep")).toBe(true);
    // Blender V3 models the reference ceiling's arch structure as two primary
    // ribs plus fourteen secondary ribs, rather than the legacy cross-beam alias.
    const ceilingRibs = nodes.filter((node) =>
      /^SDT_shell_vault_rib_(?:primary|secondary)_\d{2}$/i.test(node.name ?? ""));
    expect(ceilingRibs.filter((node) => /_primary_/i.test(node.name ?? "")).length).toBeGreaterThanOrEqual(2);
    expect(ceilingRibs.filter((node) => /_secondary_/i.test(node.name ?? "")).length).toBeGreaterThanOrEqual(14);
    expect(hasAny("studio.rack-uprights", "studio.merch-rack", "photo.garments")).toBe(true);
    expect(hasAny("studio.garments", "photo.garments")).toBe(true);
  });

  it("contains all 17 physical artist portrait frames in the model before any interaction", () => {
    const { gltf } = readStudioGlb();
    const nodes = gltf.nodes ?? [];
    const slotContracts = new Set(
      nodes.flatMap((node) => [node.name, node.extras?.interactionId])
        .filter((value): value is string => typeof value === "string"),
    );
    const slots = Array.from({ length: 17 }, (_, index) =>
      "studio.artist-slot-" + String(index + 1).padStart(3, "0"),
    );

    expect(slots.every((name) => slotContracts.has(name))).toBe(true);
    expect(new Set(slots).size).toBe(17);
    expect(slotContracts.has("studio.artist-slot-018")).toBe(false);
  });

  it("contains physical geometry and PBR material families for the actual studio set", () => {
    const { gltf } = readStudioGlb();
    const meshes = gltf.meshes ?? [];
    const materialNames = new Set((gltf.materials ?? []).map((material) => material.name?.toLowerCase()));

    expect(meshes.length).toBeGreaterThanOrEqual(100);
    // The optimized Blender tiers merge compatible geometry, so validate the
    // certified minimum rather than the legacy unmerged primitive count.
    expect(meshes.reduce((total, mesh) => total + (mesh.primitives?.length ?? 0), 0)).toBeGreaterThanOrEqual(100);
    const materialFamilies: Array<[string, RegExp]> = [
      ["wood", /wood/],
      ["floor", /floor|parquet|vinyl/],
      ["plaster", /plaster|wall/],
      ["fabric", /fabric|textile|cloth/],
      ["leather", /leather/],
      ["metal", /metal|steel/],
    ];
    for (const [family, pattern] of materialFamilies) {
      expect([...materialNames].some((name) => typeof name === "string" && pattern.test(name)),
        "missing PBR material family: " + family).toBe(true);
    }
  });
});
