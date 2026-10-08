import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ExternalLink, RefreshCw, TriangleAlert } from "lucide-react";
import { adminQuery, checkStorageBucket, getMediaBucket, publicQuery } from "@/lib/control-room-auth";
import { getFrequencyClock, getFrequencyListenerCount } from "@/lib/frequency-api";

const TABLES = [
  "artists","artist_releases","tapes","releases","camping_events","camping_sessions",
  "revelation_media","gallery_items","site_flags","artist_status","live_notifications","media_assets","merch_products","merch_variants","reservations",
  "site_settings","site_sections","drop_campaigns","members","frequency_station","frequency_listeners","frequency_badges",
] as const;

export const Route = createFileRoute("/control-room/sistema")({ component: System });

function System() {
  const [checks, setChecks] = useState<Record<string,{ok:boolean;error?:string}>>({});
  const [auditCount, setAuditCount] = useState<number | null>(null);
  const [adminCount, setAdminCount] = useState<number | null>(null);
  const [checking, setChecking] = useState(true);
  const [platform, setPlatform] = useState({ database: false, auth: false, media: false, site: false });
  const [frequencyInfo, setFrequencyInfo] = useState<{ startedAt: string | null; listeners: number; loaded: boolean }>({ startedAt: null, listeners: 0, loaded: false });

  const load = async () => {
    setChecking(true);
    const next: Record<string,{ok:boolean;error?:string}> = {};
    const platformNext = { database: false, auth: false, media: false, site: false };
    await Promise.all(TABLES.map(async table => {
      try {
        await publicQuery("/rest/v1/" + table + "?select=id&limit=1");
        next[table] = { ok: true };
      } catch (error) {
        next[table] = { ok:false, error:error instanceof Error ? error.message : "Falha" };
      }
    }));
    try {
      const rows = await adminQuery<Array<{id:string}>>("/rest/v1/audit_logs?select=id&limit=1000");
      setAuditCount(rows.length);
    } catch { setAuditCount(null); }
    try {
      const rows = await adminQuery<Array<{id:string}>>("/rest/v1/admin_profiles?select=id&limit=1000");
      setAdminCount(rows.length);
    } catch { setAdminCount(null); }
    platformNext.database = TABLES.some((table) => next[table]?.ok);
    try {
      await publicQuery("/auth/v1/settings");
      platformNext.auth = true;
    } catch {}
    try {
      const storage = await checkStorageBucket(getMediaBucket());
      platformNext.media = storage.ok && storage.public;
    } catch {}
    try {
      await publicQuery("/rest/v1/site_settings?select=id&limit=1");
      platformNext.site = true;
    } catch {}
    try {
      const [clock, listeners] = await Promise.all([getFrequencyClock(), getFrequencyListenerCount()]);
      setFrequencyInfo({ startedAt: clock?.station_started_at ?? null, listeners, loaded: Boolean(clock) });
    } catch {
      setFrequencyInfo({ startedAt: null, listeners: 0, loaded: false });
    }
    setChecks(next);
    setPlatform(platformNext);
    setChecking(false);
  };

  useEffect(() => { void load(); }, []);

  const connected = TABLES.filter(table => checks[table]?.ok).length;
  const failed = TABLES.filter(table => checks[table] && !checks[table].ok).length;

  return (
    <div>
      <header className="border-b border-white/10 pb-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">14 · SISTEMA</p>
            <h1 className="mt-2 font-gothic text-6xl leading-none md:text-8xl">HEALTH</h1>
            <p className="mt-3 max-w-3xl font-mono text-xs leading-6 text-white/45">
              Certificação operacional da ligação Control Room, Supabase e conteúdo público.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] text-white/50 hover:border-white/30 hover:text-white">
            <RefreshCw size={13} className={checking ? "animate-spin" : ""} /> ACTUALIZAR
          </button>
        </div>
      </header>

      <section className="mt-6 grid gap-px border border-white/10 bg-white/10 md:grid-cols-4">
        {[
          ["DATABASE", platform.database],
          ["AUTH", platform.auth],
          ["MEDIA", platform.media],
          ["SITE", platform.site],
        ].map(([label, ok]) => (
          <div key={String(label)} className="bg-[#0d0d0d] p-4">
            <p className="font-mono text-[9px] tracking-[0.18em] text-white/30">{String(label)}</p>
            <p className={ok ? "mt-2 font-mono text-sm text-[#d71920]" : "mt-2 font-mono text-sm text-white/25"}>{checking ? "CHECKING..." : ok ? "CONNECTED" : "ERROR"}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-px border border-white/10 bg-white/10 md:grid-cols-4">
        <Metric value={checking ? "--" : String(connected)+"/"+String(TABLES.length)} label="TABELAS LIGADAS" />
        <Metric value={checking ? "--" : String(failed)} label="FALHAS DE CONTEÚDO" alert={failed > 0} />
        <Metric value={auditCount === null ? "--" : String(auditCount)} label="REGISTOS DE ACTIVIDADE" />
        <Metric value={adminCount === null ? "--" : String(adminCount)} label="PERFIS ADMIN" />
      </section>

      <section className="mt-8 border border-white/10 bg-[#0d0d0d]">
        <div className="flex flex-col gap-2 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] text-[#d71920]">FREQUÊNCIA 808</p>
            <p className="mt-1 font-mono text-[10px] text-white/35">Estado operacional da estação e presença pública.</p>
          </div>
          <Link to="/frequencia" className="inline-flex min-h-11 items-center border border-white/10 px-3 font-mono text-[9px] tracking-[0.14em] text-white/50 hover:border-[#d71920] hover:text-white">
            ABRIR ESTAÇÃO
          </Link>
        </div>
        <div className="grid gap-px bg-white/10 md:grid-cols-3">
          <Metric value={frequencyInfo.loaded ? frequencyInfo.listeners.toString() : "--"} label="OUVINTES <45S" />
          <Metric value={frequencyInfo.startedAt ? new Date(frequencyInfo.startedAt).toLocaleString("pt-PT") : "--"} label="EMISSÃO INICIADA" />
          <Metric value={checks.frequency_badges?.ok ? "RPC/TABELA" : "PENDING"} label="BADGE MADRUGADA" />
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="border border-white/10 bg-[#0d0d0d]">
          <div className="border-b border-white/10 p-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[#d71920]">CONTENT API → SITE</p>
          </div>
          <div className="divide-y divide-white/10">
            {TABLES.map(table => (
              <div key={table} className="flex items-center justify-between gap-4 px-4 py-3 font-mono text-[10px]">
                <span className="text-white/55">{table}</span>
                {checks[table]?.ok ? (
                  <span className="inline-flex items-center gap-2 text-[#d71920]"><Check size={12} /> CONNECTED</span>
                ) : checks[table] ? (
                  <span className="inline-flex items-center gap-2 text-[#d71920]"><TriangleAlert size={12} /> ERROR</span>
                ) : (
                  <span className="text-white/20">CHECKING...</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="border border-white/10 bg-[#0d0d0d]">
          <div className="border-b border-white/10 p-4">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[#d71920]">CERTIFICAÇÃO</p>
          </div>
          <div className="grid gap-2 p-4">
            <Cert label="FRONTEND → SUPABASE" ok={connected > 0} />
            <Cert label="ARTISTAS → SITE" ok={checks.artists?.ok && checks.artist_releases?.ok} />
            <Cert label="MÚSICA → SITE" ok={checks.tapes?.ok && checks.releases?.ok} />
            <Cert label="CAMPING → SITE" ok={checks.camping_events?.ok} />
            <Cert label="REVELAÇÃO → SITE" ok={checks.gallery_items?.ok || checks.revelation_media?.ok} />
            <Cert label="CAMPING → LIVE" ok={checks.site_flags?.ok && checks.artist_status?.ok} />
            <Cert label="MERCH → SITE" ok={checks.merch_products?.ok && checks.merch_variants?.ok && checks.reservations?.ok} />
            <Cert label="SITE SETTINGS → SITE" ok={checks.site_settings?.ok && checks.site_sections?.ok} />
            <Cert label="DROP → COUNTDOWN" ok={checks.drop_campaigns?.ok} />
            <Cert label="FREQUÊNCIA 808 → STATION" ok={checks.frequency_station?.ok && checks.frequency_listeners?.ok} />
            <Cert label="AUDIT LOG TABLE" ok={auditCount !== null} />
          </div>
          <div className="border-t border-white/10 p-4">
            <Link to="/control-room/actividade" className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] tracking-[0.14em] text-white/50 hover:border-[#d71920] hover:text-white">
              ABRIR ACTIVIDADE <ExternalLink size={12} />
            </Link>
          </div>
        </section>
      </div>

      {auditCount === 0 && (
        <div className="mt-6 border border-[#d71920]/40 bg-[#d71920]/5 p-4 font-mono text-[10px] leading-6 text-white/55">
          A tabela de actividade está acessível mas não há registos. Isto não prova que os triggers de auditoria estejam activos. A migration de triggers continua no repositório para aplicação no Supabase. O armazenamento central também depende da migration de storage quando o bucket ainda não existir.
        </div>
      )}
    </div>
  );
}

function Metric({ value, label, alert = false }: { value:string; label:string; alert?:boolean }) {
  return <div className="bg-[#0d0d0d] p-5"><div className={`font-mono text-3xl font-bold ${alert ? "text-[#d71920]" : "text-white"}`}>{value}</div><p className="mt-2 font-mono text-[8px] tracking-[0.18em] text-white/30">{label}</p></div>;
}

function Cert({ label, ok = false }: { label:string; ok?:boolean }) {
  return <div className="flex items-center justify-between border border-white/10 px-3 py-2 font-mono text-[9px]"><span className="text-white/45">{label}</span><span className={ok ? "text-[#d71920]" : "text-white/20"}>{ok ? "OK" : "PENDING"}</span></div>;
}
