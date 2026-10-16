import test from "node:test";
import assert from "node:assert/strict";
import { EXPECTED_OUTPUT_COUNT, parseExrDataWindow, pngDimensions, validateBakeReport } from "./verify-lightmap-bakes.mjs";

test("Phase 13 expects 15 maps", () => assert.equal(EXPECTED_OUTPUT_COUNT, 15));
test("incomplete reports fail closed", () => {
  const result = validateBakeReport({ phase:13, status:"failed", sourceCommit:"a".repeat(40), durationSeconds:1, bakeType:"DIFFUSE", direct:true, indirect:true, usePassColor:false, lmScale:4, dilateMarginPx:8, denoiser:"OPENIMAGEDENOISE", failures:["UV2 missing"], outputs:[], lightingInventory:{} }, ".");
  assert.equal(result.ok, false);
  assert.ok(result.failures.some(x => x.includes("esperados 15 outputs")));
});
test("EXR parser and PNG parser are exported", () => {
  assert.equal(typeof parseExrDataWindow, "function");
  assert.equal(typeof pngDimensions, "function");
});
