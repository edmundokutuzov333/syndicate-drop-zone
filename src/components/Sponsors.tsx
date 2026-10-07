import { useState, type FormEvent } from "react";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";
import {
  PartnershipRequestSchema,
  submitPartnershipRequest,
  type PartnershipRequest,
} from "@/lib/partnership";

const TIERS = [
  {
    tier: "MASTER",
    slot: "01",
    line: "Este muro é teu.",
    sub: "Uma marca. A frente do movimento.",
    cls: "md:col-span-6 min-h-64 md:min-h-80",
    big: "text-6xl md:text-8xl",
    type: "Patrocínio · MASTER",
  },
  {
    tier: "MÉDIO",
    slot: "02",
    line: "Espaço livre.",
    sub: "Cola a tua marca no camping.",
    cls: "md:col-span-4 min-h-52",
    big: "text-4xl md:text-5xl",
    type: "Patrocínio · MÉDIO",
  },
  {
    tier: "PEQUENO",
    slot: "03",
    line: "Cabe aqui.",
    sub: "Pequeno no tamanho, grande na rua.",
    cls: "md:col-span-2 min-h-52",
    big: "text-3xl",
    type: "Patrocínio · PEQUENO",
  },
] as const;

type FormState = PartnershipRequest;

const EMPTY_FORM: FormState = {
  name: "",
  company: "",
  contact: "",
  partnershipType: "",
  budget: "",
  message: "",
};

type Errors = Partial<Record<keyof FormState, string>>;

