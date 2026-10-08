import { test, expect, type Page } from "@playwright/test";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function mockPublicBackend(page: Page) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = route.request().url();

    if (url.endsWith("/rest/v1/rpc/join_union")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: "ABC123",
          member_number: 42,
          alias: "TESTE",
          since: "2026-10-08T20:00:00.000Z",
          already_member: false,
        }),
      });
      return;
    }

    if (url.endsWith("/rest/v1/rpc/submit_partnership_request")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify("00000000-0000-4000-8000-000000000001"),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
}


async function unlock(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem("sdt-open", "1");
  });
}

test.describe("Filiação and public proposals", () => {
  test("supports both gallery selection and camera capture inputs, then completes filiation", async ({ page }) => {
    await unlock(page);
    await mockPublicBackend(page);
    await page.goto("/filiar");

    for (let index = 1; index <= 6; index++) {
      await page.getByRole("button", { name: new RegExp("CLAUSULA 0" + index) }).click();
    }

    await page.getByRole("button", { name: "AVANÇAR PARA A FICHA" }).click();

    const gallery = page.locator("#member-photo-gallery");
    const camera = page.locator("#member-photo-camera");

    await expect(gallery).toHaveAttribute("type", "file");
    await expect(gallery).not.toHaveAttribute("capture", /.+/);
    await expect(camera).toHaveAttribute("capture", "user");

    await gallery.setInputFiles({
      name: "member-photo.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    });

    await expect(page.getByText("FOTOGRAFIA CARREGADA", { exact: true })).toBeVisible();

    await page.getByLabel("Área de assinatura").hover();
    const signature = page.getByLabel("Área de assinatura");
    const box = await signature.boundingBox();
    if (!box) throw new Error("Signature canvas has no layout box.");

    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
    await page.mouse.up();

    await page.getByLabel("CODINOME").fill("TESTE");
    await page.getByPlaceholder("+258 84 000 0000").fill("+258 840000001");

    const submit = page.getByRole("button", { name: "ASSINAR E ENTRAR NO SINDICATO" });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText("CARTEIRA EMITIDA", { exact: true })).toBeVisible();
    await expect(page.getByText("Nº 0042", { exact: true })).toBeVisible();
    await expect(page.getByText("TESTE", { exact: true })).toBeVisible();
  });

  test("submits sponsorship proposals through the backend RPC and confirms success", async ({ page }) => {
    await unlock(page);
    await mockPublicBackend(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Abrir proposta de parceria MASTER" }).click();

    await page.getByPlaceholder("Nome da marca / responsável").fill("Marca Teste");
    await page.getByPlaceholder("Nome da empresa").fill("Empresa Teste");
    await page.getByPlaceholder("Email, telefone ou WhatsApp").fill("contacto@empresa.co.mz");
    await page.locator("select").selectOption({ label: "Patrocínio · MASTER" });
    await page.getByPlaceholder("Explique a marca, objectivo da parceria e o que pretende activar.").fill(
      "Proposta real de activação da marca no Sindicato do Trap.",
    );

    await page.getByRole("button", { name: "ENVIAR PROPOSTA" }).click();

    await expect(page.getByText("PROPOSTA RECEBIDA", { exact: true })).toBeVisible();
    await expect(page.getByText("A equipa do Sindicato recebeu os dados e entra em contacto para dar seguimento.")).toBeVisible();
  });
});
