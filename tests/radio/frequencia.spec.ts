const RADIO_SOURCES = [
  "https://files.catbox.moe/b5ypxy.wav",
  "https://files.catbox.moe/alftc5.mp3",
  "https://files.catbox.moe/qj0i9z.mp3",
  "https://files.catbox.moe/fije61.mp3",
  "https://files.catbox.moe/o47a3g.mp3",
  "https://files.catbox.moe/9b0rq5.mp3",
  "https://files.catbox.moe/0kg9v2.mp3",
  "https://files.catbox.moe/g9nczk.mp3",
  "https://files.catbox.moe/6hit4n.wav",
];

import { test, expect } from "@playwright/test";

function wavBody(seconds = 1) {
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

async function mockBackend(page: import("@playwright/test").Page) {
  await page.route("**/rest/v1/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });

  const wav = wavBody();
  await page.route("https://files.catbox.moe/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: wav,
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  });
}

async function openUnlocked(page: import("@playwright/test").Page) {
  await page.addInitScript((sources) => {
    sessionStorage.setItem("sdt-open", "1");
    (window as Window & { __radioPlaySources?: string[] }).__radioPlaySources = [];
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLAudioElement) {
        const src = this.currentSrc || this.src;
        if (src) (window as Window & { __radioPlaySources?: string[] }).__radioPlaySources?.push(src);
      }
      return originalPlay.call(this);
    };
    void sources;
  }, RADIO_SOURCES);

  await page.goto("/frequencia");
  await expect(page.getByRole("heading", { name: "FREQUÊNCIA 808" })).toBeVisible();
}

test.describe("Frequência 808 browser smoke", () => {
  test("auto-starts after an unlocked session, pauses, resumes, controls volume and stops", async ({ page }) => {
    await mockBackend(page);
    await openUnlocked(page);

    await expect.poll(async () => await page.evaluate(() => navigator.mediaSession?.playbackState ?? "none")).toBe("playing");
    await expect(page.getByText("NO AR AGORA")).toBeVisible();

    await expect.poll(async () => page.evaluate(() => {
      const sources = (window as Window & { __radioPlaySources?: string[] }).__radioPlaySources ?? [];
      return sources.find((src) => src.includes("files.catbox.moe")) ?? "";
    })).not.toBe("");

    const source = await page.evaluate(() => {
      const sources = (window as Window & { __radioPlaySources?: string[] }).__radioPlaySources ?? [];
      return sources.find((src) => src.includes("files.catbox.moe")) ?? "";
    });
    expect(RADIO_SOURCES).toContain(source);
    expect(source).not.toContain("nova-wave.mp3");
    expect(source).not.toContain("phantom-mode.mp3");

    const progress = page.getByRole("slider", { name: "Volume da Rádio Sindicato do Trap" });
    await expect(progress).toBeVisible();
    await progress.fill("0.35");
    await expect.poll(async () => page.evaluate(() => localStorage.getItem("sdt-radio-volume"))).toBe("0.35");

    await page.getByRole("button", { name: "PAUSAR" }).click();
    await expect(page.getByRole("button", { name: "RETOMAR" })).toBeVisible();

    await page.getByRole("button", { name: "RETOMAR" }).click();
    await expect(page.getByRole("button", { name: "PAUSAR" })).toBeVisible();

    await page.getByRole("button", { name: "DESLIGAR RÁDIO" }).click();
    await expect(page.getByText("FORA DO AR")).toBeVisible();

    await page.getByRole("button", { name: "SINTONIZAR" }).click();
    await expect.poll(async () => await page.evaluate(() => navigator.mediaSession?.playbackState ?? "none")).toBe("playing");
  });

  test("keeps the radio alive with emergency static when a track fails", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("sdt-open", "1");
    });
    await page.route("**/rest/v1/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.route("https://files.catbox.moe/**", async (route) => {
      await route.abort();
    });

    await page.goto("/frequencia");
    await expect(page.getByRole("heading", { name: "FREQUÊNCIA 808" })).toBeVisible();
    await expect.poll(async () => await page.evaluate(() => navigator.mediaSession?.playbackState ?? "none"), { timeout: 15_000 }).toBe("playing");
    await expect(page.getByText(/SINAL DE EMERGÊNCIA|INTERFERÊNCIA 808/)).toBeVisible();
  });
});
