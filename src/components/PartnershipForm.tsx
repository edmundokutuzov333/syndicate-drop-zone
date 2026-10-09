import { useState, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { submitPartnershipRequest, type PartnershipRequest } from "@/lib/partnership";

const INITIAL_FORM: PartnershipRequest = {
  name: "",
  company: "",
  contact: "",
  partnershipType: "Patrocínio",
  budget: "",
  message: "",
};

export function PartnershipForm() {
  const [form, setForm] = useState<PartnershipRequest>(INITIAL_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const update = <K extends keyof PartnershipRequest>(key: K, value: PartnershipRequest[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setSent(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSent(false);
    try {
      await submitPartnershipRequest(form);
      setForm(INITIAL_FORM);
      setSent(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(message.includes("Invalid API key")
        ? "A ligação segura ao serviço está a ser actualizada. Tenta novamente dentro de instantes."
        : message.includes("Failed to fetch")
          ? "Sem ligação ao serviço. Verifica a internet e tenta novamente."
          : "Não foi possível enviar a proposta. Os dados continuam no formulário. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="propor-parceria" className="relative mb-24 border border-border bg-card">
      <div className="hazard h-2" />
      <div className="grid gap-8 p-5 md:grid-cols-[0.8fr_1.2fr] md:p-8">
        <div>
          <p className="font-mono text-[10px] tracking-[0.24em] text-blood">CANAL OFICIAL · PARCERIAS</p>
          <h2 className="mt-3 font-gothic text-5xl leading-none md:text-6xl">Propor parceria.</h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Envie a proposta de marca, patrocínio ou activação. A equipa recebe os dados directamente no Control Room.
          </p>
          <p className="mt-6 border-l-2 border-blood pl-3 font-mono text-[9px] leading-5 tracking-[0.12em] text-muted-foreground">
            ENVIO DIRECTO · REGISTO NO SISTEMA · SEM ANEXOS NECESSÁRIOS
          </p>
        </div>

        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 font-mono text-[9px] tracking-[0.14em] text-muted-foreground">
              NOME
              <input required minLength={2} maxLength={120} autoComplete="name" value={form.name}
                onChange={(event) => update("name", event.target.value)} placeholder="Nome de contacto"
                className="min-h-12 border border-border bg-background px-3 text-sm tracking-normal text-foreground outline-none focus:border-blood" />
            </label>
            <label className="grid gap-2 font-mono text-[9px] tracking-[0.14em] text-muted-foreground">
              EMPRESA / MARCA
              <input required minLength={2} maxLength={160} autoComplete="organization" value={form.company}
                onChange={(event) => update("company", event.target.value)} placeholder="Nome da marca"
                className="min-h-12 border border-border bg-background px-3 text-sm tracking-normal text-foreground outline-none focus:border-blood" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 font-mono text-[9px] tracking-[0.14em] text-muted-foreground">
              CONTACTO
              <input required minLength={3} maxLength={160} autoComplete="email" value={form.contact}
                onChange={(event) => update("contact", event.target.value)} placeholder="Email ou telefone"
                className="min-h-12 border border-border bg-background px-3 text-sm tracking-normal text-foreground outline-none focus:border-blood" />
            </label>
            <label className="grid gap-2 font-mono text-[9px] tracking-[0.14em] text-muted-foreground">
              TIPO DE PARCERIA
              <select required value={form.partnershipType} onChange={(event) => update("partnershipType", event.target.value)}
                className="min-h-12 border border-border bg-background px-3 text-sm tracking-normal text-foreground outline-none focus:border-blood">
                <option>Patrocínio</option>
                <option>Activação de marca</option>
                <option>Conteúdo</option>
                <option>Merchandising</option>
                <option>Parceria estratégica</option>
              </select>
            </label>
          </div>

          <label className="grid gap-2 font-mono text-[9px] tracking-[0.14em] text-muted-foreground">
            ORÇAMENTO INDICATIVO · OPCIONAL
            <input maxLength={80} value={form.budget ?? ""} onChange={(event) => update("budget", event.target.value)}
              placeholder="Ex.: 150.000 MT"
              className="min-h-12 border border-border bg-background px-3 text-sm tracking-normal text-foreground outline-none focus:border-blood" />
          </label>

          <label className="grid gap-2 font-mono text-[9px] tracking-[0.14em] text-muted-foreground">
            DETALHES DA PROPOSTA
            <textarea required minLength={10} maxLength={4000} rows={5} value={form.message}
              onChange={(event) => update("message", event.target.value)}
              placeholder="Descreva a ideia, objectivos e activação pretendida."
              className="resize-y border border-border bg-background px-3 py-3 text-sm leading-6 tracking-normal text-foreground outline-none focus:border-blood" />
          </label>

          {error && <p role="alert" className="border border-blood/50 bg-blood/5 p-3 font-mono text-[10px] leading-5 text-blood">{error}</p>}
          {sent && <p role="status" className="flex items-start gap-2 border border-foreground/20 p-3 font-mono text-[10px] leading-5 text-foreground"><CheckCircle2 size={15} className="shrink-0 text-blood" /> PROPOSTA REGISTADA. A EQUIPA JÁ A PODE CONSULTAR NO CONTROL ROOM.</p>}

          <button type="submit" disabled={busy} className="flex min-h-12 items-center justify-center gap-2 border border-blood bg-blood px-4 py-3 font-mono text-[10px] tracking-[0.18em] text-primary-foreground hover:opacity-90 disabled:cursor-wait disabled:opacity-50">
            <Send size={14} /> {busy ? "A ENVIAR PROPOSTA..." : "ENVIAR PROPOSTA"}
          </button>
        </form>
      </div>
      <div className="hazard h-2" />
    </section>
  );
}
