import { useEffect, useRef, useState } from "react";
import { CameraManager } from "@/lib/camera/camera-manager";
import { CameraVfx3DOverlay } from "@/lib/camera/camera-vfx-3d-overlay";
import { FaceVfxTracker } from "@/lib/camera/face-vfx";
import {
  requires3DOverlay,
  requiresFaceTracking,
} from "@/lib/camera/filter-runtime-policy";
import {
  type CameraFacingMode,
  type FilterId,
} from "@/lib/camera/types";
import { OrientationManager } from "@/lib/camera/orientation-manager";
import { WebGLEngine } from "@/lib/webgl/webgl-engine";
import vertexShader from "@/shaders/camera/video.vert.glsl?raw";

type CameraViewportProps = {
  manager: CameraManager;
  facingMode: CameraFacingMode;
  filter: FilterId;
  onReady: () => void | Promise<void>;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  onEngineReady?: (engine: WebGLEngine | null) => void;
  recording?: boolean;
};

export function CameraViewport({
  manager,
  facingMode,
  filter,
  onReady,
  onCanvasReady,
  onEngineReady,
  recording = false,
}: CameraViewportProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WebGLEngine | null>(null);
  const restartRenderLoopRef = useRef<(() => void) | null>(null);
  const filterRef = useRef(filter);
  const facingRef = useRef(facingMode);
  const recordingRef = useRef(recording);
  const [engineReady, setEngineReady] = useState(false);

  filterRef.current = filter;
  facingRef.current = facingMode;
  recordingRef.current = recording;

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;

    if (!stage || !canvas) return;

    const video = manager.getVideoElement();
    video.className = "camera-native-video";
    stage.appendChild(video);

    let engine = new WebGLEngine({
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      targetFps: 60,
    });
    let vfx3d: CameraVfx3DOverlay | null = null;
    let ready = false;
    let destroyed = false;

    const faceVfx = new FaceVfxTracker();
    let faceTrackingActive = false;
    let faceWarmupStarted = false;
    let faceState = faceVfx.reset();
    const orientation = new OrientationManager();
    orientation.start(0);

    const streamActiveRef = {
      current: manager.getState().status === "active",
    };
    const rafRef = { current: 0 };
    const videoFrameRef = { current: 0 };
    const lastHudAt = { current: 0 };

    const resize = () => {
      if (engine.hasForcedOutputResolution) return;

      const rect = stage.getBoundingClientRect();
      engine.resize(rect.width, rect.height);
      vfx3d?.resize(rect.width, rect.height);
    };

    const getOrCreateVfx3DOverlay = (): CameraVfx3DOverlay | null => {
      if (vfx3d || destroyed) return vfx3d;

      try {
        const overlay = new CameraVfx3DOverlay();
        overlay.setXrayParameters([0, 1, 0.4], 1.5, 0.8);
        const rect = stage.getBoundingClientRect();
        overlay.resize(rect.width, rect.height);
        vfx3d = overlay;
      } catch {
        vfx3d = null;
      }

      return vfx3d;
    };

    const applyEngineState = () => {
      engine.setFrameSource(video);
      engine.preloadFilters(vertexShader);
      engine.setUniform(
        "u_rotation",
        orientation.getState().renderRotation,
      );
      engine.setUniform(
        "u_mirror",
        facingRef.current === "user" ? 1 : 0,
      );
      engine.setUniform("u_flash", 0);
      faceState = faceVfx.reset();
      faceTrackingActive = false;
      engine.setFaceTracking(faceState);
      engine.setFilter(filterRef.current);
      resize();
    };

    const stopRenderLoop = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      if (videoFrameRef.current) {
        if (typeof video.cancelVideoFrameCallback === "function") {
          video.cancelVideoFrameCallback(videoFrameRef.current);
        }
        videoFrameRef.current = 0;
      }
    };

    const render = (timestamp: number) => {
      if (destroyed) return;
      rafRef.current = 0;
      videoFrameRef.current = 0;

      if (
        ready &&
        streamActiveRef.current &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        (document.visibilityState === "visible" || recordingRef.current)
      ) {
        const activeFilter = filterRef.current;
        const needsFaceTracking = requiresFaceTracking(activeFilter);

        if (needsFaceTracking) {
          if (!faceWarmupStarted) {
            faceWarmupStarted = true;
            void faceVfx.warmup();
          }
          faceTrackingActive = true;
          faceState = faceVfx.detect(video, timestamp);
        } else if (faceTrackingActive) {
          faceTrackingActive = false;
          faceState = faceVfx.reset();
        }
        engine.setFaceTracking(faceState);

        if (requires3DOverlay(activeFilter)) {
          const overlay = getOrCreateVfx3DOverlay();

          if (overlay) {
            overlay.update(
              activeFilter,
              faceState,
              facingRef.current,
              timestamp,
              video,
              faceVfx.getLandmarks(),
            );
            overlay.render();
            engine.setSceneOverlaySource(overlay.getCanvas());
          } else {
            engine.setSceneOverlaySource(null);
          }
        } else {
          engine.setSceneOverlaySource(null);
        }

        if (activeFilter === "cyber-mugshot") {
          const wallTime = Date.now();
          if (wallTime - lastHudAt.current >= 33) {
            engine.setHudText(formatCyberTimecode(wallTime));
            lastHudAt.current = wallTime;
          }
        } else {
          engine.setHudText(null);
        }

        engine.render(timestamp);
      }

      scheduleNextFrame();
    };

    const scheduleNextFrame = () => {
      if (
        destroyed ||
        rafRef.current ||
        videoFrameRef.current ||
        !ready ||
        !streamActiveRef.current ||
        !(document.visibilityState === "visible" || recordingRef.current)
      ) {
        return;
      }

      // In preview, process only newly presented camera frames. During a
      // recording, keep the RAF clock alive so canvas.captureStream(60) can
      // continue sampling animated effects even on a 24/30 FPS camera.
      if (
        !recordingRef.current &&
        typeof video.requestVideoFrameCallback === "function" &&
        typeof video.cancelVideoFrameCallback === "function"
      ) {
        videoFrameRef.current = video.requestVideoFrameCallback((timestamp) => {
          videoFrameRef.current = 0;
          render(timestamp);
        });
        return;
      }

      rafRef.current = requestAnimationFrame(render);
    };

    const scheduleRenderLoop = () => {
      scheduleNextFrame();
    };

    const handleManagerState = () => {
      const state = manager.getState();
      streamActiveRef.current =
        state.status === "active" && Boolean(manager.getStream());

      if (!streamActiveRef.current) {
        stopRenderLoop();
        return;
      }

      scheduleRenderLoop();
    };

    const unsubscribeCamera = manager.subscribe(handleManagerState);
    restartRenderLoopRef.current = () => {
      stopRenderLoop();
      scheduleRenderLoop();
    };

    const initializeEngine = () => {
      try {
        vfx3d?.destroy();
        vfx3d = null;

        engine.destroy();
        engine = new WebGLEngine({
          alpha: false,
          antialias: false,
          preserveDrawingBuffer: false,
          targetFps: 60,
        });
        engine.init(canvas);

        applyEngineState();
        engineRef.current = engine;
        ready = true;
        setEngineReady(true);
        onCanvasReady?.(canvas);
        onEngineReady?.(engine);
        handleManagerState();
      } catch {
        ready = false;
        stopRenderLoop();
        vfx3d?.destroy();
        vfx3d = null;
        setEngineReady(false);
        engineRef.current = null;
        onCanvasReady?.(null);
        onEngineReady?.(null);
      }
    };

    const unsubscribe = orientation.subscribe((state) => {
      engine.setUniform("u_rotation", state.renderRotation);
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      ready = false;
      setEngineReady(false);
      onEngineReady?.(null);
    };

    const handleContextRestored = () => {
      if (destroyed) return;
      initializeEngine();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void onReady();
        scheduleRenderLoop();
        return;
      }

      if (!recordingRef.current) {
        stopRenderLoop();
      }
    };

    canvas.addEventListener(
      "webglcontextlost",
      handleContextLost,
      false,
    );
    canvas.addEventListener(
      "webglcontextrestored",
      handleContextRestored,
      false,
    );
    document.addEventListener("visibilitychange", handleVisibility);

    initializeEngine();
    void onReady();

    resize();
    handleManagerState();

    return () => {
      destroyed = true;
      restartRenderLoopRef.current = null;
      stopRenderLoop();
      resizeObserver.disconnect();
      unsubscribe();
      unsubscribeCamera();
      orientation.destroy();
      faceVfx.destroy();
      vfx3d?.destroy();
      vfx3d = null;
      canvas.removeEventListener(
        "webglcontextlost",
        handleContextLost,
      );
      canvas.removeEventListener(
        "webglcontextrestored",
        handleContextRestored,
      );
      document.removeEventListener("visibilitychange", handleVisibility);
      engine.destroy();
      engineRef.current = null;
      setEngineReady(false);
      onCanvasReady?.(null);
      onEngineReady?.(null);

      if (video.parentElement === stage) {
        stage.removeChild(video);
      }
    };
  }, [manager, onReady, onCanvasReady, onEngineReady]);

  useEffect(() => {
    restartRenderLoopRef.current?.();
  }, [recording]);

  useEffect(() => {
    engineRef.current?.setUniform(
      "u_mirror",
      facingMode === "user" ? 1 : 0,
    );
  }, [facingMode]);

  useEffect(() => {
    engineRef.current?.setFilter(filter);
  }, [filter]);

  return (
    <div
      ref={stageRef}
      className={
        "camera-viewport " +
        (engineReady ? "is-webgl " : "is-fallback ") +
        (facingMode === "user" ? "is-user" : "is-environment")
      }
    >
      <canvas
        ref={canvasRef}
        className="camera-canvas"
        aria-label="Saída WebGL da câmara"
      />
      <div
        className="camera-fallback-notice"
        aria-hidden={engineReady}
      >
        WEBGL FALLBACK
      </div>
    </div>
  );
}

function formatCyberTimecode(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const millis = String(date.getMilliseconds()).padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${millis}`;
}
