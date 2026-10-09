import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ FFmpeg: vi.fn(), toBlobURL: vi.fn(), fetchFile: vi.fn() }));
vi.mock("@ffmpeg/ffmpeg", () => ({ FFmpeg: mocked.FFmpeg }));
vi.mock("@ffmpeg/util", () => ({ toBlobURL: mocked.toBlobURL, fetchFile: mocked.fetchFile }));

import { createFanVideo, FAN_VIDEO_SPEC } from "@/lib/fan-video";

const engine = {
  on: vi.fn(),
  load: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  exec: vi.fn().mockResolvedValue(0),
  readFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  terminate: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.FFmpeg.mockImplementation(function MockFFmpeg() { return engine as any; });
  mocked.toBlobURL.mockResolvedValue("blob:ffmpeg-core");
  mocked.fetchFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("criação de vídeo do fã", () => {
  it("define formato vertical, 30 segundos e 1080p", () => {
    expect(FAN_VIDEO_SPEC).toEqual({ durationSeconds: 30, width: 1080, height: 1920, fps: 30 });
  });

  it("gera MP4 com som e visual reactivo", async () => {
    vi.stubGlobal("Worker", class {});
    vi.stubGlobal("URL", class TestURL extends URL {
      static revokeObjectURL = vi.fn();
    });
    const cardBlob = Object.assign(new Blob(["card"], { type: "image/png" }), {
      arrayBuffer: async () => new Uint8Array([99, 97, 114, 100]).buffer,
    });
    const canvas = { toBlob: (callback: BlobCallback) => callback(cardBlob) } as HTMLCanvasElement;
    const progress: number[] = [];
    const blob = await createFanVideo(canvas, "/audio/preview.mp3", (value) => progress.push(value));
    expect(blob.type).toBe("video/mp4");
    expect(mocked.FFmpeg).toHaveBeenCalledTimes(1);
    expect(engine.load).toHaveBeenCalledWith({ coreURL: "blob:ffmpeg-core", wasmURL: "blob:ffmpeg-core" });
    const args = engine.exec.mock.calls[0]?.[0] as string[];
    expect(args.join(" ")).toContain("scale=1080:1920");
    expect(args.join(" ")).toContain("showwaves");
    expect(args.join(" ")).toContain("-t 30");
    expect(args.join(" ")).toContain("libx264");
    expect(progress.at(-1)).toBe(100);
    expect(engine.terminate).toHaveBeenCalledTimes(1);
  });

  it("recusa áudio alojado noutro domínio", async () => {
    vi.stubGlobal("Worker", class {});
    const canvas = { toBlob: (callback: BlobCallback) => callback(new Blob(["card"], { type: "image/png" })) } as HTMLCanvasElement;
    await expect(createFanVideo(canvas, "https://example.com/audio.mp3")).rejects.toThrow(/não está alojada/);
    expect(mocked.FFmpeg).not.toHaveBeenCalled();
  });
});
