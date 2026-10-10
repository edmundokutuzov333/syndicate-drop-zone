import { getPublicSupabaseConfig, publicSupabaseHeaders } from "@/lib/supabase-public";

export type ProbeStatus = "present" | "missing" | "restricted" | "error";
export type ProbeArea = "ARTISTAS" | "MÚSICA" | "CAMPING" | "MEDIA" | "MERCH" | "RÁDIO" | "CONTROL ROOM" | "MEMBROS" | "ANÁLISE";
export type ProbeResult = {
  name: string;
  area: ProbeArea;
  kind: "table" | "view" | "rpc";
  status: ProbeStatus;
  httpStatus?: number;
  code?: string;
  checkedAt: string;
};

export type BackendTableContract = {
  name: string;
  area: ProbeArea;
  access: "public" | "authenticated" | "rpc-only";
};

export const BACKEND_TABLES: readonly BackendTableContract[] = [
  { name: "artists", area: "ARTISTAS", access: "public" },
  { name: "artist_releases", area: "ARTISTAS", access: "public" },
  { name: "artist_socials", area: "ARTISTAS", access: "public" },
  { name: "artist_status", area: "CAMPING", access: "public" },
  { name: "tapes", area: "MÚSICA", access: "public" },
  { name: "releases", area: "MÚSICA", access: "public" },
  { name: "beats", area: "MÚSICA", access: "authenticated" },
  { name: "beats_public", area: "MÚSICA", access: "public" },
  { name: "camping_events", area: "CAMPING", access: "public" },
  { name: "camping_sessions", area: "CAMPING", access: "public" },
  { name: "site_flags", area: "CAMPING", access: "public" },
  { name: "live_notifications", area: "CAMPING", access: "rpc-only" },
  { name: "gallery_items", area: "MEDIA", access: "public" },
  { name: "revelation_media", area: "MEDIA", access: "public" },
  { name: "media_assets", area: "MEDIA", access: "public" },
  { name: "merch_products", area: "MERCH", access: "public" },
  { name: "merch_variants", area: "MERCH", access: "public" },
  { name: "inventory_movements", area: "MERCH", access: "authenticated" },
  { name: "reservations", area: "MERCH", access: "authenticated" },
  { name: "radio_tracks", area: "RÁDIO", access: "public" },
  { name: "radio_station", area: "RÁDIO", access: "public" },
  { name: "radio_blocks", area: "RÁDIO", access: "public" },
  { name: "frequency_station", area: "RÁDIO", access: "rpc-only" },
  { name: "frequency_listeners", area: "RÁDIO", access: "rpc-only" },
  { name: "frequency_badges", area: "RÁDIO", access: "rpc-only" },
  { name: "site_settings", area: "CONTROL ROOM", access: "public" },
  { name: "site_sections", area: "CONTROL ROOM", access: "public" },
  { name: "drop_campaigns", area: "CONTROL ROOM", access: "public" },
  { name: "admin_profiles", area: "CONTROL ROOM", access: "authenticated" },
  { name: "audit_logs", area: "CONTROL ROOM", access: "authenticated" },
  { name: "events", area: "ANÁLISE", access: "authenticated" },
  { name: "members", area: "MEMBROS", access: "authenticated" },
  { name: "fan_memberships", area: "MEMBROS", access: "authenticated" },
  { name: "partnership_requests", area: "MEMBROS", access: "authenticated" },
  { name: "partnership_public", area: "MEMBROS", access: "public" },
] as const;

/**
 * Minimum column contract required by the public app and Control Room adapters.
 * A zero-row SELECT of these exact columns detects schema drift that SELECT * misses.
 * Private tables are still classified as restricted when no authorised access token is present.
 */
