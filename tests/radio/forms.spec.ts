import { test, expect, type Page } from "@playwright/test";
import { unlockSite } from "./site-gate";
function createPhotoFixture(): Buffer {
  // A small valid SVG image avoids brittle hand-encoded PNG bytes in this browser test.
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' +
      '<rect width="256" height="256" fill="#181818"/><circle cx="128" cy="96" r="54" fill="#a0a0a0"/>' +
      '<path d="M32 256c8-62 44-88 96-88s88 26 96 88" fill="#777"/>' +
      '<circle cx="108" cy="90" r="7" fill="#111"/><circle cx="148" cy="90" r="7" fill="#111"/>' +
      '<path d="M104 118q24 18 48 0" stroke="#111" stroke-width="6" fill="none"/></svg>',
    "utf-8",
  );
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

test.describe("Cartão de Fã and public proposals", () => {
  test("creates a fan card with the required local photo and without contact or signature", async ({ page }) => {
    await mockPublicBackend(page);
    await page.goto("/filiar");
    await unlockSite(page);
    await page.getByLabel("NOME OU APELIDO").fill("TESTE");
    await page.locator("#fan-photo").setInputFiles({
      name: "foto-teste.svg",
      mimeType: "image/svg+xml",
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
    await mockPublicBackend(page);
    await page.goto("/");
    await unlockSite(page);
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
