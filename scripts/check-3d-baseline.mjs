#!/usr/bin/env node
// Historical Phase 01 measurements remain in docs/camping-v3/phase-01/baseline-glb.txt.
// The production model has since been rebuilt, so CI validates today's high-tier
// budget instead of requiring four obsolete violations to remain in the public asset.
import { spawnSync } from "node:child_process";

const model = process.argv[2] || "public/models/camping/xoyens-studio.glb";
const result = spawnSync(process.execPath, [
  "scripts/check-3d-budgets.mjs",
  model,
  "high",
], { encoding: "utf8" });

const output = (result.stdout ?? "") + (result.stderr ?? "");
process.stdout.write(output);
if (result.error) {
  console.error("Unable to execute the GLB budget verifier:", result.error.message);
  process.exit(2);
}
if (result.status !== 0) {
  console.error("\nFAILED: the currently published CAMPING GLB must meet the high-tier budgets.");
  process.exit(result.status || 1);
}
console.log("\nCURRENT MODEL VERIFIED: high-tier budgets pass; the original Phase 01 baseline remains preserved as historical evidence.");
