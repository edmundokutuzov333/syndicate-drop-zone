import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, RefreshCw, TriangleAlert } from "lucide-react";
import { adminQuery } from "@/lib/control-room-auth";

type ArtistRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  spotify_artist_id: string | null;
};

type ReleaseRow = {
  artist_id: string;
  status: string;
  position: number;
  youtube_id: string | null;
};

type PartnershipRow = {
  id: string;
  company: string;
  name: string;
  partnership_type: string;
  status: string;
  created_at: string;
};

type VariantRow = {
  stock_total: number | null;
  stock_reserved: number | null;
  stock_sold: number | null;
};

const MODULES = [
  ["HUB", "/control-room"],
  ["ARTISTAS", "/control-room/artistas"],
  ["MÚSICA", "/control-room/musica"],
  ["CAMPING", "/control-room/camping"],
  ["REVELAÇÃO", "/control-room/revelacao"],
  ["MEDIA", "/control-room/media"],
  ["MERCH", "/control-room/merch"],
  ["PARCERIAS", "/control-room/parcerias"],
  ["SINDICALIZADOS", "/control-room/sindicalizados"],
] as const;

export const Route = createFileRoute("/control-room/")({
  component: ControlRoomOverview,
});

function ControlRoomOverview() {
  const [data, setData] = useState({
    artists: [] as ArtistRow[],
    releases: [] as ReleaseRow[],
    partnerships: [] as PartnershipRow[],
    variants: [] as VariantRow[],
    tapes: 0,
    media: 0,
    members: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [artists, releases, tapes, media, partnerships, variants, members] = await Promise.all([
        adminQuery<ArtistRow[]>("/rest/v1/artists?select=id,name,code,status,spotify_artist_id&order=code.asc"),
        adminQuery<ReleaseRow[]>("/rest/v1/artist_releases?select=artist_id,status,position,youtube_id&order=artist_id.asc,position.asc"),
        adminQuery<Array<{ id: string }>>("/rest/v1/tapes?select=id"),
        adminQuery<Array<{ id: string }>>("/rest/v1/media_assets?select=id"),
        adminQuery<PartnershipRow[]>("/rest/v1/partnership_requests?select=id,company,name,partnership_type,status,created_at&order=created_at.desc&limit=6"),
        adminQuery<VariantRow[]>("/rest/v1/merch_variants?select=stock_total,stock_reserved,stock_sold"),
        adminQuery<Array<{ id: string }>>("/rest/v1/members?select=id").catch(() => [] as Array<{ id: string }>),
      ]);

      setData({
        artists,
        releases,
        tapes: tapes.length,
        media: media.length,
        partnerships,
        variants,
        members: members.length,
      });
      setLastSync(new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível actualizar o overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const publishedArtists = data.artists.filter((artist) => artist.status === "published").length;
  const readyArtists = data.artists.filter((artist) => artist.status === "ready").length;
  const draftArtists = data.artists.filter((artist) => artist.status === "draft").length;
  const publishedReleases = data.releases.filter((release) => release.status === "published").length;
  const freshProposals = data.partnerships.filter((row) => row.status === "new").length;
  const negotiationProposals = data.partnerships.filter((row) => row.status === "negotiation").length;

  const incompleteArtists = useMemo(() => {
    return data.artists.filter((artist) => {
      const releaseCount = data.releases.filter((release) => release.artist_id === artist.id && release.status === "published" && release.youtube_id).length;
      return !artist.spotify_artist_id || releaseCount < 3;
    });
  }, [data.artists, data.releases]);

  const stockAvailable = data.variants.reduce(
    (sum, row) => sum + Math.max(0, Number(row.stock_total ?? 0) - Number(row.stock_reserved ?? 0) - Number(row.stock_sold ?? 0)),
    0,
  );

  const stats = [
    [String(data.artists.length).padStart(2, "0"), "ARTISTAS", "/control-room/artistas"],
    [String(data.tapes).padStart(2, "0"), "TAPES", "/control-room/musica"],
    [String(data.releases.length).padStart(2, "0"), "LANÇAMENTOS", "/control-room/musica"],
    [String(data.media).padStart(2, "0"), "MEDIA", "/control-room/media"],
    [String(data.partnerships.length).padStart(2, "0"), "PROPOSTAS", "/control-room/parcerias"],
    [String(stockAvailable).padStart(2, "0"), "UNIDADES", "/control-room/merch"],
    [String(data.members).padStart(2, "0"), "SINDICALIZADOS", "/control-room/sindicalizados"],
  ] as const;

  return (
    <div>
      <div className="border-b border-white/10 pb-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">SINDICATO CONTROL ROOM</p>
            <h1 className="mt-2 font-gothic text-6xl leading-none md:text-8xl">OVERVIEW</h1>
            <p className="mt-3 max-w-2xl font-mono text-xs leading-6 text-white/45">
              Central de controlo editorial e operacional. Cada número abaixo vem directamente do backend activo.
            </p>
          </div>
          <div className="flex items-end gap-4">
            <div className="text-right font-mono text-[10px]">
              <p>STATUS: <span className={error ? "text-[#d71920]" : "text-[#d71920]"}>● {error ? "DEGRADED" : "ONLINE"}</span></p>
              <p className="mt-1 text-white/30">BASE: <span className="text-white/60">SUPABASE</span></p>
              {lastSync && <p className="mt-1 text-white/25">SYNC: {lastSync}</p>}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] text-white/50 hover:border-white/30 hover:text-white"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              ACTUALIZAR
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-3 border border-[#d71920]/40 bg-[#d71920]/5 px-4 py-3 font-mono text-[10px] leading-6 text-white/60">
          <TriangleAlert size={15} className="mt-0.5 shrink-0 text-[#d71920]" />
          <span>{error}</span>
        </div>
      )}

      <section className="mt-8 grid grid-cols-2 gap-px border border-white/10 bg-white/10 md:grid-cols-3 xl:grid-cols-7">
        {stats.map(([value, label, to]) => (
          <Link key={label} to={to} className="group bg-[#0d0d0d] p-5 hover:bg-[#111]">
            <div className="font-mono text-4xl font-bold tabular-nums text-white">{loading ? "--" : value}</div>
            <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[9px] tracking-[0.2em] text-white/35">
              <span>{label}</span>
              <ArrowUpRight size={11} className="text-white/15 transition group-hover:text-[#d71920]" />
            </div>
          </Link>
        ))}
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="border border-white/10 bg-[#0d0d0d]">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.24em] text-[#d71920]">PIPELINE EDITORIAL</p>
              <p className="mt-1 font-mono text-[9px] text-white/25">PUBLICAÇÃO VS. CONTEÚDO AINDA EM OPERAÇÃO</p>
            </div>
            <Link to="/control-room/artistas" className="font-mono text-[9px] text-white/35 hover:text-white">ABRIR →</Link>
          </div>

          <div className="grid gap-px bg-white/10 md:grid-cols-4">
            <Pipeline value={publishedArtists} label="ARTISTAS PUBLICADOS" tone="good" />
            <Pipeline value={readyArtists} label="PRONTOS" tone="neutral" />
            <Pipeline value={draftArtists} label="RASCUNHOS" tone="alert" />
            <Pipeline value={incompleteArtists.length} label="FICHAS INCOMPLETAS" tone="alert" />
          </div>

          <div className="border-t border-white/10 p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] tracking-[0.18em] text-white/35">LANÇAMENTOS PUBLICADOS</span>
              <span className="font-mono text-xl text-white">{publishedReleases}/{data.releases.length || 0}</span>
            </div>
            <div className="mt-3 h-2 bg-white/5">
              <div
                className="h-full bg-[#d71920] transition-all"
                style={{ width: data.releases.length ? Math.min(100, (publishedReleases / data.releases.length) * 100) + "%" : "0%" }}
              />
            </div>
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
            <QuickLink label="+ NOVO PRODUTO" href="/control-room/merch" />
            <QuickLink label="+ VER PROPOSTAS" href="/control-room/parcerias" />
          </div>
        </div>
      </section>

      <section className="mt-6 border border-white/10 bg-[#0d0d0d]">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] tracking-[0.24em] text-[#d71920]">INBOX COMERCIAL</p>
              <p className="mt-1 font-mono text-[9px] text-white/25">{freshProposals} novas · {negotiationProposals} em negociação</p>
            </div>
            <Link to="/control-room/parcerias" className="font-mono text-[9px] text-white/35 hover:text-white">ABRIR INBOX →</Link>
          </div>
        </div>

        <div className="divide-y divide-white/10">
          {data.partnerships.map((row) => (
            <Link
              key={row.id}
              to="/control-room/parcerias"
              className="grid gap-2 px-4 py-4 transition hover:bg-white/[0.02] md:grid-cols-[1.1fr_1fr_160px_110px]"
            >
              <span className="font-gothic text-xl">{row.company}</span>
              <span className="font-mono text-[9px] text-white/35">{row.name} · {row.partnership_type}</span>
              <span className="font-mono text-[9px] text-white/35">{new Date(row.created_at).toLocaleDateString("pt-PT")}</span>
              <span className="font-mono text-[9px] tracking-[0.12em] text-[#d71920]">{row.status.toUpperCase()}</span>
            </Link>
          ))}
          {!data.partnerships.length && (
            <div className="p-8 font-mono text-xs text-white/30">SEM PROPOSTAS RECENTES.</div>
          )}
        </div>
      </section>

      <section className="mt-6 border border-white/10 bg-[#0d0d0d]">
        <div className="border-b border-white/10 p-4">
          <p className="font-mono text-[10px] tracking-[0.24em] text-[#d71920]">MAPA DE MÓDULOS</p>
        </div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(([label, href], index) => (
            <Link key={href} to={href} className="group bg-[#0d0d0d] p-4 hover:bg-[#111]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-white/20">0{index + 1}</span>
                <ArrowUpRight size={12} className="text-white/15 group-hover:text-[#d71920]" />
              </div>
              <p className="mt-3 font-gothic text-2xl">{label}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Pipeline({ value, label, tone }: { value: number; label: string; tone: "good" | "neutral" | "alert" }) {
  return (
    <div className="bg-[#0d0d0d] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-3xl font-bold tabular-nums">{value}</span>
        {tone === "good" && <Check size={13} className="text-[#d71920]" />}
        {tone === "alert" && <span className="font-mono text-[8px] text-[#d71920]">ATENÇÃO</span>}
      </div>
      <p className="mt-2 font-mono text-[8px] leading-4 tracking-[0.12em] text-white/30">{label}</p>
    </div>
  );
}

function QuickLink({ label, href }: { label: string; href: "/control-room/artistas" | "/control-room/musica" | "/control-room/media" | "/control-room/merch" | "/control-room/parcerias" }) {
  return (
    <Link to={href} className="border border-white/10 px-4 py-3 font-mono text-[10px] tracking-[0.14em] text-white/65 transition hover:border-[#d71920] hover:text-white">
      {label} →
    </Link>
  );
}
