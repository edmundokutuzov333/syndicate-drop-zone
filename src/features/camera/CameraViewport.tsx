import { useEffect, useRef, useState } from "react";
import { CameraManager } from "@/lib/camera/camera-manager";
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
  const recordingRef = useRef(recording);
  const [engineReady, setEngineReady] = useState(false);

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
    let ready = false;
    let destroyed = false;

    const orientation = new OrientationManager();
    orientation.start(0);

    const resize = () => {
      if (engine.hasForcedOutputResolution) return;
      const rect = stage.getBoundingClientRect();
      engine.resize(rect.width, rect.height);
    };

    const applyEngineState = () => {
      engine.setFrameSource(video);
      engine.preloadFilters(vertexShader);
      engine.setUniform("u_rotation", orientation.getState().renderRotation);
      engine.setUniform("u_mirror", facingMode === "user" ? 1 : 0);
      engine.setFilter(filter);
      resize();
    };

    const initializeEngine = () => {
      try {
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
      } catch {
        ready = false;
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
      }
    };

    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    canvas.addEventListener("webglcontextrestored", handleContextRestored, false);
    document.addEventListener("visibilitychange", handleVisibility);

    initializeEngine();
    void onReady();

    let raf = 0;

    const render = (timestamp: number) => {
      if (
        ready &&
        (
          document.visibilityState === "visible" ||
          recordingRef.current
        )
      ) {
        engine.render(timestamp);
      }
      raf = requestAnimationFrame(render);
    };

    resize();
    raf = requestAnimationFrame(render);

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      unsubscribe();
      orientation.destroy();
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
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