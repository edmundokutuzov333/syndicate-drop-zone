import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";
import { Projector } from "@/components/Projector";
import { RevelationMediaSurface } from "@/components/revelacao/MediaSurface";
import { useDevelop } from "@/components/use-develop";
import { type RevelationMedia } from "@/lib/revelacao-media";
import { cn } from "@/lib/utils";
import { getLiveRevelationMedia } from "@/lib/site-content";
import { hiss } from "@/lib/sfx";

type Search = { media?: string };

const ROLLS = ["TODOS", "CABINE", "ESTAMPA", "BEAT", "VISUALIZER", "LIVES"] as const;
const DAYS = ["TODOS", "01", "02", "03", "04", "05"] as const;

export const Route = createFileRoute("/revelacao")({
  loader: async () => ({ mediaItems: await getLiveRevelationMedia() }),
  validateSearch: (search: Record<string, unknown>): Search => {
    const media = typeof search.media === "string" ? search.media : undefined;
    return media ? { media } : {};
  },
  head: () => ({
    meta: [
      { title: "Sala de Revelação — O Sindicato do Trap" },
      {
        name: "description",
        content: "Vídeos e fotos crus das gravações do camping no Studio XOYENS.",
      },
      { property: "og:title", content: "Sala de Revelação — O Sindicato do Trap" },
      {
        property: "og:description",
        content: "Bastidores do camping, revelados em bruto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Revelacao,
});

const STAMPS = [
  "left-[4%] top-40 w-40 rotate-12 opacity-30",
  "right-[6%] top-[28rem] w-56 -rotate-[25deg] opacity-20",
  "left-[40%] top-[60rem] w-72 rotate-6 opacity-10",
  "right-[30%] bottom-20 w-32 -rotate-12 opacity-40",
];

function GalleryItem({
  item,
  index,
  onOpen,
}: {
  item: RevelationMedia;
  index: number;
  onOpen: (item: RevelationMedia) => void;
}) {
  const developRef = useDevelop<HTMLDivElement>(index * 90);
  const rotate =
    index % 3 === 0
      ? "-rotate-2"
      : index % 3 === 1
        ? "rotate-1"
        : "rotate-[-0.8deg]";

  const ready = item.src !== null;
  const ratioClass =
    item.ratio === "3:4" ? "aspect-[3/4]" : "aspect-[4/3]";

  const className = cn(
    "group relative block w-full overflow-visible border-4 border-foreground bg-foreground p-2 shadow-2xl",
    ratioClass,
    ready &&
      "cursor-pointer transition-transform duration-300 hover:rotate-0 hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood",
    rotate,
  );

  return (
    <article className={className}>
      <button
        type="button"
        onClick={() => ready && onOpen(item)}
        disabled={!ready}
        aria-label={ready ? "Abrir media" : "Slot reservado"}
        className={cn("block h-full w-full text-left", ready ? "cursor-pointer" : "cursor-default")}
      >
        <div
          ref={ready ? developRef : undefined}
          className={cn("relative h-full overflow-hidden develop", !ready && "border border-background/20")}
          style={{ "--develop-delay": String(index * 90) + "ms" } as CSSProperties}
        >
          <RevelationMediaSurface item={item} />
          <span className="pointer-events-none absolute inset-3 border border-foreground/20" />
        </div>

        <div className="relative flex items-center justify-between gap-3 border-t-2 border-background bg-foreground px-2 py-2 text-background">
          <div className="min-w-0">
            <p className="truncate font-mono text-[7px] tracking-[0.14em]">
              REC {item.timecode || "00:00"} · DIA {String(item.day ?? 1).padStart(2, "0")} · {item.tag || item.roll || "REVELAÇÃO"}
            </p>
            <p className="mt-1 truncate font-stamp text-[10px] uppercase">
              {ready ? item.caption || item.alt : "ARQUIVO RESERVADO"}
            </p>
          </div>
          <span className="shrink-0 font-mono text-[7px] opacity-60">
            {item.type.toUpperCase()}
          </span>
        </div>
      </button>

      <img
        src={selo.url}
        alt=""
        aria-hidden
        className={cn(
          "pointer-events-none absolute z-10 w-16 opacity-80 transition-transform duration-300 group-hover:rotate-6 md:w-20",
          index % 2 ? "-left-6 -top-6 rotate-12" : "-bottom-5 -right-5 -rotate-12",
        )}
      />
    </article>
  );
}

function Revelacao() {
  const navigate = useNavigate({ from: "/revelacao" });
  const { media } = Route.useSearch();
  const { mediaItems } = Route.useLoaderData();
  const [activeRoll, setActiveRoll] = useState<(typeof ROLLS)[number]>("TODOS");
  const [activeDay, setActiveDay] = useState<(typeof DAYS)[number]>("TODOS");
  const [safeLight, setSafeLight] = useState(false);

  const readyMedia = useMemo(
    () => mediaItems.filter((item) => item.src),
    [mediaItems],
  );

  const selectedIndex = useMemo(() => {
    if (!media) return null;
    const index = readyMedia.findIndex((item) => item.id === media);
    return index >= 0 ? index : null;
  }, [media, readyMedia]);

  const filteredItems = useMemo(() => {
    return mediaItems.filter((item) => {
      const rollMatch =
        activeRoll === "TODOS" || (item.roll || item.tag || "") === activeRoll;
      const dayMatch =
        activeDay === "TODOS" ||
        String(item.day ?? 1).padStart(2, "0") === activeDay;
      return rollMatch && dayMatch;
    });
  }, [activeDay, activeRoll, mediaItems]);

  const rollCounts = useMemo(() => {
    return Object.fromEntries(
      ROLLS.slice(1).map((roll) => [
        roll,
        mediaItems.filter((item) => (item.roll || item.tag) === roll && item.src).length,
      ]),
    ) as Record<string, number>;
  }, [mediaItems]);

  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-safelight", safeLight);
    return () => {
      root.removeAttribute("data-safelight");
    };
  }, [safeLight]);

  useEffect(() => {
    if (media && selectedIndex === null) {
      navigate({ search: {}, replace: true });
    }
  }, [media, navigate, selectedIndex]);

  const open = (item: RevelationMedia) => {
    if (!item.src) return;
    navigate({ search: { media: item.id } });
  };

  const close = () => {
    navigate({ search: {}, replace: true });
  };

  return (
    <main className="relative mx-auto max-w-7xl overflow-hidden px-4 pb-24 pt-12 md:px-8">
      {STAMPS.map((className) => (
        <img
          key={className}
          src={selo.url}
          alt=""
          aria-hidden
          className={cn("pointer-events-none absolute mix-blend-screen", className)}
        />
      ))}

      <div className="relative flex flex-col gap-5 border-y border-border py-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs tracking-[0.22em] text-blood">ROLO 01 · CAMPING 1ª EDIÇÃO</p>
          <h1 className="mt-2 font-gothic text-6xl leading-[0.85] md:text-8xl">
            Sala de Revelação
          </h1>
          <p className="mt-3 max-w-2xl font-stamp text-sm text-muted-foreground">
            Negativo primeiro. Revelação depois. Arquivo aberto em bruto.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSafeLight((value) => !value);
            hiss(0.18);
          }}
          aria-pressed={safeLight}
          className={cn(
            "shrink-0 border px-3 py-2 font-mono text-[9px] tracking-[0.15em] transition",
            safeLight
              ? "border-blood bg-blood text-primary-foreground"
              : "border-border text-muted-foreground hover:border-blood hover:text-blood",
          )}
        >
          {safeLight ? "LUZ VERMELHA · ON" : "LUZ VERMELHA · OFF"}
        </button>
      </div>

      <section className="mt-6 border border-border bg-card/60">
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] tracking-[0.22em] text-blood">ROLO</p>
              <p className="mt-1 font-stamp text-xs text-muted-foreground">
                {readyMedia.length} MEDIA · {mediaItems.length - readyMedia.length} SLOTS RESERVADOS
              </p>
            </div>
            <span className="font-mono text-[8px] text-muted-foreground">● REC</span>
          </div>

          <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
            {ROLLS.map((roll) => (
              <button
                key={roll}
                type="button"
                onClick={() => {
                  setActiveRoll(roll);
                  hiss(0.15);
                }}
                aria-pressed={activeRoll === roll}
                className={cn(
                  "shrink-0 border px-3 py-2 font-mono text-[8px] tracking-[0.13em]",
                  activeRoll === roll
                    ? "border-blood bg-blood text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-blood hover:text-blood",
                )}
              >
                {roll}
                {roll !== "TODOS" && (
                  <span className="ml-1 opacity-60">{rollCounts[roll] ?? 0}</span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {DAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => {
                  setActiveDay(day);
                  hiss(0.12);
                }}
                aria-pressed={activeDay === day}
                className={cn(
                  "shrink-0 border px-3 py-1.5 font-mono text-[8px]",
                  activeDay === day
                    ? "border-foreground text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground",
                )}
              >
                {day === "TODOS" ? "DIA" : "DIA " + day}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 p-4 sm:grid-cols-2 md:p-6 lg:gap-10">
          {filteredItems.map((item) => (
            <GalleryItem
              key={item.id}
              item={item}
              index={mediaItems.findIndex((candidate) => candidate.id === item.id)}
              onOpen={open}
            />
          ))}
        </div>
      </section>

      {selectedIndex !== null && (
        <Projector
          items={readyMedia}
          index={selectedIndex}
          onClose={close}
          onIndex={(nextIndex) => {
            const nextItem = readyMedia[nextIndex];
            if (nextItem) {
              navigate({ search: { media: nextItem.id }, replace: true });
            }
          }}
        />
      )}
    </main>
  );
}
