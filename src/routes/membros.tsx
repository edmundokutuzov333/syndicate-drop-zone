import { createFileRoute, Link } from "@tanstack/react-router";
import { ARTISTS } from "@/lib/artists";
import { Halftone } from "@/components/Halftone";
import { hiss } from "@/lib/sfx";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";

type Search = { a?: number };

export const Route = createFileRoute("/membros")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const n = Number(s["a"]);
    return Number.isInteger(n) && n >= 1 && n <= ARTISTS.length ? { a: n } : {};
  },
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
  const { a: q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const sel = (q ?? 1) - 1;
  const a = ARTISTS[sel]!;
  const num = String(sel + 1).padStart(2, "0");
  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-8">
      <p className="text-xs tracking-widest text-blood">1ª EDIÇÃO · 17 CONVOCADOS</p>
      <h1 className="mt-2 font-gothic text-6xl leading-[0.85] md:text-8xl">Os Convocados</h1>

      <article key={a.code} className="relative mt-10 grid animate-fade-in border border-border bg-card md:grid-cols-[1fr_1.2fr]">
        <div className="relative aspect-[4/5]">
          <Halftone src={a.img} alt={a.name} className="h-full w-full" />
        </div>
        <div className="relative flex flex-col justify-end gap-6 p-6 md:p-10">
          <img src={selo.url} alt="" aria-hidden className="absolute right-6 top-6 w-28 -rotate-12 opacity-70" />
          {/* Placa estilo mugshot */}
          <div className="max-w-md border-2 border-foreground bg-background p-4 font-stamp">
            <div className="flex justify-between border-b border-foreground pb-2 text-xs tracking-widest">
              <span>O SINDICATO DO TRAP</span><span>{a.code}</span>
            </div>
            <h2 className="mt-3 font-gothic text-5xl leading-none md:text-6xl">{a.name}</h2>
            <div className="mt-3 flex justify-between border-t border-foreground pt-2 text-xs tracking-widest">
              <span>Nº {num} / 17</span><span className="text-blood">STUDIO XOYENS · 18.12.2026</span>
            </div>
          </div>
          <div>
            <p className="font-stamp text-2xl text-blood">“{a.frase}”</p>
            <dl className="mt-4 grid gap-3 text-xs">
              <div><dt className="tracking-widest text-blood">ZONA</dt><dd className="mt-1 font-stamp text-base">{a.zona}</dd></div>
              <div><dt className="tracking-widest text-blood">FAIXAS NO CAMPING</dt><dd className="mt-1 font-stamp text-base">{a.faixas.join(" · ")}</dd></div>
              <div><dt className="tracking-widest text-blood">BIO</dt><dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{a.bio}</dd></div>
            </dl>
          </div>
        </div>
      </article>

      <div className="mt-6 grid grid-cols-4 gap-2 md:grid-cols-9">
        {ARTISTS.map((x, i) => (
          <Link
            key={x.code}
            to="/membros/$slug"
            params={{ slug: x.slug }}
            onClick={() => hiss()}
            className={`relative aspect-[4/5] border-2 ${i === sel ? "border-blood" : "border-border opacity-60 hover:opacity-100"}`}
          >
            <Halftone src={x.img} alt={x.name} className="h-full w-full" />
            <span className="absolute bottom-1 left-1 bg-background px-1 text-[10px]">{x.name}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
