import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TapeEngine, type TapeSpec } from "@/lib/tape-engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "O Sindicato do Trap — Portal Clandestino" },
      { name: "description", content: "Terminal confidencial do Sindicato do Trap: fitas vazadas do bunker, dossiê de vigilância, drops e merch tático." },
      { property: "og:title", content: "O Sindicato do Trap — Portal Clandestino" },
      { property: "og:description", content: "Fitas vazadas, dossiê de vigilância e drop numerado. Tudo ou nada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const PASS = "808";

const TAPES: (TapeSpec & { id: string; title: string; room: string; dur: string })[] = [
  { id: "REG_001", title: "CONCRETO ÚMIDO", room: "SALA 02 / 03:14", dur: "0:15", bpm: 142, root: 41.2, hat: 2, pattern: [0,-1,-1,-1,-1,-1,0,-1,-1,-1,3,-1,-1,-1,-1,-1] },
  { id: "REG_002", title: "PAVILHÃO 808", room: "SALA 01 / 04:40", dur: "0:15", bpm: 130, root: 36.7, hat: 1, pattern: [0,-1,-1,0,-1,-1,-1,-1,5,-1,-1,-1,3,-1,-1,-1] },
  { id: "REG_003", title: "O PACTO", room: "PORÃO / 23:59", dur: "0:15", bpm: 150, root: 46.2, hat: 2, pattern: [0,-1,-1,-1,-1,-1,-1,-1,-2,-1,-1,-2,-1,-1,-1,-1] },
  { id: "REG_004", title: "LUZ DE CÂMARA ESCURA", room: "SALA 03 / 05:02", dur: "0:15", bpm: 120, root: 38.9, hat: 4, pattern: [0,-1,-1,-1,-1,-1,-1,7,-1,-1,0,-1,-1,-1,-1,-1] },
];

const MEMBERS = [
  { code: "SDT-01", alias: "VULTO", role: "Produtor / 808", last: "Sala 01 — 72h sem sair", status: "ISOLADO" },
  { code: "SDT-02", alias: "CORONEL MUDO", role: "Voz / Composição", last: "Visto às 04:11 no porão", status: "ATIVO" },
  { code: "SDT-03", alias: "XEROX", role: "Direção de Arte", last: "Fotocopiadora, bloco C", status: "VIGIADO" },
  { code: "SDT-04", alias: "FANTASMA", role: "Engenharia de Áudio", last: "Sem registro desde 02/10", status: "DESAPARECIDO" },
  { code: "SDT-05", alias: "REVERSO", role: "Voz / Ad-libs", last: "Câmera 7 — sussurrando", status: "ATIVO" },
  { code: "SDT-06", alias: "CHUMBO", role: "Segurança do Bunker", last: "Guarda das maletas", status: "ISOLADO" },
];

const MERCH = [
  { n: "01", name: "HEAVYWEIGHT BOXY TEE", sub: "DOSSIÊ VOL. 1", spec: "260 GSM · lavagem mineral · 333 un. numeradas", price: 249, left: 87 },
  { n: "02", name: "THERMAL WAFFLE LS", sub: "PAVILHÃO 808", spec: "Waffle térmico · costuras expostas · brasão bordado", price: 319, left: 140 },
  { n: "03", name: "TACTICAL UTILITY HOODIE", sub: "O PACTO", spec: "450 GSM · silk puff · bolso com zíper selado", price: 549, left: 52 },
  { n: "04", name: "ZINE + FITA K7", sub: "CONTRABANDO", spec: "Papel jornal 90g · K7 fumê · saco antiestático", price: 129, left: 33 },
];

const DROP = new Date("2026-10-31T23:59:00-03:00").getTime();

function Index() {
  const [unlocked, setUnlocked] = useState(false);
  return (
    <div className="grain scanlines relative min-h-screen overflow-x-hidden bg-background">
      {unlocked ? <Hub /> : <Gate onOpen={() => setUnlocked(true)} />}
    </div>
  );
}

function Gate({ onOpen }: { onOpen: () => void }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);
  const lines = [
    "> CONEXÃO ESTABELECIDA VIA NÓ FANTASMA",
    "> SINAL DE OPERADORA: NULO",
    "> PROTOCOLO: BLACKOUT DE TELAS",
    "> SENHA SEMANAL REQUERIDA",
  ];
  return (
    <main className="halftone flex min-h-screen items-center justify-center px-4">
      <form
        className="w-full max-w-xl border border-border bg-card/80 p-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim() === PASS) onOpen();
          else { setErr(true); setV(""); }
        }}
      >
        <div className="mb-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>TERMINAL // BUNKER VERMELHO</span>
          <span className="text-blood">● REC</span>
        </div>
        <h1 className="flicker font-gothic text-6xl leading-none text-foreground md:text-7xl">O Sindicato<br />do Trap</h1>
        <div className="mt-6 space-y-1 text-xs text-muted-foreground">
          {lines.map((l) => <p key={l}>{l}</p>)}
        </div>
        <label className="mt-8 block text-xs tracking-widest text-blood">INSIRA O CÓDIGO_</label>
        <div className="mt-2 flex border border-blood">
          <input
            autoFocus
            value={v}
            onChange={(e) => { setV(e.target.value); setErr(false); }}
            className="flex-1 bg-transparent px-4 py-3 font-mono tracking-[0.5em] text-foreground outline-none"
            type="password"
            aria-label="Senha de acesso"
          />
          <button className="bg-blood px-5 font-stamp text-primary-foreground hover:opacity-80">ENTRAR</button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {err ? <span className="text-blood">ACESSO NEGADO. TENTATIVA REGISTRADA.</span> : "dica: o que quebra o peito no concreto úmido? (3 dígitos)"}
        </p>
      </form>
    </main>
  );
}

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
    else { engine.current?.start(t); setPlaying(t.id); }
  };

  return (
    <>
      <TopBar playing={playing} />
      <Marquee />
      <main className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
        <Manifesto />
        <Countdown />
        <Tapes playing={playing} toggle={toggle} lvl={lvl} />
        <Dossier />
        <Merch armed={!!playing} />
      </main>
      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
        O SINDICATO DO TRAP · MOVIMENTO AUTÔNOMO · <span className="text-blood">TUDO OU NADA</span>
      </footer>
    </>
  );
}

