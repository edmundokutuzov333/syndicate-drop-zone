import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SIZES, TAPES } from "@/lib/data";
import { canEnterMerch, keyLeftMs } from "@/lib/key";
import { createPublicMerchReservation, getLiveMerchProducts, getLiveTapes, type LiveMerchProduct } from "@/lib/site-content";
import { HalftoneCanvas } from "@/components/HalftoneCanvas";
import { hiss, printer, thud } from "@/lib/sfx";
import { tape } from "@/lib/tape-engine";
import { track } from "@/lib/track";
import { useKey } from "@/components/use-key";
import { useMember } from "@/components/use-member";
import { merchProductJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/merch")({
  loader: async () => {
    const [merch, tapes] = await Promise.all([getLiveMerchProducts(), getLiveTapes()]);
    return { merch, tapes };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: "Merch — O Sindicato do Trap" },
      { name: "description", content: "Inspecione as peças do drop em visão normal, noturna ou raio-x e reserve a sua unidade numerada." },
      { property: "og:title", content: "Merch — O Sindicato do Trap" },
      { property: "og:description", content: "Fardamento numerado do Sindicato. Reserve antes que o cofre feche." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: loaderData.merch.slice(0, 4).map((product) => ({
      type: "application/ld+json",
      children: JSON.stringify(merchProductJsonLd(product)),
    })),
  }),
  component: Merch,
});

type Mode = "normal" | "noturna" | "raiox";
type Receipt = { code: string; serial: number; item: LiveMerchProduct; size: string; at: string };

