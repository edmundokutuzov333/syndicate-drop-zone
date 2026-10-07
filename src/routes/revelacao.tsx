import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";
import { RevelationLightbox } from "@/components/revelacao/Lightbox";
import { RevelationMediaSurface } from "@/components/revelacao/MediaSurface";
import { type RevelationMedia } from "@/lib/revelacao-media";
import { cn } from "@/lib/utils";
import { getLiveRevelationMedia } from "@/lib/site-content";

type Search = { media?: string };

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
  onOpen: (index: number) => void;
}) {
  const rotate =
    index % 3 === 0
      ? "-rotate-2"
      : index % 3 === 1
        ? "rotate-1"
        : "rotate-[-0.8deg]";

  const ready = item.src !== null;
  const ratioClass =
    item.ratio === "3:4"
      ? "aspect-[3/4]"
      : "aspect-[4/3]";

  const className = cn(
    "group relative block w-full overflow-visible border-4 border-foreground bg-foreground p-2 shadow-2xl",
    ratioClass,
    ready &&
      "cursor-pointer transition-transform duration-300 hover:rotate-0 hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blood",
    rotate,
  );

  if (!ready) {
    return (
      <div className={className} aria-hidden="true">
        <RevelationMediaSurface item={item} />
        <img
          src={selo.url}
          alt=""
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-10 w-16 opacity-70 transition-transform duration-300 md:w-20",
            index % 2 ? "-left-6 -top-6 rotate-12" : "-bottom-5 -right-5 -rotate-12",
          )}
        />
        <span className="pointer-events-none absolute inset-3 border border-foreground/20" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      aria-label="Abrir media"
      className={className}
    >
      <RevelationMediaSurface item={item} />
      <img
        src={selo.url}
        alt=""
        aria-hidden
        className={cn(
          "pointer-events-none absolute z-10 w-16 opacity-80 transition-transform duration-300 group-hover:rotate-6 md:w-20",
          index % 2 ? "-left-6 -top-6 rotate-12" : "-bottom-5 -right-5 -rotate-12",
        )}
      />
      <span className="pointer-events-none absolute inset-3 border border-foreground/20" />
    </button>
  );
}

function Revelacao() {
  const navigate = useNavigate({ from: "/revelacao" });
  const { media } = Route.useSearch();
  const { mediaItems } = Route.useLoaderData();
  const readyMedia = mediaItems.filter((item) => item.src);

  const selectedIndex = useMemo(() => {
    if (!media) return null;
    const index = readyMedia.findIndex((item) => item.id === media);
    return index >= 0 ? index : null;
  }, [media, readyMedia]);

  useEffect(() => {
    if (media && selectedIndex === null) {
      navigate({ search: {}, replace: true });
    }
  }, [media, navigate, selectedIndex]);

  const open = (index: number) => {
    const item = mediaItems[index];
    if (!item?.src) return;
    const readyIndex = readyMedia.findIndex((ready) => ready.id === item.id);
    if (readyIndex < 0) return;
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

      <p className="text-xs tracking-widest text-blood">ROLO 01 · CAMPING 1ª EDIÇÃO</p>
      <h1 className="mt-2 font-gothic text-6xl leading-[0.85] md:text-8xl">
        Sala de Revelação
      </h1>

      <section
        className="relative mt-10 aspect-video overflow-hidden border border-blood outline-none focus-visible:ring-2 focus-visible:ring-blood"
        role="button"
        tabIndex={0}
        aria-label="Abrir vídeo da revelação"
        onClick={() => open(0)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open(0);
          }
        }}
      >
        <RevelationMediaSurface item={mediaItems[0]!} />
        <div className="pointer-events-none absolute inset-0 bg-background/10" />
        <span className="absolute left-3 top-3 bg-blood px-2 py-1 font-stamp text-xs text-primary-foreground">
          ● REC — SESSÃO
        </span>
        <img
          src={selo.url}
          alt=""
          aria-hidden
          className="absolute -bottom-10 -right-6 w-36 -rotate-12 opacity-90 md:w-48"
        />
      </section>

      <section className="relative mt-20 grid grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-10 lg:gap-12">
        {mediaItems.slice(1).map((item, index) => (
          <GalleryItem
            key={item.id}
            item={item}
            index={index + 1}
            onOpen={open}
          />
        ))}
      </section>

      {selectedIndex !== null && (
        <RevelationLightbox
          items={readyMedia}
          index={selectedIndex}
          onClose={close}
          onChange={(nextIndex) => {
            const item = readyMedia[nextIndex];
            if (item) {
              navigate({ search: { media: item.id }, replace: true });
            }
          }}
        />
      )}
    </main>
  );
}
