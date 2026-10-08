import { useEffect, useMemo, useState } from "react";
import { Check, Power, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  adminQuery,
  getControlRoomSession,
  isPublicPreviewSession,
  type ControlRoomRole,
} from "@/lib/control-room-auth";

type Track = {
  id: string;
  title: string;
  artist: string;
  artist_slug?: string | null;
  audio_url: string;
  duration_seconds?: number | null;
  kind: "music" | "jingle" | "sfx";
  status: string;
  rotation_weight: number;
  position: number;
  failure_count: number;
  temporarily_disabled: boolean;
  last_failure_at?: string | null;
};

type Station = {
  id: number;
  station_name: string;
  station_tag_url: string;
  forced_track_id: string | null;
  forced_started_at: string | null;
  active_block_id: string | null;
  autoplay: boolean;
  station_seed: number;
  crossfade_ms: number;
  tag_interval: number;
};


type RadioBlock = {
  id: string;
  name: string;
  track_ids: string[];
  active: boolean;
  randomize: boolean;
};

const EDIT_ROLES: ControlRoomRole[] = ["OWNER", "ADMIN", "EDITOR"];

const EMPTY_TRACK: Track = {
  id: "",
  title: "",
  artist: "SINDICATO 808",
  artist_slug: "",
  audio_url: "",
  duration_seconds: null,
  kind: "music",
  status: "published",
  rotation_weight: 1,
  position: 1,
  failure_count: 0,
  temporarily_disabled: false,
};

function canEdit(role: ControlRoomRole | null, preview: boolean) {
  return !preview && Boolean(role && EDIT_ROLES.includes(role));
}

