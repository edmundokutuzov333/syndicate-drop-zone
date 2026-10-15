import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { unlockSite } from "./site-gate";

type CampingGlbPrimitive = { attributes?: Record<string, number>; indices?: number; mode?: number; material?: number };
type CampingGlbNode = { name?: string; mesh?: number; extras?: Record<string, unknown> };
type CampingGlb = {
  extensionsUsed?: string[];
  nodes?: CampingGlbNode[];
  meshes?: Array<{ primitives?: CampingGlbPrimitive[] }>;
  materials?: Array<{ name?: string }>;
  accessors?: Array<{ count?: number }>;
  images?: unknown[];
};

const ARTIST_PHOTO_URLS = [
  "/__l5e/assets-v1/3ca51b71-9b82-4727-9957-fd3763ba89e5/a01.jpg",
  "/__l5e/assets-v1/dcfd0297-cf1d-4909-878c-e565fe7cc304/a02.jpg",
  "/__l5e/assets-v1/e2b96ec6-5924-44ba-8061-c168f64e134e/a03.jpg",
  "/__l5e/assets-v1/6d3f4cc8-bbc1-4f75-b123-172274968c1e/a04.jpg",
  "/__l5e/assets-v1/afc68f87-477b-49b1-833f-a8a75f85e4f2/a05b.jpg",
  "/__l5e/assets-v1/7e1db53d-07f0-4fe5-adf8-86484b2f9760/a06.jpg",
  "/__l5e/assets-v1/012005f8-e144-4f2c-9f1a-4643d7141ba0/a07.jpg",
  "/__l5e/assets-v1/d9ff908b-39f3-442d-87a1-cdbc4cb3a98f/a08.jpg",
  "/__l5e/assets-v1/ad1fb2dc-ff3a-4f5a-a6fa-ba379279c14c/a09.jpg",
  "/__l5e/assets-v1/dc69f6b6-1438-4abd-8c45-36e54a36057b/a10.jpg",
  "/__l5e/assets-v1/61caa7fe-4a5a-48ea-ae1b-c1544e932ae4/a11.jpg",
  "/__l5e/assets-v1/8db60002-3577-48d8-b8c7-14767e8cae04/a12.jpg",
  "/__l5e/assets-v1/ae87c626-f23a-46cb-b08b-8cbb15ad173a/a13.jpg",
  "/__l5e/assets-v1/8650b3aa-0fcb-4536-9acc-57681b8ee72b/a14.jpg",
  "/__l5e/assets-v1/07ab25e7-e7d3-4287-abf9-f0689bde4f99/a15.jpg",
  "/__l5e/assets-v1/f9f45301-7ad1-45fc-8fc8-829fa6aa534a/a16.jpg",
  "/__l5e/assets-v1/d115cdcf-68cb-403f-9cec-e9f25a077dff/a17.jpg",
] as const;

const PUBLISHED_ARTIST_FIXTURE = ARTIST_PHOTO_URLS.map((photo_url, index) => ({
  id: "camping-portrait-fixture-" + String(index + 1).padStart(2, "0"),
  slug: "camping-portrait-fixture-" + String(index + 1).padStart(2, "0"),
  code: "SDT-" + String(index + 1).padStart(2, "0"),
  name: "Published Artist " + String(index + 1).padStart(2, "0"),
  bio: "",
  frase: "",
  zona: "",
  faixas: [],
  role: "TRAP",
  studio: "STUDIO XOYENS",
  edition: "01",
  presence: "ACTIVA",
  spotify_artist_id: "",
  photo_url,
  status: "published",
}));

