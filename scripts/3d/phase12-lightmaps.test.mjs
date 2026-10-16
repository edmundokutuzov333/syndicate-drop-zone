import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildPlan, planSingleAtlas, GROUPS, TIERS } from "../plan-lightmaps.mjs";

const report = (area = 1, density = 64) => ({
  phase: 12,
  status: "source-validated",
  sourceCommit: "a".repeat(40),
  uv2Independent: true,
  smartProjectAngleDegrees: 66,
  smartProjectIslandMargin: 0.003,
  packMargin: 0.004,
  paddingAt4096Px: 16.384,
  meshAreas: GROUPS.map((lmGroup) => ({
    name: lmGroup,
    lmGroup,
    surfaceM2: area,
    targetTexelsPerM: density,
    lightmapPolicy: "baked",
    uvMap: "UVMap",
    uvLightmap: "UV_Lightmap",
    uv2Independent: true,
    maxIslandStretch: 1.01,
  })),
});
const bible = () => ({ version: 3, elements: GROUPS.map((zone) => ({ zone })) });

test("um atlas por grupo e budgets", () => {
  const plan = buildPlan(report(), bible());
  assert.equal(plan.status, "within-budget");
  for (const [tier, config] of Object.entries(TIERS)) {
    assert.ok(plan.tiers[tier].totalMemoryMB <= config.budgetMB);
    assert.equal(Object.keys(plan.tiers[tier].groups).length, 5);
    for (const group of Object.values(plan.tiers[tier].groups)) {
      assert.equal(group.atlases, 1);
      assert.equal(group.fits, true);
    }
  }
});

test("a densidade-alvo escala com a resolução sem criar atlas adicional", () => {
  const shell = [{ surfaceM2: 529.523401, targetTexelsPerM: 96, lightmapPolicy: "baked" }];
  const high = planSingleAtlas(shell, 4096);
  const mid = planSingleAtlas(shell, 2048);
  const low = planSingleAtlas(shell, 1024);
  assert.deepEqual([high.atlasPx, mid.atlasPx, low.atlasPx], [4096, 2048, 1024]);
  assert.deepEqual([high.targetDensityScale, mid.targetDensityScale, low.targetDensityScale], [1, 0.5, 0.25]);
  assert.ok(high.fits && mid.fits && low.fits);
  assert.deepEqual([high.atlases, mid.atlases, low.atlases], [1, 1, 1]);
  assert.ok(high.effectiveTexelsPerM > mid.effectiveTexelsPerM);
  assert.ok(mid.effectiveTexelsPerM > low.effectiveTexelsPerM);
});

test("stretching e UV2 são gates", () => {
  const input = report();
  input.meshAreas[0].maxIslandStretch = 1.2;
  input.meshAreas[1].uv2Independent = false;
  const plan = buildPlan(input, bible());
  assert.equal(plan.status, "failed");
  assert.ok(plan.failures.some((failure) => failure.includes("Stretching >1.15")));
});

test("não cria segundo atlas quando a superfície não cabe", () => {
  const plan = planSingleAtlas([{ surfaceM2: 5000, targetTexelsPerM: 128 }], 4096);
  assert.equal(plan.atlases, 1);
  assert.equal(plan.fits, false);
});

test("budget high falha quando cinco grupos pedem atlas 2048", () => {
  const plan = buildPlan(report(100, 128), bible());
  assert.equal(plan.status, "failed");
  assert.ok(plan.failures.some((failure) => failure.includes("high excede 24 MiB")));
});

test("o bake da Fase 13 não bloqueia a Fase 12", () => {
  const script = readFileSync(resolve("scripts/3d/local-build.sh"), "utf8");
  assert.match(script, /if \[ "\$CAMPING_PHASE" -ge 13 \]; then[\s\S]*?step phase13-bake/);
});
