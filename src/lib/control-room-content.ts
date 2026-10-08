import { ARTISTS } from "@/lib/artists";
import { MERCH, SIZES, TAPES } from "@/lib/data";
import { REVELACAO_MEDIA } from "@/lib/revelacao-media";

type Row = Record<string, unknown>;

const CAMPING_EVENTS = [
  { id: "01", number: "01", title: "Estúdio", description: "Os manos gravam juntos no Studio XOYENS.", status: "published" },
  { id: "02", number: "02", title: "Estampa ao vivo", description: "Camisetas desenhadas e estampadas na hora.", status: "published" },
  { id: "03", number: "03", title: "Visualizers", description: "Filmagem dos visuais das faixas.", status: "published" },
  { id: "04", number: "04", title: "Fotos", description: "Sessões de foto durante o camping.", status: "published" },
  { id: "05", number: "05", title: "Networking", description: "Conexão entre artistas da cena.", status: "published" },
  { id: "06", number: "06", title: "Lives", description: "Sessões transmitidas nas redes.", status: "published" },
];

function artistsRows(): Row[] {
  return ARTISTS.map((artist) => ({
    id: artist.slug,
    slug: artist.slug,
    code: artist.code,
    name: artist.name,
    bio: artist.bio,
    frase: artist.frase,
    zona: artist.zona,
    faixas: artist.faixas,
    role: artist.role,
    studio: artist.studio,
    edition: artist.edition,
    presence: artist.presence,
    spotify_artist_id: artist.spotifyArtistId,
    photo_url: artist.img,
    status: "published",
  }));
}

function artistReleaseRows(): Row[] {
  return ARTISTS.flatMap((artist) =>
    artist.youtube.map((release, index) => ({
      id: release.id,
      artist_id: artist.slug,
      position: index + 1,
      title: release.label,
      youtube_id: release.youtubeId,
      status: "published",
    })),
  );
}

function tapeRows(): Row[] {
  return TAPES.map((tape, index) => ({
    id: tape.id,
    title: tape.title,
    name: tape.title,
    feat: tape.feat,
    dur: tape.dur,
    src: tape.src,
    position: index + 1,
    status: "published",
  }));
}

function releaseRows(): Row[] {
  return TAPES.map((tape, index) => ({
    id: "release-" + tape.id,
    position: index + 1,
    title: tape.title,
    subtitle: tape.feat,
    status: "published",
  }));
}

function campingSessionRows(): Row[] {
  return CAMPING_EVENTS.map((event, index) => ({
    id: "session-" + event.id,
    event_id: event.id,
    position: index + 1,
    title: event.title,
    status: "ready",
  }));
}

function revelationRows(): Row[] {
  return REVELACAO_MEDIA.map((item, index) => ({
    id: item.id,
    type: item.type,
    src: item.src,
    alt: item.alt,
    ratio: item.ratio,
    downloadable: item.downloadable,
    download_name: item.downloadName ?? "",
    position: index + 1,
    status: item.src ? "published" : "draft",
  }));
}

function merchProductRows(): Row[] {
  return MERCH.map((product) => ({
    id: "merch-" + product.n,
    code: product.n,
    name: product.name,
    subtitle: product.sub,
    spec: product.spec,
    price: product.price,
    img: product.img,
    stock_available: product.left,
    detail: product.detail,
    status: "published",
  }));
}

function merchVariantRows(): Row[] {
  return MERCH.flatMap((product) =>
    (product.n === "04" ? ["ÚNICO"] : SIZES).map((size) => ({
      id: "variant-" + product.n + "-" + size,
      product_id: "merch-" + product.n,
      size,
      stock_total: product.left,
      stock_reserved: 0,
      stock_sold: 0,
      status: "active",
    })),
  );
}

