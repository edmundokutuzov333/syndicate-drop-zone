import { describe, expect, it } from "vitest";
import { campingDayRange, getRoomAlias, normalizeLiveUrl } from "@/lib/camping-data";

describe("FASE 8 bunker vivo", () => {
  it("mapeia salas editoriais para IDs estáveis", () => {
    expect(getRoomAlias("Estúdio").id).toBe("estudio");
    expect(getRoomAlias("visualizer").tag).toBe("VISUALIZER");
    expect(getRoomAlias("lives").id).toBe("live");
  });

  it("calcula o dia do camping apenas quando CAMP está definido", () => {
    expect(campingDayRange(null, null)).toBeNull();
    const start = "2026-10-01T00:00:00.000Z";
    const end = "2026-10-04T00:00:00.000Z";
    expect(campingDayRange(start, end, Date.parse("2026-10-02T12:00:00.000Z"))).toEqual({ current: 2, total: 3 });
  });

  it("normaliza URLs de transmissão para embeds seguros", () => {
    expect(normalizeLiveUrl("https://www.youtube.com/watch?v=abc123")).toBe("https://www.youtube.com/embed/abc123");
    expect(normalizeLiveUrl("https://youtu.be/xyz789")).toBe("https://www.youtube.com/embed/xyz789");
    expect(normalizeLiveUrl("https://example.com/live")).toBe("");
  });
});
