import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/camping")({
  head: () => ({
    meta: [
      { title: "Camping — O Sindicato do Trap" },
      { name: "description", content: "Sessões de estúdio no Studio XOYENS: gravações, estampagem ao vivo, visualizers, fotos e lives." },
      { property: "og:title", content: "Camping — O Sindicato do Trap" },
      { property: "og:description", content: "Por dentro do camping no Studio XOYENS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Camping,
});

const BLOCOS = [
  ["01", "Estúdio", "Os manos gravam juntos no Studio XOYENS."],
  ["02", "Estampa ao vivo", "Camisetas desenhadas e estampadas na hora."],
  ["03", "Visualizers", "Filmagem dos visuais das faixas."],
  ["04", "Fotos", "Sessões de foto durante o camping."],
  ["05", "Networking", "Conexão entre artistas da cena."],
  ["06", "Lives", "Sessões transmitidas nas redes."],
];

function Camping() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-8">
      <p className="text-xs tracking-widest text-blood">1ª EDIÇÃO · STUDIO XOYENS</p>
      <h1 className="mt-2 font-gothic text-6xl leading-[0.85] md:text-8xl">O Camping</h1>

      <div className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {BLOCOS.map(([n, t, d]) => (
          <div key={n} className="bg-card p-6">
            <span className="text-xs text-blood">{n}</span>
            <h2 className="mt-2 font-stamp text-2xl">{t}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>

      <section className="mt-12 border border-blood p-6">
        <p className="text-xs tracking-widest text-blood"><span style={{ animation: "blink 1s steps(1) infinite" }}>●</span> LIVE</p>
        <p className="mt-2 font-stamp text-xl">Fora do ar. Cola nas redes pra próxima sessão.</p>
      </section>
    </main>
  );
}
