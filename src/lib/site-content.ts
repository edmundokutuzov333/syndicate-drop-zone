import { ARTISTS } from "@/lib/artists";
import { MERCH as STATIC_MERCH, SIZES, TAPES as STATIC_TAPE_DATA, RADIO_TRACKS as STATIC_RADIO_TRACKS } from "@/lib/data";
import { REVELACAO_MEDIA as STATIC_REVELACAO_MEDIA, type RevelationMedia } from "@/lib/revelacao-media";
import type { RevelationMediaRatio, RevelationMediaType } from "@/lib/revelacao-media";
import { getLiveArtists } from "@/lib/public-content";
import { getPublicSupabaseConfig, publicSupabaseHeaders } from "@/lib/supabase-public";
import { getMemberCount } from "@/lib/membership";
import { getRadioCatalog, getRadioStationConfig } from "@/lib/frequency-api";
import { getAvailableMerchStock } from "@/lib/merch-stock";

export type ContentRow = Record<string, unknown>;

function config() {
  return getPublicSupabaseConfig();
}

async function tableRows(table: string): Promise<ContentRow[]> {
  const cfg = config();
  if (!cfg) throw new Error("Supabase content configuration missing.");
  const response = await fetch(cfg.url + "/rest/v1/" + table + "?select=*", {
    headers: { apikey: cfg.key },
  });
  if (!response.ok) throw new Error("Falha a carregar " + table + ".");
  return (await response.json()) as ContentRow[];
}

function value(row: ContentRow, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return undefined;
}

function stringValue(row: ContentRow, keys: string[], fallback = "") {
  const raw = value(row, keys);
  return raw === undefined ? fallback : String(raw);
}

