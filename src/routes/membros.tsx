import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ARTISTS } from "@/lib/artists";
import { Halftone } from "@/components/Halftone";
import { hiss } from "@/lib/sfx";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";

export const Route = createFileRoute("/membros")({
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
  const [sel, setSel] = useState(0);
  const a = ARTISTS[sel]!;
  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-8">
      <p className="text-xs tracking-widest text-blood">1ª EDIÇÃO · 17 CONVOCADOS</p>
      <h1 className="mt-2 font-gothic text-6xl leading-[0.85] md:text-8xl">Os Convocados</h1>

      <article key={a.code} className="relative mt-10 grid animate-fade-in border border-border bg-card md:grid-cols-[1fr_1.2fr]">
        <div className="relative aspect-[4/5]">
          <Halftone src={a.img!} alt={a.name} className="h-full w-full" />
        </div>
        <div className="relative flex flex-col justify-end p-6 md:p-10">
          <img src={selo.url} alt="" aria-hidden className="absolute right-6 top-6 w-28 -rotate-12 opacity-70" />
          <span className="text-xs text-blood">Nº {String(sel + 1).padStart(2, "0")} / 17</span>
          <h2 className="mt-2 font-gothic text-6xl md:text-7xl">{a.name}</h2>
        </div>
      </article>

      <div className="mt-6 grid grid-cols-4 gap-2 md:grid-cols-9">
        {ARTISTS.map((x, i) => (
          <button key={x.code} onClick={() => { setSel(i); hiss(); }}
            className={`relative aspect-[4/5] border-2 ${i === sel ? "border-blood" : "border-border opacity-60 hover:opacity-100"}`}>
            <Halftone src={x.img!} alt={x.name} className="h-full w-full" />
            <span className="absolute bottom-1 left-1 bg-background px-1 text-[10px]">{String(i + 1).padStart(2, "0")}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
