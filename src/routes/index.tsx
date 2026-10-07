import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TapeEngine } from "@/lib/tape-engine";
import { TAPES, MERCH } from "@/lib/data";
import { ARTISTS } from "@/lib/artists";
import { Halftone } from "@/components/Halftone";
import { Sponsors } from "@/components/Sponsors";
import logo from "@/assets/brand/sindicato-logo.png.asset.json";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "O Sindicato do Trap — 1ª Edição" },
      { name: "description", content: "Camping de estúdio na XOYENS. 17 artistas, prévias cruas, merch e lançamento a 18.12.2026." },
      { property: "og:title", content: "O Sindicato do Trap — 1ª Edição" },
      { property: "og:description", content: "A união do trap. Lançamento 18.12.2026." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Hub,
});

const DROP = new Date("2026-12-18T00:00:00+02:00").getTime();

function Hub() {
  const engine = useRef<TapeEngine | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [lvl, setLvl] = useState(0);

  useEffect(() => {
    engine.current = new TapeEngine();
    return () => engine.current?.stop();
  }, []);

  useEffect(() => {
    if (!playing) { setLvl(0); return; }
    let raf = 0;
    const loop = () => { setLvl(engine.current?.level() ?? 0); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = (t: (typeof TAPES)[number]) => {
    if (playing === t.id) { engine.current?.stop(); setPlaying(null); }
    else { engine.current?.start(t, () => setPlaying(null)); setPlaying(t.id); }
  };

  return (
    <>
      <Marquee />
      <main className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
        <Hero />
        <Countdown />
        <Tapes playing={playing} toggle={toggle} lvl={lvl} />
        <Artistas />
        <Sponsors />
        <Merch armed={!!playing} />
      </main>
    </>
  );
}

function Marquee() {
  const t = "1ª EDIÇÃO ✕ 17 ARTISTAS ✕ STUDIO XOYENS ✕ 18.12.2026 ✕ TUDO OU NADA ✕ ";
  return (
    <div className="overflow-hidden border-b border-border bg-blood py-2 font-stamp text-sm text-primary-foreground">
      <div className="flex w-max" style={{ animation: "marquee 30s linear infinite" }}>
        <span className="whitespace-nowrap">{t.repeat(4)}</span>
        <span className="whitespace-nowrap">{t.repeat(4)}</span>
      </div>
    </div>
  );
}

function SectionTag({ label, to }: { label: string; to?: "/membros" | "/merch" | "/camping" }) {
  return (
    <div className="mb-6 flex items-end justify-between border-b border-border pb-2">
      <h2 className="font-gothic text-5xl md:text-6xl">{label}</h2>
      {to && <Link to={to} className="text-xs text-blood hover:underline">ver tudo →</Link>}
    </div>
  );
}

function Hero() {
  return (
    <section className="relative flex flex-col items-center py-16 text-center md:py-24">
      <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute right-0 top-10 hidden w-40 -rotate-12 opacity-20 md:block" />
      <img src={logo.url} alt="O Sindicato do Trap" className="flicker w-48 md:w-64" />
      <h1 className="mt-8 font-gothic text-6xl leading-[0.85] md:text-8xl">O Sindicato do Trap</h1>
      <p className="mt-4 font-stamp text-lg text-blood">A união do trap. Gravado no camping.</p>
    </section>
  );
}

function Countdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const diff = now ? Math.max(0, DROP - now) : 0;
  const parts = [
    ["DIAS", Math.floor(diff / 864e5)],
    ["HORAS", Math.floor(diff / 36e5) % 24],
    ["MIN", Math.floor(diff / 6e4) % 60],
    ["SEG", Math.floor(diff / 1e3) % 60],
  ] as const;
  return (
    <section className="relative mb-24 border border-blood">
      <div className="hazard h-3" />
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_2fr] md:p-10">
        <div>
          <p className="text-xs tracking-widest text-blood">LANÇAMENTO</p>
          <p className="mt-2 font-stamp text-3xl">18.12.2026</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {parts.map(([l, v]) => (
            <div key={l} className="border border-border bg-card p-3 text-center">
              <div className="font-mono text-3xl font-bold tabular-nums md:text-6xl">{now ? String(v).padStart(2, "0") : "--"}</div>
              <div className="mt-1 text-[10px] tracking-widest text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="hazard h-3" />
    </section>
  );
}

function Tapes({ playing, toggle, lvl }: { playing: string | null; toggle: (t: (typeof TAPES)[number]) => void; lvl: number }) {
  return (
    <section className="relative mb-24">
      <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute -right-6 -top-10 w-28 rotate-[20deg] opacity-70 md:w-36" />
      <SectionTag label="Prévias Cruas" />
      <div className="mb-4 flex h-10 items-end gap-1">
        {Array.from({ length: 32 }).map((_, i) => (
          <div key={i} className="flex-1 bg-blood transition-all"
            style={{ height: `${Math.max(4, lvl * 100 * (0.4 + Math.abs(Math.sin(i * 1.7 + lvl * 9))))}%` }} />
        ))}
      </div>
      <ul className="divide-y divide-border border border-border">
        {TAPES.map((t) => {
          const on = playing === t.id;
          return (
            <li key={t.id}>
              <button onClick={() => toggle(t)}
                className={`flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-card ${on ? "bg-card" : ""}`}>
                <span className={`flex h-10 w-10 items-center justify-center border ${on ? "border-blood bg-blood text-primary-foreground" : "border-border"}`}>
                  {on ? "■" : "▶"}
                </span>
                <span className="flex-1"><span className="block font-stamp text-lg">{t.title}</span><span className="block text-[10px] tracking-widest text-muted-foreground">{t.feat}</span></span>
                <span className="text-xs text-muted-foreground">{t.dur}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Artistas() {
  return (
    <section className="relative mb-24 pb-40">
      <SectionTag label="Os Convocados" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {ARTISTS.map((a, i) => (
          <Link key={a.code} to="/membros/$slug" params={{ slug: a.slug }} preload="intent" className="group relative aspect-[4/5] hover:border-blood">
            <Halftone src={a.img!} alt={a.name} className="h-full w-full" />
            <span className="absolute bottom-1 left-1 bg-background px-1 font-stamp text-[10px]">{a.name}</span>
          </Link>
        ))}
      </div>
      <img src={selo.url} alt="Selo do Sindicato" className="pointer-events-none absolute bottom-0 left-1/2 w-56 -translate-x-1/2 rotate-[-8deg] opacity-80 md:w-72" />
    </section>
  );
}

function Merch({ armed }: { armed: boolean }) {
  return (
    <section className="mb-12">
      <SectionTag label="Merch" to="/merch" />
      <p className={`mb-6 border p-3 text-xs ${armed ? "border-blood text-blood" : "border-border text-muted-foreground"}`}>
        {armed ? "▶ FITA RODANDO — LOJA ABERTA." : "■ LOJA FECHADA — dá play numa prévia pra abrir."}
      </p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {MERCH.map((p) => (
          <Link key={p.n} to="/merch" disabled={!armed}
            className={`flex flex-col border border-border bg-card ${armed ? "hover:border-blood" : "pointer-events-none opacity-60"}`}>
            <div className="relative aspect-square"><img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute right-2 top-2 z-10 w-14 rotate-[-15deg] opacity-75" /><Halftone src={p.img} alt={p.name} className="h-full w-full" /></div>
            <div className="flex items-center justify-between p-3">
              <h3 className="font-stamp text-sm leading-tight">{p.name}</h3>
              <span className="text-xs font-bold">R$ {p.price}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
