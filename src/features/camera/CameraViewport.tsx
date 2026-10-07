import { useEffect, useRef } from "react";
import { WebGLEngine } from "@/lib/webgl/webgl-engine";
import { type FilterId } from "@/lib/camera/types";

type CameraViewportProps = { filter: FilterId };

export function CameraViewport({ filter }: CameraViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WebGLEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new WebGLEngine({
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      targetFps: 30,
    });
    engine.init(canvas);
    engine.setFilter(filter);
    engineRef.current = engine;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      engine.resize(rect.width, rect.height);
      engine.render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    return () => {
      observer.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setFilter(filter);
    engineRef.current?.render();
  }, [filter]);

  return <canvas ref={canvasRef} className="camera-canvas" aria-label="Canvas WebGL da camera" />;
}
