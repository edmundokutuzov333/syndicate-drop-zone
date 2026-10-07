import { describe, expect, it, vi } from "vitest";
import { CameraManager } from "@/lib/camera/camera-manager";
import { DeviceManager } from "@/lib/camera/device-manager";
import { calculateOrientationState } from "@/lib/camera/orientation-manager";
import { captureTimerReducer, createCaptureTimerState } from "@/lib/camera/capture-timer";
import { FILTER_REGISTRY } from "@/lib/webgl/filter-registry";
import { adaptiveRenderPolicy } from "@/lib/camera/performance-manager";
import { getRecorderCapabilities } from "@/lib/camera/recorder";

function makeTrack(kind: "video" | "audio", settings: MediaTrackSettings) {
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
      { deviceId: "front-1", kind: "videoinput", label: "FaceTime HD Camera" },
      { deviceId: "back-1", kind: "videoinput", label: "Back Camera" },
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
      { deviceId: "front", label: "Integrated Camera", facingMode: "user" as const },
      { deviceId: "rear", label: "Rear Camera", facingMode: "environment" as const },
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
    expect(captureTimerReducer(capturing, { type: "DONE" }).status).toBe("done");
    expect(captureTimerReducer(capturing, { type: "CANCEL" }).status).toBe("cancelled");
  });

  it("keeps the six visible filter ids stable", () => {
    expect(FILTER_REGISTRY.listVisible().map((filter) => filter.id)).toEqual([
      "op1um",
      "xerox",
      "corrupt",
      "nightvision",
      "thermal",
      "redroom",
    ]);
  });

  it("keeps performance policy conservative", () => {
    const policy = adaptiveRenderPolicy({
      fps: 18,
      frameTimeMs: 60,
      droppedFrames: 4,
      deviceTier: "medium",
      dpr: 2,
      renderScale: 1,
    });

    expect(policy.renderScale).toBeLessThan(1);
    expect(policy.dpr).toBe(1.5);
  });

  it("detects recorder capability without opening a device", () => {
    const capabilities = getRecorderCapabilities();

    expect(capabilities).toHaveProperty("supported");
    expect(capabilities).toHaveProperty("mimeTypes");
    expect(capabilities).toHaveProperty("canvasCaptureSupported");
  });
});