async function openCamping(page: import("@playwright/test").Page, query = "", options: { skipUnlock?: boolean; afterNavigation?: () => void } = {}) {
  await page.route("**/rest/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: pathname.endsWith("/artists") ? JSON.stringify(PUBLISHED_ARTIST_FIXTURE) : "[]",
    });
  });
  const browserDiagnostics: string[] = [];
  page.on("pageerror", (error) => browserDiagnostics.push("pageerror: " + error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserDiagnostics.push("console: " + message.text());
  });

  if (!options.skipUnlock) {
    // Seed the site session before navigation so GATE_BOOT can restore it on
    // the first document. Reloading after WebGL/audio mounts can hang the CI
    // browser's navigation lifecycle and prevents reaching the inner 808 test.
    await page.addInitScript(() => {
      try { window.sessionStorage.setItem("sdt-open", "1"); } catch { /* Browser policy may disable storage. */ }
    });
  }
  await page.goto("/camping" + query);
  if (!options.skipUnlock) {
    const siteGate = page.locator('[data-site-gate="locked"]');
    await expect(page.locator("html")).toHaveAttribute("data-gate", "open", { timeout: 15_000 });
    await expect(siteGate).toBeHidden({ timeout: 15_000 });
    options.afterNavigation?.();
    await expect(page.locator("main.camping-studio-route")).toBeVisible();
  } else {
    // This path validates the scene under the site-wide overlay. The global
    // gate is covered separately; its CSS intentionally hides the route while locked.
    options.afterNavigation?.();
    await expect(page.locator("main.camping-studio-route")).toHaveCount(1);
  }
  const canvas = page.locator("canvas.camping-studio__canvas");
  if (options.skipUnlock) await expect(canvas).toHaveCount(1);
  else await expect(canvas).toBeVisible();

  // SSR can make the canvas visible before React's client layout effects mount
  // the Three.js renderer and global keyboard handler. Wait for any explicit
  // renderer outcome, not only "ready", so startup failures are diagnosed and
  // the test can assert the accessible recovery UI rather than timing out.
  const fallback = page.locator('.camping-studio__fallback[aria-label="Acesso alternativo"]');
  try {
    await expect.poll(async () => {
      const status = await canvas.getAttribute("data-camping-webgl-status");
      return Boolean(status) || await fallback.isVisible();
    }, { timeout: 15_000 }).toBe(true);
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const canvasElement = document.querySelector("canvas.camping-studio__canvas");
      return {
        url: location.href,
        gate: document.documentElement.dataset.gate ?? null,
        rootReady: Boolean(document.querySelector("#site")),
        canvasAttributes: canvasElement ? Array.from(canvasElement.attributes).map((attribute) => ({
          name: attribute.name,
          value: attribute.value,
        })) : [],
        fallbackVisible: Boolean(document.querySelector('.camping-studio__fallback[aria-label="Acesso alternativo"]')),
        bodyText: (document.body.innerText || "").slice(0, 1200),
      };
    });
    console.log("CAMPING STARTUP DIAGNOSTICS", JSON.stringify({ diagnostics, browserDiagnostics }));
    await page.screenshot({ path: "test-results/camping-startup-diagnostic.png" }).catch(() => undefined);
    throw error;
  }

  const status = await canvas.getAttribute("data-camping-webgl-status");
  if (status && status !== "ready") {
    await expect(fallback).toBeVisible();
  }
}

