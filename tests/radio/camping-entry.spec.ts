import { expect, test } from "@playwright/test";

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

async function openCamping(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem("sdt-open", "1");
  });
  await page.route("**/rest/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: pathname.endsWith("/artists") ? JSON.stringify(PUBLISHED_ARTIST_FIXTURE) : "[]",
    });
  });
  await page.goto("/camping");
  await expect(page.locator("main.camping-studio-route")).toBeVisible();
  await expect(page.locator("canvas.camping-studio__canvas")).toBeVisible();
}

test.describe("CAMPING V2 / 808 access", () => {
  test("mounts the 3D entry or an accessible WebGL fallback", async ({ page }) => {
    await openCamping(page);

    const fallback = page.getByRole("heading", { name: "ACESSO ALTERNATIVO" });
    if (await fallback.isVisible()) {
      await expect(page.getByRole("button", { name: "ABRIR REGISTOS PÚBLICOS" })).toBeVisible();
      await expect(page.getByRole("button", { name: "SAIR DA EXPERIÊNCIA" })).toBeVisible();
      return;
    }

    await expect(page.getByRole("heading", { name: "808", exact: true })).toBeVisible();
    await expect(page.locator(".camping-studio__room")).toHaveText("STUDIO XOYENS");
    await expect(page.locator(".camping-studio__access-panel")).toContainText("Código de acesso");
    await expect(page.locator(".camping-studio__access-panel")).not.toContainText("ENTRY PROTOCOL");
    await expect(page.locator(".camping-studio__access-panel")).not.toContainText("WASD / DRAG LOOK");
    await expect(page.locator(".camping-studio__header-right")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "NAVEGAÇÃO GUIADA" })).toBeVisible();
    await expect(page.getByRole("button", { name: "REGISTOS" })).toBeVisible();
  });

  test("captures 808 while a non-input interface button has keyboard focus", async ({ page }) => {
    await openCamping(page);
    if (await page.getByRole("heading", { name: "ACESSO ALTERNATIVO" }).isVisible()) {
      test.skip(true, "O runtime Chromium deste job não disponibiliza WebGL.");
    }

    await page.getByRole("button", { name: "NAVEGAÇÃO GUIADA" }).focus();
    await page.keyboard.press("8");
    await page.keyboard.press("0");
    await page.keyboard.press("8");

    await expect(page.locator(".camping-studio__status")).toContainText("EXPLORATION", { timeout: 30_000 });
  });

  test("accepts 808 and enters the loaded studio when WebGL is available", async ({ page }) => {
    await openCamping(page);
    if (await page.getByRole("heading", { name: "ACESSO ALTERNATIVO" }).isVisible()) {
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

    await page.locator("canvas.camping-studio__canvas").focus();
    await page.keyboard.press("8");
    await page.keyboard.press("0");
    await page.keyboard.press("8");
    await expect(page.locator(".camping-studio__asset-state")).toContainText("MODEL / READY", { timeout: 25_000 });
    await expect(page.locator(".camping-studio__status")).toContainText("EXPLORATION", { timeout: 20_000 });
    expect(glbResponses).toContain(200);
    expect(portraitResponses.size).toBe(17);
    expect([...portraitResponses.values()].every((status) => status === 200)).toBe(true);
    expect(brandResponses.size).toBe(2);
    expect([...brandResponses.values()].every((status) => status === 200)).toBe(true);
  });

  test("keeps navigation and records usable at a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openCamping(page);
    await expect(page.getByRole("button", { name: "NAVEGAÇÃO GUIADA" })).toBeVisible();
    await expect(page.getByRole("button", { name: "REGISTOS" })).toBeVisible();
    await expect(page.getByRole("button", { name: "SAIR" })).toBeVisible();

    if (await page.getByRole("heading", { name: "ACESSO ALTERNATIVO" }).isVisible()) {
      await page.getByRole("button", { name: "ABRIR REGISTOS PÚBLICOS" }).click();
    } else {
      await page.locator("canvas.camping-studio__canvas").focus();
      await page.keyboard.press("8");
      await page.keyboard.press("0");
      await page.keyboard.press("8");
        await expect(page.locator(".camping-studio__status")).toContainText("EXPLORATION", { timeout: 30_000 });
      await expect(page.getByRole("button", { name: "AVANÇAR" })).toBeVisible();
      await expect(page.getByRole("button", { name: "DIREITA" })).toBeVisible();
    }

    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.evaluate(() => document.body.clientWidth));
  });
});
