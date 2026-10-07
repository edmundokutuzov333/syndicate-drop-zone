import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RevelationMedia } from "@/lib/revelacao-media";
import { RevelationMediaSurface } from "./MediaSurface";

type Props = {
  items: RevelationMedia[];
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
};

export function RevelationLightbox({ items, index, onClose, onChange }: Props) {
  const item = items[index]!;
  const frameRef = useRef<HTMLDivElement>(null);
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied">("idle");
  const [fullscreen, setFullscreen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const go = (direction: 1 | -1) => {
    const next = (index + direction + items.length) % items.length;
    setShareState("idle");
    onChange(next);
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };

    const onFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [index, items.length, onClose]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await frameRef.current?.requestFullscreen?.();
      }
    } catch {
      setFullscreen(false);
    }
  };

  const share = async () => {
    const url =
      window.location.origin +
      "/revelacao?media=" +
      encodeURIComponent(item.id);

    try {
      if (navigator.share) {
        await navigator.share({
          title: "O Sindicato do Trap",
          text: "Sala de Revelação",
          url,
        });
        setShareState("shared");
      } else {
        await navigator.clipboard.writeText(url);
        setShareState("copied");
      }
      window.setTimeout(() => setShareState("idle"), 1800);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      try {
        await navigator.clipboard.writeText(url);
        setShareState("copied");
        window.setTimeout(() => setShareState("idle"), 1800);
      } catch {
        setShareState("idle");
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/95 p-2 backdrop-blur-md md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de media"
    >
      <div
        ref={frameRef}
        className="relative flex h-full w-full items-center justify-center overflow-hidden border border-border bg-background"
        onTouchStart={(event) => {
          touchStartX.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          const end = event.changedTouches[0]?.clientX;
          touchStartX.current = null;
          if (start == null || end == null) return;

          const delta = end - start;
          if (Math.abs(delta) < 50) return;

          go(delta < 0 ? 1 : -1);
        }}
      >
        <RevelationMediaSurface item={item} lightbox className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-0 bg-background/10" />
        <div className="pointer-events-none absolute inset-0 border-[3px] border-foreground/10" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center border border-border bg-background/80 text-foreground backdrop-blur transition hover:border-blood hover:text-blood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood"
        >
          <X size={18} />
        </button>

        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Media anterior"
          className="absolute left-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center border border-border bg-background/80 text-foreground backdrop-blur transition hover:border-blood hover:text-blood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood md:flex"
        >
          <ChevronLeft size={22} />
        </button>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Media seguinte"
          className="absolute right-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center border border-border bg-background/80 text-foreground backdrop-blur transition hover:border-blood hover:text-blood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood md:flex"
        >
          <ChevronRight size={22} />
        </button>

        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 border border-border bg-background/85 p-2 backdrop-blur">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Sair do ecrã inteiro" : "Entrar em ecrã inteiro"}
            className="flex h-10 w-10 items-center justify-center border border-border text-foreground transition hover:border-blood hover:text-blood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood"
          >
            {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>

          <button
            type="button"
            onClick={share}
            aria-label="Partilhar"
            className="flex h-10 min-w-10 items-center justify-center border border-border px-2 text-foreground transition hover:border-blood hover:text-blood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood"
          >
            {shareState === "shared"
              ? "SHARED"
              : shareState === "copied"
                ? "COPIED"
                : <Share2 size={17} />}
          </button>

          {item.downloadable && (
            <a
              href={
                "/api/revelacao/download/" +
                encodeURIComponent(item.id)
              }
              aria-label="Descarregar media autorizado"
              className="flex h-10 w-10 items-center justify-center border border-border text-foreground transition hover:border-blood hover:text-blood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood"
            >
              <Download size={17} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
