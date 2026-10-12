import { test, expect } from "@playwright/test";
import { unlockSite } from "./site-gate";

function wavBody(seconds = 12) {
  const sampleRate = 8000;
  const samples = Math.max(1, Math.floor(sampleRate * seconds));
  const buffer = Buffer.alloc(44 + samples * 2);
  let offset = 0;
  buffer.write("RIFF", offset); offset += 4;
  buffer.writeUInt32LE(buffer.length - 8, offset); offset += 4;
  buffer.write("WAVE", offset); offset += 4;
  buffer.write("fmt ", offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * 2, offset); offset += 4;
  buffer.writeUInt16LE(2, offset); offset += 2;
  buffer.writeUInt16LE(16, offset); offset += 2;
  buffer.write("data", offset); offset += 4;
  buffer.writeUInt32LE(samples * 2, offset); offset += 4;
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin((i / sampleRate) * Math.PI * 2 * 220) * 0.08;
    buffer.writeInt16LE(Math.round(sample * 32767), offset);
    offset += 2;
  }
  return buffer;
}

test("Merch keeps products hidden until a listener plays a tape for ten seconds", async ({ page }) => {

  await page.route("**/rest/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  const mockAudio = async (route: import("@playwright/test").Route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: wavBody(12),
      headers: { "Cache-Control": "no-store", "Accept-Ranges": "bytes" },
    });
  };
  await page.route(/\/__l5e\/assets-v1\//, mockAudio);
  await page.route(/\/audio\//, mockAudio);

  await page.goto("/merch");
  await unlockSite(page);
  await expect(page.getByRole("heading", { name: "COFRE FECHADO" })).toBeVisible();
  await expect(page.getByText("HEAVYWEIGHT BOXY TEE", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "RESERVAR UNIDADE" })).toHaveCount(0);

  await page.getByRole("button", { name: "Ouvir A NOVA WAVE" }).click();

  await expect.poll(
    () => page.evaluate(() => Number(localStorage.getItem("sdt-key") || 0) > 0),
    { timeout: 25_000, intervals: [250, 500, 1000] },
  ).toBe(true);

  await expect(page.getByRole("heading", { name: "COFRE FECHADO" })).toHaveCount(0);
  await expect(page.getByText("HEAVYWEIGHT BOXY TEE", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "RESERVAR UNIDADE" })).toBeEnabled();
});
