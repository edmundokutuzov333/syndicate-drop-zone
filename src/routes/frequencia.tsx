import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { FrequencyDial } from "@/components/FrequencyDial";
import { frequency } from "@/lib/frequency";
import { isMuted, setMuted, subscribeMute } from "@/lib/audio-bus";
import { hasNightListenerBadge } from "@/lib/frequency-api";
import { getStoredMemberCode } from "@/lib/membership";
import { getAnalyticsSessionId } from "@/lib/track";

export const Route = createFileRoute("/frequencia")({
  head: () => ({
    meta: [
      { title: "Frequência 808 — O Sindicato do Trap" },
      { name: "description", content: "Rádio pirata 24h do Sindicato do Trap. Sintonize a Frequência 808." },
      { property: "og:title", content: "Frequência 808 — O Sindicato do Trap" },
      { property: "og:description", content: "Uma rádio clandestina que nunca pára. Sintonize a Frequência 808." },
    ],
  }),
  component: FrequenciaPage,
});

function FrequenciaPage() {
  const state = useFrequencyState();

  useEffect(() => {
    void frequency.prepare();
  }, []);
  const muted = useSyncExternalStore(subscribeMute, isMuted, () => false);
  const [nightBadge, setNightBadge] = useState(false);
  const [visual, setVisual] = useState({ level: 0, spectrum: [] as number[] });
  useEffect(() => {
    if (!state.playing) {
      setVisual({ level: 0, spectrum: [] });
      return;
    }

    let frame = 0;
    const loop = () => {
      setVisual({
        level: frequency.level(),
        spectrum: frequency.getSpectrum(),
      });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.playing]);

  useEffect(() => {
    const code = getStoredMemberCode();
    if (!code) {
      setNightBadge(false);
      return;
    }
    void hasNightListenerBadge(code).then(setNightBadge);
  }, [state.active]);

  return (
    <main className="relative mx-auto max-w-7xl overflow-hidden px-4 pb-28 pt-10 md:px-8">
      <div className="border-y border-border py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-blood">RÁDIO SINDICATO DO TRAP</p>
            <h1 className="mt-2 font-gothic text-6xl leading-none md:text-9xl">FREQUÊNCIA 808</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[9px]">
            {nightBadge && <span className="border border-blood px-3 py-2 text-blood">OUVINTE DA MADRUGADA</span>}
          </div>
        </div>
      </div>

      <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.15fr_.85fr]">
        <FrequencyDial level={state.playing ? Math.max(visual.level, .01) : 0} spectrum={visual.spectrum} playing={state.playing} />

        <div className="border border-border bg-card p-5 md:p-7">
          <p className="mt-8 text-[9px] tracking-[0.28em] text-blood">
            {!state.active ? "FORA DO AR" : state.error ? "SINAL DE EMERGÊNCIA" : state.phase === "tag" ? "IDENTIFICAÇÃO 808" : state.phase === "static" ? "ESTÁTICA" : state.playing ? "NO AR AGORA" : "PAUSADA"}
          </p>
          <h2 className="mt-2 font-stamp text-3xl md:text-4xl">
            {state.error ? "INTERFERÊNCIA 808" : state.phase === "tag" ? "SINDICATO DO TRAP" : state.phase === "static" ? "ESTÁTICA 808" : state.current?.title ?? "AGUARDA SINTONIA"}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {state.error ? "A emissão mantém sinal de emergência enquanto recupera a faixa." : state.phase === "tag" ? "IDENTIFICAÇÃO DA ESTAÇÃO" : state.phase === "static" ? "RUÍDO ANALÓGICO DE EMERGÊNCIA" : state.current?.artist ?? "FREQUÊNCIA 808 · O SINDICATO DO TRAP"}
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            {!state.playing ? (
              <button type="button" onClick={() => void frequency.start()} className="inline-flex min-h-11 items-center gap-2 border border-blood bg-blood px-4 py-3 font-mono text-[10px] tracking-[0.18em] text-primary-foreground">
                <Radio size={14} /> SINTONIZAR
              </button>
            ) : (
              <button type="button" onClick={() => frequency.pause()} className="inline-flex min-h-11 items-center gap-2 border border-blood px-4 py-3 font-mono text-[10px] tracking-[0.18em]">
                PAUSAR
              </button>
            )}
            <button type="button" aria-label={muted ? "Ligar som" : "Silenciar"} aria-pressed={muted} onClick={() => setMuted(!muted)} className="inline-flex min-h-11 items-center gap-2 border border-border px-4 py-3 font-mono text-[10px] tracking-[0.18em]">
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />} {muted ? "SOM OFF" : "SOM ON"}
            </button>
            <Link to="/membros" className="inline-flex min-h-11 items-center gap-2 border border-border px-4 py-3 font-mono text-[10px] tracking-[0.18em]">
              ARTISTAS
            </Link>
          </div>

          {state.error && <p className="mt-4 border border-blood/40 bg-blood/5 p-3 text-[10px] text-blood">{state.error}</p>}
        </div>
      </section>

      <div className="mt-8 font-mono text-[8px] tracking-[0.18em] text-muted-foreground">
        SID · {typeof window === "undefined" ? "--------" : getAnalyticsSessionId().slice(0, 8)} · 808
      </div>
    </main>
  );
}

function useFrequencyState() {
  const [state, setState] = useState(frequency.getState());
  useEffect(() => frequency.subscribe(() => setState(frequency.getState())), []);
  return state;
}