function numberValue(row: ContentRow, keys: string[], fallback = 0) {
  const raw = value(row, keys);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function arrayValue(row: ContentRow, keys: string[], fallback: string[] = []) {
  const raw = value(row, keys);
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return raw.split(/\r?\n|\s*·\s*/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return fallback;
}

function isPublic(row: ContentRow) {
  const status = String(row.status ?? "").toLowerCase();
  if (!status) return true;
  return ["published", "active", "live", "ready"].includes(status);
}

function orderValue(row: ContentRow, fallback: number) {
  return numberValue(row, ["position", "sort_order", "order_index", "display_order", "sequence"], fallback);
}

async function getMediaAssetIndex(): Promise<Map<string, string>> {
  const rows = await tableRows("media_assets").catch(() => [] as ContentRow[]);
  const map = new Map<string, string>();
  for (const row of rows) {
    const id = stringValue(row, ["id", "uuid", "media_asset_id"]);
    const url = stringValue(row, ["storage_url", "public_url", "url", "file_url", "asset_url", "media_url", "src"]);
    if (id && url) map.set(id, url);
  }
  return map;
}

function mediaAssetUrl(row: ContentRow, mediaAssets: Map<string, string>) {
  const direct = stringValue(row, ["audio_url", "audio_src", "src", "storage_url", "file_url", "media_url", "url", "image_url", "photo_url", "cover_url", "thumbnail_url", "public_url", "asset_url"]);
  if (direct) return direct;
  const assetId = stringValue(row, ["media_asset_id", "image_media_asset_id", "cover_media_asset_id", "audio_media_asset_id"]);
  return assetId ? (mediaAssets.get(assetId) ?? "") : "";
}

export type LiveTape = {
  id: string;
  title: string;
  feat: string;
  dur: string;
  src: string;
  position: number;
};

const STATIC_TAPES: LiveTape[] = STATIC_TAPE_DATA.map((tape, index) => ({
  id: tape.id,
  title: tape.title,
  feat: tape.feat,
  dur: tape.dur,
  src: tape.src,
  position: index + 1,
}));

export async function getLiveTapes(): Promise<LiveTape[]> {
  try {
    const [rawRows, mediaAssets] = await Promise.all([tableRows("tapes"), getMediaAssetIndex()]);
    const rows = rawRows.filter(isPublic).sort((a, b) => orderValue(a, 0) - orderValue(b, 0));

    const tapes = rows
      .map((row, index) => {
        const src = mediaAssetUrl(row, mediaAssets);
        if (!src) return null;
        const title = stringValue(row, ["title", "name", "label"], "TAPE " + String(index + 1).padStart(2, "0"));
        const staticMatch = STATIC_TAPE_DATA.find((item) => item.title.toLowerCase() === title.toLowerCase());
        return {
          id: stringValue(row, ["id", "slug", "code"], "T" + String(index + 1)),
          title,
          feat: stringValue(
            row,
            ["feat", "artists", "artist_names", "subtitle", "contributors"],
            staticMatch?.feat ?? "SINDICATO",
          ),
          dur: stringValue(row, ["dur", "duration_label", "duration"], "0:30"),
          src,
          position: orderValue(row, index),
        };
      })
      .filter((item): item is LiveTape => Boolean(item));

    return tapes.length ? tapes : import.meta.env.DEV ? STATIC_TAPES : [];
  } catch {
    return import.meta.env.DEV ? STATIC_TAPES : [];
  }
}

export type LiveBeat = {
  id: string;
  slug: string;
  title: string;
  producer: string;
  bpm: number | null;
  keySignature: string | null;
  previewUrl: string;
  price: number | null;
  currency: string;
  licenceTerms: string;
  position: number;
};

/** Reads only the public view, which never exposes the full/private beat asset URL. */
export async function getLiveBeats(): Promise<LiveBeat[]> {
  const rows = await tableRows("beats_public");
  return rows
    .filter(isPublic)
    .sort((a, b) => orderValue(a, 0) - orderValue(b, 0))
    .map((row, index) => ({
      id: stringValue(row, ["id", "slug"]),
      slug: stringValue(row, ["slug"]),
      title: stringValue(row, ["title", "name"], "BEAT " + String(index + 1).padStart(2, "0")),
      producer: stringValue(row, ["producer"], "PRODUTOR"),
      bpm: value(row, ["bpm"]) === undefined ? null : numberValue(row, ["bpm"]),
      keySignature: stringValue(row, ["key_signature"]) || null,
      previewUrl: stringValue(row, ["preview_url"]),
      price: value(row, ["price"]) === undefined ? null : numberValue(row, ["price"]),
      currency: stringValue(row, ["currency"], "MZN"),
      licenceTerms: stringValue(row, ["licence_terms"]),
      position: orderValue(row, index),
    }))
    .filter((beat) => Boolean(beat.id && beat.title && beat.previewUrl));
}

export type LiveRadioTrack = {
  id: string;
  title: string;
  artist: string;
  src: string;
  durationSec: number;
  kind: "music" | "jingle" | "sfx";
  rotationWeight: number;
  position: number;
  failureCount: number;
  temporarilyDisabled: boolean;
};

export type LiveRadioStation = {
  station_tag_url: string;
  forcedTrackId: string | null;
  forcedStartedAt: string | null;
  activeBlockId: string | null;
  autoplay: boolean;
  stationSeed: number;
  crossfadeMs: number;
  tagInterval: number;
};

const STATIC_RADIO_FALLBACK: LiveRadioTrack[] = STATIC_RADIO_TRACKS.map((track, index) => ({
  id: track.id,
  title: track.title,
  artist: track.artist,
  src: track.src,
  durationSec: 0,
  kind: track.kind,
  rotationWeight: 1,
  position: index + 1,
  failureCount: 0,
  temporarilyDisabled: false,
}));

export async function getLiveRadioTracks(): Promise<LiveRadioTrack[]> {
  const allowedRadioSources = new Set(STATIC_RADIO_FALLBACK.map((track) => track.src));

  try {
    const rows = await getRadioCatalog();
    const mapped = rows
      .map((row, index) => {
        const src = String(row.audio_url ?? "").trim();
        if (!src || !allowedRadioSources.has(src)) return null;
        return {
          id: String(row.id ?? "radio-" + String(index + 1)),
          title: String(row.title ?? "FAIXA " + String(index + 1).padStart(2, "0")),
          artist: String(row.artist ?? "SINDICATO 808"),
          src,
          durationSec: numberValue(row as unknown as ContentRow, ["duration_seconds"], 0),
          kind: (String(row.kind ?? "music") as LiveRadioTrack["kind"]),
          rotationWeight: Math.max(1, Math.floor(Number(row.rotation_weight ?? 1))),
          position: Number(row.track_position ?? row.position ?? index + 1),
          failureCount: Math.max(0, Math.floor(Number(row.failure_count ?? 0))),
          temporarilyDisabled: Boolean(row.temporarily_disabled),
        } satisfies LiveRadioTrack;
      })
      .filter((track): track is LiveRadioTrack => Boolean(track && track.src && !track.temporarilyDisabled));

    const ordered = [...STATIC_RADIO_FALLBACK].map(
      (fallback) => mapped.find((track) => track.src === fallback.src) ?? fallback,
    );

    return ordered.filter((track) => Boolean(track.src));
  } catch {
    return STATIC_RADIO_FALLBACK;
  }
}

export async function getLiveRadioStation(): Promise<LiveRadioStation> {
  const fallback: LiveRadioStation = {
    station_tag_url: "/audio/Frequencia_808_tag.mp3",
    forcedTrackId: null,
    forcedStartedAt: null,
    activeBlockId: null,
    autoplay: true,
    stationSeed: 8080808,
    crossfadeMs: 650,
    tagInterval: 3,
  };

  try {
    const row = await getRadioStationConfig();
    if (!row) return fallback;

    return {
      station_tag_url: row.station_tag_url || fallback.station_tag_url,
      forcedTrackId: row.forced_track_id ?? null,
      forcedStartedAt: row.forced_started_at ?? null,
      activeBlockId: row.active_block_id ?? null,
      autoplay: Boolean(row.autoplay),
      stationSeed: Number(row.station_seed) || fallback.stationSeed,
      crossfadeMs: Math.min(1200, Math.max(0, Number(row.crossfade_ms) || fallback.crossfadeMs)),
      tagInterval: Math.min(9, Math.max(1, Math.floor(Number(row.tag_interval) || fallback.tagInterval))),
    };
  } catch {
    return fallback;
  }
}

export type LiveRadioBlock = {
  id: string;
  name: string;
  trackIds: string[];
  active: boolean;
  randomize: boolean;
};

export async function getLiveRadioBlocks(): Promise<LiveRadioBlock[]> {
  try {
    const rows = await tableRows("radio_blocks");
    return rows
      .filter((row) => row.active !== false)
      .map((row) => ({
        id: stringValue(row, ["id", "uuid"]),
        name: stringValue(row, ["name", "title"], "BLOCO 808"),
        trackIds: arrayValue(row, ["track_ids"], []),
        active: row.active !== false,
        randomize: row.randomize !== false,
      }))
      .filter((row) => Boolean(row.id));
  } catch {
    return [];
  }
}

export type LiveMerchVariant = {
  id: string;
  size: string;
  stockTotal: number;
  stockReserved: number;
  stockSold: number;
};

export type LiveMerchProduct = {
  id: string;
  n: string;
  img: string;
  name: string;
  sub: string;
  spec: string;
  price: number;
  left: number;
  detail: string[];
  variants: LiveMerchVariant[];
};

export async function getLiveMerchProducts(): Promise<LiveMerchProduct[]> {
  try {
    const [products, variants, mediaAssets] = await Promise.all([
      tableRows("merch_products"),
      tableRows("merch_variants").catch(() => [] as ContentRow[]),
      getMediaAssetIndex(),
    ]);

    const mapped = products.filter(isPublic).map((row, index) => {
      const id = stringValue(row, ["id", "uuid", "product_id"], String(index + 1));
      const productVariants = variants
        .filter((variant) => String(value(variant, ["product_id", "merch_product_id", "parent_id"]) ?? "") === id)
        .map((variant, variantIndex) => ({
          id: stringValue(variant, ["id", "uuid"], id + "-" + variantIndex),
          size: stringValue(variant, ["size", "label", "name"], "ÚNICO"),
          stockTotal: numberValue(variant, ["stock_total", "quantity", "stock"]),
          stockReserved: numberValue(variant, ["stock_reserved", "reserved"]),
          stockSold: numberValue(variant, ["stock_sold", "sold"]),
        }));

      const left = getAvailableMerchStock(
        productVariants,
        numberValue(row, ["stock_available", "left", "quantity_available"]),
      );

      return {
        id,
        n: stringValue(row, ["code", "sku", "number", "n"], String(index + 1).padStart(2, "0")),
        img: mediaAssetUrl(row, mediaAssets) || stringValue(row, ["img"]),
        name: stringValue(row, ["name", "title", "label"], "MERCH " + String(index + 1).padStart(2, "0")),
        sub: stringValue(row, ["subtitle", "sub", "collection", "category"], "1ª EDIÇÃO"),
        spec: stringValue(row, ["spec", "summary", "description"]),
        price: numberValue(row, ["price", "price_mt", "amount"]),
        left,
        detail: arrayValue(row, ["detail", "details", "features", "bullet_points"], import.meta.env.DEV ? STATIC_MERCH[index]?.detail ?? [] : []),
        variants: productVariants,
      };
    });

    const developmentFallback = () => STATIC_MERCH.map((item) => ({
      id: "static-" + item.n,
      n: item.n,
      img: item.img,
      name: item.name,
      sub: item.sub,
      spec: item.spec,
      price: item.price,
      left: item.left,
      detail: item.detail,
      variants: SIZES.map((size) => ({ id: "static-" + item.n + "-" + size, size, stockTotal: item.left, stockReserved: 0, stockSold: 0 })),
    }));
    return mapped.length ? mapped : import.meta.env.DEV ? developmentFallback() : [];
  } catch {
    return import.meta.env.DEV ? STATIC_MERCH.map((item) => ({
      id: "static-" + item.n,
      n: item.n,
      img: item.img,
      name: item.name,
      sub: item.sub,
      spec: item.spec,
      price: item.price,
      left: item.left,
      detail: item.detail,
      variants: SIZES.map((size) => ({ id: "static-" + item.n + "-" + size, size, stockTotal: item.left, stockReserved: 0, stockSold: 0 })),
    })) : [];
  }
}

export async function getLiveArtistsForSite() {
  return getLiveArtists();
}

function mapGalleryRows(rows: ContentRow[], mediaAssets: Map<string, string>): RevelationMedia[] {
  return rows
    .filter(isPublic)
    .sort((a, b) => orderValue(a, 0) - orderValue(b, 0))
    .map((row, index) => {
      const src = mediaAssetUrl(row, mediaAssets);
      if (!src) return null;

      const typeRaw = stringValue(row, ["type", "media_type"], "image").toLowerCase();
      const type: RevelationMediaType = typeRaw.includes("video") ? "video" : "image";
      const ratio: RevelationMediaRatio =
        stringValue(row, ["ratio", "aspect_ratio"], index % 2 ? "3:4" : "4:3") === "3:4"
          ? "3:4"
          : "4:3";
      const poster =
        stringValue(row, ["poster_url", "poster", "poster_src", "thumbnail_url"], "") ||
        mediaAssets.get(stringValue(row, ["poster_media_asset_id", "poster_asset_id"])) ||
        undefined;
      const downloadableRaw = value(row, ["downloadable", "is_downloadable"]);
      const downloadable =
        downloadableRaw === true ||
        downloadableRaw === 1 ||
        downloadableRaw === "1" ||
        downloadableRaw === "true";

      const roll = stringValue(
        row,
        ["roll", "reel", "category", "tag"],
        ROLLS[index % ROLLS.length],
      ).toUpperCase();

      return {
        id: stringValue(row, ["id", "slug"], "revelacao-" + String(index + 1).padStart(3, "0")),
        type,
        src,
        poster,
        alt: stringValue(row, ["alt", "alt_text", "caption", "title"], "Registo visual da Sala de Revelação"),
        caption: stringValue(row, ["caption", "description", "title"], ""),
        tag: stringValue(row, ["tag", "roll", "label"], roll).toUpperCase(),
        roll,
        day: numberValue(row, ["day", "day_index", "recording_day"], Math.floor(index / 5) + 1),
        timecode: stringValue(row, ["timecode", "timestamp", "time"], "00:00"),
        ratio,
        downloadable,
        downloadName: stringValue(row, ["download_name", "filename"], "") || undefined,
      } satisfies RevelationMedia;
    })
    .filter((item): item is RevelationMedia => Boolean(item));
}

const ROLLS = ["CABINE", "ESTAMPA", "BEAT", "VISUALIZER", "LIVES"] as const;

export async function getLiveRevelationMedia(): Promise<RevelationMedia[]> {
  const mediaAssets = await getMediaAssetIndex();

  try {
    const gallery = mapGalleryRows(await tableRows("gallery_items"), mediaAssets);
    if (gallery.length) return gallery;
  } catch {
    // Fallback de compatibilidade: a migration da gallery pode ainda estar pendente.
  }

  try {
    const legacy = mapGalleryRows(await tableRows("revelation_media"), mediaAssets);
    if (legacy.length) return legacy;
  } catch {
    // Fallback para o pacote estático abaixo.
  }

  return STATIC_REVELACAO_MEDIA;
}

export async function getLiveCamping() {
  const fallback = [
    { id: "01", number: "01", title: "Estúdio", description: "Os manos gravam juntos no Studio XOYENS." },
    { id: "02", number: "02", title: "Estampa ao vivo", description: "Camisetas desenhadas e estampadas na hora." },
    { id: "03", number: "03", title: "Visualizers", description: "Filmagem dos visuais das faixas." },
    { id: "04", number: "04", title: "Fotos", description: "Sessões de foto durante o camping." },
    { id: "05", number: "05", title: "Networking", description: "Conexão entre artistas da cena." },
    { id: "06", number: "06", title: "Lives", description: "Sessões transmitidas nas redes." },
  ];

  try {
    const rows = (await tableRows("camping_events")).filter(isPublic).sort((a, b) => orderValue(a, 0) - orderValue(b, 0));
    const blocks = rows.map((row, index) => ({
      id: stringValue(row, ["id", "slug"], String(index + 1)),
      number: String(orderValue(row, index + 1)).padStart(2, "0"),
      title: stringValue(row, ["title", "name", "label"], "EVENTO " + String(index + 1).padStart(2, "0")),
      description: stringValue(row, ["description", "summary", "text"]),
    }));
    return blocks.length ? blocks : fallback;
  } catch {
    return fallback;
  }
}

export async function getLiveSiteConfig() {
  const fallback = { dropAt: new Date("2026-12-18T00:00:00+02:00").getTime(), marquee: null, heroTitle: null, heroSubtitle: null };
  try {
    const [settings, sections, campaigns] = await Promise.all([
      tableRows("site_settings").catch(() => [] as ContentRow[]),
      tableRows("site_sections").catch(() => [] as ContentRow[]),
      tableRows("drop_campaigns").catch(() => [] as ContentRow[]),
    ]);

    const extract = (rows: ContentRow[], keys: string[]) => {
      for (const row of rows) {
        const key = stringValue(row, ["key", "name", "slug", "setting_key"]);
        if (!keys.includes(key)) continue;
        return stringValue(row, ["value", "content", "text"], "");
      }
      return null;
    };

    const socialRow = settings.find((row) => stringValue(row, ["key", "name", "slug", "setting_key"]) === "social");
    const socialRaw = value(socialRow ?? {}, ["value", "content", "text"]);
    const social =
      socialRaw && typeof socialRaw === "object" && !Array.isArray(socialRaw)
        ? {
            instagram: String((socialRaw as Record<string, unknown>).instagram ?? "").trim(),
            whatsapp: String((socialRaw as Record<string, unknown>).whatsapp ?? "").trim(),
          }
        : { instagram: "", whatsapp: "" };

    const campaign = campaigns.filter(isPublic).sort((a, b) => orderValue(b, 0) - orderValue(a, 0))[0];
    const dateRaw =
      stringValue(campaign ?? {}, ["drop_at", "release_at", "launch_at", "starts_at", "date"], "") ||
      extract(settings, ["drop_at", "release_at", "launch_at"]) ||
      extract(sections, ["drop_at", "release_at", "launch_at"]);
    const parsed = dateRaw ? new Date(dateRaw).getTime() : NaN;

    return {
      dropAt: Number.isFinite(parsed) ? parsed : fallback.dropAt,
      marquee: extract(settings, ["marquee", "announcement"]) ?? extract(sections, ["marquee", "announcement"]),
      heroTitle: extract(settings, ["hero_title", "title"]) ?? extract(sections, ["hero_title", "title"]),
      heroSubtitle: extract(settings, ["hero_subtitle", "subtitle"]) ?? extract(sections, ["hero_subtitle", "subtitle"]),
      social,
    };
  } catch {
    return fallback;
  }
}

export async function getLiveHomeContent() {
  const [artists, tapes, merch, site, memberCount] = await Promise.all([
    getLiveArtistsForSite(),
    getLiveTapes(),
    getLiveMerchProducts(),
    getLiveSiteConfig(),
    getMemberCount(),
  ]);
  return { artists, tapes, merch, site, memberCount };
}


export async function createPublicMerchReservation(input: {
  productId: string;
  productName: string;
  variantId?: string | null;
  size: string;
  alias: string;
  price: number;
}) {
  const cfg = config();
  if (!cfg) throw new Error("O serviço de reservas não está configurado.");

  const response = await fetch(cfg.url + "/rest/v1/rpc/create_public_merch_reservation", {
    method: "POST",
    headers: publicSupabaseHeaders(cfg.key, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      p_product_id: input.productId,
      p_product_name: input.productName,
      p_variant_id: input.variantId ?? null,
      p_size: input.size,
      p_alias: input.alias.trim(),
      p_price: input.price,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || "Não foi possível criar a reserva.");
  }

  const result = (await response.json()) as ContentRow;
  if (!result || typeof result !== "object" || !result.code) {
    throw new Error("A reserva foi recebida sem devolver uma referência válida.");
  }
  return result;
}
