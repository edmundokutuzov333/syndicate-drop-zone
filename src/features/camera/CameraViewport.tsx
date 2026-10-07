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
};

export function CameraViewport({
  manager,
  facingMode,
  filter,
  onReady,
  onCanvasReady,
  onEngineReady,
}: CameraViewportProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WebGLEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;

    if (!stage || !canvas) return;

    const video = manager.getVideoElement();
    video.className = "camera-native-video";
    stage.appendChild(video);

    const engine = new WebGLEngine({
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      targetFps: 60,
    });

    let ready = false;

    try {
      engine.init(canvas);
      engine.setFrameSource(video);
      engine.preloadFilters(vertexShader);
      engine.setUniform("u_rotation", 0);
      engine.setUniform(
        "u_mirror",
        facingMode === "user" ? 1 : 0,
      );
      engine.setFilter(filter);
      engineRef.current = engine;
      setEngineReady(true);
      ready = true;
      onCanvasReady?.(canvas);
      onEngineReady?.(engine);
    } catch {
      engine.destroy();
      setEngineReady(false);
      onCanvasReady?.(null);
      onEngineReady?.(null);
    }

    void onReady();

    const orientation = new OrientationManager();
    orientation.start(0);

    const unsubscribe = orientation.subscribe((state) => {
      engine.setUniform("u_rotation", state.renderRotation);
    });

    const resize = () => {
      if (engine.hasForcedOutputResolution) return;
      const rect = stage.getBoundingClientRect();
      engine.resize(rect.width, rect.height);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resize();

    let raf = 0;

    const render = (timestamp: number) => {
      if (ready) engine.render(timestamp);
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      unsubscribe();
      orientation.destroy();
      engine.destroy();
      engineRef.current = null;
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