test.describe("CAMPING V2 / 808 access", () => {
  test("restores an unlocked session after refresh without a React hydration mismatch", async ({ page }) => {
    await page.route("**/rest/v1/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: pathname.endsWith("/artists") ? JSON.stringify(PUBLISHED_ARTIST_FIXTURE) : "[]",
      });
    });

    const hydrationErrors: string[] = [];
    page.on("pageerror", (error) => {
      if (/hydration failed|hydration mismatch/i.test(error.message)) {
        hydrationErrors.push(error.message);
      }
    });

    await page.goto("/camping");
    await unlockSite(page);
    await expect(page.locator("#site")).toBeVisible();

    await page.reload();
    await expect(page.locator("#site")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "OK", exact: true })).toHaveCount(0, { timeout: 10_000 });
    expect(hydrationErrors).toEqual([]);
  });

  test("keeps the studio entry available when optional Supabase catalogues fail", async ({ page }) => {
    await page.route("**/rest/v1/**", async (route) => {
      await route.abort("failed");
    });

    await page.goto("/camping");
    await unlockSite(page);
    await expect(page.locator("main.camping-studio-route")).toBeVisible();
    await expect(page.locator("canvas.camping-studio__canvas")).toBeVisible();
    await expect(
      page.locator(".camping-studio__access-panel").or(
        page.locator('.camping-studio__fallback[aria-label="Acesso alternativo"]'),
      ),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("SINAL CORROMPIDO")).toHaveCount(0);
    await expect(page.getByText("ACESSO NEGADO · 500")).toHaveCount(0);
  });

  test("mounts the 3D entry or an accessible WebGL fallback", async ({ page }) => {
    test.setTimeout(120_000);
    await openCamping(page);

    const fallback = page.locator('.camping-studio__fallback[aria-label="Acesso alternativo"]');
    if (await fallback.isVisible()) {
      await expect(page.getByRole("button", { name: "TENTAR INICIAR 3D" })).toBeVisible();
      await expect(page.getByRole("button", { name: "ABRIR REGISTOS PÚBLICOS" })).toBeVisible();
      await expect(page.getByRole("button", { name: "SAIR DA EXPERIÊNCIA" })).toBeVisible();
      return;
    }

    await expect(page.getByRole("heading", { name: "808", exact: true })).toBeVisible();
    // The studio identity header is intentionally hidden until the visitor
    // enters 808, keeping the pre-entry scene focused on the access panel.
    await expect(page.locator(".camping-studio__header")).toHaveCount(0);
    await expect(page.locator(".camping-studio__access-panel")).toContainText("Código de acesso");
    await expect(page.locator(".camping-studio__access-panel")).not.toContainText("ENTRY PROTOCOL");
    await expect(page.locator(".camping-studio__access-panel")).not.toContainText("WASD / DRAG LOOK");
    await expect(page.locator(".camping-studio__header-right")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "NAVEGAÇÃO GUIADA" })).toBeVisible();
    await expect(page.getByRole("button", { name: "REGISTOS" })).toBeVisible();
  });

  test("retries 3D initialization without leaving CAMPING after WebGL is unavailable", async ({ page }) => {
    await openCamping(page);
    const fallback = page.locator('.camping-studio__fallback[aria-label="Acesso alternativo"]');
    if (!(await fallback.isVisible())) {
      test.skip(true, "Este Chromium disponibiliza WebGL e não deve entrar no fallback.");
    }

    await page.getByRole("button", { name: "TENTAR INICIAR 3D" }).click();
    await expect(page.locator("main.camping-studio-route")).toBeVisible();
    await expect(page.locator("canvas.camping-studio__canvas")).toBeVisible();
    await expect(page.getByRole("button", { name: "ABRIR REGISTOS PÚBLICOS" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("ACESSO NEGADO · 500")).toHaveCount(0);
  });

  test("captures 808 while a non-input interface button has keyboard focus", async ({ page }) => {
    await openCamping(page);
    if (await page.locator('.camping-studio__fallback[aria-label="Acesso alternativo"]').isVisible()) {
      test.skip(true, "O runtime Chromium deste job não disponibiliza WebGL.");
    }

    const codeSlots = page.locator(".camping-studio__code-slots");
    await page.getByRole("button", { name: "NAVEGAÇÃO GUIADA" }).focus();
    await page.keyboard.press("8");
    await expect(codeSlots).toHaveAttribute("aria-label", "Código introduzido: 8");
    await page.keyboard.press("0");
    await expect(codeSlots).toHaveAttribute("aria-label", "Código introduzido: 80");
    await page.keyboard.press("8");
    await expect(page.locator(".camping-studio__transition")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".camping-studio__explore-state")).toContainText("EXPLORATION ACTIVE", { timeout: 30_000 });
  });

  test("accepts 808 and enters the loaded studio when WebGL is available", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1774, height: 887 });
    await openCamping(page);
    if (await page.locator('.camping-studio__fallback[aria-label="Acesso alternativo"]').isVisible()) {
      test.skip(true, "O runtime Chromium deste job não disponibiliza WebGL.");
    }

    const glbResponses: number[] = [];
    const portraitResponses = new Map<string, number>();
    const brandResponses = new Map<string, number>();
    const officialBrandPaths = [
      "/__l5e/assets-v1/b0478989-7ffd-43dd-92e0-a801662907ae/xoyens.png",
      "/__l5e/assets-v1/1fa67bdd-f452-442e-a0d5-a9fb482388de/sindicato-selo.png",
    ];
    page.on("response", (response) => {
      const pathname = new URL(response.url()).pathname;
      if (pathname.endsWith("/models/camping/xoyens-studio.glb")) {
        glbResponses.push(response.status());
      }
      if ((ARTIST_PHOTO_URLS as readonly string[]).includes(pathname)) {
        portraitResponses.set(pathname, response.status());
      }
      if (officialBrandPaths.includes(pathname)) {
        brandResponses.set(pathname, response.status());
      }
    });

    const codeSlots = page.locator(".camping-studio__code-slots");
    await page.locator("canvas.camping-studio__canvas").focus();
    await page.keyboard.press("8");
    await expect(codeSlots).toHaveAttribute("aria-label", "Código introduzido: 8");
    await page.keyboard.press("0");
    await expect(codeSlots).toHaveAttribute("aria-label", "Código introduzido: 80");
    await page.keyboard.press("8");
    await expect(page.locator(".camping-studio__transition")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".camping-studio__asset-state")).toContainText("MODEL / READY", { timeout: 25_000 });
    await expect(page.locator(".camping-studio__explore-state")).toContainText("EXPLORATION ACTIVE", { timeout: 20_000 });
    const canvas = page.locator("canvas.camping-studio__canvas");
    await expect(canvas).toHaveAttribute("data-camping-scene-status", "ready");
    await expect(canvas).toHaveAttribute("data-camping-scene-missing-nodes", "");
    await expect(canvas).toHaveAttribute("data-camping-artist-slots", "17");
    await expect(canvas).toHaveAttribute("data-camping-banner-status", "ready");
    await expect(canvas).toHaveAttribute("data-camping-xoyens-sign-status", "ready");
    await expect(canvas).toHaveAttribute("data-camping-daw-screen-status", "ready");
    await expect(canvas).toHaveAttribute("data-camping-portraits-requested", "17");
    await expect(canvas).toHaveAttribute("data-camping-portraits-loaded", "17");
    await expect(canvas).toHaveAttribute("data-camping-portraits-complete", "true");
    await page.screenshot({ path: "test-results/camping-reference-full-ui.png" });
    await canvas.screenshot({ path: "test-results/camping-reference-canvas.png" });
    expect(glbResponses).toContain(200);
    expect(portraitResponses.size).toBe(17);
    expect([...portraitResponses.values()].every((status) => status === 200)).toBe(true);
    expect(brandResponses.size).toBe(2);
    expect([...brandResponses.values()].every((status) => status === 200)).toBe(true);

    // Capture actual browser runtime counters. CPU frame time is diagnostic only;
    // GPU frame time requires a profiler and is not inferred from these values.
    await expect(canvas).toHaveAttribute("data-camping-perf-fps", /^\d+(?:\.\d+)?$/, { timeout: 12_000 });
    const renderStats = await canvas.evaluate((element) => ({
      pixelRatio: element.getAttribute("data-camping-render-pixel-ratio"),
      fps: element.getAttribute("data-camping-perf-fps"),
      cpuFrameMsAvg: element.getAttribute("data-camping-perf-cpu-frame-ms-avg"),
      cpuFrameMsMax: element.getAttribute("data-camping-perf-cpu-frame-ms-max"),
      drawCalls: element.getAttribute("data-camping-perf-draw-calls"),
      triangles: element.getAttribute("data-camping-perf-triangles"),
      geometries: element.getAttribute("data-camping-perf-geometries"),
      textures: element.getAttribute("data-camping-perf-textures"),
    }));
    const diagnosticsJson = JSON.stringify(renderStats, null, 2);
    mkdirSync("test-results", { recursive: true });
    writeFileSync("test-results/camping-renderer-diagnostics.json", diagnosticsJson, "utf8");
    await test.info().attach("camping-renderer-diagnostics.json", {
      body: Buffer.from(diagnosticsJson),
      contentType: "application/json",
    });
    expect(Number(renderStats.pixelRatio)).toBeLessThanOrEqual(2);
    expect(Number(renderStats.drawCalls)).toBeGreaterThan(0);
    expect(Number(renderStats.triangles)).toBeGreaterThan(0);
    expect(Number(renderStats.geometries)).toBeGreaterThan(0);
    expect(Number(renderStats.textures)).toBeGreaterThan(0);
    expect(Number(renderStats.fps)).toBeGreaterThan(0);
    expect(Number(renderStats.cpuFrameMsAvg)).toBeGreaterThan(0);
  });

  test("does not expose the 3D diagnostic API without the explicit debug flag", async ({ page }) => {
    await openCamping(page);
    expect(await page.evaluate(() => typeof window.__SDT3D__)).toBe("undefined");
  });

  test("captures the seven deterministic baseline poses and renderer fidelity metrics", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1774, height: 887 });
    await openCamping(page, "?debug3d=1&pose=entrada&still=1");
    const canvas = page.locator("canvas.camping-studio__canvas");
    if (await page.locator('.camping-studio__fallback[aria-label="Acesso alternativo"]').isVisible()) {
      throw new Error("Fase 01 requires WebGL in the Playwright runner to capture deterministic CAMPING poses.");
    }

    // The explicit debug flag intentionally performs the 808 access sequence
    // after renderer startup so deterministic captures cannot race the keypad.
    await expect(page.locator(".camping-studio__explore-state")).toContainText("EXPLORATION ACTIVE", { timeout: 30_000 });
    await expect.poll(() => page.evaluate(() => window.__SDT3D__?.ready ?? false), { timeout: 30_000 }).toBe(true);

    const api = await page.evaluate(() => {
      const debug = window.__SDT3D__;
      if (!debug) return null;
      debug.freeze();
      return { metrics: debug.metrics(), initialPose: debug.metrics()?.pose };
    });
    expect(api).not.toBeNull();
    expect(api?.metrics).not.toBeNull();
    expect(api?.metrics?.triangles).toBeGreaterThan(0);
    expect(api?.metrics?.drawCalls).toBeGreaterThan(0);
    expect(api?.metrics?.geometries).toBeGreaterThan(0);
    expect(api?.metrics?.textures).toBeGreaterThan(0);

    const poses = ["entrada", "producao", "foto", "esquerda", "direita", "tecto", "chao"] as const;
    mkdirSync("test-results/camping-v3-baseline", { recursive: true });
    const captureMetrics: Record<string, unknown> = {};
    for (const pose of poses) {
      const applied = await page.evaluate((id) => window.__SDT3D__?.setPose(id) ?? false, pose);
      expect(applied, "pose should apply only after 808 unlock and GLB readiness: " + pose).toBe(true);
      await expect(canvas).toHaveAttribute("data-camping-debug-pose", pose);
      await expect(canvas).toHaveAttribute("data-camping-debug-frozen", "true");
      const cameraBounds = await canvas.evaluate((element) => ({
        position: element.getAttribute("data-camping-camera-position"),
        bounds: element.getAttribute("data-camping-model-floor-bounds"),
        source: element.getAttribute("data-camping-model-source"),
        poseSource: element.getAttribute("data-camping-camera-pose-source"),
        floorBoundsSource: element.getAttribute("data-camping-model-floor-bounds-source"),
        floorSize: element.getAttribute("data-camping-model-floor-size"),
        floorY: element.getAttribute("data-camping-model-floor-y"),
        eyeY: element.getAttribute("data-camping-camera-eye-y"),
        pitch: element.getAttribute("data-camping-camera-pitch-deg"),
      }));
      expect(cameraBounds.position, "camera position diagnostics for " + pose).not.toBeNull();
      expect(cameraBounds.bounds, "model floor bounds diagnostics for " + pose).not.toBeNull();
      expect(cameraBounds.source, "production GLB should be classified as Blender V3").toBe("blender-v3");
      expect(cameraBounds.poseSource, "camera should use a model-derived pose for " + pose).toBe("blender-v3-scene");
      expect(cameraBounds.pitch, "camera pitch diagnostics for " + pose).not.toBeNull();
      if (pose !== "tecto" && pose !== "chao") {
        const pitchDegrees = Number(cameraBounds.pitch);
        expect(pitchDegrees, pose + " camera pitch should remain near eye level").toBeGreaterThanOrEqual(-18);
        expect(pitchDegrees, pose + " camera pitch should remain near eye level").toBeLessThanOrEqual(8);
      }
      const cameraPosition = JSON.parse(cameraBounds.position!) as [number, number, number];
      const floorBounds = JSON.parse(cameraBounds.bounds!) as [number, number, number, number];
      expect(cameraPosition[0], pose + " camera x inside floor").toBeGreaterThan(floorBounds[0]);
      expect(cameraPosition[0], pose + " camera x inside floor").toBeLessThan(floorBounds[2]);
      expect(cameraPosition[2], pose + " camera z inside floor").toBeGreaterThan(floorBounds[1]);
      expect(cameraPosition[2], pose + " camera z inside floor").toBeLessThan(floorBounds[3]);
      const metrics = await page.evaluate(() => window.__SDT3D__?.metrics() ?? null);
      expect(metrics).not.toBeNull();
      captureMetrics[pose] = metrics;
      const screenshotPath = "test-results/camping-v3-baseline/pose-" + pose + ".png";
      await canvas.screenshot({ path: screenshotPath, animations: "disabled" });
      await test.info().attach("camping-v3-baseline-" + pose, { path: screenshotPath, contentType: "image/png" });
    }

    const referenceMatch = await page.evaluate(() => window.__SDT3D__?.referenceMatch() ?? null);
    expect(referenceMatch).not.toBeNull();
    expect(typeof referenceMatch?.score).toBe("number");
    expect(referenceMatch?.worst).toHaveLength(5);
    const report = JSON.stringify({
      shaReference: referenceMatch?.referenceSourceSha256,
      viewport: { width: 1774, height: 887 },
      poses: captureMetrics,
      referenceMatchScore: referenceMatch?.score,
      worstSectors: referenceMatch?.worst,
      note: "Baseline screenshots are evidence artifacts. They are not approved visual goldens until reviewed against the original PNG.",
    }, null, 2);
    writeFileSync("test-results/camping-v3-baseline/metrics.json", report, "utf8");
    await test.info().attach("camping-v3-baseline-metrics.json", { body: Buffer.from(report), contentType: "application/json" });
  });

  test("keeps navigation and records usable at a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openCamping(page);
    await expect(page.getByRole("button", { name: "NAVEGAÇÃO GUIADA" })).toBeVisible();
    await expect(page.getByRole("button", { name: "REGISTOS" })).toBeVisible();
    await expect(page.getByRole("button", { name: "SAIR" })).toBeVisible();

    if (await page.locator('.camping-studio__fallback[aria-label="Acesso alternativo"]').isVisible()) {
      await page.getByRole("button", { name: "ABRIR REGISTOS PÚBLICOS" }).click();
    } else {
      const codeSlots = page.locator(".camping-studio__code-slots");
      await page.locator("canvas.camping-studio__canvas").focus();
      await page.keyboard.press("8");
      await expect(codeSlots).toHaveAttribute("aria-label", "Código introduzido: 8");
      await page.keyboard.press("0");
      await expect(codeSlots).toHaveAttribute("aria-label", "Código introduzido: 80");
      await page.keyboard.press("8");
      await expect(page.locator(".camping-studio__transition")).toBeVisible({ timeout: 5_000 });
      await expect(page.locator(".camping-studio__explore-state")).toContainText("EXPLORATION ACTIVE", { timeout: 30_000 });
      await expect(page.getByRole("button", { name: "AVANÇAR" })).toBeVisible();
      await expect(page.getByRole("button", { name: "DIREITA" })).toBeVisible();
    }

    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.evaluate(() => document.body.clientWidth));
  });
});


