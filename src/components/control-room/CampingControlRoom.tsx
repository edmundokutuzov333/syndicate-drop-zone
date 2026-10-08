import { useEffect, useMemo, useState } from "react";
import { ControlRoomModule } from "@/components/control-room/ControlRoomModule";
import { adminQuery, getControlRoomSession, isPublicPreviewSession } from "@/lib/control-room-auth";
import { getLiveFlags, type ArtistPresenceRow } from "@/lib/camping-data";
import { cn } from "@/lib/utils";

const STATUS = ["ATIVO", "ISOLADO", "VIGIADO", "DESAPARECIDO"] as const;

function validStatus(value: string) {
  return STATUS.includes(value as (typeof STATUS)[number]) ? value : "ATIVO";
}

export function CampingControlRoom() {
  const [liveOn, setLiveOn] = useState(false);
  const [liveUrl, setLiveUrl] = useState("");
  const [campStart, setCampStart] = useState("");
  const [campEnd, setCampEnd] = useState("");
  const [artists, setArtists] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [role, setRole] = useState<string>("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState("");

  const load = async () => {
    setBusy(true);
    setNotice("");
    try {
      const [session, flags, artistRows, statusRows] = await Promise.all([
        getControlRoomSession(),
        getLiveFlags(),
        adminQuery<Array<{ id: string; code: string; name: string }>>("/rest/v1/artists?select=id,code,name&order=code.asc"),
        adminQuery<Array<{ artist_id: string; status: string }>>("/rest/v1/artist_status?select=artist_id,status"),
      ]);
      setRole(session?.role ?? "");
      setLiveOn(flags.live.on);
      setLiveUrl(flags.live.url);
      setCampStart(flags.camp.start ?? "");
      setCampEnd(flags.camp.end ?? "");
      setArtists(artistRows);
      setStatuses(Object.fromEntries(statusRows.map((row) => [row.artist_id, validStatus(String(row.status).toUpperCase())])));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar o bunker.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const editable = Boolean(role) && role !== "PARTNERSHIPS" && role !== "MERCH";
  const currentStatuses = useMemo<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const artist of artists) result[artist.id] = validStatus(statuses[artist.id] ?? "ATIVO");
    return result;
  }, [artists, statuses]);

  const saveFlags = async () => {
    if (!editable) return;
    setSaving("flags");
    setNotice("");
    try {
      await adminQuery("/rest/v1/site_flags?key=eq.live", {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ value: { on: liveOn, url: liveUrl.trim() } }),
      });
      await adminQuery("/rest/v1/site_flags?key=eq.CAMP", {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ value: { start: campStart || null, end: campEnd || null } }),
      });
      setNotice("SINAL E CALENDÁRIO ACTUALIZADOS.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha a guardar flags.");
    } finally {
      setSaving("");
    }
  };

  const saveArtist = async (artistId: string, status: string) => {
    if (!editable) return;
    setSaving(artistId);
    setStatuses((current) => ({ ...current, [artistId]: status }));
    try {
      await adminQuery("/rest/v1/artist_status?artist_id=eq." + encodeURIComponent(artistId), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status }),
      });
      setNotice("PRESENÇA ACTUALIZADA.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha a actualizar presença.");
      void load();
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="space-y-8">
      <section className="border border-[#d71920]/70 bg-[#0d0d0d] p-5">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-[9px] tracking-[0.24em] text-[#d71920]">05 · REVELAÇÃO DO BUNKER</p>
            <h1 className="mt-1 font-gothic text-5xl leading-none">CAMPING V2</h1>
            <p className="mt-2 max-w-2xl font-mono text-[9px] leading-5 text-white/35">
              LIVE, calendário CAMP e presença dos 17 artistas. As alterações entram no site via Realtime.
            </p>
          </div>
          <span className="font-mono text-[8px] text-white/30">{isPublicPreviewSession(null) ? "PREVIEW" : role || "SEM SESSÃO"}</span>
        </div>
      </section>

      <section className="grid gap-px border border-white/10 bg-white/10 lg:grid-cols-[1fr_1.3fr]">
        <div className="bg-[#0d0d0d] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] tracking-[0.2em] text-[#d71920]">LIVE</p>
              <h2 className="mt-1 font-gothic text-3xl">SINAL</h2>
            </div>
            <button
              type="button"
              disabled={!editable}
              onClick={() => setLiveOn((value) => !value)}
              className={cn(
                "border px-4 py-3 font-mono text-[9px] tracking-[0.15em]",
                liveOn ? "border-[#d71920] bg-[#d71920] text-white" : "border-white/15 text-white/40",
                !editable && "cursor-not-allowed opacity-40",
              )}
            >
              {liveOn ? "● AO VIVO" : "○ OFF"}
            </button>
          </div>
          <label className="mt-5 block font-mono text-[8px] tracking-[0.15em] text-white/30" htmlFor="control-live-url">
            URL DE EMBED
          </label>
          <input
            id="control-live-url"
            value={liveUrl}
            onChange={(event) => setLiveUrl(event.target.value)}
            disabled={!editable}
            placeholder="https://..."
            className="mt-2 w-full border border-white/10 bg-black px-3 py-3 font-mono text-[9px] text-white outline-none focus:border-[#d71920] disabled:opacity-40"
          />
        </div>

        <div className="bg-[#0d0d0d] p-5">
          <p className="font-mono text-[9px] tracking-[0.2em] text-[#d71920]">CAMP</p>
          <h2 className="mt-1 font-gothic text-3xl">CALENDÁRIO</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="font-mono text-[8px] text-white/30">
              START
              <input type="datetime-local" value={campStart ? campStart.slice(0,16) : ""} onChange={(event) => setCampStart(event.target.value ? new Date(event.target.value).toISOString() : "")} disabled={!editable} className="mt-2 w-full border border-white/10 bg-black px-3 py-3 font-mono text-[9px] text-white disabled:opacity-40" />
            </label>
            <label className="font-mono text-[8px] text-white/30">
              END
              <input type="datetime-local" value={campEnd ? campEnd.slice(0,16) : ""} onChange={(event) => setCampEnd(event.target.value ? new Date(event.target.value).toISOString() : "")} disabled={!editable} className="mt-2 w-full border border-white/10 bg-black px-3 py-3 font-mono text-[9px] text-white disabled:opacity-40" />
            </label>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4">
        <div className="font-mono text-[9px] text-white/40">{busy ? "A CARREGAR..." : "BACKEND · CONNECTED"} {saving ? "· A GUARDAR..." : ""}</div>
        <button type="button" onClick={() => void saveFlags()} disabled={!editable || Boolean(saving)} className="border border-[#d71920] px-4 py-2 font-mono text-[9px] text-white disabled:cursor-not-allowed disabled:opacity-40">GUARDAR CAMP</button>
      </div>

      {notice && <div className="border border-white/10 bg-white/[0.02] px-4 py-3 font-mono text-[9px] text-white/50">{notice}</div>}

      <section className="border border-white/10 bg-[#0d0d0d]">
        <div className="border-b border-white/10 p-4">
          <p className="font-mono text-[9px] tracking-[0.22em] text-[#d71920]">PRESENÇA · 17 ARTISTAS</p>
          <p className="mt-1 font-mono text-[8px] text-white/25">Estado operacional separado do estado editorial do artista.</p>
        </div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {artists.map((artist) => (
            <label key={artist.id} className="bg-[#0d0d0d] p-4">
              <span className="font-gothic text-2xl">{artist.name}</span>
              <span className="mt-1 block font-mono text-[7px] text-white/25">{artist.code}</span>
              <select
                value={currentStatuses[artist.id]}
                onChange={(event) => void saveArtist(artist.id, event.target.value)}
                disabled={!editable || saving === artist.id}
                className="mt-3 w-full border border-white/10 bg-black px-2 py-2 font-mono text-[8px] text-white outline-none focus:border-[#d71920] disabled:opacity-40"
              >
                {STATUS.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>

      <ControlRoomModule module="camping" />
    </div>
  );
}
