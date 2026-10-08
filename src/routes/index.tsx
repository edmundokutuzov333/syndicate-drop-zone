import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ARTISTS } from "@/lib/artists";
import { getLiveHomeContent, type LiveMerchProduct, type LiveTape } from "@/lib/site-content";
import { tape } from "@/lib/tape-engine";
import { useTape } from "@/components/use-tape";
import { canEnterMerch } from "@/lib/key";
import { useKey } from "@/components/use-key";
import { useMember } from "@/components/use-member";
import { Halftone } from "@/components/Halftone";
import { Sponsors } from "@/components/Sponsors";
import logo from "@/assets/brand/sindicato-logo.png.asset.json";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";
import { musicEventJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: async () => getLiveHomeContent(),
  head: ({ loaderData }) => ({
    meta: [
      { title: "O Sindicato do Trap — 1ª Edição" },
      { name: "description", content: "Camping de estúdio na XOYENS. 17 artistas, prévias cruas, merch e lançamento a 18.12.2026." },
      { property: "og:title", content: "O Sindicato do Trap — 1ª Edição" },
      { property: "og:description", content: "A união do trap. Lançamento 18.12.2026." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(musicEventJsonLd(loaderData.site.dropAt)) },
    ],
  }),
  component: Hub,
});

function Hub() {
  const { artists, tapes, merch, site, memberCount } = Route.useLoaderData();
  const state = useTape();
  const armed = useKey();
  const { member } = useMember();
  const [level, setLevel] = useState(0);

  useEffect(() => {
    tape.setQueue(tapes);
  }, [tapes]);

  useEffect(() => {
    if (!state.playing) {
      setLevel(0);
      return;
    }
    let frame = 0;
    const loop = () => {
      setLevel(tape.level());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.playing]);

  return (
    <>
      <Marquee text={site.marquee} memberCount={memberCount} />
      <main className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
        <Hero title={site.heroTitle} subtitle={site.heroSubtitle} memberCount={memberCount} />
        <Countdown dropAt={site.dropAt} />
        <Tapes tapes={tapes} state={state} level={level} />
        <Artistas artists={artists} />
        <Sponsors />
        <Merch merch={merch} armed={canEnterMerch(armed, { isSyndicateMember: Boolean(member) })} member={Boolean(member)} />
      </main>
    </>
  );
}

function Marquee({ text, memberCount }: { text: string | null; memberCount: number }) {
  const t = text || "1ª EDIÇÃO ✕ 17 ARTISTAS ✕ STUDIO XOYENS ✕ 18.12.2026 ✕ TUDO OU NADA ✕ ";
  return (
    <div className="overflow-hidden border-b border-border bg-blood py-2 font-stamp text-sm text-primary-foreground">
      <div className="flex w-max" style={{ animation: "marquee 30s linear infinite" }}>
        <span className="whitespace-nowrap">{t.repeat(3)} ✕ {memberCount} SINDICALIZADOS ✕ {t.repeat(3)}</span>
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

function Hero({ title, subtitle, memberCount }: { title: string | null; subtitle: string | null; memberCount: number }) {
  return (
    <section className="relative flex flex-col items-center py-16 text-center md:py-24">
      <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute right-0 top-10 hidden w-40 -rotate-12 opacity-20 md:block" />
      <img src={logo.url} alt="O Sindicato do Trap" className="flicker w-48 md:w-64" />
      <h1 className="mt-8 font-gothic text-6xl leading-[0.85] md:text-8xl">{title || "O Sindicato do Trap"}</h1>
      <p className="mt-4 font-stamp text-lg text-blood">{subtitle || "A união do trap. Gravado no camping."}</p>
      <div className="mt-6 border border-border bg-card px-4 py-2 font-mono text-[9px] tracking-[0.2em] text-muted-foreground">SINDICALIZADOS <span className="text-blood">{String(memberCount).padStart(4, "0")}</span></div>
    </section>
  );
}

function Countdown({ dropAt }: { dropAt: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const diff = now ? Math.max(0, dropAt - now) : 0;
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
          <p className="mt-2 font-stamp text-3xl">{new Date(dropAt).toLocaleDateString("pt-PT")}</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {parts.map(([label, value]) => (
            <div key={label} className="border border-border bg-card p-3 text-center">
              <div className="font-mono text-3xl font-bold tabular-nums md:text-6xl">{now ? String(value).padStart(2, "0") : "--"}</div>
              <div className="mt-1 text-[10px] tracking-widest text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="hazard h-3" />
    </section>
  );
}

function Tapes({ tapes, state, level }: { tapes: LiveTape[]; state: ReturnType<typeof useTape>; level: number }) {
  return (
    <section className="cv-auto relative mb-24">
      <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute -right-6 -top-10 w-28 rotate-[20deg] opacity-70 md:w-36" />
      <SectionTag label="Prévias Cruas" />
      <div className="mb-4 flex h-10 items-end gap-1">
        {Array.from({ length: 32 }).map((_, index) => (
          <div key={index} className="flex-1 bg-blood transition-all" style={{ height: state.playing ? Math.max(4, level * 100 * (0.4 + Math.abs(Math.sin(index * 1.7 + level * 9)))) + "%" : "4%" }} />
        ))}
      </div>
      <ul className="divide-y divide-border border border-border">
        {tapes.map((t) => {
          const on = state.id === t.id;
          const progress = on && state.dur ? Math.min(100, (state.t / state.dur) * 100) : 0;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => tape.toggle(t)}
                aria-pressed={on && state.playing}
                className={
                  "relative flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-card focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--blood)] " +
                  (on ? "bg-card" : "")
                }
              >
                <span className={"flex h-10 w-10 items-center justify-center border " + (on ? "border-blood bg-blood text-primary-foreground" : "border-border")}>
                  {on && state.playing ? "■" : "▶"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-stamp text-lg">{t.title}</span>
                  <span className="block truncate text-[10px] tracking-widest text-muted-foreground">{t.feat}</span>
                  <span className="mt-2 block h-1 bg-border">
                    <span className="block h-full bg-blood transition-all" style={{ width: progress + "%" }} />
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{on && state.dur ? formatClock(state.t) + " / " + formatClock(state.dur) : t.dur}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
}

function Artistas({ artists }: { artists: typeof ARTISTS }) {
  return (
    <section className="cv-auto relative mb-24 pb-40">
      <SectionTag label="Os Convocados" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {artists.map((artist) => (
          <Link key={artist.code} to="/membros/$slug" params={{ slug: artist.slug }} preload="intent" className="group relative aspect-[4/5] hover:border-blood">
            <Halftone src={artist.img!} alt={artist.name} className="h-full w-full" />
            <span className="absolute bottom-1 left-1 bg-background px-1 font-stamp text-[10px]">{artist.name}</span>
          </Link>
        ))}
      </div>
      <img src={selo.url} alt="Selo do Sindicato" className="pointer-events-none absolute bottom-0 left-1/2 w-56 -translate-x-1/2 rotate-[-8deg] opacity-80 md:w-72" />
    </section>
  );
}

function Merch({ merch, armed, member }: { merch: LiveMerchProduct[]; armed: boolean; member: boolean }) {
  return (
    <section className="cv-auto mb-12">
      <SectionTag label="Merch" to="/merch" />
      <p className={"mb-6 border p-3 text-xs " + (armed ? "border-blood text-blood" : "border-border text-muted-foreground")}>
        {member ? "▶ SINDICALIZADO — PRÉ-RESERVA ABERTA." : armed ? "▶ CHAVE VALIDADA — LOJA ABERTA." : "■ COFRE FECHADO — ouve 10 segundos de uma prévia para abrir."}
      </p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {merch.map((product) => (
          <Link key={product.n} to="/merch" className={"flex flex-col border border-border bg-card transition-colors " + (armed ? "hover:border-blood" : "hover:border-blood opacity-70")}>
            <div className="relative aspect-square">
              <img src={selo.url} alt="" aria-hidden className="pointer-events-none absolute right-2 top-2 z-10 w-14 rotate-[-15deg] opacity-75" />
              <Halftone src={product.img} alt={product.name} className="h-full w-full" />
            </div>
            <div className="flex items-center justify-between p-3">
              <h3 className="font-stamp text-sm leading-tight">{product.name}</h3>
              <span className="text-xs font-bold">R$ {product.price}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
