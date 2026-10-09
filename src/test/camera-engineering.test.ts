import { type WebGLEngine } from "@/lib/webgl/webgl-engine";
import { describe, expect, it, vi } from "vitest";
import { CameraManager } from "@/lib/camera/camera-manager";
import {
  CaptureEngine,
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
import { buildFaceVfxUniforms } from "@/lib/camera/face-vfx";
import { adaptiveRenderPolicy } from "@/lib/camera/performance-manager";
import {
  getImageFormatCapabilities,
  getRecorderCapabilities,
  getVideoFormatCapabilities,
  chooseRecorderMimeType,
} from "@/lib/camera/recorder";
import { getFilterFragmentShader } from "@/lib/webgl/filter-shaders";
import {
  FILTER_PARAMETER_CONTRACTS,
  MASTER_OVERLAY_CONTRACTS,
  getFilterShaderContract,
} from "@/lib/webgl/filter-contract";
import { CinematicPipeline } from "@/lib/webgl/cinematic-pipeline";
import {
  requires3DOverlay,
  requiresFaceTracking,
} from "@/lib/camera/filter-runtime-policy";

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

function makeStream(videoTrack: MediaStreamTrack, audioTrack?: MediaStreamTrack) {
  const tracks = [videoTrack, ...(audioTrack ? [audioTrack] : [])];

  return {
    getVideoTracks: () => [videoTrack],
    getAudioTracks: () => (audioTrack ? [audioTrack] : []),
    getTracks: () => tracks,
  } as unknown as MediaStream;
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

  it("switches to the requested front/rear camera with strict facing constraints", async () => {
    const frontTrack = makeTrack("video", {
      deviceId: "front-1",
      facingMode: "user",
      width: 1920,
      height: 1080,
      frameRate: 60,
    });
    const backTrack = makeTrack("video", {
      deviceId: "back-1",
      facingMode: "environment",
      width: 3840,
      height: 2160,
      frameRate: 60,
    });
    const streamFront = makeStream(frontTrack);
    const streamBack = makeStream(backTrack);

    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(streamFront)
      .mockResolvedValueOnce(streamBack);

    const enumerateDevices = vi.fn().mockResolvedValue([
      {
        deviceId: "front-1",
        kind: "videoinput",
        label: "Front Camera",
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

    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);

    const manager = new CameraManager();

    await manager.requestPermissions();
    await manager.start();
    await manager.switchCamera();

    const request = getUserMedia.mock.calls[1]?.[0] as MediaStreamConstraints;
    const video = request.video as MediaTrackConstraints;

    expect(video.deviceId).toEqual({ exact: "back-1" });
    expect(video.facingMode).toEqual({ exact: "environment" });
    expect(manager.getState().status).toBe("active");
    expect(manager.getState().facingMode).toBe("environment");
    expect(manager.getState().deviceId).toBe("back-1");
    expect(frontTrack.stop).toHaveBeenCalledTimes(1);

    play.mockRestore();
    pause.mockRestore();
    manager.destroy();
  });

  it("never lies about FRONT/BACK when the requested facing camera is unavailable", async () => {
    const frontTrack = makeTrack("video", {
      deviceId: "front-1",
      facingMode: "user",
      width: 1920,
      height: 1080,
      frameRate: 60,
    });
    const streamFront = makeStream(frontTrack);

    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(streamFront)
      .mockRejectedValue(new Error("NO_REAR_CAMERA"));

    const enumerateDevices = vi.fn().mockResolvedValue([
      {
        deviceId: "front-1",
        kind: "videoinput",
        label: "Front Camera",
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

    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);

    const manager = new CameraManager();

    await manager.requestPermissions();
    await manager.start();
    await manager.switchCamera();

    expect(manager.getState().status).toBe("active");
    expect(manager.getState().facingMode).toBe("user");
    expect(manager.getState().deviceId).toBe("front-1");
    expect(frontTrack.stop).not.toHaveBeenCalled();

    play.mockRestore();
    manager.destroy();
  });

  it("uses the explicit capture filter and facing snapshot for a photo", async () => {
    const toBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob(["photo"], { type: "image/jpeg" }));
    });
    const canvas = { toBlob } as unknown as HTMLCanvasElement;
    const render = vi.fn();
    const webgl = {
      waitForFilter: vi.fn().mockResolvedValue(undefined),
      withOutputResolution: vi.fn(async (
        _width: number,
        _height: number,
        task: () => Promise<unknown>,
      ) => task()),
      render,
      restorePreviewResolution: vi.fn().mockResolvedValue(undefined),
    } as unknown as WebGLEngine;

    const createUrl = vi.fn().mockReturnValue("blob:camera");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createUrl,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    const capture = new CaptureEngine({
      getSourceStream: () => null,
      getFilterId: () => "op1um",
      getFacingMode: () => "user",
    });
    capture.attach(canvas, webgl);
    capture.setSourceSize(1920, 1080);

    const result = await capture.capturePhoto("jpg", "thermal", "environment");

    expect(webgl.waitForFilter).toHaveBeenCalledWith("thermal");
    expect(render).toHaveBeenCalled();
    expect(result.filename).toContain("_THERMAL_BACK_1920x1080.jpg");

    vi.unstubAllGlobals();
    await capture.dispose();
  });


  it("controls a real hardware torch when the camera exposes torch capability", async () => {
    const track = {
      kind: "video",
      readyState: "live",
      enabled: true,
      deviceId: "rear-1",
      getSettings: vi.fn(() => ({
        deviceId: "rear-1",
        facingMode: "environment",
        width: 3840,
        height: 2160,
        frameRate: 60,
      })),
      getCapabilities: vi.fn(() => ({ torch: true })),
      applyConstraints: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
    } as unknown as MediaStreamTrack & {
      getCapabilities: () => { torch: boolean };
      applyConstraints: ReturnType<typeof vi.fn>;
    };

    const audioTrack = makeTrack("audio", {});
    const stream = makeStream(track, audioTrack);
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const enumerateDevices = vi.fn().mockResolvedValue([
      {
        deviceId: "rear-1",
        kind: "videoinput",
        label: "Back Camera",
      },
    ]);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia, enumerateDevices },
    });

    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);

    const manager = new CameraManager();
    await manager.start();
    await manager.setFlashEnabled(true);

    expect(manager.getState().flashEnabled).toBe(true);
    expect(manager.getState().flashMode).toBe("hardware");
    expect(track.applyConstraints).toHaveBeenCalledWith({
      advanced: [{ torch: true }],
    });

    const cleanup = await manager.preparePhotoFlash();
    expect(track.applyConstraints).toHaveBeenLastCalledWith({
      advanced: [{ torch: true }],
    });

    await cleanup();
    expect(track.applyConstraints).toHaveBeenLastCalledWith({
      advanced: [{ torch: false }],
    });

    play.mockRestore();
    pause.mockRestore();
    manager.destroy();
  });

  it("falls back to software flash when torch is not exposed by the camera", async () => {
    const track = makeTrack("video", {
      deviceId: "front-1",
      facingMode: "user",
      width: 1920,
      height: 1080,
      frameRate: 60,
    });

    const stream = makeStream(track);
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const enumerateDevices = vi.fn().mockResolvedValue([
      {
        deviceId: "front-1",
        kind: "videoinput",
        label: "Front Camera",
      },
    ]);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia, enumerateDevices },
    });

    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);

    const manager = new CameraManager();
    await manager.start();
    await manager.setFlashEnabled(true);

    expect(manager.getState().flashEnabled).toBe(true);
    expect(manager.getState().flashMode).toBe("software");

    const cleanup = await manager.preparePhotoFlash();
    await cleanup();

    play.mockRestore();
    pause.mockRestore();
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

  it("ships all fifteen interactive VFX filters as active definitions", () => {
    const visible = FILTER_REGISTRY.listVisible();

    expect(visible).toHaveLength(15);
    expect(visible.every((filter) => filter.enabled)).toBe(true);
    expect(visible.map((filter) => filter.id)).toEqual([
      "op1um",
      "xerox",
      "corrupt",
      "nightvision",
      "thermal",
      "redroom",
      "vamp",
      "astro-haze",
      "cyber-mugshot",
      "threshold",
      "xray-mesh",
      "cathode-crt",
      "halation",
      "kinetic-melt",
      "paper-film",
    ]);
    expect(new Set(visible.map((filter) => filter.shaderKey)).size).toBe(15);
  });

  it("only enables face tracking and the Three.js overlay for filters that need them", () => {
    const visibleIds = FILTER_REGISTRY.listVisible().map((filter) => filter.id);

    expect(visibleIds.filter(requiresFaceTracking)).toEqual([
      "vamp",
      "astro-haze",
      "xray-mesh",
      "kinetic-melt",
    ]);
    expect(visibleIds.filter(requires3DOverlay)).toEqual([
      "vamp",
      "astro-haze",
      "xray-mesh",
    ]);
  });

  it("derives stable face VFX controls from MediaPipe landmarks and blendshapes", () => {
    const result = {
      faceLandmarks: [
        Array.from({ length: 478 }, (_, index) => ({
          x: 0.5 + ((index % 7) - 3) * 0.004,
          y: 0.5 + ((index % 11) - 5) * 0.004,
          z: 0,
          visibility: 1,
        })),
      ],
      faceBlendshapes: [
        {
          categories: [
            { categoryName: "jawOpen", score: 0.72 },
            { categoryName: "mouthSmileLeft", score: 0.54 },
            { categoryName: "mouthSmileRight", score: 0.46 },
            { categoryName: "eyeBlinkLeft", score: 0.18 },
            { categoryName: "eyeBlinkRight", score: 0.22 },
          ],
        },
      ],
    } as never;

    const state = buildFaceVfxUniforms(result);

    expect(state.face[2]).toBeGreaterThan(0);
    expect(state.face[3]).toBeGreaterThan(0);
    expect(state.details[0]).toBe(1);
    expect(state.details[2]).toBeCloseTo(0.2, 3);
    expect(state.details[3]).toBeCloseTo(0.72, 3);
    expect(state.matrix).toHaveLength(16);
    expect(state.pose).toHaveLength(4);
    expect(state.mouth[3]).toBeCloseTo(0.5, 3);
  });

  it("ships fifteen production VFX pipelines with temporal, face, motion and flash processing", () => {
    const ids = FILTER_REGISTRY.listVisible().map((item) => item.id);

    for (const id of ids) {
      const source = getFilterFragmentShader(id);

      expect(source).toContain("u_time");
      expect(source).toContain("u_previousFrame");
      expect(source).toContain("u_flash");
      expect(source).toContain("applyFlash");
      expect(source).toContain("filmGrain");
      expect(source).toContain("softBloom");
      expect(source).toContain("u_face");
      expect(source).toContain("u_faceDetails");
      expect(source).toContain("faceMask");
      expect(source).toContain("eyeGlow");
      expect(source).toContain("u_faceMotion");
      expect(source).toContain("u_filterStart");
    }
  });

  it("registers the six cinematic module contracts with exact defaults", () => {
    expect(FILTER_PARAMETER_CONTRACTS.map((contract) => contract.id)).toEqual([
      "threshold",
      "xray-mesh",
      "cathode-crt",
      "halation",
      "kinetic-melt",
      "paper-film",
    ]);

    expect(getFilterShaderContract("threshold")?.parameters.map((item) => item.defaultValue)).toEqual([
      0.45,
      0.015,
      0.05,
    ]);
    expect(getFilterShaderContract("xray-mesh")?.parameters.map((item) => item.defaultValue)).toEqual([
      [0, 1, 0.4],
      1.5,
      0.8,
    ]);
    expect(getFilterShaderContract("cathode-crt")?.parameters.map((item) => item.defaultValue)).toEqual([
      0.12,
      800,
      0.008,
      1,
    ]);
    expect(getFilterShaderContract("halation")?.parameters.map((item) => item.defaultValue)).toEqual([
      0.025,
      0.3,
      0.7,
    ]);
    expect(getFilterShaderContract("kinetic-melt")?.parameters.map((item) => item.defaultValue)).toEqual([
      0.08,
      0.02,
      0.92,
    ]);
    expect(getFilterShaderContract("paper-film")?.parameters.map((item) => item.defaultValue)).toEqual([
      0.06,
      0.4,
      0.001,
      1,
    ]);
  });

  it("exposes the two master overlays as explicit reusable contracts", () => {
    expect(MASTER_OVERLAY_CONTRACTS["cathode-crt"].enabledByDefault).toBe(false);
    expect(MASTER_OVERLAY_CONTRACTS["paper-film"].enabledByDefault).toBe(false);
    expect(getFilterShaderContract("cathode-crt")?.masterOverlay).toBe("cathode-crt");
    expect(getFilterShaderContract("paper-film")?.masterOverlay).toBe("paper-film");

    expect(getFilterShaderContract("halation")?.passes).toEqual([
      "halation-isolate",
      "halation-blur-h",
      "halation-blur-v",
      "halation-composite",
    ]);
    expect(getFilterShaderContract("kinetic-melt")?.passes).toEqual([
      "kinetic-flow",
      "kinetic-melt",
    ]);

  });

  it("defines the requested multipass topology", () => {
    expect(CinematicPipeline.toString()).toContain('"halation:isolate"');
    expect(CinematicPipeline.toString()).toContain('"halation:blur-h"');
    expect(CinematicPipeline.toString()).toContain('"halation:blur-v"');
    expect(CinematicPipeline.toString()).toContain('"halation:composite"');
    expect(CinematicPipeline.toString()).toContain('"kinetic:flow"');
    expect(CinematicPipeline.toString()).toContain('"kinetic:melt"');
    expect(CinematicPipeline.toString()).toContain('"master:cathode-crt"');
    expect(CinematicPipeline.toString()).toContain('"master:paper-film"');
  });

  it("ships required shader uniforms for the six new cinematic modules", () => {
    expect(getFilterFragmentShader("threshold")).toContain("uThreshold");
    expect(getFilterFragmentShader("threshold")).toContain("uEdgeSmoothness");
    expect(getFilterFragmentShader("threshold")).toContain("uFlickerIntensity");

    expect(getFilterFragmentShader("xray-mesh")).toContain("u_face");
    expect(getFilterFragmentShader("cathode-crt")).toContain("uApplyToAllFilters");
    expect(getFilterFragmentShader("halation")).toContain("uGlowThreshold");
    expect(getFilterFragmentShader("kinetic-melt")).toContain("u_previousFrame");
    expect(getFilterFragmentShader("paper-film")).toContain("uApplyToAllFilters");
  });

  it("keeps the premium VFX signatures wired into the new filters", () => {
    for (const id of ["vamp", "astro-haze", "cyber-mugshot"] as const) {
      const source = getFilterFragmentShader(id);
      expect(source).toContain("u_faceMotion");
      expect(source).toContain("u_faceMotionBurst");
      expect(source).toContain("u_filterStart");
    }

    expect(getFilterFragmentShader("astro-haze")).toContain("applyLut");
    expect(getFilterFragmentShader("cyber-mugshot")).toContain("fisheyeUv");
    expect(getFilterFragmentShader("vamp")).toContain("eyeGlow");
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
