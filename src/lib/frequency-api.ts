import { getPublicSupabaseConfig, publicSupabaseHeaders } from "@/lib/supabase-public";
import { getAnalyticsSessionId } from "@/lib/track";

type Clock = {
  server_now: string;
  station_started_at: string;
  program_seed: number;
};

function rpcConfig() {
  const cfg = getPublicSupabaseConfig();
  if (!cfg) throw new Error("Configuração pública do Sindicato indisponível.");
  return cfg;
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const cfg = rpcConfig();
  const response = await fetch(cfg.url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: publicSupabaseHeaders(cfg.key, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.text()) || "RPC da Frequência indisponível.");
  return (await response.json()) as T;
}

export async function getFrequencyClock(): Promise<Clock | null> {
  try {
    const rows = await rpc<Clock[]>("frequency_clock", {});
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function sendFrequencyHeartbeat(): Promise<void> {
  try {
    await rpc("frequency_heartbeat", { p_sid: getAnalyticsSessionId() });
  } catch {
    // listener presence must never break playback
  }
}

export async function getFrequencyListenerCount(): Promise<number> {
  try {
    const value = await rpc<number>("frequency_listener_count", {});
    return Number(value) || 0;
  } catch {
    return 0;
  }
}

export async function awardNightListener(code: string, hour: number): Promise<boolean> {
  if (!code) return false;
  try {
    return Boolean(await rpc<boolean>("frequency_award_night", { p_code: code, p_local_hour: hour }));
  } catch {
    return false;
  }
}

export async function hasNightListenerBadge(code: string): Promise<boolean> {
  if (!code) return false;
  try {
    return Boolean(await rpc<boolean>("frequency_has_night_badge", { p_code: code }));
  } catch {
    return false;
  }
}


type RadioCatalogRow = {
  id: string;
  title: string;
  artist: string;
  artist_slug?: string | null;
  audio_url: string;
  duration_seconds?: number | null;
  kind: "music" | "jingle" | "sfx" | string;
  rotation_weight?: number | null;
  position?: number | null;
  failure_count?: number | null;
  temporarily_disabled?: boolean | null;
};

export type RadioStationConfig = {
  station_name: string;
  station_tag_url: string;
  active_block_id: string | null;
  forced_track_id: string | null;
  forced_started_at: string | null;
  autoplay: boolean;
  station_seed: number;
  crossfade_ms: number;
  tag_interval: number;
};

export async function getRadioCatalog(): Promise<RadioCatalogRow[]> {
  try {
    return await rpc<RadioCatalogRow[]>("frequency_radio_catalog", {});
  } catch {
    return [];
  }
}

export async function getRadioStationConfig(): Promise<RadioStationConfig | null> {
  try {
    const rows = await rpc<RadioStationConfig[]>("frequency_radio_station", {});
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function markRadioTrackFailure(trackId: string): Promise<number> {
  if (!trackId) return 0;
  try {
    const value = await rpc<number>("frequency_mark_track_failure", { p_track_id: trackId });
    return Number(value) || 0;
  } catch {
    return 0;
  }
}
