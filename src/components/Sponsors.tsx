import selo from "@/assets/brand/sindicato-selo.png.asset.json";

const MAIL = "mailto:?subject=Patroc%C3%ADnio%20%E2%80%94%20O%20Sindicato%20do%20Trap";

const TIERS = [
  { tier: "MASTER", slot: "01", line: "Este muro é teu.", sub: "Uma marca. A frente do movimento.", cls: "md:col-span-6 min-h-64 md:min-h-80", big: "text-6xl md:text-8xl" },
  { tier: "MÉDIO", slot: "02", line: "Espaço livre.", sub: "Cola a tua marca no camping.", cls: "md:col-span-4 min-h-52", big: "text-4xl md:text-5xl" },
  { tier: "PEQUENO", slot: "03", line: "Cabe aqui.", sub: "Pequeno no tamanho, grande na rua.", cls: "md:col-span-2 min-h-52", big: "text-3xl" },
];

export function Sponsors() {
  return (
    <section className="mb-24" aria-labelledby="pub">
      <div className="mb-6 flex items-end justify-between border-b border-border pb-2">
        <h2 id="pub" className="font-gothic text-5xl md:text-6xl">Muro dos Patrocínios</h2>
        <span className="text-xs text-muted-foreground">3 VAGAS</span>
      </div>
      <div className="grid gap-3 md:grid-cols-6">
        {TIERS.map((t) => (
          <a key={t.tier} href={MAIL} aria-label={`Patrocínio ${t.tier}: fala connosco`}
            className={`group relative flex flex-col justify-between overflow-hidden border-2 border-dashed border-border bg-card p-5 transition-colors hover:border-blood focus-visible:border-blood focus-visible:outline-none ${t.cls}`}>
            <div className="hazard absolute inset-x-0 top-0 h-2 opacity-60" />
            <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute -bottom-8 -right-8 w-40 -rotate-12 opacity-20 transition-all group-hover:rotate-0 group-hover:opacity-90" />
            <div className="flex justify-between text-[10px] tracking-widest text-muted-foreground">
              <span className="text-blood">PATROCÍNIO {t.tier}</span><span>VAGA {t.slot}</span>
            </div>
            <div className="relative">
              <p className={`font-gothic leading-[0.85] ${t.big}`}>{t.line}</p>
              <p className="mt-2 font-stamp text-sm text-muted-foreground">{t.sub}</p>
            </div>
            <span className="relative self-start border border-blood px-3 py-1 text-xs text-blood group-hover:bg-blood group-hover:text-primary-foreground">OCUPAR →</span>
          </a>
        ))}
      </div>
    </section>
  );
}