test("serves a certified optimized Blender V3 model on the canonical CAMPING URL", async ({ page }) => {
  test.setTimeout(120_000);
  // Validate the files served by the app before trying WebGL. This must never
  // be skipped because the CI browser lacks a GPU/WebGL implementation.
  const metadataResponse = await page.request.get("/models/camping/xoyens-studio.model.json", {
    headers: { "cache-control": "no-cache" },
  });
  expect(metadataResponse.status(), "canonical CAMPING model metadata must be served").toBe(200);
  const metadata = await metadataResponse.json();

  expect(metadata.version).toBe(3);
  expect(metadata.phase).toBe(9);
  expect(metadata.productionPhase).toBe(metadata.phase);
  expect(metadata.surfacePhase).toBe(7);
  expect(metadata.status).toBe("blender-v3-published");

  const photoZone = metadata.geometry?.photoZone;
  expect(photoZone?.sourceStatus).toBe("source-validated");
  expect(photoZone?.requiredElements).toBe(9);
  expect(photoZone?.taggedPhotoObjects).toBe(9);
  expect(photoZone?.garments).toBe(5);
  expect(photoZone?.sealDiameterM).toBeCloseTo(2.2, 3);
  expect(photoZone?.rackWidthM).toBeCloseTo(1.6, 3);
  expect(photoZone?.requiredMaterialsLinked).toEqual(expect.arrayContaining([
    "print_official_seal",
    "print_official_xoyens",
    "led_panel_emissive",
    "led_warm_emissive",
  ]));
  expect(photoZone?.requiredInteractionsPreserved).toEqual(expect.arrayContaining([
    "studio.photo-backdrop",
    "studio.merch-rack",
  ]));
  expect(metadata.model).toBe("/models/camping/xoyens-studio.glb");
  expect(metadata.geometry?.productionZone?.sourceStatus).toBe("source-validated");
  expect(metadata.geometry?.productionZone?.requiredElements).toBe(19);
  expect(metadata.geometry?.productionZone?.chairUpholsteryTrianglesSource).toBeGreaterThanOrEqual(14_000);
  expect(metadata.geometry?.productionZone?.chairUpholsteryTrianglesSource).toBeLessThanOrEqual(18_000);
  expect(metadata.geometry?.productionZone?.midiWhiteKeys).toBe(36);
  expect(metadata.geometry?.productionZone?.midiBlackKeys).toBe(25);
  expect(metadata.geometry?.productionZone?.trianglesAddedFromPhase7).toBeGreaterThan(0);

  const modelResponse = await page.request.get(metadata.model, {
    headers: { "cache-control": "no-cache" },
  });
  expect(modelResponse.status(), "canonical CAMPING GLB must be served").toBe(200);
  const modelBytes = await modelResponse.body();
  expect(modelBytes.length).toBeGreaterThan(20);
  expect(modelBytes.length).toBeLessThanOrEqual(16 * 1024 * 1024);
  expect(modelBytes.toString("ascii", 0, 4)).toBe("glTF");
  expect(modelBytes.readUInt32LE(4)).toBe(2);
  expect(modelBytes.readUInt32LE(8)).toBe(modelBytes.length);

  const digest = createHash("sha256").update(modelBytes).digest("hex");
  expect(metadata.geometry?.sha256, "metadata geometry hash must match served GLB").toBe(digest);
  expect(metadata.geometry?.bytes, "metadata geometry byte count must match served GLB").toBe(modelBytes.length);
  expect(metadata.frontendDelivery?.sha256, "delivery hash must match served GLB").toBe(digest);
  expect(metadata.frontendDelivery?.bytes, "delivery byte count must match served GLB").toBe(modelBytes.length);
  expect(metadata.frontendDelivery?.canonicalUrl).toBe(metadata.model);

  let offset = 12;
  let gltf: CampingGlb | null = null;
  while (offset + 8 <= modelBytes.length) {
    const length = modelBytes.readUInt32LE(offset);
    const type = modelBytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    expect(start + length).toBeLessThanOrEqual(modelBytes.length);
    if (type === 0x4e4f534a) {
      gltf = JSON.parse(modelBytes.subarray(start, start + length).toString("utf8").replace(/\0+$/g, "").trim()) as CampingGlb;
    }
    offset = start + length;
  }
  expect(gltf, "served GLB must contain a valid JSON chunk").not.toBeNull();
  const extensions = new Set(gltf?.extensionsUsed ?? []);
  expect(extensions.has("KHR_texture_basisu"), "served GLB must contain KTX2/Basis textures").toBe(true);
  expect(extensions.has("EXT_meshopt_compression"), "served GLB must contain Meshopt compression").toBe(true);
  expect(metadata.geometry?.extensionsUsed).toEqual(expect.arrayContaining([
    "KHR_texture_basisu",
    "EXT_meshopt_compression",
  ]));

  const nodes = gltf?.nodes ?? [];
  const phase8MaterialNames = new Set((gltf?.materials ?? []).map((material: { name?: string }) => material.name));
  const phase9MaterialNames = new Set((gltf?.materials ?? []).map((material: { name?: string }) => material.name));
  for (const name of ["print_official_seal", "print_official_xoyens", "led_panel_emissive"]) {
    expect(phase9MaterialNames.has(name), "Phase 09 photo material must be used in the served GLB: " + name).toBe(true);
  }
  const garmentMeshes = nodes.filter((node: { name?: unknown; mesh?: unknown }) =>
    /^SDT_photo_garments_garment_\d+$/.test(String(node.name ?? "")) && Number.isInteger(node.mesh));
  expect(garmentMeshes).toHaveLength(5);
  for (const name of ["ceramic_red", "glass_mirror", "led_warm_emissive"]) {
    expect(phase8MaterialNames.has(name), "Phase 08 material must be used in the served GLB: " + name).toBe(true);
  }
  expect(nodes.some((node: { name?: unknown; mesh?: unknown }) =>
    node.name === "SDT_production_monitor_daw_screen" && Number.isInteger(node.mesh))).toBe(true);
  const interactionIds = new Set(
    nodes.map((node: { extras?: { interactionId?: unknown } }) => node.extras?.interactionId)
      .filter((id: unknown): id is string => typeof id === "string"),
  );
  const requiredInteractions = [
    "studio.imac",
    "studio.artists-wall",
    "studio.merch-rack",
    "studio.photo-backdrop",
    "studio.production-desk",
    "studio.audio-system",
    "studio.inner-door",
  ];
  expect(requiredInteractions.filter((id) => !interactionIds.has(id))).toEqual([]);
  // Blender frame meshes retain SDT_* source names. Their stable slot IDs
  // are stored in extras.interactionId and normalized into object names by the
  // frontend runtime before the 17 portraits are mounted.
  const slotContracts = new Set(
    nodes.flatMap((node: { name?: unknown; extras?: { interactionId?: unknown } }) => [
      node.name,
      node.extras?.interactionId,
    ]).filter((value: unknown): value is string => typeof value === "string"),
  );
  const requiredSlots = Array.from({ length: 17 }, (_, index) => "studio.artist-slot-" + String(index + 1).padStart(3, "0"));
  expect(requiredSlots.filter((name) => !slotContracts.has(name))).toEqual([]);
  expect(slotContracts.has("studio.artist-slot-018")).toBe(false);

  const findPhaseNode = (elementId: string, namePattern: RegExp) =>
    nodes.find((node: { name?: unknown; mesh?: unknown; extras?: Record<string, unknown> }) =>
      node.extras?.elementId === elementId && node.extras?.surfacePhase === 7) ??
    nodes.find((node: { name?: unknown; mesh?: unknown; extras?: Record<string, unknown> }) =>
      namePattern.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
  const floorNode = findPhaseNode("floor.wood", /floor_wood_hero/i);
  const vinylNode = findPhaseNode("floor.vinyl_sweep", /vinyl_sweep_hero/i);
  const bambooNode = findPhaseNode("arch.vault_ceiling", /vault_ceiling/i);
  const paperWallNode = nodes.find((node: { name?: unknown; extras?: Record<string, unknown> }) =>
    /paper_cyclorama_wall/i.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
  const paperCurveNode = nodes.find((node: { name?: unknown; extras?: Record<string, unknown> }) =>
    /paper_cyclorama_curve/i.test(String(node.name ?? "")) && node.extras?.surfacePhase === 7);
  expect(floorNode, "served GLB must include the Phase 07 walnut plank mesh").toBeTruthy();
  expect(floorNode?.extras?.phase7BoardCount).toBeGreaterThanOrEqual(100);
  const floorPrimitives = gltf?.meshes?.[Number(floorNode?.mesh)]?.primitives ?? [];
  expect(floorPrimitives.length).toBeGreaterThan(0);
  for (const primitive of floorPrimitives) {
    expect(primitive.attributes?.COLOR_0, "physical plank tone variation must reach glTF COLOR_0").toBeDefined();
    expect(primitive.attributes?.TEXCOORD_0).toBeDefined();
    expect(primitive.attributes?.TEXCOORD_1).toBeDefined();
  }
  expect(vinylNode).toBeTruthy();
  expect(Number(vinylNode?.extras?.phase7VinylRadiusM)).toBeCloseTo(2.3, 3);
  expect(Number(vinylNode?.extras?.phase7VinylThicknessM)).toBeCloseTo(0.0012, 4);
  expect(Number(vinylNode?.extras?.phase7VinylEdgeLiftM)).toBeCloseTo(0.004, 4);
  expect(bambooNode).toBeTruthy();
  expect(Number(bambooNode?.extras?.phase7BambooTileMeters)).toBeCloseTo(1.2, 4);
  expect(paperWallNode).toBeTruthy();
  expect(paperCurveNode).toBeTruthy();
  expect(Number(paperCurveNode?.extras?.phase7CycloramaRadiusM)).toBeCloseTo(0.35, 4);
  expect(paperCurveNode?.extras?.phase7PaperContinuousToFloor).toBe(true);
  expect(metadata.geometry?.heroSurfaces?.floorBoards).toBe(floorNode?.extras?.phase7BoardCount);
  expect(metadata.geometry?.heroSurfaces?.floorHasColor0).toBe(true);
  expect(metadata.geometry?.heroSurfaces?.floorHasUv0Uv1).toBe(true);
  expect(metadata.geometry?.heroSurfaces?.vinylRadiusM).toBeCloseTo(2.3, 3);
  expect(metadata.geometry?.heroSurfaces?.bambooTileMeters).toBeCloseTo(1.2, 4);
  expect(metadata.geometry?.heroSurfaces?.cycloramaRadiusM).toBeCloseTo(0.35, 4);
  expect(metadata.geometry?.meshes).toBe(gltf?.meshes?.length);
  expect(metadata.geometry?.primitives).toBe(
    (gltf?.meshes ?? []).reduce((count: number, mesh: { primitives?: unknown[] }) => count + (mesh.primitives?.length ?? 0), 0),
  );
  expect(metadata.geometry?.materials).toBe(gltf?.materials?.length);
  expect(metadata.geometry?.embeddedImages).toBe(gltf?.images?.length);

  // Keep the large compressed GLB response paused until the code gate has
  // completed its React transition. This isolates gate hydration from model
  // decoding while still verifying that the browser subsequently loads it.
  await page.setViewportSize({ width: 1774, height: 887 });
  let releaseModelResponse!: () => void;
  const modelResponseGate = new Promise<void>((resolve) => {
    releaseModelResponse = resolve;
  });
  await page.route("**/models/camping/xoyens-studio.glb**", async (route) => {
    await modelResponseGate;
    await route.continue();
  });
  await openCamping(page, "", { afterNavigation: () => releaseModelResponse() });
  const canvas = page.locator("canvas.camping-studio__canvas");
  const fallback = page.locator('.camping-studio__fallback[aria-label="Acesso alternativo"]');

  // In Chromium CI the scene sits behind the global access overlay. Inspect
  // its non-sensitive renderer diagnostics without treating the hidden route as
  // a visibility failure. On machines without WebGL, the accessible fallback
  // remains a supported outcome.
  await expect.poll(async () => {
    const modelSource = await canvas.getAttribute("data-camping-model-source");
    const webglStatus = await canvas.getAttribute("data-camping-webgl-status");
    return modelSource === "blender-v3" ||
      webglStatus === "startup-error" ||
      (await fallback.count()) > 0;
  }, { timeout: 60_000 }).toBe(true);

  const webglStatus = await canvas.getAttribute("data-camping-webgl-status");
  if (webglStatus === "startup-error" || await fallback.count() > 0) return;

  await expect(canvas).toHaveAttribute("data-camping-model-source", "blender-v3", { timeout: 60_000 });
  await expect(canvas).toHaveAttribute("data-camping-model-version", "3");
  await expect(canvas).toHaveAttribute("data-camping-scene-status", "ready");
  await expect(canvas).toHaveAttribute("data-camping-artist-slots", "17");
});
