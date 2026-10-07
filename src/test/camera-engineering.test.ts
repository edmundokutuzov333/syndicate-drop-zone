import { describe, expect, it, vi } from "vitest";
import { CameraManager } from "@/lib/camera/camera-manager";
import {
  get4KCaptureDimensions,
  getMaxCaptureDimensions,
  isReal4KSource,
} from "@/lib/camera/capture-engine";
import { DeviceManager } from "@/lib/camera/device-manager";
import { calculateOrientationState } from "@/lib/camera/orientation-manager";
import {
  captureTimerReducer,
  createCaptureTimerState,
} from "@/lib/camera/capture-timer";
import { FILTER_REGISTRY } from "@/lib/webgl/filter-registry";
import { adaptiveRenderPolicy } from "@/lib/camera/performance-manager";
import {
  getImageFormatCapabilities,
  getRecorderCapabilities,
  getVideoFormatCapabilities,
  chooseRecorderMimeType,
} from "@/lib/camera/recorder";
import { getFilterFragmentShader } from "@/lib/webgl/filter-shaders";

function makeTrack(
  kind: "video" | "audio",
  settings: MediaTrackSettings,
) {
  return {
    kind,
    readyState: "live",
    enabled: true,
    stop: vi.fn(),
    getSettings: vi.fn(() => settings),
  } as unknown as MediaStreamTrack;
}

