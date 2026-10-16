import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFanVideo, FAN_VIDEO_SPEC, type FanVideoTrackId } from "@/lib/fan-video";

const MP4_BYTES = new Uint8Array([
  0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0,
  0x69, 0x73, 0x6f, 0x6d,
]);

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function response({
  status = 200,
  contentType = "video/mp4",
  bytes = MP4_BYTES,
  json = { error: "Falha do motor." },
}: {
  status?: number;
  contentType?: string;
  bytes?: Uint8Array;
  json?: unknown;
} = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": contentType }),
    arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer(bytes)),
    json: vi.fn().mockResolvedValue(json),
  } as unknown as Response;
}

function cardCanvas() {
  return {
    toDataURL: vi.fn(() => "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q=="),
  } as unknown as HTMLCanvasElement;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("motor de vídeo do cartão de fã", () => {
  it("define o formato final vertical, 30 segundos e 1080p", () => {
    expect(FAN_VIDEO_SPEC).toEqual({ durationSeconds: 30, width: 1080, height: 1920, fps: 30 });
  });

  it("envia a fotografia para o endpoint real e valida o MP4 devolvido", async () => {
    vi.mocked(fetch).mockResolvedValue(response());
    const progress: number[] = [];
    const blob = await createFanVideo(cardCanvas(), "T1", (value) => progress.push(value));

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("/api/fan-video");
    expect(options?.method).toBe("POST");
    const payload = JSON.parse(String(options?.body)) as { trackId: string; imageData: string };
    expect(payload.trackId).toBe("T1");
    expect(payload.imageData).toMatch(/^data:image\/jpeg;base64,/);
    expect(blob.type).toBe("video/mp4");
    expect(blob.size).toBe(MP4_BYTES.length);
    expect(progress.at(-1)).toBe(100);
  });

  it("mostra a mensagem de erro que o servidor devolveu", async () => {
    vi.mocked(fetch).mockResolvedValue(response({
      status: 500,
      contentType: "application/json",
      json: { code: "RENDER_FAILED", error: "O servidor não conseguiu concluir o vídeo." },
    }));
    await expect(createFanVideo(cardCanvas(), "T2")).rejects.toThrow(/O servidor não conseguiu concluir o vídeo/);
  });

  it("recusa IDs de faixa inválidos antes do pedido", async () => {
    await expect(createFanVideo(cardCanvas(), "https://example.com/audio.mp3" as FanVideoTrackId)).rejects.toThrow(/músicas disponíveis/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("não aceita respostas HTML ou bytes que não sejam MP4", async () => {
    vi.mocked(fetch).mockResolvedValue(response({ contentType: "text/html" }));
    await expect(createFanVideo(cardCanvas(), "T3")).rejects.toThrow(/não devolveu um ficheiro MP4/);

    vi.mocked(fetch).mockResolvedValue(response({ bytes: new Uint8Array([1, 2, 3, 4]) }));
    await expect(createFanVideo(cardCanvas(), "T3")).rejects.toThrow(/não é um vídeo MP4 válido/);
  });

  it("devolve uma mensagem útil se o servidor não responder", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(createFanVideo(cardCanvas(), "T1")).rejects.toThrow(/contactar o motor de vídeo no servidor/);
  });
});
