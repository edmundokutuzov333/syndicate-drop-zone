import { test, expect, type Page } from "@playwright/test";

async function mockPublicBackend(page: Page) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/rest/v1/rpc/register_fan")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{
        code: "FAN123", fan_number: 42, alias: "TESTE", since: "2026-10-08T20:00:00.000Z",
      }]) });
      return;
    }
    if (url.endsWith("/rest/v1/rpc/fan_public")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{
        code: "FAN123", fan_number: 42, alias: "TESTE", since: "2026-10-08T20:00:00.000Z",
      }]) });
      return;
    }
    if (url.endsWith("/rest/v1/rpc/submit_partnership_request")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify("00000000-0000-4000-8000-000000000001") });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function unlock(page: Page) {
  await page.addInitScript(() => { sessionStorage.setItem("sdt-open", "1"); });
}

test.describe("Cartão de Fã and public proposals", () => {
  test("creates a fan card with the required local photo and without contact or signature", async ({ page }) => {
    await unlock(page);
    await mockPublicBackend(page);
    await page.goto("/filiar");
    await page.getByLabel("NOME OU APELIDO").fill("TESTE");
    await page.locator("#fan-photo").setInputFiles({
      name: "foto-teste.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960"><rect width="540" height="960" fill="#222"/><circle cx="270" cy="280" r="120" fill="#bd252b"/></svg>'),
    });
    await page.getByLabel(/Aceito o Código do Fã/).check();
    await page.getByRole("button", { name: "CRIAR O MEU CARTÃO" }).click();
    await expect(page.getByText("CARTÃO DE FÃ CRIADO", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /DESCARREGAR IMAGEM PNG/ })).toBeVisible();
    await expect(page.getByLabel("ESCOLHE A MÚSICA")).toBeVisible();
  });

  test("submits sponsorship proposals through the backend RPC and confirms success", async ({ page }) => {
    await unlock(page);
    await mockPublicBackend(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir proposta de parceria MASTER" }).click();
    await page.getByPlaceholder("Nome de contacto").fill("Marca Teste");
    await page.getByPlaceholder("Nome da marca").fill("Empresa Teste");
    await page.getByPlaceholder("Email ou telefone").fill("contacto@empresa.co.mz");
    await page.getByLabel("TIPO DE PARCERIA").selectOption({ label: "Patrocínio" });
    await page.getByPlaceholder("Descreva a ideia, objectivos e activação pretendida.").fill("Proposta real de activação da marca no Sindicato do Trap.");
    await page.getByRole("button", { name: "ENVIAR PROPOSTA" }).click();
    await expect(page.getByText("PROPOSTA REGISTADA. A EQUIPA JÁ A PODE CONSULTAR NO CONTROL ROOM.", { exact: false })).toBeVisible();
    await expect(page.getByText("PROPOSTA REGISTADA. A EQUIPA JÁ A PODE CONSULTAR NO CONTROL ROOM.")).toBeVisible();
  });
});