export const REQUIRED_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  artists: ["id", "slug", "code", "name", "bio", "frase", "zona", "faixas", "role", "studio", "edition", "presence", "spotify_artist_id", "photo_url", "status", "position"],
  artist_releases: ["id", "artist_id", "position", "title", "youtube_id", "spotify_url", "status"],
  artist_socials: ["id", "artist_id", "platform", "url", "position", "status"],
  artist_status: ["artist_id", "status", "updated_at"],
  tapes: ["id", "slug", "title", "feat", "dur", "src", "cover_url", "description", "position", "status"],
  releases: ["id", "slug", "title", "subtitle", "description", "cover_url", "artist_id", "published_at", "position", "status"],
  beats: ["id", "slug", "title", "producer", "bpm", "key_signature", "preview_url", "audio_url", "price", "currency", "licence_terms", "position", "status"],
  beats_public: ["id", "slug", "title", "producer", "bpm", "key_signature", "preview_url", "price", "currency", "licence_terms", "position", "status"],
  camping_events: ["id", "slug", "number", "title", "description", "starts_at", "ends_at", "position", "status"],
  camping_sessions: ["id", "event_id", "slug", "day", "title", "room_id", "room_name", "gallery_tag", "starts_at", "ends_at", "description", "position", "status"],
  site_flags: ["key", "value", "updated_at"],
  gallery_items: ["id", "slug", "type", "url", "media_asset_id", "poster_url", "poster_media_asset_id", "alt", "caption", "tag", "roll", "day", "timecode", "ratio", "downloadable", "download_name", "position", "status"],
  revelation_media: ["id", "type", "url", "media_asset_id", "poster_url", "poster_media_asset_id", "alt", "caption", "tag", "roll", "day", "timecode", "ratio", "downloadable", "download_name", "position", "status"],
  media_assets: ["id", "name", "asset_type", "storage_url", "public_url", "url", "storage_path", "size_bytes", "format", "mime_type", "uploader_user_id", "alt_text", "tags", "status"],
  merch_products: ["id", "slug", "code", "name", "subtitle", "spec", "description", "price", "currency", "image_url", "media_asset_id", "detail", "position", "status"],
  merch_variants: ["id", "product_id", "sku", "size", "stock_total", "stock_reserved", "stock_sold", "status"],
  inventory_movements: ["id", "variant_id", "movement_type", "quantity", "reference", "notes", "actor_user_id", "created_at"],
  reservations: ["id", "created_at", "product_id", "merch_product_id", "variant_id", "merch_variant_id", "product_name", "item_name", "size", "selected_size", "alias", "codename", "recipient_alias", "quantity", "qty", "unit_price", "price", "amount", "status", "code", "serial_number", "reference"],
  radio_tracks: ["id", "title", "artist", "artist_slug", "audio_url", "duration_seconds", "kind", "status", "rotation_weight", "position", "failure_count", "temporarily_disabled", "last_failure_at", "tags_enabled", "effects_enabled"],
  radio_station: ["id", "station_name", "station_tag_url", "active_block_id", "forced_track_id", "forced_started_at", "autoplay", "station_seed", "crossfade_ms", "tag_interval"],
  radio_blocks: ["id", "name", "track_ids", "active", "randomize"],
  site_settings: ["id", "key", "value", "status", "position"],
  site_sections: ["id", "key", "title", "subtitle", "description", "content", "position", "status"],
  drop_campaigns: ["id", "slug", "name", "title", "description", "drop_at", "starts_at", "ends_at", "marquee", "status", "position"],
  admin_profiles: ["user_id", "display_name", "role", "active"],
  audit_logs: ["id", "actor_user_id", "action", "entity_type", "entity_id", "changed_fields", "payload", "created_at"],
  events: ["id", "sid", "name", "props", "created_at"],
  members: ["id", "code", "member_number", "alias", "contact_type", "contact_value", "contact_key", "referred_by_member_id", "statute_version", "signature_present", "status", "since"],
  fan_memberships: ["id", "code", "fan_number", "alias", "referred_by_fan_id", "rules_version", "status", "since"],
  partnership_requests: ["id", "created_at", "name", "company", "contact", "partnership_type", "budget", "message", "status", "notes", "priority", "follow_up_at"],
  partnership_public: ["id", "created_at", "name", "company", "partnership_type", "budget", "status", "priority"],
};

