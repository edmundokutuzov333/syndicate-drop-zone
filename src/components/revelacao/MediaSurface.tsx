import { useEffect, useRef } from "react";
import type { RevelationMedia } from "@/lib/revelacao-media";
import { cn } from "@/lib/utils";

type Props = {
  item: RevelationMedia;
  className?: string;
  lightbox?: boolean;
};

const IMAGE_FILTER = "grayscale(1) contrast(1.45) brightness(0.92)";
const VIDEO_FILTER = "grayscale(1) contrast(1.35) brightness(0.9)";

export function RevelationMediaSurface({ item, className, lightbox = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (item.type !== "video" || !videoRef.current) return;
    const playPromise = videoRef.current.play();
    playPromise?.catch(() => undefined);
  }, [item]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-background", className)}>
      {item.type === "video" ? (
        <video
          ref={videoRef}
          src={item.src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={item.alt}
          className={cn("h-full w-full", lightbox ? "object-contain" : "object-cover")}
          style={{ filter: VIDEO_FILTER }}
        />
      ) : (
        <img
          src={item.src}
          alt={item.alt}
          loading={lightbox ? "eager" : "lazy"}
          decoding="async"
          className={cn("h-full w-full", lightbox ? "object-contain" : "object-cover")}
          style={{ filter: IMAGE_FILTER }}
        />
      )}

      <div className="halftone-overlay pointer-events-none absolute inset-0" />
      <div className="xerox-wear pointer-events-none absolute inset-0" />
      {item.type === "video" && !lightbox && (
        <div className="scan-sweep pointer-events-none absolute inset-x-0 h-1/4 opacity-70" />
      )}
    </div>
  );
}
