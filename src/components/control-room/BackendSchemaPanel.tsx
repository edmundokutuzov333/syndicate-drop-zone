import { useEffect, useState } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { getControlRoomSession, isPublicPreviewSession } from "@/lib/control-room-auth";
import {
  auditBackendSchema,
  BACKEND_TABLES,
  READ_ONLY_RPCS,
  summarizeProbes,
  type ProbeResult,
} from "@/lib/backend-schema-contract";

function label(result?: ProbeResult, access?: string) {
  if (access === "rpc-only") return "RPC ONLY / SEM ACESSO DIRECTO";
  if (!result) return "A VERIFICAR";
  if (result.status === "present") return "ACESSÍVEL";
  if (result.status === "missing") return "AUSENTE";
  if (result.status === "restricted") return "RESTRITO / NÃO CONFIRMADO";
  return "ERRO DE LIGAÇÃO";
}

function tone(result?: ProbeResult) {
  if (result?.status === "present") return "text-[#d71920]";
  if (result?.status === "missing" || result?.status === "error") return "text-[#d71920]";
  return "text-white/40";
}

export function BackendSchemaPanel() {
  const [tables, setTables] = useState<Record<string, ProbeResult>>({});
  const [rpcs, setRpcs] = useState<Record<string, ProbeResult>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const session = await getControlRoomSession().catch(() => null);
      const authenticated = Boolean(session && !isPublicPreviewSession(session) && session.accessToken);
      const audit = await auditBackendSchema({ accessToken: authenticated ? session?.accessToken : undefined });
      setTables(Object.fromEntries(audit.tables.map((item) => [item.name, item])));
      setRpcs(Object.fromEntries(audit.rpcs.map((item) => [item.name, item])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar o schema.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const directTables = BACKEND_TABLES.filter((item) => item.access !== "rpc-only");
  const tableResults = directTables.map((item) => tables[item.name]).filter((item): item is ProbeResult => Boolean(item));
  const summary = summarizeProbes(tableResults);
  const rpcResults = READ_ONLY_RPCS.map((item) => rpcs[item.name]).filter((item): item is ProbeResult => Boolean(item));
  const rpcSummary = summarizeProbes(rpcResults);

  return (
    <section className="mt-8 border border-[#d71920]/50 bg-[#0d0d0d]">
      <header className="flex flex-col justify-between gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-[9px] tracking-[0.22em] text-[#d71920]">FASE 5 · BACKEND CONTRACT</p>
          <h2 className="mt-1 font-gothic text-3xl">SCHEMA / CONTROL ROOM</h2>
          <p className="mt-2 max-w-3xl font-mono text-[9px] leading-5 text-white/40">Verificação de leitura. Não cria, altera ou elimina dados. Endpoints restritos não são classificados como ausentes.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/10 px-3 font-mono text-[9px] text-white/60 hover:border-[#d71920] disabled:opacity-40">
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> VERIFICAR
        </button>
      </header>
      <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        <Metric value={busy ? "--" : summary.present + "/" + directTables.length} label="ENDPOINTS ACESSÍVEIS" />
        <Metric value={busy ? "--" : String(summary.missing)} label="AUSENTES" alert={summary.missing > 0} />
        <Metric value={busy ? "--" : String(summary.restricted)} label="RESTRITOS / NÃO VERIFICADOS" alert={summary.restricted > 0} />
        <Metric value={busy ? "--" : rpcSummary.present + "/" + READ_ONLY_RPCS.length} label="RPCs DE LEITURA" />
      </div>
      {error && <p className="border-b border-white/10 p-4 font-mono text-[10px] text-[#d71920]">{error}</p>}
      <div className="grid gap-6 p-4 xl:grid-cols-2">
        <div>
          <h3 className="mb-3 font-mono text-[9px] tracking-[0.2em] text-white/45">TABELAS E VISTAS</h3>
          <div className="divide-y divide-white/10 border border-white/10">
            {BACKEND_TABLES.map((entry) => {
              const result = tables[entry.name];
              return <div key={entry.name} className="flex items-start justify-between gap-3 px-3 py-2.5 font-mono text-[9px]">
                <div><p className="text-white/65">{entry.name}</p><p className="mt-1 text-[8px] text-white/25">{entry.area} · {entry.access.toUpperCase()}</p></div>
                <span className={tone(result)}>{label(result, entry.access)}</span>
              </div>;
            })}
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-mono text-[9px] tracking-[0.2em] text-white/45">RPCs SÓ DE LEITURA</h3>
          <div className="divide-y divide-white/10 border border-white/10">
            {READ_ONLY_RPCS.map((entry) => {
              const result = rpcs[entry.name];
              return <div key={entry.name} className="flex items-start justify-between gap-3 px-3 py-2.5 font-mono text-[9px]">
                <div><p className="text-white/65">{entry.name}</p><p className="mt-1 text-[8px] text-white/25">{entry.area}</p></div>
                <span className={tone(result)}>{label(result)}</span>
              </div>;
            })}
          </div>
        </div>
      </div>
      <footer className="border-t border-white/10 p-4 font-mono text-[9px] leading-5 text-white/35">
        <p>ACESSÍVEL significa que a chamada de leitura foi aceite. AUSENTE significa que o endpoint não está exposto ou não existe. RESTRITO não prova ausência. A verificação usa leituras com zero linhas para tabelas e RPCs de leitura.</p>
        {(summary.missing > 0 || summary.restricted > 0 || summary.errors > 0) && <p className="mt-2 inline-flex items-start gap-2 text-[#d71920]"><TriangleAlert size={13} className="mt-0.5 shrink-0" />A certificação não está completa enquanto existirem dependências ausentes, erros ou acessos ainda não verificados com uma sessão autorizada.</p>}
      </footer>
    </section>
  );
}

function Metric({ value, label, alert = false }: { value: string; label: string; alert?: boolean }) {
  return <div className="bg-[#0d0d0d] p-4"><p className={`font-mono text-2xl font-bold ${alert ? "text-[#d71920]" : "text-white"}`}>{value}</p><p className="mt-2 font-mono text-[8px] tracking-[0.14em] text-white/30">{label}</p></div>;
}
