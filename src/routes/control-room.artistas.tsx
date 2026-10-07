import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Edit3, ExternalLink, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { adminQuery, type ControlRoomRole, getControlRoomSession } from "@/lib/control-room-auth";

type Artist = {
  id: string;
  slug: string;
  code: string;
  name: string;
  bio: string;
  frase: string;
  zona: string;
  faixas: string[];
  role: string;
  studio: string;
  edition: string;
  presence: string;
  spotify_artist_id: string;
  photo_url: string;
  status: "draft" | "ready" | "published" | "archived";
  meta_title?: string;
  meta_description?: string;
  alt_text?: string;
};

type Release = {
  id: string;
  artist_id: string;
  position: number;
  title: string;
  youtube_id: string | null;
  status: string;
};

export const Route = createFileRoute("/control-room/artistas")({
  component: ControlRoomArtists,
});

function ControlRoomArtists() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [selected, setSelected] = useState<Artist | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Artist["status"]>("all");
  const [role, setRole] = useState<ControlRoomRole | null>(null);
  const [busy, setBusy] = useState(true);

  const load = async () => {
    setBusy(true);
    try {
      const [artistRows, releaseRows, session] = await Promise.all([
        adminQuery<Artist[]>("/rest/v1/artists?select=*&order=code.asc"),
        adminQuery<Release[]>("/rest/v1/artist_releases?select=*&order=position.asc"),
        getControlRoomSession(),
      ]);
      setArtists(artistRows);
      setReleases(releaseRows);
      setRole(session?.role ?? null);
      setSelected((current) => current ? artistRows.find((item) => item.id === current.id) ?? null : artistRows[0] ?? null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load().catch(() => setBusy(false));
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return artists.filter((artist) => {
      const matchesSearch =
        !needle ||
        artist.name.toLowerCase().includes(needle) ||
        artist.code.toLowerCase().includes(needle) ||
        artist.zona.toLowerCase().includes(needle);
      return matchesSearch && (filter === "all" || artist.status === filter);
    });
  }, [artists, filter, query]);

  const canEdit = role === "OWNER" || role === "ADMIN" || role === "EDITOR";

  return (
    <div>
      <Header
        eyebrow="02 · ARTISTAS"
        title="OS CONVOCADOS"
        description="Fonte operacional dos perfis. O conteúdo guardado aqui substitui a necessidade de editar o código."
        onRefresh={() => load()}
        busy={busy}
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="min-w-0 border border-white/10 bg-[#0d0d0d]">
          <div className="border-b border-white/10 p-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="PESQUISAR..."
                className="h-10 w-full border border-white/10 bg-[#090909] pl-9 pr-3 font-mono text-xs text-white outline-none focus:border-[#d71920]"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["all", "published", "ready", "draft", "archived"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  className={`border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] ${filter === status ? "border-[#d71920] bg-[#d71920]/10 text-white" : "border-white/10 text-white/35 hover:text-white"}`}
                >
                  {status === "all" ? "TODOS" : status}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {visible.map((artist) => (
              <button
                key={artist.id}
                type="button"
                onClick={() => setSelected(artist)}
                className={`flex w-full items-center gap-3 p-3 text-left transition ${selected?.id === artist.id ? "bg-[#d71920]/5" : "hover:bg-white/[0.02]"}`}
              >
                <img src={artist.photo_url} alt="" className="h-14 w-11 object-cover grayscale" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-gothic text-2xl">{artist.name}</span>
                    <span className="font-mono text-[9px] text-[#d71920]">{artist.code}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 font-mono text-[9px] text-white/35">
                    <span>{artist.status.toUpperCase()}</span>
                    <span>•</span>
                    <span>SPOTIFY {artist.spotify_artist_id ? "✓" : "—"}</span>
                    <span>•</span>
                    <span>YT {releases.filter((release) => release.artist_id === artist.id).length}</span>
                  </div>
                </div>
                <Edit3 size={14} className="shrink-0 text-white/20" />
              </button>
            ))}
            {!visible.length && (
              <div className="p-8 font-mono text-xs text-white/35">NENHUM ARTISTA ENCONTRADO.</div>
            )}
          </div>
        </section>

        {selected ? (
          <ArtistEditor
            key={selected.id}
            artist={selected}
            releases={releases.filter((release) => release.artist_id === selected.id)}
            canEdit={canEdit}
            onSaved={load}
          />
        ) : (
          <div className="grid min-h-80 place-items-center border border-dashed border-white/10 bg-[#0d0d0d] font-mono text-xs text-white/25">
            SELECT ARTIST
          </div>
        )}
      </div>
    </div>
  );
}

function ArtistEditor({
  artist,
  releases,
  canEdit,
  onSaved,
}: {
  artist: Artist;
  releases: Release[];
  canEdit: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const [form, setForm] = useState(artist);
  const [releaseForm, setReleaseForm] = useState(
    [...releases].sort((a, b) => a.position - b.position).map((release) => ({
      id: release.id,
      position: release.position,
      title: release.title,
      youtube_id: release.youtube_id ?? "",
      status: release.status ?? "published",
    })),
  );
  const [removedReleaseIds, setRemovedReleaseIds] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  const save = async () => {
    if (!canEdit) return;
    setStatus("A GUARDAR...");
    await adminQuery("/rest/v1/artists?id=eq." + encodeURIComponent(artist.id), {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(form),
    });

    for (const id of removedReleaseIds) {
      await adminQuery("/rest/v1/artist_releases?id=eq." + encodeURIComponent(id), {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
    }

    for (const release of releaseForm) {
      const payload = {
        artist_id: artist.id,
        position: release.position,
        title: release.title,
        youtube_id: release.youtube_id || null,
        status: release.status,
      };
      if (release.id) {
        await adminQuery("/rest/v1/artist_releases?id=eq." + encodeURIComponent(release.id), {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        });
      } else {
        await adminQuery("/rest/v1/artist_releases", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        });
      }
    }

    setRemovedReleaseIds([]);
    setStatus("GUARDADO");
    await onSaved();
    window.setTimeout(() => setStatus(""), 1800);
  };

  return (
    <section className="border border-white/10 bg-[#0d0d0d]">
      <div className="border-b border-white/10 p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[9px] tracking-[0.24em] text-[#d71920]">{artist.code} · IDENTIDADE</p>
            <h2 className="mt-1 font-gothic text-5xl">{artist.name}</h2>
          </div>
          <span className="font-mono text-[9px] text-white/35">{artist.slug}</span>
        </div>
      </div>

      <div className="grid gap-6 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="NOME ARTÍSTICO" value={form.name} onChange={(value) => setForm({ ...form, name: value })} disabled={!canEdit} />
          <Field label="SLUG" value={form.slug} onChange={(value) => setForm({ ...form, slug: value })} disabled={!canEdit} />
          <Field label="CÓDIGO SDT" value={form.code} onChange={(value) => setForm({ ...form, code: value })} disabled={!canEdit} />
          <Field label="ZONA" value={form.zona} onChange={(value) => setForm({ ...form, zona: value })} disabled={!canEdit} />
          <Field label="FUNÇÃO" value={form.role} onChange={(value) => setForm({ ...form, role: value })} disabled={!canEdit} />
          <Field label="EDIÇÃO" value={form.edition} onChange={(value) => setForm({ ...form, edition: value })} disabled={!canEdit} />
          <Field label="PRESENÇA" value={form.presence} onChange={(value) => setForm({ ...form, presence: value })} disabled={!canEdit} />
          <Field label="SPOTIFY ARTIST ID" value={form.spotify_artist_id} onChange={(value) => setForm({ ...form, spotify_artist_id: value })} disabled={!canEdit} />
        </div>

        <div className="grid gap-2">
          <label className="font-mono text-[9px] tracking-[0.18em] text-white/35">FRASE</label>
          <input value={form.frase} disabled={!canEdit} onChange={(e) => setForm({ ...form, frase: e.target.value })} className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[#d71920]" />
        </div>

        <div className="grid gap-2">
          <label className="font-mono text-[9px] tracking-[0.18em] text-white/35">BIO</label>
          <textarea value={form.bio} disabled={!canEdit} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={5} className="resize-y border border-white/10 bg-[#090909] px-3 py-3 text-sm leading-6 text-white outline-none focus:border-[#d71920]" />
        </div>

        <div>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="font-mono text-[9px] tracking-[0.24em] text-[#d71920]">YOUTUBE</p>
                          <h3 className="mt-1 font-gothic text-3xl">{releaseForm.length} LANÇAMENTO{releaseForm.length === 1 ? "" : "S"}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={"https://open.spotify.com/artist/" + encodeURIComponent(form.spotify_artist_id)} target="_blank" rel="noreferrer" className="font-mono text-[9px] text-white/40 hover:text-white">
                            SPOTIFY <ExternalLink size={11} className="inline" />
                          </a>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setReleaseForm((rows) => [...rows, { id: null, position: Math.max(0, ...rows.map((row) => row.position)) + 1, title: "Novo lançamento", youtube_id: "", status: "draft" }])}
                              className="inline-flex items-center gap-1 border border-white/10 px-2 py-2 font-mono text-[9px] text-white/45 hover:border-[#d71920] hover:text-white"
                            >
                              <Plus size={12} /> ADICIONAR
                            </button>
                          )}
                        </div>
                      </div>
                    <div className="grid gap-3">
            {releaseForm.map((release, index) => (
              <div key={release.id ?? "new-" + release.position} className="grid gap-3 border border-white/10 p-4 md:grid-cols-[80px_1fr_1fr_auto_auto] md:items-center">
                <span className="font-mono text-[9px] text-[#d71920]">{String(release.position).padStart(2, "0")}</span>
                <input
                  value={release.title}
                  disabled={!canEdit}
                  onChange={(e) => setReleaseForm((rows) => rows.map((row, i) => i === index ? { ...row, title: e.target.value } : row))}
                  className="min-h-10 border border-white/10 bg-[#090909] px-3 text-xs text-white outline-none focus:border-[#d71920]"
                />
                <input
                  value={release.youtube_id}
                  disabled={!canEdit}
                  onChange={(e) => setReleaseForm((rows) => rows.map((row, i) => i === index ? { ...row, youtube_id: e.target.value } : row))}
                  placeholder="YouTube ID"
                  className="min-h-10 border border-white/10 bg-[#090909] px-3 text-xs text-white outline-none focus:border-[#d71920]"
                />
                {release.youtube_id ? (
                  <a href={"https://youtu.be/" + release.youtube_id} target="_blank" rel="noreferrer" className="text-white/40 hover:text-white">
                    <ExternalLink size={14} />
                  </a>
                ) : <span />}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setReleaseForm((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
                      if (release.id) setRemovedReleaseIds((ids) => ids.includes(release.id as string) ? ids : [...ids, release.id as string]);
                    }}
                    className="text-white/25 hover:text-[#d71920]"
                    title="Remover lançamento"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div className="font-mono text-[10px] text-[#d71920]">{status}</div>
            <button
              type="button"
              onClick={() => save().catch((error) => setStatus(error instanceof Error ? error.message : "ERRO"))}
              className="inline-flex items-center gap-2 border border-[#d71920] bg-[#d71920] px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-white transition-opacity hover:opacity-90"
            >
              <Save size={14} /> GUARDAR
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Header({ eyebrow, title, description, onRefresh, busy }: { eyebrow: string; title: string; description: string; onRefresh: () => void; busy: boolean }) {
  return (
    <header className="border-b border-white/10 pb-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">{eyebrow}</p>
          <h1 className="mt-2 font-gothic text-6xl leading-none">{title}</h1>
          <p className="mt-3 max-w-2xl font-mono text-xs leading-6 text-white/45">{description}</p>
        </div>
        <button type="button" onClick={onRefresh} className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] text-white/45 hover:border-white/30 hover:text-white">
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> ACTUALIZAR
        </button>
      </div>
    </header>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <label className="grid gap-2 font-mono text-[9px] tracking-[0.18em] text-white/35">
      {label}
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm tracking-normal text-white outline-none focus:border-[#d71920] disabled:opacity-60" />
    </label>
  );
}
