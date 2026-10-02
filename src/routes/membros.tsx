import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MEMBERS } from "@/lib/data";
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

function Membros() {
  const [sel, setSel] = useState(0);
  const m = MEMBERS[sel]!;
  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-8">
      <p className="text-xs tracking-widest text-blood">// ARQUIVO 02 — VIGILÂNCIA</p>
      <h1 className="mt-2 font-gothic text-6xl leading-[0.85] md:text-8xl">Arquivo de Vigilância</h1>

      {/* triptych selector */}
      <div className="mt-10 grid grid-cols-3 gap-2 md:grid-cols-6">
        {MEMBERS.map((x, i) => (
          <button key={x.code} onClick={() => { setSel(i); hiss(); }}
            className={`relative aspect-[4/5] border-2 ${i === sel ? "border-blood" : "border-border opacity-60 hover:opacity-100"}`}>
            <Halftone src={x.img} alt={x.alias} className="h-full w-full" />
            <span className="absolute bottom-1 left-1 bg-background px-1 text-[10px]">{x.code}</span>
          </button>
        ))}
      </div>

      <article key={m.code} className="mt-8 grid animate-fade-in gap-0 border border-border bg-card md:grid-cols-[1fr_1.2fr]">
        <div className="relative aspect-[4/5]">
          <Halftone src={m.img} alt={`Foto de registro de ${m.alias}`} className="h-full w-full" />
          <span className="absolute left-3 top-3 text-xs text-blood">● REC · CAM {sel + 2}</span>
          <span className="stamp absolute bottom-8 right-6 -rotate-12 px-3 py-1 text-2xl">{m.status}</span>
          <span className="stamp absolute left-6 top-1/3 rotate-6 px-2 text-sm">CLASSIFICADO</span>
        </div>
        <div className="flex flex-col p-6 md:p-10">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>FICHA DE REGISTRO Nº {m.code}</span><span>NÍVEL: RESTRITO</span>
          </div>
          <h2 className="mt-4 font-gothic text-6xl md:text-7xl">{m.alias}</h2>
          <p className="font-stamp text-lg text-blood">{m.role}</p>
          <dl className="mt-8 grid grid-cols-2 gap-px bg-border text-sm">
            {[
              ["ORIGEM", m.origem],
              ["ENTRADA NO BUNKER", m.entrada],
              ["GRAU DE RISCO", m.risco],
              ["ÚLTIMO REGISTRO", m.last],
            ].map(([k, v]) => (
              <div key={k} className="bg-card p-3">
                <dt className="text-[10px] text-muted-foreground">{k}</dt>
                <dd className="mt-1">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 border-l-2 border-blood pl-4 font-stamp">{m.nota}</div>
          <div className="mt-auto pt-8">
            <div className="h-10 w-full" style={{ background: "repeating-linear-gradient(90deg, var(--foreground) 0 2px, transparent 2px 4px, var(--foreground) 4px 5px, transparent 5px 9px)" }} />
            <p className="mt-1 text-[10px] text-muted-foreground">SDT/{m.code}/BUNKER-VERMELHO/2026</p>
          </div>
        </div>
      </article>
    </main>
  );
}
