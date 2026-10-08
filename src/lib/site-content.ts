import { ARTISTS } from "@/lib/artists";
import { MERCH as STATIC_MERCH, SIZES, TAPES as STATIC_TAPE_DATA } from "@/lib/data";
import { REVELACAO_MEDIA as STATIC_REVELACAO_MEDIA, type RevelationMedia } from "@/lib/revelacao-media";
import type { RevelationMediaRatio, RevelationMediaType } from "@/lib/revelacao-media";
import { getLiveArtists } from "@/lib/public-content";
import { getPublicSupabaseConfig } from "@/lib/supabase-public";

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
        return {
          id: stringValue(row, ["id", "slug", "code"], "T" + String(index + 1)),
          title: stringValue(row, ["title", "name", "label"], "TAPE " + String(index + 1).padStart(2, "0")),
          feat: stringValue(row, ["feat", "artists", "artist_names", "subtitle", "contributors"], "SINDICATO"),
          dur: stringValue(row, ["dur", "duration_label", "duration"], "0:30"),
          src,
          position: orderValue(row, index),
        };
      })
      .filter((item): item is LiveTape => Boolean(item));

    return tapes.length ? tapes : STATIC_TAPES;
  } catch {
    return STATIC_TAPES;
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

      const left = productVariants.reduce(
        (sum, variant) => sum + Math.max(0, variant.stockTotal - variant.stockReserved - variant.stockSold),
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
        detail: arrayValue(row, ["detail", "details", "features", "bullet_points"], STATIC_MERCH[index]?.detail ?? []),
        variants: productVariants,
      };
    });

    return mapped.length ? mapped : STATIC_MERCH.map((item) => ({
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
  } catch {
    return STATIC_MERCH.map((item) => ({
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
  }
}

export async function getLiveArtistsForSite() {
  return getLiveArtists();
}

export async function getLiveRevelationMedia(): Promise<RevelationMedia[]> {
  try {
    const [rawRows, mediaAssets] = await Promise.all([tableRows("revelation_media"), getMediaAssetIndex()]);
    const rows = rawRows.filter(isPublic).sort((a, b) => orderValue(a, 0) - orderValue(b, 0));
    const mapped = rows.map((row, index) => {
      const src = mediaAssetUrl(row, mediaAssets);
      if (!src) return null;
      const typeRaw = stringValue(row, ["type", "media_type"], "image").toLowerCase();
      const type: RevelationMediaType = typeRaw.includes("video") ? "video" : "image";
      const ratio: RevelationMediaRatio = stringValue(row, ["ratio", "aspect_ratio"], index % 2 ? "3:4" : "4:3") === "3:4" ? "3:4" : "4:3";
      return {
        id: stringValue(row, ["id", "slug"], "revelacao-" + String(index + 1).padStart(3, "0")),
        type,
        src,
        alt: stringValue(row, ["alt", "alt_text", "caption", "title"], "Registo visual da Sala de Revelação"),
        ratio,
        downloadable: Boolean(value(row, ["downloadable", "is_downloadable"]) ?? false),
        downloadName: stringValue(row, ["download_name", "filename"], "") || undefined,
      };
    }).filter(Boolean) as unknown as RevelationMedia[];
    return mapped.length ? mapped : STATIC_REVELACAO_MEDIA.filter((item) => item.src);
  } catch {
    return STATIC_REVELACAO_MEDIA.filter((item) => item.src);
  }
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
    };
  } catch {
    return fallback;
  }
}

export async function getLiveHomeContent() {
  const [artists, tapes, merch, site] = await Promise.all([
    getLiveArtistsForSite(),
    getLiveTapes(),
    getLiveMerchProducts(),
    getLiveSiteConfig(),
  ]);
  return { artists, tapes, merch, site };
}


async function tableSchema(table: string): Promise<Record<string, unknown> | null> {
  const cfg = config();
  if (!cfg) return null;
  try {
    const response = await fetch(cfg.url + "/rest/v1/", { headers: { apikey: cfg.key } });
    if (!response.ok) return null;
    const document = (await response.json()) as {
      definitions?: Record<string, { properties?: Record<string, unknown> }>;
      components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
    };
    return document.definitions?.[table]?.properties ??
      document.components?.schemas?.[table]?.properties ??
      null;
  } catch {
    return null;
  }
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

  const properties = await tableSchema("reservations");
  if (!properties) throw new Error("O schema de reservas não está disponível.");

  const candidates: Record<string, unknown> = {
    product_id: input.productId,
    merch_product_id: input.productId,
    variant_id: input.variantId ?? undefined,
    merch_variant_id: input.variantId ?? undefined,
    product_name: input.productName,
    item_name: input.productName,
    size: input.size,
    selected_size: input.size,
    alias: input.alias || "ANÔNIMO",
    codename: input.alias || "ANÔNIMO",
    recipient_alias: input.alias || "ANÔNIMO",
    quantity: 1,
    qty: 1,
    unit_price: input.price,
    price: input.price,
    amount: input.price,
    status: "new",
  };

  const payload: Record<string, unknown> = {};
  for (const [key, candidate] of Object.entries(candidates)) {
    if (properties[key] && candidate !== undefined) payload[key] = candidate;
  }
  if (!Object.keys(payload).length) throw new Error("A tabela de reservas não expõe campos compatíveis.");

  const response = await fetch(cfg.url + "/rest/v1/reservations", {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: "Bearer " + cfg.key,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "Não foi possível criar a reserva.");
  }
  const rows = (await response.json()) as ContentRow[];
  return rows[0] ?? payload;
}
