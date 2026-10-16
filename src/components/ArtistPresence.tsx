import { useEffect, useMemo, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { getLiveArtistPresence, type ArtistPresenceRow } from "@/lib/camping-data";
import { getPublicSupabaseConfig } from "@/lib/supabase-public";
import { cn } from "@/lib/utils";
import { hiss } from "@/lib/sfx";

const STATUS = ["ATIVO", "ISOLADO", "VIGIADO", "DESAPARECIDO"] as const;

function statusLabel(value: string | undefined) {
  const normalized = String(value ?? "").toUpperCase();
  return STATUS.includes(normalized as (typeof STATUS)[number]) ? normalized : "ATIVO";
}

export function ArtistPresence() {
  const [rows, setRows] = useState<ArtistPresenceRow[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getLiveArtistPresence().then((next) => {
      if (!mounted) return;
      setRows(next);
      setReady(true);
    });

    let client: ReturnType<typeof createClient> | null = null;
    let channel: RealtimeChannel | null = null;

    try {
      const { url, key } = getPublicSupabaseConfig();
      client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 10 } },
      });
      channel = client
        .channel("camping-artist-status")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "artist_status" },
          () => {
            void getLiveArtistPresence().then((next) => {
              if (!mounted) return;
              setRows(next);
              hiss(0.08);
            });
          },
        )
        .subscribe();
    } catch {
      channel = null;
    }

    const poll = window.setInterval(() => {
      void getLiveArtistPresence().then((next) => {
        if (!mounted) return;
        setRows((current) => {
          const a = JSON.stringify(current);
          const b = JSON.stringify(next);
          return a === b ? current : next;
        });
      });
    }, 12000);

    return () => {
      mounted = false;
      window.clearInterval(poll);
      if (channel && client) void client.removeChannel(channel);
    };
  }, []);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const row of rows) result[statusLabel(row.status)] = (result[statusLabel(row.status)] ?? 0) + 1;
    return result;
  }, [rows]);

  return (
    <section className="border border-border bg-card">
      <div className="flex items-end justify-between gap-4 border-b border-border p-4">
        <div>
          <p className="font-mono text-[9px] tracking-[0.2em] text-blood">PRESENÇA</p>
          <h2 className="mt-1 font-gothic text-4xl">QUEM ESTÁ NA SALA</h2>
        </div>
        <div className="text-right font-mono text-[8px] text-muted-foreground">
          {Object.entries(counts).map(([label, count]) => (
            <div key={label}>{label} {String(count).padStart(2, "0")}</div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((row) => {
          const status = statusLabel(row.status);
          return (
            <article key={row.artistId} className="bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    status === "ATIVO" && "bg-green-500",
                    status === "ISOLADO" && "bg-amber-500",
                    status === "VIGIADO" && "bg-blue-400",
                    status === "DESAPARECIDO" && "bg-blood",
                  )}
                  aria-hidden
                />
                <span className="truncate font-mono text-[8px] text-muted-foreground">{status}</span>
              </div>
              <p className="mt-4 font-gothic text-2xl leading-none">{row.name}</p>
              <p className="mt-1 font-mono text-[7px] tracking-[0.12em] text-muted-foreground">{row.code}</p>
            </article>
          );
        })}
      </div>

      {!ready && <div className="p-4 font-mono text-[9px] text-muted-foreground">A LIGAR PRESENÇA...</div>}
      {ready && rows.length === 0 && (
        <div role="status" className="border-t border-border p-4 font-mono text-[9px] leading-5 text-muted-foreground">
          SEM DADOS DE PRESENÇA DISPONÍVEIS. A PRESENÇA NÃO FOI SIMULADA.
        </div>
      )}
    </section>
  );
}
