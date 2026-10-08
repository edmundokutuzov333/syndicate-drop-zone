import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TAPES } from "@/lib/data";
import { KEY_LISTEN_SECONDS } from "@/lib/config";
import { grantKey, keyLeftMs } from "@/lib/key";
import { isMuted, setMuted, subscribeMute } from "@/lib/audio-bus";
import { tape } from "@/lib/tape-engine";
import { track } from "@/lib/track";
import { useTape } from "./use-tape";
import { frequency } from "@/lib/frequency";

function mmss(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
}

function keyLabel(): string {
  const remaining = keyLeftMs();
  if (!remaining) return "";
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  return "CHAVE " + hours + "H " + minutes + "M";
}

export function MiniPlayer() {
  const state = useTape();
  const muted = useSyncExternalStore(subscribeMute, isMuted, () => false);
  const [level, setLevel] = useState(0);
  const earnedTracks = useRef(new Set<string>());

  useEffect(() => {
    if (tape.getQueue().length === 0) tape.setQueue(TAPES);
  }, []);

  useEffect(() => {
    if (!state.id || !state.playing || state.t < KEY_LISTEN_SECONDS || earnedTracks.current.has(state.id)) return;
    earnedTracks.current.add(state.id);
    grantKey();
    track("tape_10s", { tape: state.id });
    track("key_earned", { tape: state.id });
  }, [state.id, state.playing, state.t]);

  useEffect(() => {
    if (!state.playing) {
      setLevel(0);
      return;
    }
    let frame = 0;
    const loop = () => {
      setLevel(tape.level());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.playing]);

  const frequencyState = frequency.getState();

  if (frequencyState.active) {
    return (
      <div role="region" aria-label="Frequência 808" className="fixed inset-x-0 bottom-0 z-[55] border-t-2 border-blood bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 md:px-8">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-blood text-blood">808</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-stamp text-sm">FREQUÊNCIA 808</p>
            <p className="truncate text-[10px] tracking-widest text-muted-foreground">
              {frequencyState.phase === "tag" ? "IDENTIFICAÇÃO 808" : frequencyState.phase === "static" ? "ESTÁTICA" : frequencyState.current?.title ?? "NO AR"}
              {frequencyState.current?.artist ? " · " + frequencyState.current.artist : ""}
            </p>
          </div>
          <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">{Math.floor(frequencyState.elapsed)}s / {Math.floor(frequencyState.duration)}s</span>
          <button
            type="button"
            aria-label={frequencyState.playing ? "Pausar Frequência 808" : "Retomar Frequência 808"}
            onClick={() => void (frequencyState.playing ? frequency.pause() : frequency.resume())}
            className="min-h-11 border border-blood bg-blood px-3 py-1 text-xs text-primary-foreground"
          >
            {frequencyState.playing ? "■" : "▶"}
          </button>
          <button
            type="button"
            aria-label={muted ? "Ligar som" : "Silenciar"}
            aria-pressed={muted}
            onClick={() => setMuted(!muted)}
            className="min-h-11 border border-border px-3 py-1 text-xs"
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button type="button" aria-label="Parar Frequência 808" onClick={() => frequency.stop()} className="min-h-11 border border-border px-3 py-1 text-xs">✕</button>
        </div>
      </div>
    );
  }

  const current = tape.getCurrentTrack();
  if (!current) return null;

  const percentage = state.dur ? Math.min(100, (state.t / state.dur) * 100) : 0;
  const currentKeyLabel = keyLabel();

  return (
    <div role="region" aria-label="Leitor de fitas" className="fixed inset-x-0 bottom-0 z-[55] border-t-2 border-blood bg-background/95 backdrop-blur">
      <label className="sr-only" htmlFor="sdt-tape-progress">Progresso da fita</label>
      <input
        id="sdt-tape-progress"
        aria-label="Progresso da fita"
        type="range"
        min={0}
        max={state.dur || 0}
        value={Math.min(state.t, state.dur || 0)}
        disabled={!state.dur}
        onChange={(event) => tape.seek(Number(event.target.value))}
        style={{ accentColor: "var(--blood)" }}
        className="h-2 w-full cursor-pointer disabled:cursor-default"
      />
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 md:px-8">
        <span aria-hidden className="relative flex h-9 w-14 shrink-0 items-center justify-between border border-border px-1.5">
          {[0, 1].map((item) => (
            <span key={item} className="h-4 w-4 rounded-full border-2 border-foreground/70" style={{ animation: state.playing ? "spin-reel 1.2s linear infinite" : "none", borderTopColor: "var(--blood)" }} />
          ))}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-stamp text-sm">{current.title}</p>
          <p className="truncate text-[10px] tracking-widest text-muted-foreground">{state.error ? "FITA CORROMPIDA — TENTA OUTRA" : current.feat}</p>
        </div>
        <div aria-hidden className="hidden h-6 items-end gap-0.5 sm:flex">
          {Array.from({ length: 8 }).map((_, index) => (
            <span key={index} className="w-1 bg-blood" style={{ height: Math.max(12, level * 100 * (0.5 + Math.abs(Math.sin(index * 1.9 + level * 7)))) + "%" }} />
          ))}
        </div>
        <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">{mmss(state.t)} / {mmss(state.dur)}</span>
        <button aria-label="Anterior" onClick={() => tape.prev()} className="border border-border px-2 py-1 text-xs hover:border-blood focus-visible:outline focus-visible:outline-1">⏮</button>
        <button aria-label={state.playing ? "Pausar" : "Tocar"} onClick={() => tape.toggle(current)} className="border border-blood bg-blood px-3 py-1 text-xs text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-1">{state.playing ? "■" : "▶"}</button>
        <button aria-label="Seguinte" onClick={() => tape.next()} className="border border-border px-2 py-1 text-xs hover:border-blood focus-visible:outline focus-visible:outline-1">⏭</button>
        <button aria-label={muted ? "Ligar som" : "Silenciar"} aria-pressed={muted} onClick={() => setMuted(!muted)} className="border border-border px-2 py-1 text-xs hover:border-blood focus-visible:outline focus-visible:outline-1">{muted ? "🔇" : "🔊"}</button>
        <button aria-label="Fechar" onClick={() => tape.stop()} className="border border-border px-2 py-1 text-xs hover:border-blood focus-visible:outline focus-visible:outline-1">✕</button>
        {currentKeyLabel && <span className="hidden font-mono text-[8px] tracking-widest text-blood lg:inline">{currentKeyLabel}</span>}
      </div>
    </div>
  );
}
