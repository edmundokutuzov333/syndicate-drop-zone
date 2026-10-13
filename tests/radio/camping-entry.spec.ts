import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { unlockSite } from "./site-gate";

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

async function openCamping(page: import("@playwright/test").Page, query = "") {
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

  await page.goto("/camping" + query);
  await unlockSite(page);
  await expect(page.locator("main.camping-studio-route")).toBeVisible();
  const canvas = page.locator("canvas.camping-studio__canvas");
  await expect(canvas).toBeVisible();

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

    const codeSlots = page.locator(".camping-studio__code-slots");
    await canvas.focus();
    await page.keyboard.press("8");
    await expect(codeSlots).toHaveAttribute("aria-label", "Código introduzido: 8");
    await page.keyboard.press("0");
    await expect(codeSlots).toHaveAttribute("aria-label", "Código introduzido: 80");
    await page.keyboard.press("8");
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
