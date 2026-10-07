import { createFileRoute } from "@tanstack/react-router";
import { Halftone } from "@/components/Halftone";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";
import v1 from "@/assets/gallery/v1.mp4.asset.json";
import g1 from "@/assets/gallery/g1.jpg";
import g2 from "@/assets/gallery/g2.jpg";
import g3 from "@/assets/gallery/g3.jpg";
import g4 from "@/assets/gallery/g4.jpg";

export const Route = createFileRoute("/revelacao")({
  head: () => ({
    meta: [
      { title: "Sala de Revelação — O Sindicato do Trap" },
      { name: "description", content: "Vídeos e fotos crus das gravações do camping no Studio XOYENS." },
      { property: "og:title", content: "Sala de Revelação — O Sindicato do Trap" },
      { property: "og:description", content: "Bastidores do camping, revelados em bruto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Revelacao,
});

const FOTOS = [
  { src: g1, tag: "CABINE", rot: "-rotate-2", span: "md:row-span-2" },
  { src: g2, tag: "ESTAMPA AO VIVO", rot: "rotate-1", span: "" },
  { src: g3, tag: "NO BEAT", rot: "-rotate-1", span: "" },
  { src: g4, tag: "VISUALIZER", rot: "rotate-2", span: "md:row-span-2" },
];

const STAMPS = [
  "left-[4%] top-40 w-40 rotate-12 opacity-30",
  "right-[6%] top-[28rem] w-56 -rotate-[25deg] opacity-20",
  "left-[40%] top-[60rem] w-72 rotate-6 opacity-10",
  "right-[30%] bottom-20 w-32 -rotate-12 opacity-40",
];

function Revelacao() {
  return (
    <main className="relative mx-auto max-w-7xl overflow-hidden px-4 pb-24 pt-12 md:px-8">
      {STAMPS.map((c) => <img key={c} src={selo.url} alt="" aria-hidden className={`pointer-events-none absolute mix-blend-screen ${c}`} />)}
      <p className="text-xs tracking-widest text-blood">ROLO 01 · CAMPING 1ª EDIÇÃO</p>
      <h1 className="mt-2 font-gothic text-6xl leading-[0.85] md:text-8xl">Sala de Revelação</h1>

      <section className="relative mt-10 border border-blood">
        <video src={v1.url} autoPlay muted loop playsInline className="aspect-video w-full object-cover grayscale contrast-125" />
        <div className="pointer-events-none absolute inset-0 grain scanlines" />
        <span className="absolute left-3 top-3 bg-blood px-2 py-1 font-stamp text-xs text-primary-foreground">● REC — SESSÃO</span>
        <img src={selo.url} alt="" aria-hidden className="absolute -bottom-10 -right-6 w-36 -rotate-12 opacity-90 md:w-48" />
      </section>

      <section className="relative mt-16 grid auto-rows-[16rem] gap-6 md:grid-cols-3">
        {FOTOS.map((f, i) => (
          <figure key={f.tag} className={`relative border-4 border-foreground bg-foreground p-2 pb-8 shadow-2xl transition-transform hover:rotate-0 hover:scale-[1.02] ${f.rot} ${f.span}`}>
            <Halftone src={f.src} alt={f.tag} className="h-full w-full" />
            <figcaption className="absolute bottom-1 left-2 font-stamp text-xs text-background">{f.tag} · #{String(i + 1).padStart(2, "0")}</figcaption>
            <img src={selo.url} alt="" aria-hidden className={`pointer-events-none absolute w-20 opacity-90 ${i % 2 ? "-left-6 -top-6 rotate-12" : "-right-6 -bottom-4 -rotate-12"}`} />
          </figure>
        ))}
      </section>
    </main>
  );
}
