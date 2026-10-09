import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Share2, ShieldCheck } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { drawCard, shareCard } from "@/lib/carteira";
import { getDelegates, joinUnion, storeMemberCode } from "@/lib/membership";
import { validateMembershipForm } from "@/lib/membership-validation";
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
  {
    title: "LEALDADE AO MOVIMENTO",
    body: "Respeitar artistas, produtores e colaboradores que constroem o Sindicato. O nome da crew não serve para intimidar nem diminuir ninguém.",
  },
  {
    title: "CRÉDITO É LEI",
    body: "Reconhecer cada autoria. Música, imagem, conceito e trabalho de outra pessoa não são propriedade de quem os partilha primeiro.",
  },
  {
    title: "RESPEITO NO MICROFONE",
    body: "Representar o movimento com responsabilidade, dentro e fora do palco, nas redes, nos estúdios e em qualquer colaboração.",
  },
  {
    title: "O BACKSTAGE É CONFIDENCIAL",
    body: "Conversas privadas, dados pessoais e informação interna ficam protegidos. Nada é divulgado sem autorização de quem tem legitimidade para autorizar.",
  },
  {
    title: "PROTEGER O DROP",
    body: "Pré-lançamentos, ficheiros, campanhas e conteúdos exclusivos só podem ser publicados ou enviados com autorização expressa.",
  },
  {
    title: "A CREW ACIMA DO EGO",
    body: "Nenhuma ambição individual justifica prejudicar a segurança, a confiança ou o trabalho colectivo. O respeito também faz parte da cultura.",
  },
] as const;

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

