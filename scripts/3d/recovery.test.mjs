import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "../ci/read-run-annotations.mjs";
import { blendKind, colliderGlbContract, glbContract } from "./verify-delivery.mjs";

test("annotation classifier identifies known causes only from annotation text", () => {
  assert.equal(classify(["The job was not started because recent account payments have failed"]).cause, "BILLING_BLOCK");
  assert.equal(classify(["Actions are disabled"]).cause, "ACTIONS_DISABLED");
  assert.equal(classify(["This action is not allowed to be used"]).cause, "POLICY_BLOCK");
  assert.equal(classify(["No runner matching the specified labels was found"]).cause, "NO_MATCHING_RUNNER");
  assert.equal(classify(["The minutes limit has been exceeded"]).cause, "QUOTA");
});

test("runner_id 0 without annotation remains unknown", () => {
  assert.equal(classify(["runner_id=0; steps=[]; failure"]).cause, "UNKNOWN");
});

test("blend detector distinguishes native magic and an LFS pointer", () => {
  assert.equal(blendKind(Buffer.from("BLENDER-v400")), "blend");
  assert.equal(blendKind(Buffer.from("version https://git-lfs.github.com/spec/v1\\noid sha256:fake\\nsize 100\\n")), "LFS-POINTER-FALSO");
  assert.equal(blendKind(Buffer.from("not a blend file")), "unknown");
});

test("GLB contract checks Phase 07 surfaces, interactions, unique 17 slots, materials and UVs", () => {
  const nodes = [
    { name: "SDT_door", extras: { interactionId: "studio.inner-door", zone: "shell", lmGroup: "shell" } },
    { name: "SDT_shell_floor_wood_hero", mesh: 0, extras: {
      elementId: "floor.wood", zone: "shell", lmGroup: "shell", surfacePhase: 7,
      phase7BoardCount: 116, phase7BoardWidthTargetM: 0.19,
    } },
    { name: "SDT_photo_vinyl_sweep_hero", mesh: 1, extras: {
      elementId: "floor.vinyl_sweep", zone: "photo", lmGroup: "photo", surfacePhase: 7,
      phase7VinylRadiusM: 2.3, phase7VinylThicknessM: 0.0012, phase7VinylEdgeLiftM: 0.004,
    } },
    { name: "SDT_shell_vault_ceiling", mesh: 2, extras: {
      elementId: "arch.vault_ceiling", zone: "shell", lmGroup: "shell", surfacePhase: 7,
      phase7BambooTileMeters: 1.2,
    } },
    { name: "SDT_photo_paper_cyclorama_wall", extras: {
      elementId: "photo.paper_folds", zone: "photo", lmGroup: "photo", surfacePhase: 7,
    } },
    { name: "SDT_photo_paper_cyclorama_curve", extras: {
      elementId: "photo.paper_folds", zone: "photo", lmGroup: "photo", surfacePhase: 7,
      phase7CycloramaRadiusM: 0.35, phase7PaperContinuousToFloor: true,
    } },
  ];
  for (let number = 1; number <= 17; number += 1) {
    const id = String(number).padStart(3, "0");
    nodes.push({ name: "slot-" + id, extras: { interactionId: "studio.artist-slot-" + id } });
  }
  const glb = {
    nodes,
    meshes: [
      { primitives: [{ material: 0, attributes: { COLOR_0: 2, TEXCOORD_0: 0, TEXCOORD_1: 1 } }] },
      { primitives: [{ material: 0, attributes: { TEXCOORD_0: 0, TEXCOORD_1: 1 } }] },
      { primitives: [{ material: 0, attributes: { TEXCOORD_0: 0, TEXCOORD_1: 1 } }] },
    ],
    materials: Array.from({ length: 10 }, (_, index) => ({ name: "material-" + index })),
  };
  const bible = { elements: [{ interactionId: "studio.inner-door" }] };
  assert.ok(glbContract(glb, bible).every((check) => check.pass), JSON.stringify(glbContract(glb, bible)));
  const missingUv = structuredClone(glb);
  delete missingUv.meshes[0].primitives[0].attributes.TEXCOORD_1;
  assert.ok(glbContract(missingUv, bible).some((check) => check.name.includes("UV1") && !check.pass));
  const extraSlot = structuredClone(glb);
  extraSlot.nodes.push({ name: "slot-018", extras: { interactionId: "studio.artist-slot-018" } });
  assert.ok(glbContract(extraSlot, bible).some((check) => check.name.includes("17 artist slots") && !check.pass));
});

test("collider GLB contains only COL_* mesh nodes with extras.collider", () => {
  const colliders = {
    nodes: [
      { name: "COL_wall_left", mesh: 0, extras: { collider: "box" } },
      { name: "COL_desk", mesh: 1, extras: { collider: "box" } },
    ],
    meshes: [
      { primitives: [{ material: 0, attributes: { TEXCOORD_0: 0, TEXCOORD_1: 1 } }] },
      { primitives: [{ material: 0, attributes: { TEXCOORD_0: 0, TEXCOORD_1: 1 } }] },
    ],
  };
  assert.ok(colliderGlbContract(colliders, 2).every((check) => check.pass));
  const missingExtras = structuredClone(colliders);
  delete missingExtras.nodes[0].extras.collider;
  assert.ok(colliderGlbContract(missingExtras, 2).some((check) => check.name.includes("extras.collider") && !check.pass));
  assert.ok(colliderGlbContract(colliders, 3).some((check) => check.name.includes("match Blender report") && !check.pass));
});


test("PBR material helper contracts are deterministic", async () => {
  const { PROFILES, REQUIRED_MAPS, packOrmChannels, invertDirectXGreenChannel } = await import("../fetch-cc0-materials.mjs");
  const { pngDimensions, isLfsPointer, renderLicenseRows } = await import("../validate-pbr-materials.mjs");
  assert.ok(PROFILES.length >= 18);
  assert.equal(new Set(PROFILES.map((p) => p.name)).size, PROFILES.length);
  assert.deepEqual(REQUIRED_MAPS, ["BC", "N", "ORM"]);
  assert.deepEqual([...packOrmChannels(Buffer.from([1]), Buffer.from([2]), Buffer.from([3]), 1)], [1, 2, 3]);
  assert.deepEqual([...invertDirectXGreenChannel(Buffer.from([5, 10, 15]), 1, 1)], [5, 245, 15]);
  const png = Buffer.alloc(24); Buffer.from("89504e470d0a1a0a", "hex").copy(png); png.writeUInt32BE(2048, 16); png.writeUInt32BE(2048, 20);
  assert.deepEqual(pngDimensions(png), { width: 2048, height: 2048 });
  assert.equal(isLfsPointer(Buffer.from("version https://git-lfs.github.com/spec/v1\\n")), true);
  assert.ok(renderLicenseRows([{ material: "wood", sourceAsset: { id: "test_asset", url: "https://polyhaven.com/a/test_asset", authors: ["Test Author"] } }]).includes("CC0 1.0"));
});
