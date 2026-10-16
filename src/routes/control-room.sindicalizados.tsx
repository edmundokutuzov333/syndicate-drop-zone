import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ShieldCheck } from "lucide-react";
import { adminQuery } from "@/lib/control-room-auth";

type MemberRow = {
  id: string;
  code: string;
  member_number: number;
  alias: string;
  contact_type: "whatsapp" | "email";
  contact_value: string;
  referred_by_member_id: string | null;
  statute_version: string;
  signature_present: boolean;
  status: "active" | "suspended" | "revoked";
  since: string;
};

export const Route = createFileRoute("/control-room/sindicalizados")({
  component: MembersAdmin,
});

function MembersAdmin() {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminQuery<MemberRow[]>(
        "/rest/v1/members?select=id,code,member_number,alias,contact_type,contact_value,referred_by_member_id,statute_version,signature_present,status,since&order=member_number.desc",
      );
      setRows(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar os sindicalizados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      [row.alias, row.code, row.contact_value, row.contact_type].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [query, rows]);

  return (
    <div>
      <header className="border-b border-white/10 pb-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">15 · SINDICALIZADOS</p>
            <h1 className="mt-2 font-gothic text-6xl leading-none md:text-8xl">CARTEIRAS</h1>
            <p className="mt-3 max-w-3xl font-mono text-xs leading-6 text-white/45">
              Registo administrativo real. Contactos permanecem apenas no Control Room.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] text-white/50 hover:border-white/30 hover:text-white">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> ACTUALIZAR
          </button>
        </div>
      </header>

      <section className="mt-6 border border-white/10 bg-[#0d0d0d] p-4">
        <div className="flex items-center gap-3 border border-white/10 px-3 py-3">
          <Search size={14} className="text-white/25" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="codinome, código, contacto..."
            className="min-w-0 flex-1 bg-transparent font-mono text-xs text-white outline-none placeholder:text-white/20"
          />
        </div>
      </section>

      {error && <div className="mt-4 border border-[#d71920]/40 bg-[#d71920]/5 p-4 font-mono text-[10px] leading-6 text-white/55">{error}</div>}

      <section className="mt-6 border border-white/10 bg-[#0d0d0d]">
        <div className="grid grid-cols-[70px_1fr_160px_190px_130px] gap-4 border-b border-white/10 px-4 py-3 font-mono text-[8px] tracking-[0.16em] text-white/25 max-md:hidden">
          <span>Nº</span><span>CODINOME</span><span>CÓDIGO</span><span>CONTACTO</span><span>ESTADO</span>
        </div>
        <div className="divide-y divide-white/10">
          {filtered.map((row) => (
            <div key={row.id} className="grid gap-3 px-4 py-4 md:grid-cols-[70px_1fr_160px_190px_130px] md:items-center">
              <span className="font-mono text-xs text-[#d71920]">{String(row.member_number).padStart(4, "0")}</span>
              <span className="font-gothic text-2xl text-white">{row.alias}</span>
              <span className="font-mono text-[10px] text-white/55">{row.code}</span>
              <span className="font-mono text-[10px] text-white/45">{row.contact_type.toUpperCase()} · {row.contact_value}</span>
              <span className="inline-flex items-center gap-2 font-mono text-[9px] text-white/45"><ShieldCheck size={13} className="text-[#d71920]" /> {row.status.toUpperCase()}</span>
            </div>
          ))}
          {!loading && !filtered.length && <div className="p-10 font-mono text-xs text-white/25">SEM RESULTADOS.</div>}
          {loading && <div className="p-10 font-mono text-xs text-white/25">A LER O SISTEMA...</div>}
        </div>
      </section>
    </div>
  );
}
