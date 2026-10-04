import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ARTISTS, type Artist } from "@/lib/artists";
import { Halftone } from "@/components/Halftone";
import { hiss } from "@/lib/sfx";

export const Route = createFileRoute("/membros")({
  head: () => ({
    meta: [
      { title: "Arquivo de Vigilância — O Sindicato do Trap" },
      { name: "description", content: "Dossiês completos dos integrantes do Sindicato: codinomes, fichas de registro e imagens de vigilância." },
      { property: "og:title", content: "Arquivo de Vigilância — O Sindicato do Trap" },
      { property: "og:description", content: "Fichas confidenciais dos membros do Sindicato do Trap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Membros,
});

function Slot({ a, className }: { a: Artist; className?: string }) {
  if (a.img) return <Halftone src={a.img} alt={a.name} className={className ?? ""} />;
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-background ${className ?? ""}`}>
      <div className="halftone-overlay pointer-events-none absolute inset-0" />
      <div className="xerox-wear pointer-events-none absolute inset-0" />
      <span className="relative text-center font-stamp text-[10px] text-muted-foreground">SEM<br />REGISTRO</span>
    </div>
  );
}

function Membros() {
  const [sel, setSel] = useState(0);
  const a = ARTISTS[sel]!;
  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-8">
      <p className="text-xs tracking-widest text-blood">// ARQUIVO 02 — VIGILÂNCIA · 1ª EDIÇÃO</p>
      <h1 className="mt-2 font-gothic text-6xl leading-[0.85] md:text-8xl">Dossiê de Vigilância</h1>
      <p className="mt-3 text-xs text-muted-foreground">17 INDIVÍDUOS SOB OBSERVAÇÃO</p>

      <div className="mt-10 grid grid-cols-4 gap-2 md:grid-cols-8">
        {ARTISTS.map((x, i) => (
          <button key={x.code} onClick={() => { setSel(i); hiss(); }}
            className={`relative aspect-[4/5] border-2 ${i === sel ? "border-blood" : "border-border opacity-60 hover:opacity-100"}`}>
            <Slot a={x} className="h-full w-full" />
            <span className="absolute bottom-1 left-1 bg-background px-1 text-[10px]">{x.code}</span>
          </button>
        ))}
      </div>

      <article key={a.code} className="mt-8 grid animate-fade-in gap-0 border border-border bg-card md:grid-cols-[1fr_1.2fr]">
        <div className="relative aspect-[4/5]">
          <Slot a={a} className="h-full w-full" />
          <span className="absolute left-3 top-3 text-xs text-blood">● REC · CAM {String(sel + 1).padStart(2, "0")}</span>
          <span className="stamp absolute bottom-8 right-6 -rotate-12 px-3 py-1 text-2xl">{a.status}</span>
        </div>
        <div className="flex flex-col p-6 md:p-10">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>FICHA Nº {a.code}</span><span>1ª EDIÇÃO</span>
          </div>
          <h2 className="mt-4 font-gothic text-6xl md:text-7xl">{a.name}</h2>
          <p className="font-stamp text-lg text-blood">Identidade em sigilo</p>
          <div className="mt-auto pt-8">
            <div className="h-10 w-full" style={{ background: "repeating-linear-gradient(90deg, var(--foreground) 0 2px, transparent 2px 4px, var(--foreground) 4px 5px, transparent 5px 9px)" }} />
            <p className="mt-1 text-[10px] text-muted-foreground">SDT/{a.code}/EDICAO-01/2026</p>
          </div>
        </div>
      </article>
    </main>
  );
}