/** Only known read-only RPCs are checked. No editorial, reservation or membership write is called. */
export const READ_ONLY_RPCS: readonly { name: string; area: ProbeArea }[] = [
  { name: "frequency_clock", area: "RÁDIO" },
  { name: "frequency_radio_catalog", area: "RÁDIO" },
  { name: "frequency_radio_station", area: "RÁDIO" },
  { name: "frequency_radio_blocks", area: "RÁDIO" },
  { name: "member_count", area: "MEMBROS" },
  { name: "delegados", area: "MEMBROS" },
] as const;

export function classifyProbe(httpStatus: number, code?: string | null): ProbeStatus {
  const value = String(code ?? "").toUpperCase();
  if (httpStatus >= 200 && httpStatus < 300) return "present";
  if (["PGRST205", "PGRST202", "PGRST204", "42P01", "42703", "42883"].includes(value) || httpStatus === 404) return "missing";
  if (httpStatus === 401 || httpStatus === 403 || value === "42501") return "restricted";
  return "error";
}

export function summarizeProbes(results: readonly ProbeResult[]) {
  return {
    present: results.filter((item) => item.status === "present").length,
    missing: results.filter((item) => item.status === "missing").length,
    restricted: results.filter((item) => item.status === "restricted").length,
    errors: results.filter((item) => item.status === "error").length,
    certified: results.every((item) => item.status === "present"),
  };
}

type AuditOptions = { accessToken?: string | null; fetcher?: typeof fetch };

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const value = await response.clone().json() as { code?: unknown };
    return typeof value.code === "string" ? value.code : undefined;
  } catch {
    return undefined;
  }
}

async function limitedMap<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      out[index] = await fn(items[index]);
    }
  }));
  return out;
}

export async function auditBackendSchema(options: AuditOptions = {}) {
  const cfg = getPublicSupabaseConfig();
  const request = options.fetcher ?? fetch;
  const checkedAt = () => new Date().toISOString();
  const tableHeaders = publicSupabaseHeaders(
    cfg.key,
    options.accessToken ? { Authorization: "Bearer " + options.accessToken } : undefined,
  );

  const tables = await limitedMap(BACKEND_TABLES, 4, async (item) => {
    const at = checkedAt();
    if (item.access === "rpc-only") {
      return { name: item.name, area: item.area, kind: "table" as const, status: "restricted" as const, httpStatus: 403, code: "RPC_ONLY", checkedAt: at };
    }
    try {
      const columns = REQUIRED_COLUMNS[item.name];
      const select = columns?.length ? columns.join(",") : "*";
      const response = await request(
        cfg.url + "/rest/v1/" + encodeURIComponent(item.name) + "?select=" + encodeURIComponent(select) + "&limit=0",
        { method: "GET", headers: tableHeaders },
      );
      const code = await readErrorCode(response);
      return {
        name: item.name,
        area: item.area,
        kind: (["partnership_public", "beats_public"].includes(item.name) ? "view" : "table") as "view" | "table",
        status: classifyProbe(response.status, code),
        httpStatus: response.status,
        code,
        checkedAt: at,
      };
    } catch {
      return {
        name: item.name,
        area: item.area,
        kind: (["partnership_public", "beats_public"].includes(item.name) ? "view" : "table") as "view" | "table",
        status: "error" as ProbeStatus,
        checkedAt: at,
      };
    }
  });

  const rpcs = await limitedMap(READ_ONLY_RPCS, 3, async (item) => {
    const at = checkedAt();
    try {
      const headers = publicSupabaseHeaders(cfg.key, {
        "Content-Type": "application/json",
        ...(options.accessToken ? { Authorization: "Bearer " + options.accessToken } : {}),
      });
      const response = await request(cfg.url + "/rest/v1/rpc/" + encodeURIComponent(item.name), {
        method: "POST",
        headers,
        body: "{}",
      });
      const code = await readErrorCode(response);
      return {
        name: item.name,
        area: item.area,
        kind: "rpc" as const,
        status: classifyProbe(response.status, code),
        httpStatus: response.status,
        code,
        checkedAt: at,
      };
    } catch {
      return { name: item.name, area: item.area, kind: "rpc" as const, status: "error" as ProbeStatus, checkedAt: at };
    }
  });

  return { tables, rpcs, startedAt: checkedAt(), finishedAt: checkedAt() };
}
