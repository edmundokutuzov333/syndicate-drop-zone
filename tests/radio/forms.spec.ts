import { test, expect, type Page } from "@playwright/test";
function createPhotoFixture(): Buffer {
  // Valid, textured 256x256 PNG so Chromium tests the upload flow with a decodable image.
  return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAECUlEQVR42u3dPXLyMBSGUZJhEV4eLStyy1JTpMzgGJDlK73ntN9PkLmPZEgmfC3LcoFU3y4BAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAD0cT36C9xuN1eZTzweDycACAAEAAIAAYAAQAAgABAACAAEAAIAAYAAQAAgABAACAAEgABAACAAEAAIAAQAAgABgABAACAAEAAM75q8+HVdn/3R/X63XgFkDf2zvzb0cKStVwCfjsKzfzjcWKStVwDtR2HQsUhbrxfBh0/DQf+b9ToBhhmF+ltj2nqdAGduXdW2xrT1CuD8Z6vOTKStVwBVnqcKM5G2XgHUeobOnYm09QoABFBsc/J1BZA7/W69BAACCN7++z+GtPUKAARQfivyDTgBgABAACCAuNtQP4UqABAACAAEAAIAAYAAQAAggCaq/b6aox9P2noFAAIAAYAASt+G9nkkaesVAAig/FbU8zGkrVcAIIDCG1L/r562XgHUfVZ8XQGAACIPAbdeAshtwLtPAshtwDfgBJDbgJ9CncPMH5P6+5w1/8U1ZUchbb1OgBOev/rTkLZeJ0CnrXGgUUhbrwCOHYtBRyFtvQJ4+dndGI5phiBtvQKw1VmvF8EgABAACAAEAAIAAYAAQAAIAAQAAgABgABAACAAEAAIAAQAAgABAACAAEAAIAAQAAgABAACCACtZ1bf5JcnNclsBVXz3B/L1EOR+lcY0d/XVdfWLKs0uUU4LXAHgNYNuz/QtgYm51XDcngM3PFRAAZAawcZonb4E+OtsJgBPAIRB5CNj+404ADZh+t0AXDXjvKzcA3xNwfZwA0Vuj7T89gO1Nbu752F5d4PEYegJkNmD6BZDbgOkXQO69svt+Abyz7c0xN/+uIvmdsfQTYPoGTL8Achsw/QJo1sBYGex5wKZfAK9NwygN7Hmcpl8AczZg+gVweAM1M9j5wEy/ABrMR6kM9j8Y0y+AllNyegYvPQDT/9fVJdiYlZ2z9fvXOo/XS+EZfQG8mcH+Oevz6wTfOHBMvwA6NXBcCW/faJl+AXS9Hdqe2v2vsHu+khEAB2bQfLKNfkPeBZpttky/E2CAo8DoC2CSo+D0Esy9AEIPBKMvgMQDwdwLYIzXoA1jMPQCGDuGix9eEIAeXIRqfB8AAYAAQAAgABAACAAEAAIAAYAAQAAgABAACAAEAAIAAYAAQAAgABAACAAEAAIAAYAAQAAgABAACAAEAAIAAYAAQAAgABAACAA+9LUsi6uAEwAEAAIAAYAAQAAgABAACAAEAAIAAYAAQAAgABAACAAEAAIAAYAAQAAgABAACAAEAAIAAYAAQADQwQ8OMqe9v8qn5AAAAABJRU5ErkJggg==", "base64");
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
