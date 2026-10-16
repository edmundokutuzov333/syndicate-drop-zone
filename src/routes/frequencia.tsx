import { createFileRoute, Link } from "@tanstack/react-router";
import { Power, Radio, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { FrequencyDial } from "@/components/FrequencyDial";
import { frequency } from "@/lib/frequency";
import {
  getRadioVolume,
  isMuted,
  setMuted,
  setRadioVolume,
  subscribeMute,
  subscribeRadioVolume,
} from "@/lib/audio-bus";
import { hasNightListenerBadge } from "@/lib/frequency-api";
import { getStoredMemberCode } from "@/lib/membership";

export const Route = createFileRoute("/frequencia")({
  head: () => ({
    meta: [
      { title: "Frequência 808 — O Sindicato do Trap" },
      { name: "description", content: "Rádio Sindicato do Trap. Frequência 808." },
      { property: "og:title", content: "Frequência 808 — O Sindicato do Trap" },
      { property: "og:description", content: "Rádio Sindicato do Trap. Frequência 808." },
    ],
  }),
  component: FrequenciaPage,
});

function FrequenciaPage() {
  const state = useFrequencyState();
  const muted = useSyncExternalStore(subscribeMute, isMuted, () => false);
  const [nightBadge, setNightBadge] = useState(false);
  const [visual, setVisual] = useState({ level: 0, spectrum: [] as number[] });
  const [position, setPosition] = useState(() => frequency.getPlaybackPosition());
  const [radioVolume, setVolumeState] = useState(getRadioVolume());

  useEffect(() => {
    void frequency.prepare();
  }, []);

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
    if (!state.active) {
      setPosition(frequency.getPlaybackPosition());
      return;
    }
    const tick = () => setPosition(frequency.getPlaybackPosition());
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [state.active, state.playing, state.phase]);

  useEffect(() => subscribeRadioVolume(() => setVolumeState(getRadioVolume())), []);

  useEffect(() => {
    const code = getStoredMemberCode();
    if (!code) {
      setNightBadge(false);
      return;
    }
    void hasNightListenerBadge(code).then(setNightBadge);
  }, [state.active]);

  const progress = position.duration > 0
    ? Math.min(100, Math.max(0, (position.elapsed / position.duration) * 100))
    : 0;

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
        <FrequencyDial
          level={state.playing ? Math.max(visual.level, 0.01) : 0}
          spectrum={visual.spectrum}
          playing={state.playing}
        />

        <div className="border border-border bg-card p-5 md:p-7">
          <p className="text-[9px] tracking-[0.28em] text-blood">
            {!state.active
              ? "FORA DO AR"
              : state.error
                ? "SINAL DE EMERGÊNCIA"
                : state.phase === "tag"
                  ? "IDENTIFICAÇÃO 808"
                  : state.phase === "static"
                    ? "ESTÁTICA"
                    : state.phase === "jingle"
                      ? "JINGLE"
                      : state.playing
                        ? "NO AR AGORA"
                        : "PAUSADA"}
          </p>

          <h2 className="mt-2 font-stamp text-3xl md:text-4xl">
            {state.error
              ? "INTERFERÊNCIA 808"
              : state.phase === "tag"
                ? "SINDICATO DO TRAP"
                : state.phase === "static"
                  ? "ESTÁTICA 808"
                  : state.phase === "jingle"
                    ? state.current?.title ?? "SINDICATO 808"
                    : state.current?.title ?? "AGUARDA SINTONIA"}
          </h2>

          <p className="mt-2 text-xs text-muted-foreground">
            {state.error
              ? "A emissão mantém o sinal enquanto recupera a faixa."
              : state.phase === "tag"
                ? "IDENTIFICAÇÃO DA ESTAÇÃO"
                : state.phase === "static"
                  ? "EFEITO DE TRANSIÇÃO"
                  : state.current?.artist ?? "RÁDIO SINDICATO DO TRAP"}
          </p>

          <div className="mt-7 border-y border-border py-4">
            <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
              <span>{formatTime(position.elapsed)}</span>
              <span>{formatTime(position.remaining)} RESTAM</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden bg-secondary" role="progressbar" aria-label="Progresso da emissão" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div
                className="h-full bg-blood transition-[width] duration-200"
                style={{ width: progress + "%" }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between font-mono text-[8px] tracking-[0.14em] text-muted-foreground">
              <span>
                {position.phase === "tag"
                  ? "IDENTIFICAÇÃO"
                  : position.phase === "static"
                    ? "EFEITO"
                    : position.phase === "jingle"
                      ? "JINGLE"
                      : "EMISSÃO"}
              </span>
              <span>
                {state.syncStatus === "sync_ok"
                  ? "SYNC OK"
                  : state.syncStatus === "sync_degraded"
                    ? "SYNC DEGRADED"
                    : "OFFLINE CLOCK"}
              </span>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            {!state.playing ? (
              <button
                type="button"
                onClick={() => void frequency.resume()}
                className="inline-flex min-h-11 items-center gap-2 border border-blood bg-blood px-4 py-3 font-mono text-[10px] tracking-[0.18em] text-primary-foreground"
              >
                <Radio size={14} /> {state.active ? "RETOMAR" : "SINTONIZAR"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => frequency.pause()}
                className="inline-flex min-h-11 items-center gap-2 border border-blood px-4 py-3 font-mono text-[10px] tracking-[0.18em]"
              >
                PAUSAR
              </button>
            )}

            <button
              type="button"
              aria-label={muted ? "Ligar som" : "Silenciar"}
              aria-pressed={muted}
              onClick={() => setMuted(!muted)}
              className="inline-flex min-h-11 items-center gap-2 border border-border px-4 py-3 font-mono text-[10px] tracking-[0.18em]"
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {muted ? "SOM OFF" : "SOM ON"}
            </button>

            <label className="flex min-h-11 items-center gap-2 border border-border px-3 font-mono text-[9px] tracking-[0.12em] text-muted-foreground">
              <Volume2 size={13} />
              <input
                aria-label="Volume da Rádio Sindicato do Trap"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={radioVolume}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setRadioVolume(value);
                  setVolumeState(value);
                  frequency.setVolume(value);
                }}
                className="w-24 accent-[var(--blood)]"
              />
            </label>

            <button
              type="button"
              onClick={() => frequency.stop()}
              className="inline-flex min-h-11 items-center gap-2 border border-border px-4 py-3 font-mono text-[10px] tracking-[0.18em] hover:border-blood"
            >
              <Power size={14} /> DESLIGAR RÁDIO
            </button>

            <Link
              to="/membros"
              className="inline-flex min-h-11 items-center gap-2 border border-border px-4 py-3 font-mono text-[10px] tracking-[0.18em]"
            >
              ARTISTAS
            </Link>
          </div>

          {state.error && (
            <p className="mt-4 border border-blood/40 bg-blood/5 p-3 text-[10px] text-blood">
              {state.error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return minutes + ":" + secs;
}

function useFrequencyState() {
  const [state, setState] = useState(frequency.getState());
  useEffect(() => frequency.subscribe(() => setState(frequency.getState())), []);
  return state;
}
