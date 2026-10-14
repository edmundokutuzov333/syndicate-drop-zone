import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "../ci/read-run-annotations.mjs";
import { blendKind, glbContract } from "./verify-delivery.mjs";

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
  assert.equal(blendKind(Buffer.from("version https://git-lfs.github.com/spec/v1\noid sha256:fake\nsize 100\n")), "LFS-POINTER-FALSO");
  assert.equal(blendKind(Buffer.from("not a blend file")), "unknown");
});

test("GLB contract checks interactions, unique 17 slots, materials and UVs", () => {
  const nodes = [{ name: "SDT_door", extras: { interactionId: "studio.inner-door", zone: "shell", lmGroup: "shell" } }];
  for (let number = 1; number <= 17; number += 1) {
    const id = String(number).padStart(3, "0");
    nodes.push({ name: "slot-" + id, extras: { interactionId: "studio.artist-slot-" + id } });
  }
  const glb = {
    nodes,
    meshes: [{ primitives: [{ material: 0, attributes: { TEXCOORD_0: 0, TEXCOORD_1: 1 } }] }],
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