export function Filiacao() {
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
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  const formIssue = validateMembershipForm({
    alias,
    contactType,
    contactValue,
    hasPhoto: Boolean(photo),
    hasSignature: Boolean(signature),
  });

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

  const selectPhoto = async (file: File | undefined, input?: HTMLInputElement | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("SELECCIONE UMA IMAGEM VÁLIDA.");
      if (input) input.value = "";
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("A fotografia deve ter no máximo 12 MB.");
      if (input) input.value = "";
      return;
    }

    setError("");
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(file);
    objectUrl.current = url;

    try {
      const image = await loadImage(url);
      setPhoto(image);
    } catch {
      setError("Não foi possível ler a fotografia.");
    } finally {
      if (input) input.value = "";
    }
  };

  const submit = async () => {
    setError("");
    setAlreadyMember(false);

    if (busy) return;
    if (honeypot) {
      setError("NÃO FOI POSSÍVEL VALIDAR A FICHA. ACTUALIZA A PÁGINA E TENTA NOVAMENTE.");
      return;
    }

    const issue = validateMembershipForm({
      alias,
      contactType,
      contactValue,
      hasPhoto: Boolean(photo),
      hasSignature: Boolean(signature),
    });
    if (issue) {
      setError(issue.message);
      const target = document.getElementById(issue.target);
      target?.scrollIntoView?.({
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      });
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
      return;
    }

    setBusy(true);
    try {
      track("join_start", { referred: Boolean(referrer) ? 1 : 0 });
      const result = await joinUnion({
        alias: alias.trim(),
        contactType,
        contactValue: contactValue.trim(),
        referredBy: referrer,
        signaturePresent: Boolean(signature),
      });

      if (result.alreadyMember) {
        setAlreadyMember(true);
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
          : raw.includes("ASSINATURA_OBRIGATORIA")
            ? "ASSINATURA OBRIGATÓRIA."
            : raw.includes("MEMBRO_JA_EXISTE")
              ? "ESTE CONTACTO JÁ TEM UMA FILIAÇÃO ACTIVA."
              : raw.includes("SUPABASE") || raw.includes("SERVIÇO") || raw.includes("PGRST") || raw.includes("function")
                ? "O SERVIÇO DO SINDICATO ESTÁ TEMPORARIAMENTE INDISPONÍVEL. TENTA NOVAMENTE."
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
        <section className="mx-auto mt-10 max-w-5xl" aria-labelledby="statute-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] tracking-[0.24em] text-blood">PROTOCOLO DE ENTRADA // ARQUIVO 001</p>
              <h2 id="statute-title" className="mt-2 font-gothic text-5xl leading-none md:text-7xl">O Estatuto.</h2>
            </div>
            <div className="flex items-center gap-2 border border-blood px-3 py-2 font-mono text-[9px] tracking-[0.16em] text-blood">
              <span className="h-2 w-2 animate-pulse bg-blood" />
              LEITURA OBRIGATÓRIA
            </div>
          </div>

          <article className="relative isolate overflow-hidden border border-border bg-[#141313] shadow-[0_22px_80px_rgba(0,0,0,0.42)]">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 xerox-wear opacity-25" />

            <header className="relative z-10 border-b-2 border-blood bg-[#100f0f] p-5 md:p-8">
              <div className="flex flex-wrap items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center border-2 border-blood font-gothic text-3xl text-blood md:h-16 md:w-16 md:text-4xl">
                  SDT
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[9px] tracking-[0.22em] text-blood">O SINDICATO DO TRAP</p>
                  <h3 className="mt-2 font-stamp text-xl leading-tight text-foreground md:text-3xl">TERMO DE ADESÃO AO SINDICATO</h3>
                  <p className="mt-2 max-w-2xl font-mono text-[9px] leading-5 tracking-[0.08em] text-muted-foreground">
                    INSTRUMENTO DE COMPROMISSO, CONDUTA E PROTECÇÃO DO MOVIMENTO.
                  </p>
                </div>
                <div className="stamp hidden rotate-[-8deg] px-3 py-2 text-center text-[9px] font-bold leading-4 tracking-[0.15em] sm:block">
                  USO INTERNO
                  <br />
                  CÓPIA 001
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 border-y border-border py-3 md:grid-cols-4">
                <div className="border-r border-border pr-2">
                  <p className="font-mono text-[8px] tracking-[0.16em] text-muted-foreground">DOCUMENTO</p>
                  <p className="mt-1 font-mono text-[9px] text-foreground">SDT-FIL-001</p>
                </div>
                <div className="md:border-r md:border-border md:pr-2">
                  <p className="font-mono text-[8px] tracking-[0.16em] text-muted-foreground">VERSÃO</p>
                  <p className="mt-1 font-mono text-[9px] text-foreground">ESTATUTO V1.0</p>
                </div>
                <div className="border-r border-border pr-2">
                  <p className="font-mono text-[8px] tracking-[0.16em] text-muted-foreground">VALIDAÇÃO</p>
                  <p className="mt-1 font-mono text-[9px] text-foreground">6 ARTIGOS</p>
                </div>
                <div>
                  <p className="font-mono text-[8px] tracking-[0.16em] text-muted-foreground">ESTADO</p>
                  <p className="mt-1 font-mono text-[9px] text-blood">{clauses.size === 6 ? "ACEITE INTEGRAL" : "AGUARDA ACEITAÇÃO"}</p>
                </div>
              </div>
            </header>

            <div className="relative z-10 p-4 md:p-8">
              <div className="max-w-3xl border-l-2 border-blood pl-4 md:pl-5">
                <p className="font-mono text-[8px] tracking-[0.2em] text-blood">PREÂMBULO</p>
                <p className="mt-2 font-stamp text-sm leading-6 text-foreground md:text-base">
                  Ao solicitar entrada no Sindicato, declaro que li este estatuto e assumo o compromisso de respeitar as pessoas, o trabalho e a cultura que sustentam o movimento. Cada artigo deve ser lido e confirmado através do respectivo carimbo digital.
                </p>
              </div>

              <div className="mt-7 border-t border-border">
                {CLAUSES.map((clause, index) => {
                  const stamped = clauses.has(index);
                  return (
                    <button
                      key={clause.title}
                      type="button"
                      onClick={() => stampClause(index)}
                      className={
                        "group relative grid w-full grid-cols-[38px_minmax(0,1fr)_auto] items-start gap-3 border-b border-border/70 px-2 py-5 text-left transition-colors sm:grid-cols-[58px_minmax(0,1fr)_112px] sm:gap-4 sm:px-4 " +
                        (stamped ? "bg-blood/[0.06]" : "hover:bg-foreground/[0.025]")
                      }
                      aria-pressed={stamped}
                      aria-label={(stamped ? "Cláusula aceite " : "Carimbar cláusula ") + String(index + 1).padStart(2, "0") + ": " + clause.title}
                    >
                      <span className="pt-1 font-mono text-[9px] tracking-[0.08em] text-blood md:text-[10px]">
                        ART. {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block font-stamp text-base leading-tight text-foreground md:text-lg">{clause.title}</span>
                        <span className="mt-2 block font-mono text-[9px] leading-5 tracking-[0.01em] text-muted-foreground md:text-[10px]">
                          {clause.body}
                        </span>
                        <span className="mt-3 block font-mono text-[8px] tracking-[0.13em] text-muted-foreground">
                          {stamped ? "ARTIGO CONFIRMADO NO REGISTO" : "LER E CARIMBAR PARA ACEITAR"}
                        </span>
                      </span>
                      <span className="flex min-h-8 items-center justify-center pt-0.5">
                        {stamped ? (
                          <span className="stamp inline-flex rotate-[-8deg] px-2 py-1 text-[8px] font-bold tracking-[0.12em] md:px-3 md:text-[9px]">
                            ACEITE
                          </span>
                        ) : (
                          <span className="inline-flex min-h-8 items-center gap-2 border border-border px-2 font-mono text-[8px] tracking-[0.1em] text-muted-foreground transition group-hover:border-blood group-hover:text-blood">
                            <span className="h-2 w-2 border border-current" />
                            CARIMBAR
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                <div className="border border-border bg-black/20 p-4">
                  <p className="font-mono text-[8px] tracking-[0.18em] text-blood">DECLARAÇÃO DE VONTADE</p>
                  <p className="mt-2 font-stamp text-sm leading-6 text-foreground">
                    Confirmo que compreendo o compromisso descrito neste documento. A assinatura desenhada e a confirmação final serão pedidas na ficha seguinte.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 border border-border p-4">
                  <div>
                    <p className="font-mono text-[8px] tracking-[0.18em] text-muted-foreground">CARIMBOS REGISTADOS</p>
                    <p className="mt-2 font-gothic text-4xl leading-none text-foreground">{String(clauses.size).padStart(2, "0")}<span className="font-mono text-sm text-muted-foreground"> / 06</span></p>
                  </div>
                  <div className={"stamp px-2 py-2 text-center text-[8px] font-bold leading-3 tracking-[0.1em] " + (clauses.size === 6 ? "rotate-[-8deg] opacity-100" : "rotate-[5deg] opacity-35")}>
                    {clauses.size === 6 ? "ACEITE" : "PENDENTE"}
                  </div>
                </div>
              </div>
            </div>

            <footer className="relative z-10 border-t-2 border-border bg-[#100f0f] p-4 md:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[8px] tracking-[0.18em] text-muted-foreground">RUBRICA DIGITAL</p>
                  <div className="mt-4 h-px w-full max-w-sm bg-border" />
                  <p className="mt-2 font-stamp text-xs text-foreground">CONFIRMAÇÃO FINAL NA FICHA 02</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[8px] tracking-[0.16em] text-muted-foreground">PROTOCOLO SDT</p>
                  <p className="mt-1 font-mono text-[9px] text-blood">FILIAÇÃO / 001 / V1.0</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-border pt-5 sm:flex-row sm:items-center">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.2em] text-blood">ESTATUTO</p>
                  <p className="mt-1 max-w-xl text-[10px] leading-5 text-muted-foreground">
                    Todos os seis artigos têm de ficar carimbados. A aceitação fica associada à versão do estatuto usada na filiação.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={clauses.size !== 6}
                  onClick={() => {
                    setError("");
                    setStep(2);
                  }}
                  className="min-h-12 border border-blood bg-blood px-5 py-3 font-mono text-[10px] tracking-[0.18em] text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  AVANÇAR PARA A FICHA
                </button>
              </div>
            </footer>
          </article>

          <p className="mt-3 font-mono text-[8px] leading-5 tracking-[0.1em] text-muted-foreground">
            INTERFACE DE ADESÃO DO MOVIMENTO // LÊ CADA ARTIGO ANTES DE CARIMBAR. O BOTÃO DE AVANÇO SÓ ABRE DEPOIS DOS 6/6.
          </p>
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
                  onChange={(event) => {
                    setAlias(event.target.value.toUpperCase().slice(0, 20));
                    setError("");
                  }}
                  minLength={2}
                  maxLength={20}
                  autoComplete="nickname"
                  placeholder="ANÓNIMO"
                  className="border border-border bg-background px-3 py-3 text-sm tracking-normal text-foreground outline-none focus:border-blood"
                />
              </label>

              <div className="mt-5">
                <label htmlFor="member-contact" className="font-mono text-[9px] tracking-[0.18em] text-muted-foreground">CONTACTO</label>
                <div className="mt-2 grid grid-cols-2 border border-border">
                  {([
                    ["whatsapp", "WHATSAPP"],
                    ["email", "EMAIL"],
                  ] as const).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => {
                        setContactType(value);
                        setError("");
                      }}
                      className={"py-3 font-mono text-[9px] tracking-[0.16em] " + (contactType === value ? "bg-blood text-primary-foreground" : "hover:bg-muted")}
                      aria-pressed={contactType === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  id="member-contact"
                  value={contactValue}
                  onChange={(event) => {
                    setContactValue(event.target.value);
                    setError("");
                  }}
                  type={contactType === "email" ? "email" : "tel"}
                  inputMode={contactType === "email" ? "email" : "tel"}
                  autoComplete={contactType === "email" ? "email" : "tel"}
                  placeholder={contactType === "email" ? "teu@email.com" : "+258 84 000 0000"}
                  className="mt-2 w-full border border-border bg-background px-3 py-3 text-sm outline-none focus:border-blood"
                />
                <p className="mt-2 text-[9px] leading-5 text-muted-foreground">Só o Sindicato vê isto. Este contacto impede uma segunda filiação.</p>
              </div>

              <div id="member-photo-section" tabIndex={-1} className="mt-6 outline-none">
                <p className="font-mono text-[9px] tracking-[0.18em] text-muted-foreground">FOTOGRAFIA</p>
                <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
                  No telemóvel pode escolher uma fotografia da galeria ou abrir a câmara. No computador pode seleccionar um ficheiro.
                </p>

                <input
                  ref={galleryInputRef}
                  id="member-photo-gallery"
                  type="file"
                  accept="image/*"
                  onChange={(event) => void selectPhoto(event.target.files?.[0], event.currentTarget)}
                  className="sr-only"
                />
                <input
                  ref={cameraInputRef}
                  id="member-photo-camera"
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={(event) => void selectPhoto(event.target.files?.[0], event.currentTarget)}
                  className="sr-only"
                />

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="min-h-12 border border-border bg-background px-4 py-3 font-mono text-[10px] tracking-[0.16em] hover:border-blood hover:text-blood"
                  >
                    ESCOLHER FOTO
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="min-h-12 border border-blood bg-blood px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-primary-foreground hover:opacity-90"
                  >
                    ABRIR CÂMARA
                  </button>
                </div>

                {photo && (
                  <div className="mt-3 flex items-center justify-between gap-3 border border-border bg-background px-3 py-2">
                    <span className="truncate font-mono text-[9px] tracking-[0.12em] text-blood">FOTOGRAFIA CARREGADA</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setError("");
                      }}
                      className="shrink-0 border border-border px-2 py-1 font-mono text-[8px] tracking-[0.12em] hover:border-blood"
                    >
                      REMOVER
                    </button>
                  </div>
                )}
              </div>

              <div id="member-signature-section" tabIndex={-1} className="mt-6 outline-none">
                <p className="font-mono text-[9px] tracking-[0.18em] text-muted-foreground">ASSINATURA</p>
                <p className="mt-2 text-[9px] leading-5 text-muted-foreground">DESENHA A TUA RUBRICA NO CAMPO. UM TRAÇO CURTO TAMBÉM CONTA.</p>
                <div className="mt-2">
                  <SignaturePad onChange={(canvas) => {
                    setSignature(canvas);
                    if (canvas) setError("");
                  }} />
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

              {error && <div role="alert" aria-live="assertive" className="mt-4 border border-blood/60 bg-blood/10 p-3 font-mono text-[10px] leading-5 text-blood">{error}</div>}
              {alreadyMember && (
                <div className="mt-4 border border-blood bg-blood/5 p-4">
                  <p className="font-gothic text-3xl text-blood">JÁ ESTÁS NO SISTEMA.</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Este contacto já tem uma filiação activa. Não criámos uma segunda carteira.</p>
                </div>
              )}

              <div id="membership-submit-status" aria-live="polite" className="mt-6 mb-3 flex items-start gap-3 border border-border p-3">
                <span className={"mt-1 h-2 w-2 shrink-0 " + (busy ? "animate-pulse bg-blood" : formIssue ? "bg-border" : "bg-blood")} />
                <p className="font-mono text-[9px] leading-5 tracking-[0.08em] text-muted-foreground">
                  {busy
                    ? "A VALIDAR O REGISTO NO SISTEMA DO SINDICATO..."
                    : formIssue
                      ? "FICHA INCOMPLETA. " + formIssue.message
                      : "FICHA COMPLETA. A CONFIRMAÇÃO VAI EMITIR A TUA CARTEIRA."}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
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
                  disabled={busy}
                  aria-busy={busy}
                  aria-describedby="membership-submit-status"
                  className="min-h-12 flex-1 border border-blood bg-blood px-4 py-3 font-mono text-[10px] tracking-[0.18em] text-primary-foreground transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
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
