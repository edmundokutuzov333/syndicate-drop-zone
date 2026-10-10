import { test, expect, type Page } from "@playwright/test";
function createPhotoFixture(): Buffer {
  // Known valid 1x1 PNG fixture: the test should exercise the upload flow, not PNG encoding.
  return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR42mNsaGhgIAUwMZAIRjWMahg6GgDJTAGg54KQ4AAAAABJRU5ErkJggg==", "base64");
}

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
      name: "foto-teste.png",
      mimeType: "image/png",
      buffer: createPhotoFixture(),
    });
    await expect(page.getByText("FOTOGRAFIA SELECCIONADA", { exact: true })).toBeVisible();
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
    const form = page.locator("#parcerias-form");
    await form.getByPlaceholder("Nome da marca / responsável").fill("Marca Teste");
    await form.getByPlaceholder("Nome da empresa").fill("Empresa Teste");
    await form.getByPlaceholder("Email, telefone ou WhatsApp").fill("contacto@empresa.co.mz");
    await form.locator("select").selectOption({ label: "Patrocínio · MASTER" });
    await form.getByPlaceholder("Explique a marca, objectivo da parceria e o que pretende activar.").fill("Proposta real de activação da marca no Sindicato do Trap.");
    await form.getByRole("button", { name: "ENVIAR PROPOSTA" }).click();
    await expect(form.getByText("PROPOSTA RECEBIDA", { exact: true })).toBeVisible();
    await expect(form.getByText("A equipa do Sindicato recebeu os dados e entra em contacto para dar seguimento.")).toBeVisible();
  });
});
