import { describe, expect, it } from "vitest";
import { REVELACAO_MEDIA, REVELACAO_READY_MEDIA } from "@/lib/revelacao-media";

describe("FASE 7 sala de revelação", () => {
  it("mantém os 5 media estáticos utilizáveis e os 17 slots de arquivo", () => {
    expect(REVELACAO_READY_MEDIA).toHaveLength(5);
    expect(REVELACAO_MEDIA.filter((item) => item.src === null)).toHaveLength(17);
    expect(REVELACAO_MEDIA.map((item) => item.roll).filter(Boolean)).toContain("CABINE");
    expect(REVELACAO_MEDIA.map((item) => item.roll).filter(Boolean)).toContain("LIVES");
  });

  it("mantém metadados editoriais para projector e timeline", () => {
    const first = REVELACAO_READY_MEDIA[0]!;
    expect(first.type).toBe("video");
    expect(first.tag).toBe("LIVES");
    expect(first.day).toBe(1);
    expect(first.timecode).toMatch(/^\d{2}:\d{2}$/);
  });
});
