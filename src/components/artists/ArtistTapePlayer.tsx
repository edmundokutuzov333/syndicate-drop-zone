import { Pause, Play, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/tape-engine";
import { TapeEngine } from "@/lib/tape-engine";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  tape: Track | null;
};

export function ArtistTapePlayer({ title, tape }: Props) {
  const engineRef = useRef<TapeEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    return engine.subscribe(() => {
      const state = engine.getState();
      setPlaying(state.playing);
      if (!state.playing) setLevel(0);
    });
  }, []);

  useEffect(() => {
    if (!playing) return;

    const engine = engineRef.current;
    if (!engine) return;

    const tick = () => {
      setLevel(engine.level());
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      engineRef.current?.stop();
    };
  }, []);

  if (!tape) return null;

  const toggle = () => {
    const engine = engineRef.current ?? new TapeEngine();
    engineRef.current = engine;

    if (engine.getState().id === tape.id && engine.getState().playing) {
      engine.pause();
      return;
    }

    engine.play(tape);
  };

  return (
    <section className="border border-border bg-card" aria-label={"Prévia " + title}>
      <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <p className="text-[10px] tracking-[0.28em] text-blood">OUVIR NO SINDICATO</p>
          <h3 className="mt-1 font-gothic text-4xl">{title}</h3>
          <p className="mt-1 text-[10px] tracking-widest text-muted-foreground">
            PRÉVIA DE CAMPING · 30 SEG
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Parar prévia" : "Reproduzir prévia"}
            className="flex h-12 w-12 shrink-0 items-center justify-center border border-foreground bg-background text-foreground transition hover:border-blood hover:text-blood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood"
          >
            {playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
          </button>

          <div className="flex h-12 min-w-40 items-end gap-[3px] border border-border bg-background px-3 py-2" aria-hidden>
            {Array.from({ length: 22 }, (_, index) => {
              const pulse = playing
                ? Math.max(0.15, level * (0.55 + ((index * 17) % 37) / 50))
                : 0.08;
              return (
                <span
                  key={index}
                  className={cn(
                    "w-1 bg-foreground/60 transition-[height] duration-75",
                    playing && "bg-blood",
                  )}
                  style={{ height: Math.max(4, Math.round(pulse * 34)) }}
                />
              );
            })}
          </div>

          <Radio size={16} className={playing ? "animate-pulse text-blood" : "text-muted-foreground"} />
        </div>
      </div>
    </section>
  );
}