function TopBar({ playing }: { playing: string | null }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 text-xs backdrop-blur md:px-8">
      <span className="font-gothic text-2xl">Sindicato</span>
      <nav className="hidden gap-6 text-muted-foreground md:flex">
        <a href="#drop" className="hover:text-blood">[DROP]</a>
        <a href="#fitas" className="hover:text-blood">[FITAS]</a>
        <a href="#dossie" className="hover:text-blood">[DOSSIÊ]</a>
        <a href="#merch" className="hover:text-blood">[ARSENAL]</a>
      </nav>
      <span className={playing ? "text-blood" : "text-muted-foreground"}>
        {playing ? `▶ ${playing}.WAV` : "■ SILÊNCIO"}
      </span>
    </header>
  );
}

function Marquee() {
  const t = "CLASSIFICADO ✕ NÃO ESTAMOS AQUI PARA ENTRETER ALGORITMOS ✕ BLACKOUT DE TELAS ✕ A ARTE VOLTA A QUEIMAR ✕ ";
  return (
    <div className="overflow-hidden border-b border-border bg-blood py-2 font-stamp text-sm text-primary-foreground">
      <div className="flex w-max" style={{ animation: "marquee 30s linear infinite" }}>
        <span className="whitespace-nowrap">{t.repeat(4)}</span>
        <span className="whitespace-nowrap">{t.repeat(4)}</span>
      </div>
    </div>
  );
}

function SectionTag({ n, label }: { n: string; label: string }) {
  return (
    <div className="mb-6 flex items-end justify-between border-b border-border pb-2">
      <h2 className="font-gothic text-5xl md:text-6xl">{label}</h2>
      <span className="text-xs text-muted-foreground">ARQ. {n}</span>
    </div>
  );
}

