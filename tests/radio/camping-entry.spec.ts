import { expect, test } from "@playwright/test";

async function openCamping(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem("sdt-open", "1");
  });
  await page.route("**/rest/v1/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
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

    await expect(page.getByRole("heading", { name: /ENTER\s+ACCESS CODE/i })).toBeVisible();
    await expect(page.locator(".camping-studio__status")).toContainText("ACCESS LOCKED");
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
    page.on("response", (response) => {
      if (response.url().endsWith("/models/camping/xoyens-studio.glb")) {
        glbResponses.push(response.status());
      }
    });

    await page.locator("canvas.camping-studio__canvas").focus();
    await page.keyboard.press("8");
    await page.keyboard.press("0");
    await page.keyboard.press("8");
    await expect(page.locator(".camping-studio__asset-state")).toContainText("MODEL / READY", { timeout: 25_000 });
    await expect(page.locator(".camping-studio__status")).toContainText("EXPLORATION", { timeout: 20_000 });
    expect(glbResponses).toContain(200);
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
