const RADIO_SOURCES = [
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557765898171842621/A_BAG_Complete.mp3?ex=6ac8fe0c&is=6ac7ac8c&hm=1494126ae70966427cf777eb721772f3d4ef00814f3b7412937c89cf1b266b14&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557765662632575076/CHOPPER_1.mp3?ex=6ac8fdd3&is=6ac7ac53&hm=24be6c48e7ed9407277b217d90625b7208763f014fde12da7a6cdb4f2298cef4&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557765539441410178/FREESTYLE_SUJO.mp3?ex=6ac8fdb6&is=6ac7ac36&hm=1505bde309c1d01f5fe53938aa22637dac8accffce29b90fb90a63c94fa55c42&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557765583716614184/IM_FLEXIN_UP-KHRIYS_FT_GOMONEY.mp3?ex=6ac8fdc1&is=6ac7ac41&hm=5b7ee0a19fb3207d340c10bea0ebc551b0937b66a6de1cf8cf0f9cbaf58c9179&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557765540070559885/MONEY_TALK_2.1_MELHOR_QUALIDADE.mp3?ex=6ac8fdb6&is=6ac7ac36&hm=ff97f95b66b387da151f5fcc10e5a2d8767569ff4d8861632469148e7a50d148&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557765342690942986/TSANTO_DOUGH_1.mp3?ex=6ac8fd87&is=6ac7ac07&hm=9e02b411d4a7d54858462fcf40b4940708052c51b51ac2e01c5857200c5c6f71&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557766706838114324/Unmastered_PHANTOM_Kingston_Siriro_Elton_Penicela_-_Fashion_de_Phantom.mp3?ex=6ac8fecc&is=6ac7ad4c&hm=9c70066a9c203dbb469d1cf40fa26b3f2eeb987c45fff12942eefbc1f83741d1&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557766760034345020/Phantom_Bruno_The_Goat_Alemao_Wav__Elton_Penicela_-_A_Nova_Wave.mp3?ex=6ac8fed9&is=6ac7ad59&hm=65d0da1218a5d5b655ff7a83b3e8658942e24fde6dbd0817f36b9a36ae475be4&",
  "https://cdn.discordapp.com/attachments/1313921250678014022/1557766742204223548/PHANTOM_Mode_2_-_The_Final_Movie_W__INF8M8US_HEYYG_KINGSTON_SIRIRO.mp3?ex=6ac8fed5&is=6ac7ad55&hm=2359055ed92ca9baa8799a4abeaf9ec0bb9295072b4883b658a86c581705f89a&",
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
  await page.route("https://cdn.discordapp.com/attachments/**", async (route) => {
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
      return sources.find((src) => src.includes("cdn.discordapp.com/attachments/")) ?? "";
    })).not.toBe("");

    const source = await page.evaluate(() => {
      const sources = (window as Window & { __radioPlaySources?: string[] }).__radioPlaySources ?? [];
      return sources.find((src) => src.includes("cdn.discordapp.com/attachments/")) ?? "";
    });
    expect(RADIO_SOURCES).toContain(source);
    expect(source).not.toContain("nova-wave.mp3");
    expect(source).not.toContain("phantom-mode.mp3");

    const progress = page.getByRole("slider", { name: "Volume da Rádio Sindicato do Trap" });
    await expect(progress).toBeVisible();
    await progress.fill("0.35");
    await expect.poll(async () => page.evaluate(() => localStorage.getItem("sdt-radio-volume"))).toBe("0.35");

    await page.getByRole("button", { name: "PAUSAR", exact: true }).click();
    await expect(page.getByRole("button", { name: "RETOMAR" })).toBeVisible();

    await page.getByRole("button", { name: "RETOMAR", exact: true }).click();
    await expect(page.getByRole("button", { name: "PAUSAR" })).toBeVisible();

    await page.getByRole("button", { name: "DESLIGAR RÁDIO" }).click();
    await expect(page.getByText("FORA DO AR")).toBeVisible();

    await page.getByRole("button", { name: "SINTONIZAR" }).click();
    await expect.poll(async () => await page.evaluate(() => navigator.mediaSession?.playbackState ?? "none")).toBe("playing");
  });


  test("blocks legacy 30-second preview audio while radio is on air", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("sdt-open", "1");
    });
    await page.route("**/rest/v1/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.route("https://cdn.discordapp.com/attachments/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: route.request().url().endsWith(".wav") ? "audio/wav" : "audio/mpeg",
        body: wavBody(),
        headers: { "Accept-Ranges": "bytes", "Cache-Control": "no-store" },
      });
    });

    await page.goto("/frequencia");
    await expect(page.getByRole("heading", { name: "FREQUÊNCIA 808" })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => navigator.mediaSession?.playbackState ?? "none")).toBe("playing");

    const blocked = await page.evaluate(async () => {
      const legacy = new Audio();
      legacy.src = "/assets/tapes/nova-wave.mp3";
      try {
        await legacy.play();
        return { rejected: false, paused: legacy.paused };
      } catch (error) {
        return {
          rejected: true,
          paused: legacy.paused,
          name: error instanceof DOMException ? error.name : "",
        };
      }
    });

    expect(blocked.rejected).toBe(true);
    expect(blocked.paused).toBe(true);
  });

  test("keeps the radio alive with emergency static when a track fails", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("sdt-open", "1");
    });
    await page.route("**/rest/v1/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.route("https://cdn.discordapp.com/attachments/**", async (route) => {
      await route.abort();
    });

    await page.goto("/frequencia");
    await expect(page.getByRole("heading", { name: "FREQUÊNCIA 808" })).toBeVisible();
    await expect.poll(async () => await page.evaluate(() => navigator.mediaSession?.playbackState ?? "none"), { timeout: 15_000 }).toBe("playing");
    await expect(page.getByText("SINAL DE EMERGÊNCIA", { exact: true })).toBeVisible();
  });
});
