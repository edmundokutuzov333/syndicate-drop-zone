import { useEffect, useRef, useState } from "react";
import { renderHalftone, type HalftoneOpts } from "@/lib/halftone-canvas";
import { cn } from "@/lib/utils";
import { Halftone } from "./Halftone";

type Mode = "normal" | "noturna" | "raiox";

const PRESETS: Record<Mode, HalftoneOpts> = {
  normal: {},
  noturna: { ink: "#9dff8a", paper: "#06130a", contrast: 1.7 },
  raiox: { invert: true, ink: "#d8d2c4", paper: "#240a0a", contrast: 1.8 },
};

const cache = new Map<string, HTMLCanvasElement>();

const lite = () =>
  typeof document !== "undefined" &&
  document.documentElement.hasAttribute("data-lite");

export function HalftoneCanvas({
  src,
  alt,
  mode = "normal",
  className,
}: {
  src: string;
  alt: string;
  mode?: Mode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || !src) return;

    let dead = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        io.disconnect();

        const scale = Math.min(
          window.devicePixelRatio || 1,
          lite() ? 1 : 1.5,
        );
        const w = Math.round(el.clientWidth * scale);
        const h = Math.round(el.clientHeight * scale);
        if (!w || !h) return;

        const key = src + "|" + mode + "|" + w + "x" + h + "|" + lite();
        const paint = (canvas: HTMLCanvasElement) => {
          const target = cv.current;
          if (!target || dead) return;
          target.width = canvas.width;
          target.height = canvas.height;
          target.getContext("2d")?.drawImage(canvas, 0, 0);
          setReady(true);
        };

        const cached = cache.get(key);
        if (cached) {
          paint(cached);
          return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        img
          .decode()
          .then(() => {
            if (dead) return;
            const out = document.createElement("canvas");
            renderHalftone(img, out, w, h, {
              ...PRESETS[mode],
              cell: lite() ? 8 : 5,
            });
            cache.set(key, out);
            paint(out);
          })
          .catch(() => undefined);
      },
      { rootMargin: "200px" },
    );

    io.observe(el);

    return () => {
      dead = true;
      io.disconnect();
    };
  }, [src, mode]);

  return (
    <div
      ref={box}
      className={cn("relative overflow-hidden bg-background", className)}
    >
      <Halftone src={src} alt={alt} mode={mode} className="h-full w-full" />
      <canvas
        ref={cv}
        role="img"
        aria-label={alt}
        className={cn(
          "absolute inset-0 h-full w-full transition-opacity duration-500",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
