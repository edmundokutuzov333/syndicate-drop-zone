import { useEffect, useRef, useState } from "react";
import { CameraManager } from "@/lib/camera/camera-manager";
import { type CameraFacingMode } from "@/lib/camera/types";
import { OrientationManager } from "@/lib/camera/orientation-manager";
import { WebGLEngine } from "@/lib/webgl/webgl-engine";
import vertexShader from "@/shaders/camera/video.vert.glsl?raw";
import fragmentShader from "@/shaders/camera/video.frag.glsl?raw";

type CameraViewportProps = {
  manager: CameraManager;
  facingMode: CameraFacingMode;
  onReady: () => void | Promise<void>;
};

export function CameraViewport({
  manager,
  facingMode,
  onReady,
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

    void onReady();

    const engine = new WebGLEngine({
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      targetFps: 60,
    });

    let ready = false;

    try {
      engine.init(canvas);
      engine.setProgram("camera-video:v1", vertexShader, fragmentShader);
      engine.setFrameSource(video);
      engineRef.current = engine;
      setEngineReady(true);
      ready = true;
    } catch {
      setEngineReady(false);
    }

    const orientation = new OrientationManager();
    orientation.start(0);

    const syncOrientation = () => {
      const state = orientation.getState();
      engine.setUniform("u_rotation", state.renderRotation);
    };

    const unsubscribe = orientation.subscribe(syncOrientation);
    syncOrientation();
    engine.setUniform("u_mirror", facingMode === "user" ? 1 : 0);

    const resize = () => {
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

      if (video.parentElement === stage) {
        stage.removeChild(video);
      }
    };
  }, [manager, onReady]);

  useEffect(() => {
    engineRef.current?.setUniform(
      "u_mirror",
      facingMode === "user" ? 1 : 0,
    );
  }, [facingMode]);

  return (
    <div
      ref={stageRef}
      className={`camera-viewport ${engineReady ? "is-webgl" : "is-fallback"} ${facingMode === "user" ? "is-user" : "is-environment"}`}
    >
      <canvas
        ref={canvasRef}
        className="camera-canvas"
        aria-label="Saída WebGL da câmara"
      />
      <div className="camera-fallback-notice" aria-hidden={engineReady}>
        WEBGL FALLBACK
      </div>
    </div>
  );
}
