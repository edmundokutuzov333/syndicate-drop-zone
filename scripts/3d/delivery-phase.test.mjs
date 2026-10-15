import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildManifest, phasePrerequisiteFailures, requiredFilesForPhase } from "./pack-delivery.mjs";

test("Phases before 07 do not require future-phase evidence", () => {
  const phase5 = new Set(requiredFilesForPhase(5));
  const phase6 = new Set(requiredFilesForPhase(6));
  assert.equal(phase5.has("art/out/optimized/xoyens-studio.high.glb"), false);
  assert.equal(phase6.has("art/out/optimized/xoyens-studio.high.glb"), true);
  assert.equal(new Set(requiredFilesForPhase(7)).has("art/out/optimized/xoyens-studio.high.glb"), true);
  assert.equal(new Set(requiredFilesForPhase(8)).has("art/out/optimized/xoyens-studio.high.glb"), true);
  assert.equal(new Set(requiredFilesForPhase(9)).has("art/out/optimized/xoyens-studio.high.glb"), true);
  assert.equal(phase6.has("art/out/phase07-surfaces.json"), false);
  assert.equal(phase6.has("art/xoyens-studio.phase07.report.json"), false);
  assert.equal(phase6.has("art/xoyens-studio.phase08.report.json"), false);
  assert.equal(phase6.has("public/models/camping/xoyens-studio.colliders.glb"), false);
});

test("Phase 07 requires surface source and Blender acceptance reports, not Phase 08 or colliders", () => {
  const required = new Set(requiredFilesForPhase(7));
  assert.equal(required.has("art/out/phase07-surfaces.json"), true);
  assert.equal(required.has("art/xoyens-studio.phase07.report.json"), true);
  assert.equal(required.has("art/xoyens-studio.phase08.report.json"), false);
  assert.equal(required.has("art/out/xoyens-studio.colliders.glb"), false);
  assert.equal(required.has("public/models/camping/xoyens-studio.colliders.glb"), false);
});

test("Phase 08 requires certified Phase 07 and Phase 08 evidence without prematurely requiring colliders", () => {
  const required = new Set(requiredFilesForPhase(8));
  assert.equal(required.has("art/out/phase07-surfaces.json"), true);
  assert.equal(required.has("art/xoyens-studio.phase07.report.json"), true);
  assert.equal(required.has("art/xoyens-studio.phase08.report.json"), true);
  assert.equal(required.has("public/models/camping/xoyens-studio.glb"), true);
  assert.equal(required.has("public/models/camping/xoyens-studio.model.json"), true);
  assert.equal(required.has("art/out/xoyens-studio.colliders.glb"), false);
  assert.equal(required.has("public/models/camping/xoyens-studio.colliders.glb"), false);
});

