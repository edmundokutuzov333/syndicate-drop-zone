import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { getLiveArtistsForSite } from "@/lib/site-content";
import { getPublicSupabaseConfig } from "@/lib/supabase-public";

export type CampingRoom = {
  id: string; name: string; x: number; y: number; w: number; h: number; line: string; live?: boolean; galleryTag: string;
};

export type CampingSessionRow = {
  id: string; day: number; title: string; roomId: string; roomName: string; galleryTag: string; startsAt: string; endsAt: string;
};

export type CampingGalleryItem = { id: string; src: string; caption: string; tag: string; };

export type ArtistPresenceRow = { artistId: string; code: string; name: string; status: string; };

export type LiveFlag = { on: boolean; url: string; };

export type CampRange = { start: string | null; end: string | null; };

const ROOM_ALIAS: Record<string, { id: string; name: string; tag: string }> = {
  estudio: { id: "estudio", name: "ESTÚDIO", tag: "CABINE" },
  "estúdio": { id: "estudio", name: "ESTÚDIO", tag: "CABINE" },
  estampa: { id: "estampa", name: "ESTAMPA", tag: "ESTAMPA" },
  visualizer: { id: "visual", name: "VISUALIZER", tag: "VISUALIZER" },
  visual: { id: "visual", name: "VISUALIZER", tag: "VISUALIZER" },
  foto: { id: "foto", name: "FOTO", tag: "FOTO" },
  fotos: { id: "foto", name: "FOTO", tag: "FOTO" },
  networking: { id: "rede", name: "NETWORKING", tag: "NETWORKING" },
  rede: { id: "rede", name: "NETWORKING", tag: "NETWORKING" },
  live: { id: "live", name: "LIVE", tag: "LIVES" },
  lives: { id: "live", name: "LIVE", tag: "LIVES" },
};

const STATUS = ["ATIVO", "ISOLADO", "VIGIADO", "DESAPARECIDO"] as const;

function cfg() {
  return getPublicSupabaseConfig();
}

