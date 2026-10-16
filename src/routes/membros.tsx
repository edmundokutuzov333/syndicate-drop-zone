import { createFileRoute, Link } from "@tanstack/react-router";
import { ARTISTS } from "@/lib/artists";
import { getLiveArtists } from "@/lib/public-content";
import { HalftoneCanvas } from "@/components/HalftoneCanvas";
import { hiss } from "@/lib/sfx";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";

export const Route = createFileRoute("/membros")({
  loader: async () => ({ artists: await getLiveArtists() }),
  head: () => ({
    meta: [
      { title: "Artistas — O Sindicato do Trap" },
      { name: "description", content: "Os 17 artistas convocados da 1ª edição do Sindicato do Trap." },
      { property: "og:title", content: "Artistas — O Sindicato do Trap" },
      { property: "og:description", content: "17 artistas. Uma edição. Tudo ou nada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Membros,
});

function Membros() {
  const { artists } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-8">
      <header className="relative overflow-hidden border-y border-border py-6">
        <img
          src={selo.url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 w-24 -translate-y-1/2 rotate-12 opacity-35 md:right-10 md:w-32"
        />
        <p className="text-xs tracking-widest text-blood">1ª EDIÇÃO · 17 CONVOCADOS</p>
        <h1 className="mt-2 font-gothic text-6xl leading-[0.85] md:text-8xl">Os Convocados</h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
          Arquivo completo dos 17 artistas. Cada convocado tem o seu próprio dossiê, canais oficiais e registos da edição.
        </p>
      </header>

      <section className="mt-10" aria-labelledby="artists-grid-title">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-[0.28em] text-blood">ARQUIVO COMPLETO</p>
            <h2 id="artists-grid-title" className="mt-1 font-gothic text-4xl md:text-5xl">
              TODOS OS CONVOCADOS
            </h2>
          </div>
          <span className="font-stamp text-xs text-muted-foreground">17 / 17</span>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {artists.map((artist) => (
            <Link
              key={artist.slug}
              to="/membros/$slug"
              params={{ slug: artist.slug }}
              preload="intent"
              onClick={() => { try { hiss(); } catch { /* navigation must never depend on SFX */ } }}
              className="group overflow-hidden transition"
            >
              <HalftoneCanvas
                src={artist.img}
                alt={artist.name}
                className="aspect-[4/5] transition duration-500 group-hover:scale-[1.02]"
              />
              <div className="bg-background px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-gothic text-2xl md:text-3xl">{artist.name}</span>
                  <span className="shrink-0 text-[10px] text-blood">{artist.code}</span>
                </div>
                <p className="mt-1 text-[9px] tracking-[0.18em] text-muted-foreground">{artist.zona}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
