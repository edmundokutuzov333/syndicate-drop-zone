import { useEffect, useState } from "react";
import { adminQuery } from "@/lib/control-room-auth";

export const MODULE_CONFIG: Record<string, { code: string; title: string; eyebrow: string; description: string; tables: string[] }> = {
  musica: { code: "03", title: "MÚSICA", eyebrow: "TAPES + RELEASES", description: "Conteúdo musical centralizado no banco para deixar de depender dos ficheiros de dados.", tables: ["tapes", "releases", "artist_releases"] },
  camping: { code: "04", title: "CAMPING", eyebrow: "EVENTOS + SESSÕES", description: "Timeline e sessões do camping com estado editorial.", tables: ["camping_events", "camping_sessions"] },
  revelacao: { code: "05", title: "REVELAÇÃO", eyebrow: "SALA DE REVELAÇÃO", description: "Media publicada e slots preparados para a operação de revelação.", tables: ["revelation_media"] },
  media: { code: "06", title: "MEDIA", eyebrow: "MEDIA LIBRARY", description: "Biblioteca central de assets. A origem pode ser ligada a artistas, revelação, camping, merch e press.", tables: ["media_assets"] },
  merch: { code: "07", title: "MERCH", eyebrow: "PRODUTOS + STOCK", description: "Produtos, variantes e inventário preparados para operação real.", tables: ["merch_products", "merch_variants", "inventory_movements", "reservations"] },
  site: { code: "09", title: "SITE", eyebrow: "SITE SETTINGS", description: "Definições editoriais e secções previstas do site, sem page builder genérico.", tables: ["site_settings", "site_sections"] },
  drop: { code: "10", title: "DROP", eyebrow: "DROP CAMPAIGN", description: "Campanha operacional de lançamento com estado e countdown.", tables: ["drop_campaigns"] },
  seo: { code: "11", title: "SEO & SOCIAL", eyebrow: "METADATA", description: "Central de SEO, redes sociais e previews públicos.", tables: ["site_settings"] },
  utilizadores: { code: "12", title: "UTILIZADORES", eyebrow: "RBAC", description: "Perfis do Control Room. Roles aplicadas através de Supabase Auth + RLS.", tables: ["admin_profiles"] },
  actividade: { code: "13", title: "ACTIVIDADE", eyebrow: "AUDIT LOG", description: "Histórico operacional de alterações, para saber quem fez o quê.", tables: ["audit_logs"] },
  sistema: { code: "14", title: "SISTEMA", eyebrow: "HEALTH", description: "Estado do backend, conteúdo e infraestrutura do Control Room.", tables: ["admin_profiles", "artists", "partnership_requests"] },
};

export function ControlRoomModule({ module }: { module: keyof typeof MODULE_CONFIG }) {
  const config = MODULE_CONFIG[module];
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all(
      config.tables.map(async (table) => {
        try {
          const rows = await adminQuery<Array<{ id?: string; user_id?: string }>>("/rest/v1/" + table + "?select=id");
          return [table, rows.length] as const;
        } catch {
          return [table, -1] as const;
        }
      }),
    ).then((entries) => setCounts(Object.fromEntries(entries)));
  }, [config.tables]);

  return (
    <div>
      <header className="border-b border-white/10 pb-6">
        <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">{config.code} · {config.eyebrow}</p>
        <h1 className="mt-2 font-gothic text-6xl leading-none md:text-8xl">{config.title}</h1>
        <p className="mt-3 max-w-2xl font-mono text-xs leading-6 text-white/45">{config.description}</p>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {config.tables.map((table) => (
          <div key={table} className="border border-white/10 bg-[#0d0d0d] p-5">
            <div className="font-mono text-[9px] tracking-[0.18em] text-white/30">{table.toUpperCase()}</div>
            <div className="mt-3 flex items-end justify-between">
              <span className="font-mono text-4xl font-bold">{counts[table] === undefined ? "--" : counts[table] < 0 ? "ERR" : counts[table]}</span>
              <span className="font-mono text-[9px] text-[#d71920]">{counts[table] === undefined ? "CHECKING" : counts[table] < 0 ? "ERROR" : "CONNECTED"}</span>
            </div>
          </div>
        ))}
      </section>

      <div className="mt-8 border border-dashed border-white/10 bg-[#0d0d0d] p-6">
        <p className="font-mono text-[10px] tracking-[0.22em] text-[#d71920]">MÓDULO BASE</p>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-white/50">
          Este módulo já está ligado à camada de dados real. A interface operacional específica de edição, preview e publicação será acoplada a estas tabelas sem reintroduzir conteúdo hardcoded no frontend.
        </p>
      </div>
    </div>
  );
}