function pick(row: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function text(row: Record<string, unknown>, keys: string[], fallback = "") {
  return String(pick(row, keys, fallback));
}

function num(row: Record<string, unknown>, keys: string[], fallback = 0) {
  const value = Number(pick(row, keys, fallback));
  return Number.isFinite(value) ? value : fallback;
}

function publicConfig() {
  const { url, key } = cfg();
  return { url, key, headers: { apikey: key } };
}

async function rows(table: string, query = "?select=*") {
  const { url, headers } = publicConfig();
  const response = await fetch(url + "/rest/v1/" + table + query, { headers });
  if (!response.ok) throw new Error("Falha a carregar " + table + ".");
  return (await response.json()) as Record<string, unknown>[];
}

function normalizeRoom(raw: string) {
  const key = raw.trim().toLowerCase();
  return ROOM_ALIAS[key] ?? ROOM_ALIAS.estudio;
}

export async function getLiveCampingSessions(): Promise<CampingSessionRow[]> {
  try {
    const data = await rows("camping_sessions");
    return data
      .map((row, index) => {
        const room = normalizeRoom(text(row, ["room_id", "room", "room_slug", "area", "location"], "estudio"));
        return {
          id: text(row, ["id", "slug", "code"], "session-" + index),
          day: num(row, ["day", "day_number", "camp_day"], 1),
          title: text(row, ["title", "name", "label"], "SESSÃO " + String(index + 1).padStart(2, "0")),
          roomId: room.id,
          roomName: text(row, ["room_name", "location_label", "room"], room.name),
          galleryTag: room.tag,
          startsAt: text(row, ["starts_at", "start_at", "scheduled_for"], new Date().toISOString()),
          endsAt: text(row, ["ends_at", "end_at", "scheduled_end"], new Date(Date.now() + 3600000).toISOString()),
        } satisfies CampingSessionRow;
      })
      .sort((a, b) => {
        const day = a.day - b.day;
        if (day !== 0) return day;
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
  } catch {
    return [];
  }
}

export async function getLiveArtistPresence(): Promise<ArtistPresenceRow[]> {
  const artists = await getLiveArtistsForSite().catch(() => []);
  const fallback = artists.map((artist) => ({
    artistId: artist.id,
    code: artist.code,
    name: artist.name,
    status: STATUS.includes(String(artist.status).toUpperCase() as (typeof STATUS)[number])
      ? String(artist.status).toUpperCase()
      : "ATIVO",
  }));

  try {
    const statuses = await rows("artist_status", "?select=artist_id,status,updated_at");
    const map = new Map(statuses.map((row) => [String(row.artist_id), text(row, ["status"], "ATIVO").toUpperCase()]));
    return artists.map((artist) => ({
      artistId: artist.id,
      code: artist.code,
      name: artist.name,
      status: map.get(artist.id) && STATUS.includes(map.get(artist.id)! as (typeof STATUS)[number]) ? map.get(artist.id)! : "ATIVO",
    }));
  } catch {
    return fallback;
  }
}

export async function getLiveFlags(): Promise<{ live: LiveFlag; camp: CampRange }> {
  const fallback = { live: { on: false, url: "" }, camp: { start: null, end: null } };
  try {
    const flags = await rows("site_flags", "?select=key,value&key=in.(live,CAMP)");
    const map = new Map(flags.map((row) => [String(row.key), row.value]));
    const liveValue = map.get("live");
    const campValue = map.get("CAMP");
    const liveObject = liveValue && typeof liveValue === "object" ? liveValue as Record<string, unknown> : {};
    const campObject = campValue && typeof campValue === "object" ? campValue as Record<string, unknown> : {};
    return {
      live: { on: Boolean(liveObject.on), url: String(liveObject.url ?? "") },
      camp: { start: String(campObject.start ?? "") || null, end: String(campObject.end ?? "") || null },
    };
  } catch {
    return fallback;
  }
}

export async function getLiveCampingGallery(): Promise<Record<string, CampingGalleryItem[]>> {
  try {
    const [media, assets] = await Promise.all([
      rows("gallery_items", "?select=id,url,alt,caption,tag,roll,status,position,media_asset_id&status=eq.published&order=position.asc"),
      rows("media_assets", "?select=id,public_url,storage_url,url"),
    ]);
    const assetMap = new Map(assets.map((row) => [
      String(row.id),
      text(row, ["public_url", "storage_url", "url"], ""),
    ]));
    const grouped: Record<string, CampingGalleryItem[]> = {};

    for (const row of media) {
      const raw = text(row, ["tag", "roll"], "").toUpperCase();
      const entry = Object.values(ROOM_ALIAS).find((value) => value.tag === raw);
      if (!entry) continue;
      const src = text(row, ["url"], "") || assetMap.get(String(row.media_asset_id ?? "")) || "";
      if (!src) continue;
      grouped[entry.id] = grouped[entry.id] ?? [];
      if (grouped[entry.id].length < 3) {
        grouped[entry.id].push({
          id: text(row, ["id", "slug"], ""),
          src,
          caption: text(row, ["caption", "alt"], "REGISTO"),
          tag: raw,
        });
      }
    }
    return grouped;
  } catch {
    return {};
  }
}

export async function createPublicLiveNotification(input: { contactType: "whatsapp" | "email"; contactValue: string }) {
  const { url, key } = publicConfig();
  const response = await fetch(url + "/rest/v1/rpc/create_live_notification", {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_contact_type: input.contactType, p_contact_value: input.contactValue, p_kind: "live" }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "Serviço de notificações indisponível.");
  }
  return response.json();
}

export function getRoomAlias(raw: string) {
  return normalizeRoom(raw);
}

export type LiveRealtimeHandler = (next: LiveFlag) => void;

export function subscribeCampingLive(onChange: LiveRealtimeHandler): () => void {
  let client: ReturnType<typeof createClient> | null = null;
  let channel: RealtimeChannel | null = null;
  let poll: number | null = null;
  let active = true;

  try {
    const { url, key } = cfg();
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
    channel = client
      .channel("camping-live-flag")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_flags", filter: "key=eq.live" }, () => {
        if (active) void getLiveFlags().then((state) => active && onChange(state.live));
      })
      .subscribe();
  } catch {
    channel = null;
  }

  poll = window.setInterval(() => {
    void getLiveFlags().then((state) => active && onChange(state.live));
  }, 1500);

  return () => {
    active = false;
    if (poll !== null) window.clearInterval(poll);
    if (channel && client) void client.removeChannel(channel);
  };
}


export function campingDayRange(start: string | null, end: string | null, now = Date.now()) {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  const total = Math.max(1, Math.ceil((endMs - startMs) / 86400000));
  if (now < startMs) return { current: 0, total };
  return { current: Math.min(total, Math.floor((now - startMs) / 86400000) + 1), total };
}
