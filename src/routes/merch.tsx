import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MERCH, SIZES } from "@/lib/data";
import { Halftone } from "@/components/Halftone";
import { hiss, printer } from "@/lib/sfx";

export const Route = createFileRoute("/merch")({
  head: () => ({
    meta: [
      { title: "Cofre Tático de Drops — O Sindicato do Trap" },
      { name: "description", content: "Inspecione as peças do drop em visão normal, noturna ou raio-x e reserve sua unidade numerada." },
      { property: "og:title", content: "Cofre Tático de Drops — O Sindicato do Trap" },
      { property: "og:description", content: "Fardamento numerado do Sindicato. Reserve antes que o cofre feche." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Merch,
});

type Mode = "normal" | "noturna" | "raiox";
type Receipt = { code: string; serial: number; item: (typeof MERCH)[number]; size: string; at: string };

function Merch() {
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState<Mode>("normal");
  const [size, setSize] = useState("M");
  const [alias, setAlias] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const p = MERCH[sel]!;

  const reserve = () => {
    printer();
    setReceipt({
      code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      serial: Math.floor(Math.random() * 333) + 1,
      item: p,
      size: p.n === "04" ? "ÚNICO" : size,
      at: new Date().toLocaleString("pt-BR"),
    });
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-8">
      <p className="text-xs tracking-widest text-blood">// ARQUIVO 03 — COFRE</p>
      <h1 className="mt-2 font-gothic text-6xl leading-[0.85] md:text-8xl">Cofre Tático de Drops</h1>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="relative aspect-square border border-border">
            <Halftone src={p.img} alt={p.name} mode={mode} className="h-full w-full" />
            <div className="pointer-events-none absolute inset-4 border border-foreground/20" />
            <span className="absolute left-6 top-6 text-xs">{mode === "normal" ? "ÓPTICA PADRÃO" : mode === "noturna" ? "VISÃO NOTURNA · IR 850nm" : "RAIO-X · INSPEÇÃO DE COSTURAS"}</span>
            <span className="absolute bottom-6 right-6 text-xs text-blood">LOTE {p.n} · {p.left}/333</span>
          </div>
          <div className="mt-2 grid grid-cols-3 border border-border">
            {(["normal", "noturna", "raiox"] as Mode[]).map((m) => (
              <button key={m} onClick={() => { setMode(m); hiss(0.25); }}
                className={`py-3 text-xs ${mode === m ? "bg-blood text-primary-foreground" : "hover:bg-muted"}`}>
                {m === "normal" ? "NORMAL" : m === "noturna" ? "VISÃO NOTURNA" : "RAIO-X"}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {MERCH.map((x, i) => (
              <button key={x.n} onClick={() => { setSel(i); setReceipt(null); }}
                className={`aspect-square border-2 ${i === sel ? "border-blood" : "border-border opacity-60 hover:opacity-100"}`}>
                <Halftone src={x.img} alt={x.name} className="h-full w-full" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <p className="text-xs text-blood">{p.sub}</p>
          <h2 className="font-stamp text-3xl">{p.name}</h2>
          <p className="mt-2 text-2xl font-bold">R$ {p.price}</p>
          <ul className="mt-6 space-y-2 border-y border-border py-4 text-sm">
            {p.detail.map((d) => <li key={d}><span className="text-blood">▸</span> {d}</li>)}
          </ul>
          {p.n !== "04" && (
            <div className="mt-6">
              <p className="mb-2 text-xs text-muted-foreground">TAMANHO</p>
              <div className="flex gap-2">
                {SIZES.map((s) => (
                  <button key={s} onClick={() => setSize(s)}
                    className={`h-10 w-12 border text-sm ${size === s ? "border-blood text-blood" : "border-border"}`}>{s}</button>
                ))}
              </div>
            </div>
          )}
          <label className="mt-6 text-xs text-muted-foreground">CODINOME DO RECEPTOR</label>
          <input value={alias} onChange={(e) => setAlias(e.target.value.toUpperCase())} maxLength={20} placeholder="ANÔNIMO"
            className="mt-2 border border-border bg-transparent px-3 py-3 text-sm outline-none focus:border-blood" />
          <button onClick={reserve} className="mt-6 bg-blood py-4 font-stamp text-lg text-primary-foreground hover:opacity-85">
            RESERVAR UNIDADE
          </button>
          <p className="mt-2 text-[10px] text-muted-foreground">reserva simbólica — pagamento liberado no dia do drop.</p>

          {receipt && (
            <div className="mt-8 flex justify-center">
              <div className="thermal w-72 px-5 py-8 font-mono text-xs" style={{ animation: "print-out 1.2s steps(14) both" }}>
                <p className="text-center font-gothic text-2xl">Sindicato</p>
                <p className="text-center">COMPROVANTE CLANDESTINO</p>
                <p className="my-2 text-center">--------------------------------</p>
                <p>DATA: {receipt.at}</p>
                <p>RECEPTOR: {alias || "ANÔNIMO"}</p>
                <p>PEÇA: {receipt.item.name}</p>
                <p>LOTE: {receipt.item.n} · TAM: {receipt.size}</p>
                <p>UNIDADE Nº {String(receipt.serial).padStart(3, "0")}/333</p>
                <p className="my-2 text-center">--------------------------------</p>
                <p className="flex justify-between font-bold"><span>TOTAL</span><span>R$ {receipt.item.price},00</span></p>
                <p className="my-2 text-center">--------------------------------</p>
                <p className="text-center">CÓDIGO DE RETIRADA</p>
                <p className="text-center text-2xl font-bold tracking-[0.3em]">{receipt.code}</p>
                <div className="mx-auto mt-3 h-10 w-48" style={{ background: "repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 3px, currentColor 3px 6px, transparent 6px 8px)" }} />
                <p className="mt-3 text-center">NÃO FOTOGRAFE. NÃO COMPARTILHE.</p>
                <p className="text-center">TUDO OU NADA.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