test("Phase 06 rejects a canonical GLB that differs from its optimized high-tier source", () => {
  const root = mkdtempSync(join(tmpdir(), "camping-optimized-public-mismatch-"));
  try {
    const optimizedDir = join(root, "art/out/optimized");
    const publicDir = join(root, "public/models/camping");
    mkdirSync(optimizedDir, { recursive: true });
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(join(optimizedDir, "xoyens-studio.high.glb"), Buffer.from("optimized-high-tier-glb"));
    writeFileSync(join(publicDir, "xoyens-studio.glb"), Buffer.from("stale-public-glb"));
    const failures = phasePrerequisiteFailures(root, 6);
    assert.ok(failures.some((failure) => failure.includes("Optimized high-tier GLB and canonical frontend GLB differ")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Phase 08 is rejected when Phase 07 source evidence is missing", () => {
  const root = mkdtempSync(join(tmpdir(), "camping-phase-gate-"));
  try {
    const failures = phasePrerequisiteFailures(root, 8);
    assert.ok(failures.some((failure) => failure.includes("Phase 07 source evidence missing")));
    assert.ok(failures.some((failure) => failure.includes("Phase 07 Blender validation missing")));
    assert.ok(failures.some((failure) => failure.includes("Canonical frontend model metadata missing")));
    assert.ok(failures.some((failure) => failure.includes("Phase 08 production validation missing")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Phase 09 requires photo source report, official brand assets and canonical frontend metadata", () => {
  const required = new Set(requiredFilesForPhase(9));
  assert.equal(required.has("art/xoyens-studio.phase07.report.json"), true);
  assert.equal(required.has("art/xoyens-studio.phase08.report.json"), true);
  assert.equal(required.has("art/xoyens-studio.phase09.report.json"), true);
  assert.equal(required.has("art/textures/brand/sindicato-selo.png"), true);
  assert.equal(required.has("art/textures/brand/xoyens.png"), true);
  assert.equal(required.has("art/out/optimized/xoyens-studio.high.glb"), true);
  assert.equal(required.has("public/models/camping/xoyens-studio.glb"), true);
  assert.equal(required.has("public/models/camping/xoyens-studio.model.json"), true);
  assert.equal(required.has("public/models/camping/xoyens-studio.colliders.glb"), false);
});

test("Phase 09 is rejected when the photo report and official assets are absent", () => {
  const root = mkdtempSync(join(tmpdir(), "camping-phase09-gate-"));
  try {
    const failures = phasePrerequisiteFailures(root, 9);
    assert.ok(failures.some((failure) => failure.includes("Phase 07 source evidence missing")));
    assert.ok(failures.some((failure) => failure.includes("Phase 08 production validation missing")));
    assert.ok(failures.some((failure) => failure.includes("Phase 09 photo validation missing")));
    assert.ok(failures.some((failure) => failure.includes("Phase 09 official brand asset missing")));
    assert.ok(failures.some((failure) => failure.includes("Canonical frontend model metadata missing")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Phase 13 defers collider artifacts, while Phase 14 requires both", () => {
  const phase13 = new Set(requiredFilesForPhase(13));
  assert.equal(phase13.has("art/out/xoyens-studio.colliders.glb"), false);
  assert.equal(phase13.has("public/models/camping/xoyens-studio.colliders.glb"), false);
  const root = mkdtempSync(join(tmpdir(), "camping-phase13-gate-"));
  try {
    const failures = phasePrerequisiteFailures(root, 13);
    assert.equal(failures.some((failure) => failure.includes("Phase 14 collider artifact missing")), false);
    const phase14Failures = phasePrerequisiteFailures(root, 14);
    assert.ok(phase14Failures.some((failure) => failure.includes("Phase 14 collider artifact missing: art/out/xoyens-studio.colliders.glb")));
    assert.ok(phase14Failures.some((failure) => failure.includes("Phase 14 collider artifact missing: public/models/camping/xoyens-studio.colliders.glb")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Phase 14 keeps both source and public collider GLBs as required artifacts", () => {
  const required = new Set(requiredFilesForPhase(14));
  assert.equal(required.has("art/out/xoyens-studio.colliders.glb"), true);
  assert.equal(required.has("public/models/camping/xoyens-studio.colliders.glb"), true);
  assert.equal(required.has("art/xoyens-studio.phase07.report.json"), true);
  assert.equal(required.has("art/xoyens-studio.phase08.report.json"), true);
});


test("delivery manifest excludes mutable run logs and exit codes from file checksums", async () => {
  const root = mkdtempSync(join(tmpdir(), "camping-manifest-evidence-"));
  try {
    const delivery = join(root, "art/_delivery");
    const logs = join(delivery, "logs");
    mkdirSync(logs, { recursive: true });
    writeFileSync(join(delivery, "environment.txt"), "runtime=ci\n");
    writeFileSync(join(delivery, "exit-codes.txt"), "verify=0\n");
    writeFileSync(join(logs, "01-validate.log"), "validation complete\n");
    writeFileSync(join(logs, "02-package.log"), "packaging is still writing\n");

    const manifest = await buildManifest(root, 6);
    const checksummed = new Set(manifest.files.map((file) => file.path));
    assert.equal(checksummed.has("art/_delivery/environment.txt"), true);
    assert.equal(checksummed.has("art/_delivery/exit-codes.txt"), false);
    assert.equal(checksummed.has("art/_delivery/logs/01-validate.log"), false);
    assert.deepEqual(manifest.evidence.logs, ["art/_delivery/logs/01-validate.log"]);
    assert.equal(manifest.evidence.exitCodesPath, "art/_delivery/exit-codes.txt");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("invalid delivery phases are rejected", () => {
  assert.throws(() => requiredFilesForPhase(0), /integer between 1 and 22/);
  assert.throws(() => requiredFilesForPhase(23), /integer between 1 and 22/);
  assert.throws(() => requiredFilesForPhase(8.5), /integer between 1 and 22/);
  assert.throws(() => phasePrerequisiteFailures(".", 23), /integer between 1 and 22/);
});