export function RadioManager() {
  const [role, setRole] = useState<ControlRoomRole | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [station, setStation] = useState<Station | null>(null);
  const [blocks, setBlocks] = useState<RadioBlock[]>([]);
  const [blockName, setBlockName] = useState("");
  const [blockTracks, setBlockTracks] = useState<string[]>([]);
  const [selected, setSelected] = useState<Track | null>(null);
  const [form, setForm] = useState<Track>(EMPTY_TRACK);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");
  const editable = canEdit(role, previewMode);

  const forcedTrack = useMemo(
    () => tracks.find((track) => track.id === station?.forced_track_id) ?? null,
    [tracks, station?.forced_track_id],
  );

  const load = async () => {
    setBusy(true);
    setNotice("");
    try {
      const [session, nextTracks, nextStation, nextBlocks] = await Promise.all([
        getControlRoomSession(),
        adminQuery<Track[]>("/rest/v1/radio_tracks?select=*&order=position.asc,created_at.asc"),
        adminQuery<Station[]>("/rest/v1/radio_station?select=*&id=eq.1"),
        adminQuery<RadioBlock[]>("/rest/v1/radio_blocks?select=*&order=created_at.asc"),
      ]);
      setRole(session?.role ?? null);
      setPreviewMode(isPublicPreviewSession(session));
      setTracks(nextTracks);
      setStation(nextStation[0] ?? null);
      setBlocks(nextBlocks);
      setSelected((current) => current ? nextTracks.find((track) => track.id === current.id) ?? current : nextTracks[0] ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar a rádio.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    setForm(selected ? { ...selected } : { ...EMPTY_TRACK, position: tracks.length + 1 });
  }, [selected?.id]);

  const setField = <K extends keyof Track>(key: K, value: Track[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveStation = async () => {
    if (!editable || !station) return;
    setNotice("A GUARDAR ESTAÇÃO...");
    try {
      await adminQuery("/rest/v1/radio_station?id=eq.1", {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          station_name: station.station_name,
          station_tag_url: station.station_tag_url,
          autoplay: station.autoplay,
          station_seed: station.station_seed,
          crossfade_ms: station.crossfade_ms,
          tag_interval: station.tag_interval,
          active_block_id: station.active_block_id,
        }),
      });
      setNotice("ESTAÇÃO ACTUALIZADA");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível guardar a estação.");
    }
  };

  const saveTrack = async () => {
    if (!editable || !form.title.trim() || !form.audio_url.trim()) return;
    setNotice(form.id ? "A GUARDAR FAIXA..." : "A CRIAR FAIXA...");
    try {
      const payload = {
        title: form.title.trim(),
        artist: form.artist.trim() || "SINDICATO 808",
        artist_slug: form.artist_slug?.trim() || null,
        audio_url: form.audio_url.trim(),
        duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
        kind: form.kind,
        status: form.status,
        rotation_weight: Math.max(1, Number(form.rotation_weight) || 1),
        position: Math.max(1, Number(form.position) || 1),
        temporarily_disabled: Boolean(form.temporarily_disabled),
      };
      if (form.id) {
        await adminQuery("/rest/v1/radio_tracks?id=eq." + encodeURIComponent(form.id), {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        });
      } else {
        await adminQuery("/rest/v1/radio_tracks", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        });
      }
      setNotice("FAIXA GUARDADA");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível guardar a faixa.");
    }
  };

  const removeTrack = async () => {
    if (!editable || !form.id) return;
    if (!window.confirm("Eliminar esta faixa da rotação?")) return;
    try {
      await adminQuery("/rest/v1/radio_tracks?id=eq." + encodeURIComponent(form.id), {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      setSelected(null);
      setNotice("FAIXA REMOVIDA");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível eliminar.");
    }
  };

  const toggleDisabled = async (track: Track) => {
    if (!editable) return;
    try {
      await adminQuery("/rest/v1/radio_tracks?id=eq." + encodeURIComponent(track.id), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          temporarily_disabled: !track.temporarily_disabled,
          status: track.temporarily_disabled ? "published" : "inactive",
        }),
      });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível alterar o estado.");
    }
  };

  const resetFailures = async (track: Track) => {
    if (!editable) return;
    try {
      await adminQuery("/rest/v1/radio_tracks?id=eq." + encodeURIComponent(track.id), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ failure_count: 0, temporarily_disabled: false, last_failure_at: null, status: "published" }),
      });
      setNotice("CONTADOR DE FALHAS REINICIADO");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível reiniciar as falhas.");
    }
  };

  const saveBlock = async () => {
    if (!editable || !blockName.trim()) return;
    try {
      const payload = {
        name: blockName.trim(),
        track_ids: blockTracks,
        active: true,
        randomize: true,
      };
      await adminQuery("/rest/v1/radio_blocks", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(payload),
      });
      setBlockName("");
      setBlockTracks([]);
      setNotice("BLOCO CRIADO");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível criar o bloco.");
    }
  };

  const deleteBlock = async (blockId: string) => {
    if (!editable) return;
    if (!window.confirm("Eliminar este bloco?")) return;
    try {
      await adminQuery("/rest/v1/radio_blocks?id=eq." + encodeURIComponent(blockId), {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      if (station?.active_block_id === blockId) {
        await adminQuery("/rest/v1/radio_station?id=eq.1", {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ active_block_id: null }),
        });
      }
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível eliminar o bloco.");
    }
  };

  const activateBlock = async (blockId: string | null) => {
    if (!editable || !station) return;
    try {
      await adminQuery("/rest/v1/radio_station?id=eq.1", {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ active_block_id: blockId }),
      });
      setNotice(blockId ? "BLOCO ACTIVO" : "ROTAÇÃO GERAL ACTIVA");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível activar o bloco.");
    }
  };

  const forceTrack = async (trackId: string | null) => {
    if (!editable || !station) return;
    try {
      await adminQuery("/rest/v1/radio_station?id=eq.1", {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          forced_track_id: trackId,
          forced_started_at: trackId ? new Date().toISOString() : null,
        }),
      });
      setNotice(trackId ? "FAIXA FORÇADA PARA O AR" : "FORÇAR FAIXA DESACTIVADO");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível alterar o NOW PLAYING.");
    }
  };

  return (
    <div>
      <header className="border-b border-white/10 pb-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] tracking-[0.28em] text-[#d71920]">16 · RADIO</p>
            <h1 className="mt-2 font-gothic text-6xl leading-none md:text-8xl">FREQUÊNCIA 808</h1>
            <p className="mt-3 max-w-3xl font-mono text-xs leading-6 text-white/45">Programação real. Rotação aleatória. Falhas, pesos, publicação e NOW PLAYING controlados pelo backend.</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 font-mono text-[9px] text-white/50 hover:border-white/30 hover:text-white"><RefreshCw size={13} className={busy ? "animate-spin" : ""} /> ACTUALIZAR</button>
        </div>
      </header>

      {notice && <div className="mt-5 border border-white/10 bg-[#0d0d0d] px-4 py-3 font-mono text-[10px] tracking-[0.12em] text-[#d71920]">{notice}</div>}

      {station && (
        <section className="mt-6 border border-white/10 bg-[#0d0d0d] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] tracking-[0.2em] text-[#d71920]">IDENTIDADE DA ESTAÇÃO</p>
              <h2 className="mt-1 font-gothic text-4xl">{station.station_name}</h2>
            </div>
            <span className="font-mono text-[9px] text-white/35">{station.autoplay ? "AUTOPLAY ON" : "AUTOPLAY OFF"}</span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Field label="NOME" value={station.station_name} onChange={(value) => setStation({ ...station, station_name: value })} disabled={!editable} />
            <Field label="TAG URL" value={station.station_tag_url} onChange={(value) => setStation({ ...station, station_tag_url: value })} disabled={!editable} />
            <NumberField label="CROSSFADE MS" value={station.crossfade_ms} onChange={(value) => setStation({ ...station, crossfade_ms: value })} disabled={!editable} />
            <NumberField label="TAG A CADA" value={station.tag_interval} onChange={(value) => setStation({ ...station, tag_interval: value })} disabled={!editable} />
            <label className="flex min-h-11 items-center gap-3 border border-white/10 px-3 font-mono text-[9px] text-white/45"><input type="checkbox" checked={station.autoplay} disabled={!editable} onChange={(event) => setStation({ ...station, autoplay: event.target.checked })} /> AUTOPLAY</label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" disabled={!editable} onClick={() => void saveStation()} className="inline-flex items-center gap-2 border border-[#d71920] bg-[#d71920] px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-white disabled:opacity-40"><Save size={14} /> GUARDAR ESTAÇÃO</button>
            {forcedTrack ? (
              <button type="button" disabled={!editable} onClick={() => void forceTrack(null)} className="inline-flex items-center gap-2 border border-[#d71920] px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-[#d71920] disabled:opacity-40"><Power size={14} /> LIBERTAR NOW PLAYING · {forcedTrack.title}</button>
            ) : (
              <span className="border border-white/10 px-3 py-2 font-mono text-[9px] text-white/35">ROTAÇÃO ALEATÓRIA NORMAL</span>
            )}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="border border-white/10 bg-[#0d0d0d]">
          <div className="border-b border-white/10 p-4"><p className="font-mono text-[9px] tracking-[0.18em] text-white/30">{tracks.length} FAIXAS / JINGLES</p></div>
          <div className="divide-y divide-white/10">
            {tracks.map((track) => (
              <div key={track.id} className="p-4">
                <button type="button" onClick={() => setSelected(track)} className={"w-full text-left " + (selected?.id === track.id ? "text-white" : "text-white/65")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-gothic text-2xl">{track.title}</p>
                      <p className="mt-1 font-mono text-[8px] text-white/30">{track.artist} · {track.kind.toUpperCase()} · PESO {track.rotation_weight}</p>
                    </div>
                    <span className={"font-mono text-[8px] " + (track.temporarily_disabled ? "text-[#d71920]" : "text-white/30")}>{track.temporarily_disabled ? "OFF" : track.status.toUpperCase()}</span>
                  </div>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={!editable} onClick={() => void forceTrack(track.id)} className="border border-white/10 px-2 py-1 font-mono text-[8px] text-white/45 hover:border-[#d71920] hover:text-white disabled:opacity-30">FORÇAR AGORA</button>
                  <button type="button" disabled={!editable} onClick={() => void toggleDisabled(track)} className="border border-white/10 px-2 py-1 font-mono text-[8px] text-white/45 disabled:opacity-30">{track.temporarily_disabled ? "ACTIVAR" : "DESACTIVAR"}</button>
                  {track.failure_count > 0 && <button type="button" disabled={!editable} onClick={() => void resetFailures(track)} className="inline-flex items-center gap-1 border border-white/10 px-2 py-1 font-mono text-[8px] text-white/45 disabled:opacity-30"><RotateCcw size={11} /> FALHAS {track.failure_count}</button>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-white/10 bg-[#0d0d0d]">
          <div className="flex items-center justify-between border-b border-white/10 p-5">
            <div><p className="font-mono text-[9px] tracking-[0.22em] text-[#d71920]">EDITOR DA ROTAÇÃO</p><h2 className="mt-1 font-gothic text-4xl">{form.id ? form.title : "NOVA FAIXA"}</h2></div>
            {form.id && <button type="button" disabled={!editable} onClick={() => void removeTrack()} className="border border-white/10 p-2 text-white/35 hover:border-[#d71920] hover:text-[#d71920] disabled:opacity-30"><Trash2 size={14} /></button>}
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="TÍTULO" value={form.title} onChange={(value) => setField("title", value)} disabled={!editable} />
            <Field label="ARTISTA" value={form.artist} onChange={(value) => setField("artist", value)} disabled={!editable} />
            <Field label="ARTISTA SLUG" value={form.artist_slug ?? ""} onChange={(value) => setField("artist_slug", value)} disabled={!editable} />
            <Field label="ÁUDIO URL" value={form.audio_url} onChange={(value) => setField("audio_url", value)} disabled={!editable} />
            <NumberField label="DURAÇÃO SEGUNDOS" value={form.duration_seconds ?? 0} onChange={(value) => setField("duration_seconds", value || null)} disabled={!editable} />
            <NumberField label="PESO DA ROTAÇÃO" value={form.rotation_weight} onChange={(value) => setField("rotation_weight", value)} disabled={!editable} />
            <NumberField label="POSIÇÃO" value={form.position} onChange={(value) => setField("position", value)} disabled={!editable} />
            <label className="grid gap-2 font-mono text-[9px] tracking-[0.16em] text-white/35">TIPO<select value={form.kind} disabled={!editable} onChange={(event) => setField("kind", event.target.value as Track["kind"])} className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none"><option value="music">MUSIC</option><option value="jingle">JINGLE</option><option value="sfx">SFX</option></select></label>
            <label className="grid gap-2 font-mono text-[9px] tracking-[0.16em] text-white/35">ESTADO<select value={form.status} disabled={!editable} onChange={(event) => setField("status", event.target.value)} className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none"><option value="draft">DRAFT</option><option value="published">PUBLISHED</option><option value="active">ACTIVE</option><option value="inactive">INACTIVE</option><option value="archived">ARCHIVED</option></select></label>
            <label className="flex min-h-11 items-center gap-3 border border-white/10 px-3 font-mono text-[9px] text-white/45"><input type="checkbox" checked={form.temporarily_disabled} disabled={!editable} onChange={(event) => setField("temporarily_disabled", event.target.checked)} /> DESACTIVAR DA ROTAÇÃO</label>
          </div>
          <div className="border-t border-white/10 p-5">
            <button type="button" disabled={!editable || !form.title.trim() || !form.audio_url.trim()} onClick={() => void saveTrack()} className="inline-flex items-center gap-2 border border-[#d71920] bg-[#d71920] px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-white disabled:opacity-40"><Check size={14} /> {form.id ? "GUARDAR FAIXA" : "ADICIONAR À ROTAÇÃO"}</button>
          </div>
        </section>
      </div>

      <section className="mt-6 border border-white/10 bg-[#0d0d0d] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[9px] tracking-[0.2em] text-[#d71920]">BLOCOS DE ROTAÇÃO</p>
            <h2 className="mt-1 font-gothic text-4xl">BLOCOS</h2>
            <p className="mt-2 max-w-2xl font-mono text-[9px] leading-5 text-white/35">Cada bloco define um conjunto de faixas. A reprodução continua aleatória dentro do bloco activo.</p>
          </div>
          {station?.active_block_id && (
            <button type="button" disabled={!editable} onClick={() => void activateBlock(null)} className="border border-white/10 px-3 py-2 font-mono text-[9px] text-white/45 disabled:opacity-30">ROTAÇÃO GERAL</button>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
          <Field label="NOME DO BLOCO" value={blockName} onChange={setBlockName} disabled={!editable} />
          <button type="button" disabled={!editable || !blockName.trim()} onClick={() => void saveBlock()} className="self-end inline-flex min-h-11 items-center justify-center gap-2 border border-[#d71920] bg-[#d71920] px-4 font-mono text-[9px] text-white disabled:opacity-40"><Check size={13} /> CRIAR BLOCO</button>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.filter((track) => track.kind === "music").map((track) => (
            <label key={track.id} className="flex items-center gap-3 border border-white/10 px-3 py-2 font-mono text-[9px] text-white/50">
              <input
                type="checkbox"
                checked={blockTracks.includes(track.id)}
                disabled={!editable}
                onChange={(event) =>
                  setBlockTracks((current) =>
                    event.target.checked ? [...current, track.id] : current.filter((id) => id !== track.id),
                  )
                }
              />
              {track.title}
            </label>
          ))}
        </div>

        <div className="mt-5 divide-y divide-white/10 border border-white/10">
          {blocks.map((block) => (
            <div key={block.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-gothic text-2xl">{block.name}</p>
                <p className="mt-1 font-mono text-[8px] text-white/30">{block.track_ids.length} FAIXAS · {block.randomize ? "ALEATÓRIO" : "SEQUENCIAL"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!editable} onClick={() => void activateBlock(block.id)} className={"border px-3 py-2 font-mono text-[8px] " + (station?.active_block_id === block.id ? "border-[#d71920] text-[#d71920]" : "border-white/10 text-white/45")}>{station?.active_block_id === block.id ? "ACTIVO" : "ACTIVAR"}</button>
                <button type="button" disabled={!editable} onClick={() => void deleteBlock(block.id)} className="border border-white/10 px-3 py-2 font-mono text-[8px] text-white/35 hover:border-[#d71920] hover:text-[#d71920] disabled:opacity-30">ELIMINAR</button>
              </div>
            </div>
          ))}
          {!blocks.length && <div className="p-5 font-mono text-[9px] text-white/30">SEM BLOCOS. A ROTAÇÃO GERAL ALEATÓRIA ESTÁ ACTIVA.</div>}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <label className="grid gap-2 font-mono text-[9px] tracking-[0.16em] text-white/35">{label}<input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[#d71920] disabled:opacity-50" /></label>;
}

function NumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (value: number) => void; disabled: boolean }) {
  return <label className="grid gap-2 font-mono text-[9px] tracking-[0.16em] text-white/35">{label}<input type="number" value={String(value)} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="min-h-11 border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none focus:border-[#d71920] disabled:opacity-50" /></label>;
}
