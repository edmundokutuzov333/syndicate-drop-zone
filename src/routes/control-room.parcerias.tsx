import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, MessageSquare, RefreshCw } from "lucide-react";
import { adminQuery, type ControlRoomRole, getControlRoomSession } from "@/lib/control-room-auth";

type Partnership = {
  id: string;
  created_at: string;
  name: string;
  company: string;
  contact: string;
  partnership_type: string;
  budget: string;
  message: string;
  status: "new" | "analysis" | "contacted" | "negotiation" | "accepted" | "rejected" | "closed";
  notes: string;
  priority: boolean;
  follow_up_at: string | null;
};

const STATUSES: Partnership["status"][] = ["new", "analysis", "contacted", "negotiation", "accepted", "rejected", "closed"];

export const Route = createFileRoute("/control-room/parcerias")({
  component: ControlRoomPartnerships,
});

function ControlRoomPartnerships() {
  const [rows, setRows] = useState<Partnership[]>([]);
  const [selected, setSelected] = useState<Partnership | null>(null);
  const [role, setRole] = useState<ControlRoomRole | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [data, session] = await Promise.all([
        adminQuery<Partnership[]>("/rest/v1/partnership_requests?select=*&order=created_at.desc"),
        getControlRoomSession(),
      ]);
      setRows(data);
      setRole(session?.role ?? null);
      setSelected((current) => current ? data.find((row) => row.id === current.id) ?? null : data[0] ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const canEdit = role === "OWNER" || role === "ADMIN" || role === "PARTNERSHIPS";
  const fresh = rows.filter((row) => row.status === "new").length;

  return (
    <div>
      <header className="border-b border-white/10 pb-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">08 · PARCERIAS</p>
            <h1 className="mt-2 font-gothic text-6xl leading-none">INBOX</h1>
            <p className="mt-3 max-w-2xl font-mono text-xs leading-6 text-white/45">
              CRM operacional das propostas recebidas no site. O formulário público já grava directamente em Supabase.
            </p>
          </div>
          <button type="button" onClick={() => load()} className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] text-white/45 hover:border-white/30 hover:text-white">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> ACTUALIZAR
          </button>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-3 gap-px border border-white/10 bg-white/10 md:max-w-xl">
        {[
          [fresh, "NOVAS"],
          [rows.filter((row) => row.status === "negotiation").length, "NEGOCIAÇÃO"],
          [rows.filter((row) => row.status === "accepted").length, "ACEITES"],
        ].map(([value, label]) => (
          <div key={label} className="bg-[#0d0d0d] p-4">
            <div className="font-mono text-3xl font-bold">{value}</div>
            <div className="mt-1 font-mono text-[9px] tracking-[0.16em] text-white/35">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="border border-white/10 bg-[#0d0d0d]">
          <div className="divide-y divide-white/10">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelected(row)}
                className={`w-full border-l-2 p-4 text-left transition ${selected?.id === row.id ? "border-[#d71920] bg-[#d71920]/5" : "border-transparent hover:bg-white/[0.02]"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[9px] tracking-[0.18em] text-[#d71920]">{row.partnership_type}</p>
                    <h2 className="mt-1 font-gothic text-3xl">{row.company}</h2>
                    <p className="mt-1 font-mono text-[10px] text-white/35">{row.name} · {new Date(row.created_at).toLocaleDateString("pt-PT")}</p>
                  </div>
                  {row.priority && <span className="font-mono text-[9px] text-[#d71920]">PRIORIDADE</span>}
                </div>
                <div className="mt-3 flex items-center gap-2 font-mono text-[9px] text-white/35">
                  <span>{row.status.toUpperCase()}</span>
                  <span>·</span>
                  <span>{row.budget}</span>
                </div>
              </button>
            ))}
            {!rows.length && <div className="p-8 font-mono text-xs text-white/35">SEM PROPOSTAS.</div>}
          </div>
        </section>

        {selected ? (
          <ProposalEditor key={selected.id} row={selected} canEdit={canEdit} onSaved={load} />
        ) : (
          <div className="grid min-h-80 place-items-center border border-dashed border-white/10 bg-[#0d0d0d] font-mono text-xs text-white/25">SELECT PROPOSAL</div>
        )}
      </div>
    </div>
  );
}

function ProposalEditor({ row, canEdit, onSaved }: { row: Partnership; canEdit: boolean; onSaved: () => Promise<void> | void }) {
  const [status, setStatus] = useState(row.status);
  const [notes, setNotes] = useState(row.notes);
  const [priority, setPriority] = useState(row.priority);
  const [followUp, setFollowUp] = useState(row.follow_up_at ? row.follow_up_at.slice(0, 16) : "");
  const [message, setMessage] = useState("");

  const save = async () => {
    if (!canEdit) return;
    setMessage("A GUARDAR...");
    await adminQuery("/rest/v1/partnership_requests?id=eq." + encodeURIComponent(row.id), {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status,
        notes,
        priority,
        follow_up_at: followUp ? new Date(followUp).toISOString() : null,
      }),
    });
    setMessage("GUARDADO");
    await onSaved();
    window.setTimeout(() => setMessage(""), 1800);
  };

  return (
    <section className="border border-white/10 bg-[#0d0d0d]">
      <div className="border-b border-white/10 p-5">
        <p className="font-mono text-[9px] tracking-[0.24em] text-[#d71920]">PROPOSTA</p>
        <h2 className="mt-1 font-gothic text-5xl">{row.company}</h2>
      </div>

      <div className="grid gap-5 p-5">
        <div className="grid gap-3 border border-white/10 p-4 font-mono text-xs">
          <Row label="NOME" value={row.name} />
          <Row label="EMPRESA" value={row.company} />
          <Row label="CONTACTO" value={row.contact} />
          <Row label="TIPO" value={row.partnership_type} />
          <Row label="ORÇAMENTO" value={row.budget} />
        </div>

        <div className="border border-white/10 p-4">
          <p className="font-mono text-[9px] tracking-[0.18em] text-[#d71920]">MENSAGEM</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/70">{row.message}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 font-mono text-[9px] tracking-[0.18em] text-white/35">
            STATUS
            <select
              value={status}
              disabled={!canEdit}
              onChange={(e) => setStatus(e.target.value as Partnership["status"])}
              className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[#d71920]"
            >
              {STATUSES.map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
            </select>
          </label>
          <label className="grid gap-2 font-mono text-[9px] tracking-[0.18em] text-white/35">
            PRÓXIMO FOLLOW-UP
            <input
              type="datetime-local"
              value={followUp}
              disabled={!canEdit}
              onChange={(e) => setFollowUp(e.target.value)}
              className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[#d71920]"
            />
          </label>
        </div>

        <label className="flex items-center gap-3 border border-white/10 p-4 font-mono text-[10px] text-white/55">
          <input type="checkbox" checked={priority} disabled={!canEdit} onChange={(e) => setPriority(e.target.checked)} />
          MARCAR COMO PRIORIDADE
        </label>

        <label className="grid gap-2 font-mono text-[9px] tracking-[0.18em] text-white/35">
          NOTAS INTERNAS
          <textarea value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} rows={5} className="resize-y border border-white/10 bg-[#090909] px-3 py-3 text-sm text-white outline-none focus:border-[#d71920]" />
        </label>

        {canEdit && (
          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <span className="font-mono text-[9px] text-[#d71920]">{message}</span>
            <button type="button" onClick={() => save().catch((error) => setMessage(error instanceof Error ? error.message : "ERRO"))} className="inline-flex items-center gap-2 border border-[#d71920] bg-[#d71920] px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-white">
              <Check size={14} /> GUARDAR ALTERAÇÕES
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[110px_1fr] gap-4 border-b border-white/5 pb-2 last:border-0 last:pb-0"><span className="text-white/30">{label}</span><span className="text-white/75">{value}</span></div>;
}