function Manifesto() {
  return (
    <section className="grid gap-8 py-20 md:grid-cols-[1.4fr_1fr]">
      <div>
        <p className="mb-4 text-xs tracking-widest text-blood">// DOCUMENTO 000 — MANIFESTO</p>
        <h1 className="font-gothic text-7xl leading-[0.85] md:text-[9rem]">O Sindicato<br />do Trap</h1>
      </div>
      <blockquote className="self-end border-l-2 border-blood pl-6 font-stamp text-lg leading-relaxed">
        Não estamos aqui para entreter algoritmos. O Sindicato não pede espaço; ocupa o vácuo deixado pelo óbvio.
        Quando as luzes da cidade se apagam, o concreto úmido reverbera em 808s que quebram o peito.
        <span className="mt-4 block text-blood">O pacto foi assinado no silêncio do bunker.</span>
      </blockquote>
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
    <section id="drop" className="relative mb-24 border border-blood">
      <div className="hazard h-3" />
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_2fr] md:p-10">
        <div>
          <p className="text-xs tracking-widest text-blood">DROP 001 · DOSSIÊ VOL. 1</p>
          <p className="mt-2 font-stamp text-2xl">ECLOSÃO DO CAMPING</p>
          <p className="mt-2 text-xs text-muted-foreground">31.10.2026 — 23:59 BRT · coordenadas reveladas no zero</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {parts.map(([l, v]) => (
            <div key={l} className="border border-border bg-card p-3 text-center">
              <div className="font-mono text-4xl font-bold tabular-nums md:text-6xl">{now ? String(v).padStart(2, "0") : "--"}</div>
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
  const current = TAPES.find((t) => t.id === playing);
  return (
    <section id="fitas" className="mb-24">
      <SectionTag n="001" label="Fitas Vazadas" />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="border border-border bg-card p-6">
          <div className="relative mx-auto aspect-[1.6] max-w-lg border-2 border-ash bg-background p-4">
            <div className="flex h-8 items-center justify-between border border-border px-3 text-[10px]">
              <span>SINDICATO · TYPE II · CrO2</span>
              <span className="text-blood">{current ? current.id : "SEM FITA"}</span>
            </div>
            <div className="mt-3 border border-border bg-card px-3 py-2 font-stamp text-sm">
              {current ? current.title : "— insira uma gravação —"}
            </div>
            <div className="mt-4 flex items-center justify-around">
              {[0, 1].map((i) => (
                <div key={i} className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-ash"
                  style={{ animation: playing ? "spin-reel 1.6s linear infinite" : undefined }}>
                  <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex h-10 items-end gap-1">
            {Array.from({ length: 32 }).map((_, i) => (
              <div key={i} className="flex-1 bg-blood transition-all"
                style={{ height: `${Math.max(4, lvl * 100 * (0.4 + Math.abs(Math.sin(i * 1.7 + lvl * 9))))}%` }} />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            áudio cru, sem mixagem final. reprodução registrada pela câmera 7.
          </p>
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
                  <span className="flex-1">
                    <span className="block text-[10px] text-muted-foreground">[SINDICATO_{t.id}.WAV] · {t.room}</span>
                    <span className="font-stamp text-lg">{t.title}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{t.bpm} BPM · {t.dur}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Dossier() {
  return (
    <section id="dossie" className="mb-24">
      <SectionTag n="002" label="Dossiê de Vigilância" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MEMBERS.map((m, i) => (
          <article key={m.code} className="group relative border border-border bg-card">
            <div className="halftone relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-background">
              <span className="font-gothic text-[7rem] leading-none text-ash transition-colors group-hover:text-blood">
                {m.alias[0]}
              </span>
              <span className="absolute left-2 top-2 text-[10px] text-blood">● CAM {String(i + 2).padStart(2, "0")}</span>
              <span className="absolute bottom-2 right-2 font-mono text-[10px] text-muted-foreground">
                02/10/26 0{i}:{String(13 + i * 7).padStart(2, "0")}:{String(i * 9).padStart(2, "0")}
              </span>
              <span className="absolute right-3 top-6 rotate-12 border-2 border-blood px-2 font-stamp text-xs text-blood">
                {m.status}
              </span>
            </div>
            <div className="p-4">
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>{m.code}</span><span>NÍVEL: RESTRITO</span></div>
              <h3 className="mt-1 font-stamp text-2xl">{m.alias}</h3>
              <p className="text-xs text-muted-foreground">{m.role}</p>
              <p className="mt-3 border-t border-border pt-2 text-xs">
                ÚLTIMO REGISTRO: <span className="bg-foreground text-foreground transition-colors group-hover:bg-transparent">{m.last}</span>
              </p>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">passe o cursor para remover a tarja.</p>
    </section>
  );
}

function Merch({ armed }: { armed: boolean }) {
  const [bag, setBag] = useState<string[]>([]);
  return (
    <section id="merch" className="mb-12">
      <SectionTag n="003" label="Arsenal" />
      <div className={`mb-6 border p-3 text-xs ${armed ? "border-blood text-blood" : "border-border text-muted-foreground"}`}>
        {armed
          ? "▶ FITA RODANDO — CANAL DE COMPRA ABERTO."
          : "■ CANAL FECHADO — o arsenal só libera enquanto uma fita estiver tocando."}
        {bag.length > 0 && <span className="float-right text-foreground">RESERVADOS: {bag.length}</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {MERCH.map((p) => {
          const got = bag.includes(p.n);
          return (
            <article key={p.n} className="flex flex-col border border-border bg-card">
              <div className="halftone relative flex aspect-square items-center justify-center bg-background">
                <span className="font-gothic text-8xl text-ash">{p.n}</span>
                <span className="absolute left-0 top-3 bg-blood px-2 py-0.5 font-stamp text-xs text-primary-foreground">{p.left} RESTANTES</span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-[10px] text-blood">{p.sub}</p>
                <h3 className="font-stamp text-lg leading-tight">{p.name}</h3>
                <p className="mt-2 flex-1 text-xs text-muted-foreground">{p.spec}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-bold">R$ {p.price}</span>
                  <button
                    disabled={!armed || got}
                    onClick={() => setBag((b) => [...b, p.n])}
                    className="border border-blood px-3 py-1.5 text-xs text-blood transition-colors enabled:hover:bg-blood enabled:hover:text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground"
                  >
                    {got ? "RESERVADO" : armed ? "RESERVAR" : "BLOQUEADO"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
