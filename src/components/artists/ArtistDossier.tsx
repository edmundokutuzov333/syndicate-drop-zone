import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Music2,
  Play,
  Share2,
  Youtube,
} from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Halftone } from "@/components/Halftone";
import { SpotifyEmbed } from "@/components/artists/SpotifyEmbed";
import { YouTubePreview } from "@/components/artists/YouTubePreview";
import { ArtistTapePlayer } from "@/components/artists/ArtistTapePlayer";
import { ARTISTS, type Artist } from "@/lib/artists";
import { getArtistChannels } from "@/lib/artist-content";
import type { ArtistVideo } from "@/lib/artist-profiles";
import { TAPES } from "@/lib/data";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";
import { cn } from "@/lib/utils";

type Props = {
  artist: Artist;
  channels?: {
    spotifyArtistId: string;
    youtube: ArtistVideo[];
  } | null;
};

function getTapeForArtist(artist: Artist) {
  const title = artist.faixas[0];
  return TAPES.find((tape) => tape.title === title) ?? null;
}

function socialLabel(name: string) {
  return name.toUpperCase();
}

export function ArtistDossier({ artist, channels: liveChannels }: Props) {
  const [shared, setShared] = useState(false);
  const channels = liveChannels ?? getArtistChannels(artist.slug);
  const currentIndex = ARTISTS.findIndex((item) => item.slug === artist.slug);
  const previous = ARTISTS[(currentIndex - 1 + ARTISTS.length) % ARTISTS.length]!;
  const next = ARTISTS[(currentIndex + 1) % ARTISTS.length]!;
  const others = Array.from({ length: 3 }, (_, offset) => {
    return ARTISTS[(currentIndex + 1 + offset) % ARTISTS.length]!;
  });

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      setShared(false);
    }
  };

  const shareOnWhatsApp = () => {
    const url = window.location.href;
    const target =
      "https://wa.me/?text=" +
      encodeURIComponent("Arquivo de " + artist.name + " · O Sindicato do Trap · " + url);
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const shareOnX = () => {
    const url = window.location.href;
    const target =
      "https://x.com/intent/post?text=" +
      encodeURIComponent("Arquivo de " + artist.name + " · O Sindicato do Trap") +
      "&url=" +
      encodeURIComponent(url);
    window.open(target, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="relative mx-auto max-w-7xl overflow-hidden px-4 pb-28 pt-10 md:px-8 md:pt-14">
      <div className="pointer-events-none absolute left-[3%] top-40 w-40 rotate-12 opacity-20 md:w-56">
        <img src={selo.url} alt="" aria-hidden />
      </div>
      <div className="pointer-events-none absolute right-[4%] top-[34rem] w-44 -rotate-[18deg] opacity-20 md:w-64">
        <img src={selo.url} alt="" aria-hidden />
      </div>

      <header className="relative border-y border-border py-5">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-stamp text-sm tracking-[0.25em]">O SINDICATO DO TRAP</p>
            <h1 className="mt-1 font-gothic text-5xl leading-none md:text-7xl">
              ARQUIVO DE CONVOCADOS
            </h1>
          </div>
          <p className="font-stamp text-2xl text-blood md:text-3xl">{artist.code}</p>
        </div>
      </header>

      <section className="relative mt-8 grid gap-8 md:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] md:gap-12">
        <div className="relative min-h-[520px] overflow-hidden md:min-h-[680px]">
          <Halftone src={artist.img} alt={artist.name} className="h-full min-h-[500px] md:min-h-[660px]" />
          <span className="absolute left-5 top-5 bg-blood px-3 py-1 font-stamp text-[10px] text-primary-foreground">
            CONVOCADO
          </span>
          <img
            src={selo.url}
            alt=""
            aria-hidden
            className="absolute -bottom-9 -right-8 w-36 -rotate-12 opacity-90 md:w-48"
          />
        </div>

        <div className="flex flex-col justify-end">
          <p className="text-[10px] tracking-[0.28em] text-blood">
            CONVOCADO Nº {String(currentIndex + 1).padStart(2, "0")} / {ARTISTS.length}
          </p>
          <h2 className="mt-2 font-gothic text-7xl leading-[0.78] md:text-9xl">{artist.name}</h2>

          <div className="mt-8 border-y border-border py-5">
            <p className="font-stamp text-2xl leading-tight text-foreground md:text-3xl">
              “{artist.frase}”
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 text-[10px] tracking-widest">
            <div>
              <dt className="text-blood">VOZ</dt>
              <dd className="mt-1 font-stamp text-sm tracking-normal">
                {artist.role}
              </dd>
            </div>
            <div>
              <dt className="text-blood">SESSÃO</dt>
              <dd className="mt-1 font-stamp text-sm tracking-normal">{artist.studio}</dd>
            </div>
            <div>
              <dt className="text-blood">ZONA</dt>
              <dd className="mt-1 font-stamp text-sm tracking-normal">{artist.zona}</dd>
            </div>
            <div>
              <dt className="text-blood">EDIÇÃO</dt>
              <dd className="mt-1 font-stamp text-sm tracking-normal">{artist.edition}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="relative mt-24 grid gap-10 border-t border-border pt-8 md:grid-cols-[1.15fr_0.85fr] md:gap-14">
        <div>
          <p className="text-[10px] tracking-[0.28em] text-blood">PERFIL</p>
          <h2 className="mt-1 font-gothic text-5xl md:text-6xl">SOBRE O ARTISTA</h2>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            {artist.bio}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 self-start">
          <InfoTag label="ZONA" value={artist.zona} />
          <InfoTag label="FAIXAS NO CAMPING" value={artist.faixas.join(" · ")} />
          <InfoTag label="PRESENÇA" value={artist.presence} />
          <InfoTag label="EDIÇÃO" value={artist.edition} />
        </div>
      </section>

      {channels && (
        <>
          <section className="mt-24">
            <SpotifyEmbed artistName={artist.name} spotifyArtistId={channels.spotifyArtistId} />
          </section>

          <section className="mt-24">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] tracking-[0.28em] text-blood">RELEASE RADAR</p>
                <h2 className="mt-1 font-gothic text-5xl md:text-6xl">ÚLTIMOS LANÇAMENTOS</h2>
              </div>
              <a
                href={"https://www.youtube.com/results?search_query=" + encodeURIComponent(artist.name)}
                target="_blank"
                rel="noreferrer"
                className="hidden items-center gap-1 text-[10px] tracking-widest text-muted-foreground hover:text-blood md:flex"
              >
                YOUTUBE <ExternalLink size={12} />
              </a>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {channels.youtube.map((video) => (
                <YouTubePreview key={video.id} artistName={artist.name} video={video} />
              ))}
            </div>
          </section>

          <section className="mt-24 grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
            <div className="border border-border bg-card p-5 md:p-7">
              <p className="text-[10px] tracking-[0.28em] text-blood">NO SINDICATO</p>
              <h2 className="mt-1 font-gothic text-5xl md:text-6xl">01 PARTICIPAÇÃO</h2>
              <div className="mt-8 grid gap-4 text-xs">
                <InfoLine label="FAIXA" value={artist.faixas[0] ?? "REGISTO DE CAMPING"} />
                <InfoLine label="COM" value={artist.faixas[0] === "PHANTOM MODE" ? "INF8M8US" : "ARQUIVO SDT"} />
                <InfoLine label="SESSÃO" value="STUDIO XOYENS" />
                <InfoLine label="ESTADO" value="GRAVADO" accent />
              </div>
            </div>

            <div>
              <ArtistTapePlayer title={artist.faixas[0] ?? "PRÉVIA DO CAMPING"} tape={getTapeForArtist(artist)} />
            </div>
          </section>

          <section className="mt-24">
            <div className="mb-6">
              <p className="text-[10px] tracking-[0.28em] text-blood">ARQUIVO</p>
              <h2 className="mt-1 font-gothic text-5xl md:text-6xl">ARQUIVO DO ARTISTA</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-4">
              <ArchiveCard title="FOTO DE CAMPING" index="01">
                <Halftone src={artist.img} alt={artist.name} className="aspect-[4/3] h-auto" />
              </ArchiveCard>
              <ArchiveCard title="STUDIO SESSION" index="02">
                {channels.youtube[0] && (
                  <img
                    src={"https://i.ytimg.com/vi/" + channels.youtube[0].youtubeId + "/hqdefault.jpg"}
                    alt=""
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover grayscale contrast-[1.35]"
                  />
                )}
              </ArchiveCard>
              <ArchiveCard title="DOSSIÊ" index="03">
                <div className="flex aspect-[4/3] items-center justify-center bg-background p-5 text-center font-stamp text-sm">
                  {artist.code}<br />ARQUIVO DE CONVOCADOS
                </div>
              </ArchiveCard>
              <ArchiveCard title={artist.faixas[0] ?? "CAMPING"} index="04">
                <div className="flex aspect-[4/3] items-center justify-center bg-background p-5 text-center">
                  <Play size={30} fill="currentColor" />
                </div>
              </ArchiveCard>
            </div>
          </section>

          <section className="mt-24 border-y border-border py-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] tracking-[0.28em] text-blood">CANAIS OFICIAIS</p>
                <h2 className="mt-1 font-gothic text-5xl">ENCONTRAR O ARTISTA</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={"https://open.spotify.com/artist/" + channels.spotifyArtistId}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 border border-border px-4 py-3 text-[10px] tracking-widest transition hover:border-blood hover:text-blood"
                >
                  <Music2 size={14} /> SPOTIFY
                </a>
                <a
                  href={"https://www.youtube.com/results?search_query=" + encodeURIComponent(artist.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 border border-border px-4 py-3 text-[10px] tracking-widest transition hover:border-blood hover:text-blood"
                >
                  <Youtube size={14} /> YOUTUBE
                </a>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="mt-24 border border-blood bg-card p-5 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] tracking-[0.28em] text-blood">TRANSMITIR DOSSIÊ</p>
            <h2 className="mt-1 font-gothic text-5xl md:text-6xl">PARTILHAR</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 border border-foreground px-4 py-3 text-[10px] tracking-widest transition hover:border-blood hover:text-blood"
            >
              {shared ? <Check size={14} /> : <Copy size={14} />}
              {shared ? "COPIADO" : "COPIAR LINK"}
            </button>
            <button
              type="button"
              onClick={shareOnWhatsApp}
              className="inline-flex items-center gap-2 border border-border px-4 py-3 text-[10px] tracking-widest transition hover:border-blood hover:text-blood"
            >
              <Share2 size={14} /> WHATSAPP
            </button>
            <button
              type="button"
              onClick={shareOnX}
              className="inline-flex items-center gap-2 border border-border px-4 py-3 text-[10px] tracking-widest transition hover:border-blood hover:text-blood"
            >
              <Link2 size={14} /> X
            </button>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-3 md:grid-cols-2">
        <Link
          to="/membros/$slug"
          params={{ slug: previous.slug }}
          preload="intent"
          className="group border border-border p-5 transition hover:border-blood"
        >
          <p className="text-[10px] tracking-widest text-muted-foreground">CONVOCADO ANTERIOR</p>
          <div className="mt-2 flex items-center justify-between gap-4">
            <span className="font-gothic text-4xl">{previous.name}</span>
            <ArrowLeft className="transition-transform group-hover:-translate-x-1" />
          </div>
        </Link>
        <Link
          to="/membros/$slug"
          params={{ slug: next.slug }}
          preload="intent"
          className="group border border-border p-5 text-right transition hover:border-blood"
        >
          <p className="text-[10px] tracking-widest text-muted-foreground">PRÓXIMO CONVOCADO</p>
          <div className="mt-2 flex items-center justify-between gap-4">
            <ArrowRight className="transition-transform group-hover:translate-x-1" />
            <span className="font-gothic text-4xl">{next.name}</span>
          </div>
        </Link>
      </section>

      <section className="mt-24">
        <div className="mb-6">
          <p className="text-[10px] tracking-[0.28em] text-blood">OUTROS CONVOCADOS</p>
          <h2 className="mt-1 font-gothic text-5xl md:text-6xl">DESCUBRA OUTRO</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {others.map((item) => (
            <Link
              key={item.slug}
              to="/membros/$slug"
              params={{ slug: item.slug }}
              preload="intent"
              className="group relative overflow-hidden"
            >
              <Halftone src={item.img} alt={item.name} className="aspect-[4/3] transition duration-500 group-hover:scale-[1.02]" />
              <div className="flex items-center justify-between bg-background px-3 py-3">
                <span className="font-gothic text-2xl">{item.name}</span>
                <span className="text-[10px] text-blood">{item.code}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function InfoTag({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <p className="text-[9px] tracking-[0.2em] text-blood">{label}</p>
      <p className="mt-2 font-stamp text-sm leading-5">{value}</p>
    </div>
  );
}

function InfoLine({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-border pb-3">
      <span className="text-[9px] tracking-widest text-muted-foreground">{label}</span>
      <span className={cn("text-right font-stamp text-sm", accent && "text-blood")}>{value}</span>
    </div>
  );
}

function ArchiveCard({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: import("react").ReactNode;
}) {
  return (
    <article className="overflow-hidden border border-border bg-card">
      {children}
      <div className="flex items-center justify-between border-t border-border p-3">
        <span className="font-stamp text-[10px]">{title}</span>
        <span className="text-[10px] text-blood">{index}</span>
      </div>
    </article>
  );
}
