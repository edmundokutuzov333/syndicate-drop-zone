import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { adminQuery } from "@/lib/control-room-auth";

type CountResponse = Array<{ id: string }>;

const MODULES = [
  ["HUB", "ONLINE"],
  ["ARTISTAS", "ONLINE"],
  ["CAMPING", "ONLINE"],
  ["REVELAÇÃO", "ONLINE"],
  ["MERCH", "ONLINE"],
  ["PARCERIAS", "ONLINE"],
] as const;

export const Route = createFileRoute("/control-room/")({
  component: ControlRoomOverview,
});

function ControlRoomOverview() {
  const [counts, setCounts] = useState({
    artists: 0,
    tapes: 0,
    releases: 0,
    media: 0,
    partnerships: 0,
    stock: 0,
  });

  useEffect(() => {
    Promise.all([
      adminQuery<CountResponse>("/rest/v1/artists?select=id"),
      adminQuery<CountResponse>("/rest/v1/tapes?select=id"),
      adminQuery<CountResponse>("/rest/v1/artist_releases?select=id"),
      adminQuery<CountResponse>("/rest/v1/media_assets?select=id"),
      adminQuery<CountResponse>("/rest/v1/partnership_requests?select=id"),
      adminQuery<Array<{ stock_total: number; stock_reserved: number; stock_sold: number }>>(
        "/rest/v1/merch_variants?select=stock_total,stock_reserved,stock_sold",
      ),
    ])
      .then(([artists, tapes, releases, media, partnerships, stock]) => {
        setCounts({
          artists: artists.length,
          tapes: tapes.length,
          releases,
          media: media.length,
          partnerships: partnerships.length,
          stock: stock.reduce(
            (sum, row) => sum + Math.max(0, Number(row.stock_total) - Number(row.stock_reserved) - Number(row.stock_sold)),
            0,
          ),
        });
      })
      .catch(() => undefined);
  }, []);

  const stats = [
    ["17", "ARTISTAS", counts.artists],
    ["04", "TAPES", counts.tapes],
    [String(counts.releases).padStart(2, "0"), "LANÇAMENTOS", counts.releases],
    [String(counts.media).padStart(2, "0"), "MEDIA", counts.media],
    [String(counts.partnerships).padStart(2, "0"), "PROPOSTAS", counts.partnerships],
    [String(counts.stock).padStart(2, "0"), "UNIDADES", counts.stock],
  ];

  return (
    <div>
      <div className="border-b border-white/10 pb-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">SINDICATO CONTROL ROOM</p>
            <h1 className="mt-2 font-gothic text-6xl leading-none md:text-8xl">OVERVIEW</h1>
            <p className="mt-3 max-w-2xl font-mono text-xs leading-6 text-white/45">
              Central de controlo editorial e operacional. Sem page builder. Cada módulo corresponde a uma operação real da plataforma.
            </p>
          </div>
          <div className="font-mono text-[10px] text-white/45 md:text-right">
            <p>STATUS: <span className="text-[#d71920]">ONLINE</span></p>
            <p className="mt-1">BASE: <span className="text-white">SUPABASE</span></p>
          </div>
        </div>
      </div>

      <section className="mt-8 grid grid-cols-2 gap-px border border-white/10 bg-white/10 md:grid-cols-3 xl:grid-cols-6">
        {stats.map(([value, label]) => (
          <div key={label} className="bg-[#0d0d0d] p-5">
            <div className="font-mono text-4xl font-bold tabular-nums text-white">{value}</div>
            <div className="mt-2 font-mono text-[9px] tracking-[0.2em] text-white/35">{label}</div>
          </div>
        ))}
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="border border-white/10 bg-[#0d0d0d]">
          <div className="border-b border-white/10 p-4">
            <p className="font-mono text-[10px] tracking-[0.24em] text-[#d71920]">ESTADO DO SITE</p>
          </div>
          <div className="divide-y divide-white/10">
            {MODULES.map(([label, status]) => (
              <div key={label} className="flex items-center justify-between px-4 py-4 font-mono text-[10px]">
                <span className="text-white/55">{label}</span>
                <span className="text-[#d71920]">● {status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-[#0d0d0d]">
          <div className="border-b border-white/10 p-4">
            <p className="font-mono text-[10px] tracking-[0.24em] text-[#d71920]">ACÇÕES RÁPIDAS</p>
          </div>
          <div className="grid gap-2 p-4">
            <QuickLink label="+ NOVO ARTISTA" href="/control-room/artistas" />
            <QuickLink label="+ NOVA TAPE" href="/control-room/musica" />
            <QuickLink label="+ ADICIONAR MEDIA" href="/control-room/media" />
            <QuickLink label="+ NOVA PUBLICAÇÃO" href="/control-room/seo" />
          </div>
        </div>
      </section>
    </div>
  );
}

function QuickLink({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} className="border border-white/10 px-4 py-3 font-mono text-[10px] tracking-[0.14em] text-white/65 transition hover:border-[#d71920] hover:text-white">
      {label} →
    </a>
  );
}