describe("camera engineering foundation", () => {
  it("does not request media during manager construction", () => {
    const getUserMedia = vi.fn();

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });

    const manager = new CameraManager();

    expect(getUserMedia).not.toHaveBeenCalled();
    manager.destroy();
  });

  it("opens a preferred 4K-capable camera request and records actual settings", async () => {
    const videoTrack = makeTrack("video", {
      deviceId: "front-1",
      width: 3840,
      height: 2160,
      frameRate: 60,
    });
    const audioTrack = makeTrack("audio", {});
    const stream = {
      getVideoTracks: () => [videoTrack],
      getAudioTracks: () => [audioTrack],
      getTracks: () => [videoTrack, audioTrack],
    } as unknown as MediaStream;

    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const enumerateDevices = vi.fn().mockResolvedValue([
      {
        deviceId: "front-1",
        kind: "videoinput",
        label: "FaceTime HD Camera",
      },
      {
        deviceId: "back-1",
        kind: "videoinput",
        label: "Back Camera",
      },
    ]);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia, enumerateDevices },
    });

    const manager = new CameraManager();
    await manager.requestPermissions();

    const state = manager.getState();

    expect(getUserMedia).toHaveBeenCalled();
    expect(state.status).toBe("ready");
    expect(state.microphoneEnabled).toBe(true);
    expect(state.width).toBe(3840);
    expect(state.height).toBe(2160);
    expect(state.frameRate).toBe(60);
    expect(state.devices).toHaveLength(2);

    manager.destroy();
  });

  it("classifies and prefers front/back devices without trusting names globally", () => {
    const manager = new DeviceManager();
    const devices = [
      {
        deviceId: "front",
        label: "Integrated Camera",
        facingMode: "user" as const,
      },
      {
        deviceId: "rear",
        label: "Rear Camera",
        facingMode: "environment" as const,
      },
    ];

    expect(manager.prefer("user", devices)?.deviceId).toBe("front");
    expect(manager.prefer("environment", devices)?.deviceId).toBe("rear");
  });

  it("calculates orientation without requiring stream restart", () => {
    expect(calculateOrientationState(90, 0, 0)).toMatchObject({
      screenAngle: 90,
      renderRotation: 90,
      captureRotation: 270,
    });
  });

  it("transitions the capture timer", () => {
    const capturing = captureTimerReducer(
      createCaptureTimerState(3),
      { type: "START" },
    );

    expect(capturing.status).toBe("capturing");
    expect(
      captureTimerReducer(capturing, { type: "DONE" }).status,
    ).toBe("done");
    expect(
      captureTimerReducer(capturing, { type: "CANCEL" }).status,
    ).toBe("cancelled");
  });

  it("ships all six Phase 2 filters as active definitions", () => {
    const visible = FILTER_REGISTRY.listVisible();

    expect(visible).toHaveLength(6);
    expect(visible.every((filter) => filter.enabled)).toBe(true);
    expect(visible.map((filter) => filter.id)).toEqual([
      "op1um",
      "xerox",
      "corrupt",
      "nightvision",
      "thermal",
      "redroom",
    ]);
    expect(new Set(visible.map((filter) => filter.shaderKey)).size).toBe(6);
  });

  it("builds non-static shader programs with shared dynamic uniforms", () => {
    const source = getFilterFragmentShader("op1um");

    expect(source).toContain("u_time");
    expect(source).toContain("u_noise");
    expect(source).toContain("u_distortion");
    expect(source).toContain("u_chromatic");
    expect(source).toContain("u_previousFrame");
    expect(source).toContain("filmGrain");
    expect(source).toContain("feedbackBlend");
  });

  it("keeps performance adaptation inside the render budget", () => {
    const policy = adaptiveRenderPolicy({
      fps: 18,
      frameTimeMs: 60,
      droppedFrames: 4,
      deviceTier: "medium",
      dpr: 2,
      renderScale: 1,
    });

    expect(policy.renderScale).toBeLessThan(1);
    expect(policy.dpr).toBe(1.75);
  });

  it("keeps the 4K gate orientation-aware", () => {
    expect(isReal4KSource(3840, 2160)).toBe(true);
    expect(isReal4KSource(2160, 3840)).toBe(true);
    expect(isReal4KSource(1920, 1080)).toBe(false);

    expect(get4KCaptureDimensions(3840, 2160)).toEqual({
      width: 3840,
      height: 2160,
    });
    expect(get4KCaptureDimensions(2160, 3840)).toEqual({
      width: 2160,
      height: 3840,
    });
  });

  it("captures at maximum real source resolution when 4K is unavailable", () => {
    expect(getMaxCaptureDimensions(1920, 1080)).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(getMaxCaptureDimensions(1280, 720)).toEqual({
      width: 1280,
      height: 720,
    });
    expect(getMaxCaptureDimensions(1080, 1920)).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  it("detects the capability matrix without opening a device", () => {
    const recorder = getRecorderCapabilities();
    const images = getImageFormatCapabilities();
    const videos = getVideoFormatCapabilities();

    expect(recorder).toHaveProperty("supported");
    expect(recorder).toHaveProperty("canvasCaptureSupported");
    expect(recorder).toHaveProperty("audioCaptureSupported");
    expect(images.map((item) => item.format)).toEqual([
      "jpg",
      "png",
      "tiff",
    ]);
    expect(videos.map((item) => item.format)).toEqual([
      "mp4",
      "mov",
      "mkv",
      "webm",
    ]);
  });

  it("never claims a requested codec without MediaRecorder runtime support", () => {
    vi.stubGlobal("MediaRecorder", {
      isTypeSupported: vi.fn(
        (mime: string) =>
          mime.includes("video/webm;codecs=vp9,opus") ||
          mime === "video/webm",
      ),
    });

    expect(chooseRecorderMimeType("mp4")).toBeNull();
    expect(chooseRecorderMimeType("mov")).toBeNull();
    expect(chooseRecorderMimeType("mkv")).toBeNull();
    expect(chooseRecorderMimeType("webm")).toBe("video/webm;codecs=vp9,opus");

    const capabilities = getVideoFormatCapabilities();
    expect(capabilities.find((item) => item.format === "mp4")?.supported).toBe(false);
    expect(capabilities.find((item) => item.format === "webm")?.supported).toBe(true);

    vi.unstubAllGlobals();
  });

  it("keeps the performance policy conservative on constrained frames", () => {
    const low = adaptiveRenderPolicy({
      fps: 30,
      frameTimeMs: 33,
      droppedFrames: 8,
      deviceTier: "low",
      dpr: 1,
      renderScale: 0.8,
    });

    const healthy = adaptiveRenderPolicy({
      fps: 60,
      frameTimeMs: 16.7,
      droppedFrames: 0,
      deviceTier: "high",
      dpr: 2,
      renderScale: 0.85,
    });

    expect(low.renderScale).toBeLessThan(0.8);
    expect(low.dpr).toBe(1);
    expect(healthy.renderScale).toBeGreaterThan(0.85);
    expect(healthy.dpr).toBe(2);
  });
});