function Merch() {
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState<Mode>("normal");
  const [size, setSize] = useState("M");
  const [alias, setAlias] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [reservationState, setReservationState] = useState<"idle" | "sending" | "error">("idle");
  const [reservationMessage, setReservationMessage] = useState("");
  const [openedStamp, setOpenedStamp] = useState(false);
  const armed = useKey();
  const { member } = useMember();
  const canOpen = canEnterMerch(armed, { isSyndicateMember: Boolean(member) });
  const previousKey = useRef(armed);
  const { merch, tapes } = Route.useLoaderData();
  const p = merch[sel]!;

  useEffect(() => {
    tape.setQueue(tapes);
  }, [tapes]);

  useEffect(() => {
    if (!armed || previousKey.current) {
      previousKey.current = armed;
      return;
    }
    previousKey.current = true;
    thud();
    setOpenedStamp(true);
    const timeout = window.setTimeout(() => setOpenedStamp(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [armed]);

  useEffect(() => {
    track("merch_view", { member: Boolean(member) ? 1 : 0 });
  }, []);

  const reserve = async () => {
    if (!p || reservationState === "sending" || !armed) return;
    setReservationState("sending");
    setReservationMessage("");
    try {
      track("cart_add", { product: p.id, size: p.n === "04" ? "ÚNICO" : size });
      const variant = p.variants.find((item) => item.size === (p.n === "04" ? "ÚNICO" : size)) ?? p.variants[0];
      const row = await createPublicMerchReservation({
        productId: p.id,
        productName: p.name,
        variantId: variant?.id ?? null,
        size: p.n === "04" ? "ÚNICO" : size,
        alias,
        price: p.price,
      });
      printer();
      const reference = String(row.code ?? row.reference ?? row.reservation_code ?? row.id ?? "RESERVA");
      const serialRaw = Number(row.serial_number ?? row.unit_number ?? row.number ?? 0);
      track("reserve", { product: p.id, size: p.n === "04" ? "ÚNICO" : size });
      track("proof_sent", { product: p.id, reference: reference.slice(-10) });
      setReceipt({
        code: reference.slice(-10).toUpperCase(),
        serial: Number.isFinite(serialRaw) && serialRaw > 0 ? serialRaw : 0,
        item: p,
        size: p.n === "04" ? "ÚNICO" : size,
        at: new Date().toLocaleString("pt-PT"),
      });
      setReservationState("idle");
    } catch (error) {
      setReservationState("error");
      setReservationMessage(error instanceof Error ? error.message : "Não foi possível criar a reserva.");
    }
  };

  const visibleTapes = (tapes.length ? tapes : TAPES).slice(0, 3);
  const remaining = keyLeftMs();
  const keyLabel = remaining > 0 ? Math.ceil(remaining / 3600000) + "H " + Math.ceil((remaining % 3600000) / 60000) + "M RESTANTES" : "CHAVE EXPIRADA";

  return (
    <main className="relative mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-8">
      {!canOpen && (
        <dialog open aria-labelledby="merch-gate-title" className="fixed inset-0 z-[70] h-full w-full overflow-y-auto border-0 bg-black/60 p-4 backdrop-blur-sm md:p-8">
          <div className="mx-auto flex min-h-full max-w-4xl items-center justify-center py-12">
            <section className="w-full border-2 border-blood bg-background/95 shadow-[0_30px_100px_rgba(0,0,0,.75)]">
              <div className="hazard h-3" />
              <div className="grid gap-8 p-6 md:p-10">
                <div className="text-center">
                  <p className="font-mono text-[10px] tracking-[0.3em] text-blood">COFRE 001 · ACESSO RESTRITO</p>
                  <h2 id="merch-gate-title" className="mt-3 font-gothic text-5xl leading-none md:text-7xl">COFRE FECHADO</h2>
                  <p className="mx-auto mt-4 max-w-xl font-stamp text-sm text-muted-foreground">O catálogo está em baixo do aço. Ouve 10 segundos de qualquer fita para receber a chave.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {visibleTapes.map((preview) => {
                    const active = tape.getState().id === preview.id;
                    return (
                      <button
                        key={preview.id}
                        type="button"
                        onClick={() => tape.toggle(preview)}
                        className={"group border border-border bg-card p-4 text-left hover:border-blood focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--blood)] " + (active ? "border-blood" : "")}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blood">{active ? "■ A TOCAR" : "▶ TAPE " + preview.id}</span>
                          <span className="h-8 w-8 rounded-full border-2 border-border border-t-blood group-hover:animate-spin" />
                        </div>
                        <p className="mt-8 truncate font-stamp text-lg">{preview.title}</p>
                        <p className="mt-1 truncate text-[9px] tracking-[0.16em] text-muted-foreground">{preview.feat}</p>
                        <p className="mt-5 border-t border-border pt-3 text-[9px] tracking-[0.18em] text-muted-foreground">OUVE UMA FITA PARA ABRIR</p>
                      </button>
                    );
                  })}
                </div>
                <div className="border border-border bg-card/70 p-4 text-center font-mono text-[9px] tracking-[0.18em] text-muted-foreground">catálogo mantido no DOM · scanlines · SEO · CX</div>
              </div>
              <div className="hazard h-3" />
            </section>
          </div>
        </dialog>
      )}

      <p className="text-xs tracking-widest text-blood">1ª EDIÇÃO · MERCH OFICIAL</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <h1 className="font-gothic text-6xl leading-[0.85] md:text-8xl">Merch</h1>
        {canOpen && <span className="border border-blood px-2 py-1 font-mono text-[9px] tracking-widest text-blood">{openedStamp ? "ABERTO" : keyLabel}</span>}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="relative aspect-square border border-border">
            <HalftoneCanvas src={p.img} alt={p.name} mode={mode} className="h-full w-full" />
            <div className="pointer-events-none absolute inset-4 border border-foreground/20" />
            <span className="absolute left-6 top-6 text-xs">{mode === "normal" ? "ÓPTICA PADRÃO" : mode === "noturna" ? "VISÃO NOTURNA · IR 850nm" : "RAIO-X · INSPEÇÃO DE COSTURAS"}</span>
            <span className="absolute bottom-6 right-6 text-xs text-blood">LOTE {p.n} · {p.left}/333</span>
          </div>
          <div className="mt-2 grid grid-cols-3 border border-border">
            {(["normal", "noturna", "raiox"] as Mode[]).map((modeOption) => (
              <button key={modeOption} type="button" onClick={() => { setMode(modeOption); hiss(0.25); }} className={"py-3 text-xs " + (mode === modeOption ? "bg-blood text-primary-foreground" : "hover:bg-muted")}>
                {modeOption === "normal" ? "NORMAL" : modeOption === "noturna" ? "VISÃO NOTURNA" : "RAIO-X"}
              </button>
            ))}
          </div>
          <div className="cv-auto mt-4 grid grid-cols-4 gap-2">
            {merch.map((item, index) => (
              <button key={item.n} type="button" onClick={() => { setSel(index); setReceipt(null); }} className={"aspect-square border-2 " + (index === sel ? "border-blood" : "border-border opacity-60 hover:opacity-100")}>
                <HalftoneCanvas src={item.img} alt={item.name} className="h-full w-full" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <p className="text-xs text-blood">{p.sub}</p>
          <h2 className="font-stamp text-3xl">{p.name}</h2>
          <p className="mt-2 text-2xl font-bold">MT {p.price.toLocaleString("pt-MZ")}</p>
          <ul className="mt-6 space-y-2 border-y border-border py-4 text-sm">{p.detail.map((detail) => <li key={detail}><span className="text-blood">▸</span> {detail}</li>)}</ul>
          {p.n !== "04" && (
            <div className="mt-6">
              <p className="mb-2 text-xs text-muted-foreground">TAMANHO</p>
              <div className="flex gap-2">{SIZES.map((sizeOption) => <button key={sizeOption} type="button" onClick={() => setSize(sizeOption)} className={"h-10 w-12 border text-sm " + (size === sizeOption ? "border-blood text-blood" : "border-border")}>{sizeOption}</button>)}</div>
            </div>
          )}
          <label className="mt-6 text-xs text-muted-foreground" htmlFor="merch-alias">CODINOME DO RECEPTOR</label>
          <input id="merch-alias" value={alias} onChange={(event) => setAlias(event.target.value.toUpperCase())} maxLength={20} placeholder="ANÔNIMO" className="mt-2 border border-border bg-transparent px-3 py-3 text-sm outline-none focus:border-blood" />
          <button type="button" onClick={() => void reserve()} disabled={reservationState === "sending" || !canOpen} className="mt-6 bg-blood py-4 font-stamp text-lg text-primary-foreground hover:opacity-85 disabled:cursor-wait disabled:opacity-60">RESERVAR UNIDADE</button>
          <p className="mt-2 text-[10px] text-muted-foreground">{reservationState === "sending" ? "a registar a reserva..." : member ? "pré-reserva de sindicalizado — registo real no Control Room." : "reserva real no Control Room — pagamento liberado no dia do drop."}</p>
          {reservationState === "error" && <p className="mt-2 border border-blood/50 bg-blood/5 p-3 text-[10px] text-blood">{reservationMessage}</p>}
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
                {receipt.serial > 0 && <p>UNIDADE Nº {String(receipt.serial).padStart(3, "0")}/333</p>}
                <p className="my-2 text-center">--------------------------------</p>
                <p className="flex justify-between font-bold"><span>TOTAL</span><span>MT {receipt.item.price.toLocaleString("pt-MZ")}</span></p>
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
