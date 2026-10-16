import type { Artist } from "@/lib/artists";
import { ARTISTS } from "@/lib/artists";
import { getPublicSupabaseConfig } from "@/lib/supabase-public";

type DbArtist = {
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
};

type DbRelease = {
  artist_id: string;
  position: number;
  title: string;
  youtube_id: string | null;
  status: string;
};

function config() {
  return getPublicSupabaseConfig();
}

async function getJson<T>(path: string): Promise<T> {
  const cfg = config();
  if (!cfg) throw new Error("Supabase content configuration missing.");
  const response = await fetch(cfg.url + path, {
    headers: { apikey: cfg.key },
  });
  if (!response.ok) throw new Error("Supabase content request failed.");
  return (await response.json()) as T;
}

export async function getLiveArtistBySlug(slug: string): Promise<Artist | null> {
  const fallback = ARTISTS.find((artist) => artist.slug === slug) ?? null;
  try {
    const rows = await getJson<DbArtist[]>(
      "/rest/v1/artists?select=*&slug=eq." + encodeURIComponent(slug) + "&status=eq.published&limit=1",
    );
    const row = rows[0];
    if (!row) return import.meta.env.DEV ? fallback : null;
    return {
      ...(import.meta.env.DEV && fallback ? fallback : {}),
      id: row.id,
      slug: row.slug,
      code: row.code,
      name: row.name,
      bio: row.bio,
      frase: row.frase,
      zona: row.zona,
      faixas: row.faixas,
      role: row.role,
      studio: row.studio,
      edition: row.edition,
      presence: row.presence,
      spotifyArtistId: row.spotify_artist_id,
      img: row.photo_url,
      youtube: (await getJson<DbRelease[]>(
        "/rest/v1/artist_releases?select=artist_id,position,title,youtube_id,status&artist_id=eq." + encodeURIComponent(row.id) + "&status=eq.published&order=position.asc",
      )).filter((release) => Boolean(release.youtube_id)).map((release) => ({
        id: "db-" + release.position,
        youtubeId: release.youtube_id!,
        label: release.title || "Lançamento " + String(release.position).padStart(2, "0"),
      })),
    } as Artist;
  } catch {
    return import.meta.env.DEV ? fallback : null;
  }
}

export async function getLiveArtistChannels(slug: string) {
  const fallback = ARTISTS.find((artist) => artist.slug === slug);
  if (!fallback) return null;

  try {
    const artists = await getJson<DbArtist[]>(
      "/rest/v1/artists?select=id,spotify_artist_id&slug=eq." + encodeURIComponent(slug) + "&status=eq.published&limit=1",
    );
    const dbArtist = artists[0];
    if (!dbArtist) return null;

    const releases = await getJson<DbRelease[]>(
      "/rest/v1/artist_releases?select=position,title,youtube_id,status&artist_id=eq." +
        encodeURIComponent(dbArtist.id) +
        "&status=eq.published&order=position.asc",
    );

    return {
      spotifyArtistId: dbArtist.spotify_artist_id || fallback.spotifyArtistId,
      youtube: releases
        .filter((release) => release.youtube_id)
        .map((release) => ({
          id: "db-" + release.position,
          youtubeId: release.youtube_id!,
          label: release.title || "Lançamento " + String(release.position).padStart(2, "0"),
        })),
    };
  } catch {
    return import.meta.env.DEV
      ? { spotifyArtistId: fallback.spotifyArtistId, youtube: fallback.youtube }
      : { spotifyArtistId: "", youtube: [] };
  }
}


export async function getLiveArtists(): Promise<Artist[]> {
  try {
    const [rows, releases] = await Promise.all([
      getJson<DbArtist[]>("/rest/v1/artists?select=*&status=eq.published&order=code.asc"),
      getJson<DbRelease[]>("/rest/v1/artist_releases?select=artist_id,position,title,youtube_id,status&status=eq.published&order=position.asc"),
    ]);
    if (!rows.length) return import.meta.env.DEV ? ARTISTS : [];
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      code: row.code,
      name: row.name,
      bio: row.bio,
      frase: row.frase,
      zona: row.zona,
      faixas: row.faixas ?? [],
      role: row.role,
      studio: row.studio,
      edition: row.edition,
      presence: row.presence,
      spotifyArtistId: row.spotify_artist_id ?? "",
      img: row.photo_url ?? "",
      youtube: releases.filter((release) => release.artist_id === row.id && release.youtube_id).map((release) => ({
        id: "db-" + release.position,
        youtubeId: release.youtube_id!,
        label: release.title || "Lançamento " + String(release.position).padStart(2, "0"),
      })),
    } as Artist));
  } catch {
    return import.meta.env.DEV ? ARTISTS : [];
  }
}
