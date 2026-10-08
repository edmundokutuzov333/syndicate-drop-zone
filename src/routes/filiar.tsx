import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Share2, ShieldCheck } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { drawCard, shareCard } from "@/lib/carteira";
import { getDelegates, joinUnion, storeMemberCode } from "@/lib/membership";
import { renderHalftone } from "@/lib/halftone-canvas";
import { track } from "@/lib/track";
import { thud } from "@/lib/sfx";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";

export const Route = createFileRoute("/filiar")({
  head: () => ({
    meta: [
      { title: "Filiar-se — O Sindicato do Trap" },
      { name: "description", content: "Assina o estatuto, recebe a tua carteira numerada e entra no Sindicato." },
      { property: "og:title", content: "Filiar-se — O Sindicato do Trap" },
      { property: "og:description", content: "Assina o estatuto. Recebe a carteira. Entra no Sindicato." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Filiacao,
});

type Step = 1 | 2 | 3;
type ContactType = "whatsapp" | "email";
type JoinView = {
  code: string;
  memberNumber: number;
  alias: string;
  since: string;
};

const CLAUSES = [
  "Ninguém sai sem o disco.",
  "Respeita quem segura o microfone.",
  "A crew vem antes do ego.",
  "O segredo fica no Sindicato.",
  "O drop não espera ninguém.",
  "Tudo ou nada. Sem desculpas.",
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    image.src = src;
  });
}

function fmtStamp(value: string): string {
  return new Date(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Filiacao() {
  const [step, setStep] = useState<Step>(1);
  const [clauses, setClauses] = useState<Set<number>>(() => new Set());
  const [alias, setAlias] = useState("");
  const [contactType, setContactType] = useState<ContactType>("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [signature, setSignature] = useState<HTMLCanvasElement | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [referrer, setReferrer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [card, setCard] = useState<JoinView | null>(null);
  const [shareState, setShareState] = useState("");
  const previewRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLCanvasElement>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    setReferrer(ref ? ref.trim().toUpperCase().slice(0, 6) : null);
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  useEffect(() => {
    if (!photo || !previewRef.current) return;
    renderHalftone(photo, previewRef.current, 640, 800, {
      cell: 7,
      contrast: 1.5,
      gamma: 0.9,
    });
  }, [photo]);

  useEffect(() => {
    if (!card || !photo || !cardRef.current) return;
    let active = true;
    loadImage(selo.url)
      .then((seal) => {
        if (!active || !cardRef.current) return;
        drawCard(cardRef.current, {
          code: card.code,
          number: card.memberNumber,
          alias: card.alias,
          since: fmtStamp(card.since),
          photo,
          signature,
          seloUrl: seal,
        });
      })
      .catch(() => {
        if (!active || !cardRef.current) return;
        drawCard(cardRef.current, {
          code: card.code,
          number: card.memberNumber,
          alias: card.alias,
          since: fmtStamp(card.since),
          photo,
          signature,
        });
      });
    return () => {
      active = false;
    };
  }, [card, photo, signature]);

  const validAlias = alias.trim().length >= 2 && alias.trim().length <= 20;
  const validContact = contactValue.trim().length >= 5;
  const canSubmit = validAlias && validContact && Boolean(photo) && Boolean(signature) && !busy;

  const progressLabel = useMemo(() => {
    if (step === 1) return clauses.size + "/6 CARIMBOS";
    if (step === 2) return "FICHA 2/3";
    return "CARTEIRA 3/3";
  }, [clauses, step]);

  const stampClause = (index: number) => {
    if (clauses.has(index)) return;
    thud();
    setClauses((current) => new Set([...current, index]));
  };

  const selectPhoto = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    try {
      const image = await loadImage(url);
      setPhoto(image);
    } catch {
      setError("Não foi possível ler a fotografia.");
    }
  };

  const submit = async () => {
    setError("");
    setAlreadyMember(false);

    if (honeypot) return;
    if (!canSubmit) {
      setError("FALTA UMA PEÇA: codinome, contacto, fotografia e assinatura são obrigatórios.");
      return;
    }

    setBusy(true);
    track("join_start", { referred: Boolean(referrer) ? 1 : 0 });

    try {
      const result = await joinUnion({
        alias: alias.trim(),
        contactType,
        contactValue: contactValue.trim(),
        referredBy: referrer,
        signaturePresent: Boolean(signature),
      });

      if (result.alreadyMember) {
        setAlreadyMember(true);
        setBusy(false);
        return;
      }

      if (!result.code || !result.memberNumber || !result.since || !result.alias) {
        throw new Error("O Sindicato recebeu a ficha mas não devolveu a carteira.");
      }

      storeMemberCode(result.code);
      track("join_done", {
        member: result.memberNumber,
        referred: Boolean(referrer) ? 1 : 0,
      });
      setCard({
        code: result.code,
        memberNumber: result.memberNumber,
        alias: result.alias,
        since: result.since,
      });
      setStep(3);
    } catch (requestError) {
      const raw = requestError instanceof Error ? requestError.message : "ERRO DE SISTEMA";
      const message = raw.includes("CODINOME_INVALIDO")
        ? "CODINOME INVÁLIDO."
        : raw.includes("CONTACTO_INVALIDO") || raw.includes("WHATSAPP_INVALIDO") || raw.includes("EMAIL_INVALIDO")
          ? "CONTACTO INVÁLIDO."
          : "NÃO FOI POSSÍVEL REGISTAR A FILIAÇÃO. TENTA NOVAMENTE.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!cardRef.current || !card) return;
    const result = await shareCard(cardRef.current, "sindicalizado-" + card.code);
    if (result === "cancelled") {
      setShareState("PARTILHA CANCELADA");
      return;
    }
    track("card_share", { method: result });
    setShareState(result === "shared" ? "PARTILHADO" : "PNG DESCARREGADO");
  };

  const copyRecruitLink = async () => {
    if (!card) return;
    const link = window.location.origin + "/filiar?ref=" + encodeURIComponent(card.code);
    try {
      await navigator.clipboard.writeText(link);
      setShareState("LINK DE RECRUTA COPIADO");
    } catch {
      setShareState("COPIA ESTE LINK: " + link);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-12 md:px-8">
      <div className="border-y border-border py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.28em] text-blood">FILIAÇÃO · 1ª EDIÇÃO</p>
            <h1 className="mt-2 font-gothic text-6xl leading-[0.82] md:text-8xl">Assinar o estatuto.</h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
              Três passos. Um codinome. Uma carteira real. O Sindicato guarda o contacto. O público só vê a carteira.
            </p>
          </div>
          <div className="border border-blood px-3 py-2 font-mono text-[9px] tracking-[0.2em] text-blood">
            {progressLabel}
          </div>
        </div>
      </div>

      {step === 1 && (
        <section className="mt-10">
          <div className="grid gap-4 md:grid-cols-2">
            {CLAUSES.map((clause, index) => {
              const stamped = clauses.has(index);
              return (
                <button
                  key={clause}
                  type="button"
                  onClick={() => stampClause(index)}
                  className={"grain xerox-wear relative min-h-40 overflow-hidden border p-6 text-left transition " + (stamped ? "border-blood bg-blood/5" : "border-border bg-card hover:border-blood")}
                  aria-pressed={stamped}
                >
                  <span className="absolute right-4 top-4 font-mono text-[9px] tracking-[0.2em] text-blood">
                    CLAUSULA 0{index + 1}
                  </span>
                  <p className="max-w-sm font-stamp text-2xl leading-tight">{clause}</p>
                  <div className="mt-8 flex items-center gap-3 text-[9px] tracking-[0.2em]">
                    {stamped ? <Check size={13} className="text-blood" /> : <span className="h-3 w-3 border border-border" />}
                    <span>{stamped ? "CARIMBADO" : "TOCA PARA CARIMBAR"}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col items-start justify-between gap-4 border border-border bg-card p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-blood">ESTATUTO</p>
              <p className="mt-1 text-xs text-muted-foreground">As seis cláusulas têm de ficar carimbadas. Não há atalho.</p>
            </div>
            <button
              type="button"
              disabled={clauses.size !== 6}
              onClick={() => {
                setError("");
                setStep(2);
              }}
              className="border border-blood bg-blood px-5 py-3 font-mono text-[10px] tracking-[0.18em] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-35"
            >
              AVANÇAR PARA A FICHA
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="mt-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
            <div className="border border-border bg-card p-5 md:p-7">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.22em] text-blood">FICHA 02</p>
                  <h2 className="mt-2 font-gothic text-4xl">Identificação</h2>
                </div>
                <ShieldCheck className="text-blood" size={20} />
              </div>

              <label className="mt-6 grid gap-2 font-mono text-[9px] tracking-[0.18em] text-muted-foreground" htmlFor="member-alias">
                CODINOME
                <input
                  id="member-alias"
                  value={alias}
                  onChange={(event) => setAlias(event.target.value.toUpperCase().slice(0, 20))}
                  minLength={2}
                  maxLength={20}
                  autoComplete="nickname"
                  placeholder="ANÓNIMO"
                  className="border border-border bg-background px-3 py-3 text-sm tracking-normal text-foreground outline-none focus:border-blood"
                />
              </label>

              <div className="mt-5">
                <p className="font-mono text-[9px] tracking-[0.18em] text-muted-foreground">CONTACTO</p>
                <div className="mt-2 grid grid-cols-2 border border-border">
                  {([
                    ["whatsapp", "WHATSAPP"],
                    ["email", "EMAIL"],
                  ] as const).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => setContactType(value)}
                      className={"py-3 font-mono text-[9px] tracking-[0.16em] " + (contactType === value ? "bg-blood text-primary-foreground" : "hover:bg-muted")}
                      aria-pressed={contactType === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  value={contactValue}
                  onChange={(event) => setContactValue(event.target.value)}
                  type={contactType === "email" ? "email" : "tel"}
                  inputMode={contactType === "email" ? "email" : "tel"}
                  autoComplete={contactType === "email" ? "email" : "tel"}
                  placeholder={contactType === "email" ? "teu@email.com" : "+258 84 000 0000"}
                  className="mt-2 w-full border border-border bg-background px-3 py-3 text-sm outline-none focus:border-blood"
                />
                <p className="mt-2 text-[9px] leading-5 text-muted-foreground">Só o Sindicato vê isto. Este contacto impede uma segunda filiação.</p>
              </div>

              <label className="mt-6 grid gap-2 font-mono text-[9px] tracking-[0.18em] text-muted-foreground" htmlFor="member-photo">
                FOTOGRAFIA
                <input
                  id="member-photo"
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={(event) => void selectPhoto(event.target.files?.[0])}
                  className="block w-full border border-border bg-background px-3 py-3 text-xs file:mr-3 file:border-0 file:bg-blood file:px-3 file:py-2 file:text-primary-foreground"
                />
              </label>

              <div className="mt-6">
                <p className="font-mono text-[9px] tracking-[0.18em] text-muted-foreground">ASSINATURA</p>
                <div className="mt-2">
                  <SignaturePad onChange={setSignature} />
                </div>
              </div>

              <input
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-px w-px opacity-0"
              />
            </div>

            <div className="border border-border bg-card p-5 md:p-7">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.22em] text-blood">MEIO-TOM REAL</p>
                  <h2 className="mt-2 font-gothic text-4xl">Pré-visualização</h2>
                </div>
                {referrer && <span className="font-mono text-[9px] text-blood">REF {referrer}</span>}
              </div>

              <div className="mt-6 grid min-h-[500px] place-items-center border border-border bg-background p-4">
                {photo ? (
                  <canvas ref={previewRef} className="max-h-[72vh] w-full object-contain" aria-label="Pré-visualização em meio-tom" />
                ) : (
                  <div className="grid aspect-[4/5] w-full max-w-md place-items-center border border-dashed border-border p-10 text-center font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
                    CARREGA UMA FOTOGRAFIA<br />PARA INICIAR A INSPECÇÃO
                  </div>
                )}
              </div>

              {error && <div className="mt-4 border border-blood/40 bg-blood/5 p-3 font-mono text-[10px] leading-5 text-blood">{error}</div>}
              {alreadyMember && (
                <div className="mt-4 border border-blood bg-blood/5 p-4">
                  <p className="font-gothic text-3xl text-blood">JÁ ESTÁS NO SISTEMA.</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Este contacto já tem uma filiação activa. Não criámos uma segunda carteira.</p>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="border border-border px-4 py-3 font-mono text-[10px] tracking-[0.18em] hover:border-blood"
                >
                  VOLTAR
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!canSubmit}
                  className="flex-1 border border-blood bg-blood px-4 py-3 font-mono text-[10px] tracking-[0.18em] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {busy ? "A REGISTAR..." : "ASSINAR E ENTRAR NO SINDICATO"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {step === 3 && card && (
        <section className="mt-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,480px)_1fr]">
            <div className="border border-border bg-card p-4 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.22em] text-blood">CARTEIRA EMITIDA</p>
                  <p className="mt-1 font-stamp text-lg">Nº {String(card.memberNumber).padStart(4, "0")} · {card.code}</p>
                </div>
                <span className="border border-blood px-2 py-1 font-mono text-[8px] tracking-[0.16em] text-blood">ABERTO</span>
              </div>
              <div className="overflow-hidden border border-border bg-black">
                <canvas ref={cardRef} className="h-auto w-full" aria-label="Carteira de Sindicalizado" />
              </div>
            </div>

            <div className="border border-border bg-card p-6 md:p-8">
              <p className="font-mono text-[10px] tracking-[0.22em] text-blood">BEM-VINDO AO SINDICATO</p>
              <h2 className="mt-3 font-gothic text-6xl leading-none md:text-8xl">Nº {String(card.memberNumber).padStart(4, "0")}</h2>
              <p className="mt-4 font-stamp text-2xl">{card.alias}</p>
              <p className="mt-2 text-sm text-muted-foreground">Filiação emitida em {fmtStamp(card.since)}. A carteira fica guardada neste dispositivo.</p>

              <div className="mt-8 grid gap-3">
                <button type="button" onClick={() => void share()} className="flex items-center justify-center gap-2 border border-blood bg-blood px-4 py-4 font-mono text-[10px] tracking-[0.18em] text-primary-foreground">
                  <Share2 size={15} /> PARTILHAR
                </button>
                <button type="button" onClick={() => void copyRecruitLink()} className="flex items-center justify-center gap-2 border border-border px-4 py-4 font-mono text-[10px] tracking-[0.18em] hover:border-blood">
                  <Copy size={15} /> COPIAR LINK DE RECRUTA
                </button>
                {shareState && <p className="text-center font-mono text-[9px] tracking-[0.16em] text-blood">{shareState}</p>}
              </div>

              <div className="mt-8 border-y border-border py-5 text-[10px] leading-6 text-muted-foreground">
                <p><span className="text-blood">▸</span> Link público: <span className="text-foreground">{window.location.origin}/carteira/{card.code}</span></p>
                <p><span className="text-blood">▸</span> Recruta: cada nova filiação pelo teu código fica ligada a ti.</p>
                <p><span className="text-blood">▸</span> Top 3 Delegados: prémio editorial ainda não automatizado.</p>
              </div>

              <Link to="/" className="mt-6 inline-flex items-center gap-2 border border-border px-4 py-3 font-mono text-[10px] tracking-[0.18em] hover:border-blood">
                VOLTAR AO HUB <Download size={13} />
              </Link>
            </div>
          </div>

        </section>
      )}

      <Delegates />
    </main>
  );
}

function Delegates() {
  const [rows, setRows] = useState<Array<{ alias: string; referrals: number }>>([]);
  useEffect(() => {
    void getDelegates().then(setRows);
  }, []);

  if (!rows.length) return null;

  return (
    <section className="mt-8 border border-border bg-card">
      <div className="border-b border-border p-4">
        <p className="font-mono text-[10px] tracking-[0.22em] text-blood">DELEGADOS</p>
        <p className="mt-1 text-[10px] text-muted-foreground">Os 10 codinomes com mais recrutas.</p>
      </div>
      <div className="grid md:grid-cols-2">
        {rows.map((row, index) => (
          <div key={row.alias + index} className="flex items-center justify-between border-b border-border px-4 py-3 font-mono text-[9px]">
            <span><span className="text-blood">#{String(index + 1).padStart(2, "0")}</span> {row.alias}</span>
            <span className="text-muted-foreground">{row.referrals} RECRUTAS</span>
          </div>
        ))}
      </div>
    </section>
  );
}
