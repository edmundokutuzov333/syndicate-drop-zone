import { useEffect, useRef, useState } from "react";
import type { RevelationMedia } from "@/lib/revelacao-media";
import { cn } from "@/lib/utils";
import { HalftoneCanvas } from "@/components/HalftoneCanvas";

const VIDEO_FILTER = "grayscale(1) contrast(1.35) brightness(0.9)";

const lite = () =>
  typeof document !== "undefined" &&
  document.documentElement.hasAttribute("data-lite");

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const total = Math.floor(seconds);
  return Math.floor(total / 60)
    .toString()
    .padStart(2, "0") + ":" + (total % 60).toString().padStart(2, "0");
}

export function RevelationMediaSurface({
  item,
  className,
  lightbox = false,
}: {
  item: RevelationMedia;
  className?: string;
  lightbox?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || item.type !== "video" || !item.src) return;

    const sync = () => setTime(video.currentTime || 0);
    video.addEventListener("timeupdate", sync);
    sync();

    return () => video.removeEventListener("timeupdate", sync);
  }, [item.id, item.src, item.type]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-background", className)}>
      {item.src && item.type === "video" ? (
        <video
          ref={videoRef}
          src={item.src}
          poster={item.poster}
          autoPlay={!lite() && !lightbox}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={item.alt}
          className={cn("h-full w-full", lightbox ? "object-contain" : "object-cover")}
          style={{ filter: VIDEO_FILTER }}
        />
      ) : item.src ? (
        <HalftoneCanvas
          src={item.src}
          alt={item.alt}
          className="h-full w-full"
        />
      ) : (
        <div
          aria-hidden="true"
          className="h-full w-full bg-background"
          style={{
            backgroundImage:
              "radial-gradient(circle, oklch(0.87 0.015 85 / 0.08) 1px, transparent 1.4px)",
            backgroundSize: "5px 5px",
          }}
        />
      )}

      {item.src && (
        <div className="pointer-events-none absolute left-3 top-3 bg-black/55 px-2 py-1 font-mono text-[7px] tracking-[0.14em] text-foreground">
          ● REC · {item.timecode || formatTime(time)}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 xerox-wear" />

      {item.src && item.type === "video" && !lightbox && !lite() && (
        <div className="scan-sweep pointer-events-none absolute inset-x-0 h-1/4 opacity-60" />
      )}
    </div>
  );
}
