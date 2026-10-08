import { useEffect, useRef, useState } from "react";
import { HalftoneCanvas } from "./HalftoneCanvas";
import { hiss } from "@/lib/sfx";
import type { RevelationMedia } from "@/lib/revelacao-media";

type Mode = "normal" | "noturna" | "raiox";

const MODES: Mode[] = ["normal", "noturna", "raiox"];

const lite = () =>
  typeof document !== "undefined" &&
  document.documentElement.hasAttribute("data-lite");

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return minutes + ":" + secs;
}

export function Projector({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: readonly RevelationMedia[];
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<Mode>("normal");
  const [muted, setMuted] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const x0 = useRef(0);

  const open = index !== null;
  const current = index === null ? undefined : items[index];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    setMode("normal");
    setMuted(true);
    setTime(0);
    setDuration(0);
  }, [index]);

  useEffect(() => {
    if (index === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        onIndex((index + 1) % items.length);
        hiss(0.15);
      }
      if (event.key === "ArrowLeft") {
        onIndex((index - 1 + items.length) % items.length);
        hiss(0.15);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, items.length, onIndex]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || current?.type !== "video") return;

    const sync = () => {
      setTime(video.currentTime || 0);
      setDuration(video.duration || 0);
    };

    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("timeupdate", sync);
    sync();

    return () => {
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("timeupdate", sync);
    };
  }, [current?.src, current?.type]);

  if (!current) {
    return <dialog ref={ref} aria-label="Projector" />;
  }

  const displayTime = formatTime(time);
  const totalTime = formatTime(duration);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Projector"
      className="m-0 h-full max-h-none w-full max-w-none bg-background/95 p-0 text-foreground backdrop:bg-black"
      onPointerDown={(event) => {
        x0.current = event.clientX;
      }}
      onPointerUp={(event) => {
        const dx = event.clientX - x0.current;
        if (Math.abs(dx) < 60 || index === null) return;
        onIndex(
          (index + (dx < 0 ? 1 : -1) + items.length) % items.length,
        );
        hiss(0.15);
      }}
    >
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border p-3 font-mono text-[9px] tracking-[0.16em]">
          <span className="text-blood">
            ● REC · {current.tag || current.roll || "REVELAÇÃO"}
            {current.day
              ? " · DIA " + String(current.day).padStart(2, "0")
              : ""}
          </span>
          <span className="hidden text-muted-foreground sm:inline">
            {(index ?? 0) + 1}/{items.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="border border-border px-3 py-2 hover:border-blood hover:text-blood"
          >
            FECHAR ✕
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-black">
          {current.type === "video" ? (
            <>
              <video
                ref={videoRef}
                key={current.src}
                src={current.src ?? undefined}
                poster={current.poster}
                controls
                autoPlay={!lite()}
                muted={muted}
                playsInline
                preload="metadata"
                className="h-full w-full object-contain grayscale contrast-125"
              />
              <div className="pointer-events-none absolute left-3 top-3 bg-black/65 px-2 py-1 font-mono text-[8px] tracking-[0.14em] text-foreground">
                ● REC · {displayTime}
                {duration > 0 ? " / " + totalTime : ""}
              </div>
            </>
          ) : (
            <HalftoneCanvas
              key={current.src + "|" + mode}
              src={current.src}
              alt={current.alt}
              mode={mode}
              className="h-full w-full"
            />
          )}
        </div>

        <div className="border-t border-border bg-background/95">
          <div className="flex items-center justify-between gap-4 px-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-[8px] tracking-[0.16em] text-blood">
                {current.tag || current.roll || "REVELAÇÃO"} · DIA{" "}
                {String(current.day ?? 1).padStart(2, "0")} ·{" "}
                {current.timecode || displayTime}
              </p>
              <p className="mt-1 truncate font-stamp text-sm text-muted-foreground">
                {current.caption || current.alt}
              </p>
            </div>

            {current.type === "video" && (
              <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                className="shrink-0 border border-border px-3 py-2 font-mono text-[8px] tracking-[0.14em] hover:border-blood hover:text-blood"
                aria-pressed={!muted}
              >
                {muted ? "SOM OFF" : "SOM ON"}
              </button>
            )}
          </div>

          {current.type === "image" && (
            <div className="grid grid-cols-3 border-t border-border">
              {MODES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setMode(option);
                    hiss(0.2);
                  }}
                  aria-pressed={mode === option}
                  className={
                    "py-3 font-mono text-[8px] tracking-[0.12em] " +
                    (mode === option
                      ? "bg-blood text-primary-foreground"
                      : "hover:bg-muted")
                  }
                >
                  {option === "normal"
                    ? "NORMAL"
                    : option === "noturna"
                      ? "VISÃO NOTURNA"
                      : "RAIO-X"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
