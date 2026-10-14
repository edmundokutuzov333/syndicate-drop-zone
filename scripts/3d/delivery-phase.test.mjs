import test from "node:test";
import assert from "node:assert/strict";
import { requiredFilesForPhase } from "./pack-delivery.mjs";

test("Phase 08 requires production evidence without prematurely requiring colliders", () => {
  const required = new Set(requiredFilesForPhase(8));
  assert.equal(required.has("art/xoyens-studio.phase08.report.json"), true);
  assert.equal(required.has("art/out/xoyens-studio.colliders.glb"), false);
  assert.equal(required.has("public/models/camping/xoyens-studio.colliders.glb"), false);
});

test("Phase 14 requires both source and public collider GLBs", () => {
  const required = new Set(requiredFilesForPhase(14));
  assert.equal(required.has("art/out/xoyens-studio.colliders.glb"), true);
  assert.equal(required.has("public/models/camping/xoyens-studio.colliders.glb"), true);
  assert.equal(required.has("art/xoyens-studio.phase08.report.json"), true);
});

test("invalid delivery phases are rejected", () => {
  assert.throws(() => requiredFilesForPhase(0), /integer between 1 and 22/);
  assert.throws(() => requiredFilesForPhase(23), /integer between 1 and 22/);
  assert.throws(() => requiredFilesForPhase(8.5), /integer between 1 and 22/);
});
