import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Radio, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ARTIST_PROFILES } from "@/lib/artist-profiles";
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

const ARTIST_ORDER = [
  "masepurp", "kametee", "3go", "cipher", "kingston-siriro", "herkey-hk", "reinaldo-king",
  "twista", "txopheer-wawa", "5ir0w", "khriys", "kaka-machava", "kong-v12", "skyler", "pita-shana",
  "bruno-the-goat", "keew080",
];

function FrequenciaPage() {
  const state = useFrequencyState();
  const muted = useSyncExternalStore(subscribeMute, isMuted, () => false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [nightBadge, setNightBadge] = useState(false);
  const [visual, setVisual] = useState({ level: 0, spectrum: [] as number[] });
  const artists = useMemo(
    () => ARTIST_ORDER.map((slug) => ARTIST_PROFILES.find((artist) => artist.slug === slug)).filter(Boolean),
    [],
  );

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
            <p className="font-mono text-[10px] tracking-[0.3em] text-blood">RÁDIO PIRATA · 24 H</p>
            <h1 className="mt-2 font-gothic text-6xl leading-none md:text-9xl">FREQUÊNCIA 808</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[9px]">
            <span className="border border-border px-3 py-2">● {state.listenerCount || 0} OUVINTES</span>
            <span className="border border-border px-3 py-2">17 CONVOCADOS · PLAYERS SPOTIFY OFICIAIS</span>
            {nightBadge && <span className="border border-blood px-3 py-2 text-blood">OUVINTE DA MADRUGADA</span>}
          </div>
        </div>
      </div>

      <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.15fr_.85fr]">
        <FrequencyDial level={state.playing ? Math.max(visual.level, .01) : 0} spectrum={visual.spectrum} playing={state.playing} />

        <div className="border border-border bg-card p-5 md:p-7">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <span className="font-mono text-[9px] tracking-[0.22em] text-blood">{state.active ? "CARRIER LOCK" : "OFF AIR"}</span>
            <Radio size={18} className={state.playing ? "animate-pulse text-blood" : "text-muted-foreground"} />
          </div>

          <p className="mt-8 text-[9px] tracking-[0.28em] text-blood">
            {state.phase === "tag" ? "IDENTIFICAÇÃO 808" : state.phase === "static" ? "ESTÁTICA" : "NO AR AGORA"}
          </p>
          <h2 className="mt-2 font-stamp text-3xl md:text-4xl">{state.current?.title ?? "AGUARDA SINTONIA"}</h2>
          <p className="mt-2 text-xs text-muted-foreground">{state.current?.artist ?? "FREQUÊNCIA 808 · O SINDICATO DO TRAP"}</p>

          <div className="mt-7 border-y border-border py-4">
            <p className="text-[9px] tracking-[0.2em] text-muted-foreground">A SEGUIR</p>
            <p className="mt-2 font-stamp text-xl">{state.next?.title ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">{state.next?.artist ?? "—"}</p>
          </div>

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
          <p className="mt-6 text-[9px] leading-5 text-muted-foreground">
            A grelha corre por relógio, não por pedido. Todos os ouvintes recebem a mesma posição de emissão.
          </p>
        </div>
      </section>

      <section className="mt-14 border-t border-border pt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] tracking-[0.28em] text-blood">CATÁLOGO DE CONVOCADOS</p>
            <h2 className="mt-1 font-gothic text-5xl md:text-6xl">PRÉ-VISUALIZAR</h2>
          </div>
          <a href="https://open.spotify.com" target="_blank" rel="noreferrer" className="hidden items-center gap-1 text-[9px] tracking-[0.18em] text-muted-foreground hover:text-blood md:flex">
            SPOTIFY <ExternalLink size={12} />
          </a>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {artists.map((artist) => {
            if (!artist) return null;
            const open = expanded === artist.slug;
            return (
              <article key={artist.slug} className={"border " + (open ? "border-blood" : "border-border") + " bg-card"}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={"spotify-" + artist.slug}
                  onClick={() => setExpanded(open ? null : artist.slug)}
                  className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block font-stamp text-lg">{artist.name}</span>
                    <span className="font-mono text-[8px] tracking-[0.18em] text-muted-foreground">SPOTIFY · {artist.spotifyArtistId}</span>
                  </span>
                  <span className="text-blood">{open ? "—" : "+"}</span>
                </button>
                {open && <SpotifyPreview artist={artist} />}

              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-14 border border-border bg-card/50 p-5 md:p-7">
        <p className="text-[9px] tracking-[0.22em] text-blood">SINAL DA CASA</p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          A emissão automática usa áudio próprio do Sindicato. Os 17 artistas têm players oficiais do Spotify nesta página para ouvir e descobrir as faixas no serviço; o áudio do Spotify não é retransmitido pela rádio.
        </p>
      </section>

      <div className="mt-8 font-mono text-[8px] tracking-[0.18em] text-muted-foreground">
        SID · {typeof window === "undefined" ? "--------" : getAnalyticsSessionId().slice(0, 8)} · 808
      </div>
    </main>
  );
}

function SpotifyPreview({ artist }: { artist: (typeof ARTIST_PROFILES)[number] }) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setSlow(false);
    const timeout = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [artist.spotifyArtistId]);

  const embedUrl = "https://open.spotify.com/embed/artist/" + encodeURIComponent(artist.spotifyArtistId) + "?utm_source=generator&theme=0";
  const panelId = "spotify-" + artist.slug;

  return (
    <div id={panelId} className="border-t border-border p-3">
      <div className="relative overflow-hidden border border-border bg-black/30">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex min-h-[352px] items-center justify-center p-5 text-center">
            <div>
              <p className="font-mono text-[9px] tracking-[0.2em] text-blood">
                {slow ? "SPOTIFY DEMORA A RESPONDER" : "A CARREGAR PLAYER OFICIAL"}
              </p>
              <p className="mt-2 max-w-xs text-[10px] leading-5 text-muted-foreground">
                {slow ? "O player externo pode estar bloqueado pela rede ou pelo browser. Use ABRIR NO SPOTIFY abaixo." : "Pré-visualização oficial de " + artist.name + "."}
              </p>
            </div>
          </div>
        )}
        <iframe
          title={"Player Spotify oficial de " + artist.name}
          src={embedUrl}
          loading="eager"
          className="h-[352px] w-full border-0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
          onLoad={() => setLoaded(true)}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[9px] leading-4 text-muted-foreground">
          PLAYER OFICIAL SPOTIFY · AS FAIXAS TOCAM NO PLAYER DO SPOTIFY.
        </p>
        <a
          href={"https://open.spotify.com/artist/" + encodeURIComponent(artist.spotifyArtistId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 border border-border px-3 text-[9px] tracking-[0.16em] hover:border-blood"
        >
          ABRIR NO SPOTIFY <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

function useFrequencyState() {
  const [state, setState] = useState(frequency.getState());
  useEffect(() => frequency.subscribe(() => setState(frequency.getState())), []);
  return state;
}