function mediaRows(): Row[] {
  const artistMedia = ARTISTS.map((artist) => ({
    id: "artist-" + artist.code,
    name: artist.name,
    asset_type: "image",
    storage_url: artist.img,
    format: "image/jpeg",
    size_bytes: 0,
    alt_text: artist.name,
    tags: ["context:artists", artist.code.toLowerCase()],
    status: "published",
  }));

  const merchMedia = MERCH.map((product) => ({
    id: "merch-media-" + product.n,
    name: product.name,
    asset_type: "image",
    storage_url: product.img,
    format: "image/jpeg",
    size_bytes: 0,
    alt_text: product.name,
    tags: ["context:merch", "drop:" + product.n],
    status: "published",
  }));

  const revelationMedia = REVELACAO_MEDIA.map((item) => ({
    id: "revelacao-media-" + item.id,
    name: item.id,
    asset_type: item.type,
    storage_url: item.src ?? "",
    format: item.type === "video" ? "video/mp4" : "image/jpeg",
    size_bytes: 0,
    alt_text: item.alt,
    tags: ["context:revelacao"],
    status: item.src ? "published" : "draft",
  }));

  const tapeMedia = TAPES.map((tape) => ({
    id: "tape-media-" + tape.id,
    name: tape.title,
    asset_type: "audio",
    storage_url: tape.src,
    format: "audio/mpeg",
    size_bytes: 0,
    alt_text: tape.title,
    tags: ["context:music"],
    status: "published",
  }));

  return [...artistMedia, ...merchMedia, ...revelationMedia, ...tapeMedia];
}

function siteSettingsRows(): Row[] {
  return [
    { id: "setting-hero-title", key: "hero_title", value: "O Sindicato do Trap", status: "published" },
    { id: "setting-hero-subtitle", key: "hero_subtitle", value: "A união do trap. Gravado no camping.", status: "published" },
    { id: "setting-marquee", key: "marquee", value: "1ª EDIÇÃO ✕ 17 ARTISTAS ✕ STUDIO XOYENS ✕ 18.12.2026 ✕ TUDO OU NADA ✕ ", status: "published" },
    { id: "setting-drop-at", key: "drop_at", value: "2026-12-18T00:00:00+02:00", status: "published" },
  ];
}

function siteSectionRows(): Row[] {
  return [
    { id: "section-hero", key: "hero", title: "O Sindicato do Trap", subtitle: "A união do trap. Gravado no camping.", status: "published" },
    { id: "section-launch", key: "launch", title: "Lançamento", date: "2026-12-18T00:00:00+02:00", status: "published" },
    ...CAMPING_EVENTS.map((event) => ({
      id: "section-camping-" + event.id,
      key: "camping-" + event.id,
      title: event.title,
      description: event.description,
      status: event.status,
    })),
  ];
}

function dropRows(): Row[] {
  return [
    {
      id: "drop-001",
      slug: "primeira-edicao",
      title: "O Sindicato do Trap",
      drop_at: "2026-12-18T00:00:00+02:00",
      status: "published",
    },
  ];
}

export function getControlRoomStaticRows(table: string): Row[] | null {
  switch (table) {
    case "artists":
      return artistsRows();
    case "artist_releases":
      return artistReleaseRows();
    case "tapes":
      return tapeRows();
    case "releases":
      return releaseRows();
    case "camping_events":
      return CAMPING_EVENTS;
    case "camping_sessions":
      return campingSessionRows();
    case "revelation_media":
      return revelationRows();
    case "merch_products":
      return merchProductRows();
    case "merch_variants":
      return merchVariantRows();
    case "media_assets":
      return mediaRows();
    case "site_settings":
      return siteSettingsRows();
    case "site_sections":
      return siteSectionRows();
    case "drop_campaigns":
      return dropRows();
    case "partnership_requests":
      return [];
    case "members":
      return [];
    case "reservations":
    case "inventory_movements":
    case "audit_logs":
    case "admin_profiles":
      return [];
    default:
      return null;
  }
}