export function Sponsors() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const openProposal = (type: string) => {
    setSelectedTier(type);
    setForm((current) => ({ ...current, partnershipType: current.partnershipType || type }));
    setStatus("idle");
    setStatusMessage("");
    window.requestAnimationFrame(() => {
      document.getElementById("parcerias-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (status !== "idle") {
      setStatus("idle");
      setStatusMessage("");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;

    if (honeypot.trim()) {
      setStatus("success");
      setStatusMessage("Proposta recebida.");
      return;
    }

    const parsed = PartnershipRequestSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormState | undefined;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setErrors(nextErrors);
      setStatus("error");
      setStatusMessage("Corrija os campos assinalados.");
      return;
    }

    setStatus("sending");
    setErrors({});

    try {
      await submitPartnershipRequest(parsed.data);
      setStatus("success");
      setStatusMessage("Proposta recebida. A equipa do Sindicato entra em contacto.");
      setForm(EMPTY_FORM);
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Não foi possível enviar a proposta. Tente novamente.",
      );
    }
  };

  return (
    <section className="mb-24" aria-labelledby="pub">
      <div className="mb-6 flex items-end justify-between border-b border-border pb-2">
        <h2 id="pub" className="font-gothic text-5xl md:text-6xl">Muro dos Patrocínios</h2>
        <span className="text-xs text-muted-foreground">3 VAGAS</span>
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        {TIERS.map((t) => (
          <button
            key={t.tier}
            type="button"
            onClick={() => openProposal(t.type)}
            aria-label={"Abrir proposta de parceria " + t.tier}
            className={`group relative flex flex-col justify-between overflow-hidden border-2 border-dashed border-border bg-card p-5 text-left transition-colors hover:border-blood focus-visible:border-blood focus-visible:outline-none ${t.cls}`}
          >
            <div className="hazard absolute inset-x-0 top-0 h-2 opacity-60" />
            <img
              src={selo.url}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -bottom-8 -right-8 w-40 -rotate-12 opacity-20 transition-all group-hover:rotate-0 group-hover:opacity-90"
            />
            <div className="flex justify-between text-[10px] tracking-widest text-muted-foreground">
              <span className="text-blood">PATROCÍNIO {t.tier}</span>
              <span>VAGA {t.slot}</span>
            </div>
            <div className="relative">
              <p className={`font-gothic leading-[0.85] ${t.big}`}>{t.line}</p>
              <p className="mt-2 font-stamp text-sm text-muted-foreground">{t.sub}</p>
            </div>
            <span className="relative self-start border border-blood px-3 py-1 text-xs text-blood transition-colors group-hover:bg-blood group-hover:text-primary-foreground">
              ENVIAR PROPOSTA →
            </span>
          </button>
        ))}
      </div>

      <div id="parcerias-form" className="scroll-mt-28">
        {selectedTier ? (
          <form
            onSubmit={submit}
            className="mt-8 border border-blood bg-card p-5 md:p-8"
            noValidate
          >
            <div className="flex flex-col gap-3 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] tracking-[0.28em] text-blood">PARCERIAS</p>
                <h3 className="mt-1 font-gothic text-4xl md:text-5xl">ENVIAR PROPOSTA</h3>
              </div>
              <span className="font-stamp text-sm text-muted-foreground">{selectedTier}</span>
            </div>

            {status === "success" && (
              <div className="mt-6 border border-blood bg-blood/5 p-4" role="status">
                <p className="font-stamp text-sm text-blood">PROPOSTA RECEBIDA</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A equipa do Sindicato recebeu os dados e entra em contacto para dar seguimento.
                </p>
              </div>
            )}

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Field
                label="NOME DA MARCA"
                value={form.name}
                error={errors.name}
                placeholder="Nome da marca / responsável"
                onChange={(value) => updateField("name", value)}
              />
              <Field
                label="EMPRESA"
                value={form.company}
                error={errors.company}
                placeholder="Nome da empresa"
                onChange={(value) => updateField("company", value)}
              />
              <Field
                label="CONTACTO"
                value={form.contact}
                error={errors.contact}
                placeholder="Email, telefone ou WhatsApp"
                onChange={(value) => updateField("contact", value)}
              />
              <label className="grid gap-2 text-[10px] tracking-[0.2em] text-muted-foreground">
                TIPO DE PARCERIA
                <select
                  value={form.partnershipType}
                  onChange={(event) => updateField("partnershipType", event.target.value)}
                  className="min-h-12 border border-border bg-background px-3 text-sm tracking-normal text-foreground outline-none transition-colors focus:border-blood"
                >
                  <option value="">Seleccione</option>
                  <option value="Patrocínio · MASTER">Patrocínio · MASTER</option>
                  <option value="Patrocínio · MÉDIO">Patrocínio · MÉDIO</option>
                  <option value="Patrocínio · PEQUENO">Patrocínio · PEQUENO</option>
                  <option value="Media Partner">Media Partner</option>
                  <option value="Produto / Serviços">Produto / Serviços</option>
                  <option value="Experiência">Experiência</option>
                  <option value="Outro">Outro</option>
                </select>
                {errors.partnershipType && <span className="text-[10px] normal-case tracking-normal text-blood">{errors.partnershipType}</span>}
              </label>
              <label className="grid gap-2 text-[10px] tracking-[0.2em] text-muted-foreground md:col-span-2">
                MENSAGEM
                <textarea
                  value={form.message}
                  onChange={(event) => updateField("message", event.target.value)}
                  placeholder="Explique a marca, objectivo da parceria e o que pretende activar."
                  rows={6}
                  maxLength={4000}
                  className="resize-y border border-border bg-background px-3 py-3 text-sm leading-6 tracking-normal text-foreground outline-none transition-colors focus:border-blood"
                />
                <div className="flex items-center justify-between gap-3">
                  {errors.message ? (
                    <span className="text-[10px] normal-case tracking-normal text-blood">{errors.message}</span>
                  ) : (
                    <span className="text-[9px] tracking-wider text-muted-foreground">Mínimo 10 caracteres.</span>
                  )}
                  <span className="text-[9px] tracking-wider text-muted-foreground">{form.message.length}/4000</span>
                </div>
              </label>

              <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                WEBSITE
                <input
                  value={honeypot}
                  onChange={(event) => setHoneypot(event.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 md:flex-row md:items-center md:justify-between">
              <div aria-live="polite" className="text-sm">
                <p className="max-w-xl text-[9px] tracking-wider text-muted-foreground">
                  Os dados enviados destinam-se exclusivamente ao contacto e avaliação desta proposta de parceria.
                </p>
                {statusMessage && (
                  <span className={status === "success" ? "text-blood" : "text-muted-foreground"}>
                    {statusMessage}
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={status === "sending"}
                className="self-start border border-blood bg-blood px-5 py-3 text-xs tracking-[0.2em] text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 md:self-auto"
              >
                {status === "sending" ? "A ENVIAR..." : "ENVIAR PROPOSTA"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 border border-border bg-background/70 p-4 text-xs text-muted-foreground">
            Escolha uma vaga acima para abrir o formulário de parceria.
          </div>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  error,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-[10px] tracking-[0.2em] text-muted-foreground">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-12 border border-border bg-background px-3 text-sm tracking-normal text-foreground outline-none transition-colors focus:border-blood"
      />
      {error && <span className="text-[10px] normal-case tracking-normal text-blood">{error}</span>}
    </label>
  );
}
