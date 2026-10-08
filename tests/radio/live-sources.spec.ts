import { test, expect } from "@playwright/test";

const RADIO_SOURCES = [
  { src: "/audio/KHRYIS - A Bag.wav", type: "audio/wav" },
  { src: "/audio/KHRYIS - Chopper.mp3", type: "audio/mpeg" },
  { src: "/audio/KHRYIS - Freestyle Sujo.mp3", type: "audio/mpeg" },
  { src: "/audio/KHRYIS - I’M Flexin up.mp3", type: "audio/mpeg" },
  { src: "/audio/KHRYIS - Money Talk.mp3", type: "audio/mpeg" },
  { src: "/audio/KHRYIS - Tsanto Dough.mp3", type: "audio/mpeg" },
  {
    src: "/audio/(Unmastered) PHANTOM, Kingston Siriro, Elton Penicela - Fashion de Phantom.mp3",
    type: "audio/mpeg",
  },
  {
    src: "/audio/Phantom, Bruno The Goat, Alemão Wav & Elton Penicela - A Nova Wave.mp3",
    type: "audio/mpeg",
  },
  {
    src: "/audio/PHANTOM Mode 2 - The Final Movie W_ INF8M8US, HEYYG, KINGSTON SIRIRO.mp3",
    type: "audio/mpeg",
  },
];

test("serves all nine bundled Frequencia 808 sources as complete audio files", async ({ request }) => {
  for (const track of RADIO_SOURCES) {
    const response = await request.get(track.src, { timeout: 20_000 });

    expect(response.ok(), track.src).toBe(true);

    const headers = response.headers();
    const contentType = (headers["content-type"] ?? "").toLowerCase();
    expect(contentType, track.src).toMatch(track.type === "audio/wav" ? /audio\/(wav|x-wav)/ : /audio\/mpeg/);

    const contentLength = Number(headers["content-length"] ?? 0);
    expect(contentLength, track.src).toBeGreaterThan(1_000_000);

    const body = await response.body();
    expect(body.byteLength, track.src).toBe(contentLength);
  }
});

test("decodes every bundled radio file and never applies a 30-second duration cap", async ({ page }) => {
  for (const track of RADIO_SOURCES) {
    const result = await page.evaluate(async (src) => {
      const response = await fetch(src, { cache: "no-store" });
      if (!response.ok) throw new Error("asset fetch failed: " + src + " (" + response.status + ")");
      const blob = await response.blob();
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.src = URL.createObjectURL(blob);

      return await new Promise<{ duration: number; readyState: number }>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("metadata timeout: " + src)), 15_000);
        audio.addEventListener("loadedmetadata", () => {
          window.clearTimeout(timeout);
          URL.revokeObjectURL(audio.src);
          window.clearTimeout(timeout);
          resolve({ duration: audio.duration, readyState: audio.readyState });
        }, { once: true });
        audio.addEventListener("error", () => {
          window.clearTimeout(timeout);
          URL.revokeObjectURL(audio.src);
          reject(new Error("media decode error: " + src));
        }, { once: true });
        document.body.appendChild(audio);
      });
    }, track.src);

    expect(result.readyState, track.src).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(result.duration), track.src).toBe(true);
    expect(result.duration, track.src).toBeGreaterThan(30);
  }
});

test("uses only bundled /audio sources for the radio catalogue", async () => {
  const sources = RADIO_SOURCES.map((track) => track.src);

  expect(sources).toHaveLength(9);
  expect(new Set(sources).size).toBe(9);
  expect(sources.every((src) => src.startsWith("/audio/"))).toBe(true);
  expect(sources.every((src) => !src.includes("/assets/tapes/"))).toBe(true);
  expect(sources.every((src) => !src.includes("cdn.discordapp.com"))).toBe(true);
  expect(sources.every((src) => !src.includes("files.catbox.moe"))).toBe(true);
});
