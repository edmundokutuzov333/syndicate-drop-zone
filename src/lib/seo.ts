import { ARTIST_PROFILES } from "@/lib/artist-profiles";

export const SITE_ORIGIN =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://syndicate-drop-zone.vercel.app";

export const OG_IMAGE = SITE_ORIGIN + "/og.jpg";

type RouteSeo = {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  ogType: string;
  noIndex: boolean;
};

const STATIC_SEO: Record<string, Pick<RouteSeo, "title" | "description">> = {
  "/": {
    title: "O Sindicato do Trap — 1ª Edição",
    description: "Camping de estúdio na XOYENS. 17 artistas, prévias cruas, merch e lançamento a 18.12.2026.",
  },
  "/camping": {
    title: "Camping — O Sindicato do Trap",
    description: "Mapa do bunker, sessões, presença e emissão ao vivo do camping no Studio XOYENS.",
  },
  "/membros": {
    title: "Convocados — O Sindicato do Trap",
    description: "Arquivo dos 17 artistas convocados para a 1ª edição do Sindicato do Trap.",
  },
  "/merch": {
    title: "Merch — O Sindicato do Trap",
    description: "Inspecione as peças do drop e reserve a sua unidade numerada.",
  },
  "/revelacao": {
    title: "Sala de Revelação — O Sindicato do Trap",
    description: "Vídeos e fotografias cruas das gravações do camping no Studio XOYENS.",
  },
  "/filiar": {
    title: "Filiar-se — O Sindicato do Trap",
    description: "Assina o estatuto, recebe a tua carteira numerada e entra no Sindicato.",
  },
  "/frequencia": {
    title: "Frequência 808 — O Sindicato do Trap",
    description: "Rádio pirata 24h do Sindicato do Trap, com prévias, estática e identificação 808.",
  },
  "/camera": {
    title: "Camera — O Sindicato do Trap",
    description: "Câmara experimental do Sindicato do Trap com filtros de arquivo.",
  },
};

function normalizePath(pathname: string) {
  const clean = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  return clean;
}

export function buildRouteSeo(pathname: string, fallbackHomeTitle?: string): RouteSeo {
  const path = normalizePath(pathname);
  const artistMatch = path.match(/^\/membros\/([^/]+)$/);
  const controlRoom = path === "/control-room" || path.startsWith("/control-room/");
  const wallet = path.startsWith("/carteira/");
  const artist = artistMatch ? ARTIST_PROFILES.find((item) => item.slug === decodeURIComponent(artistMatch[1])) : null;

  if (artist) {
    return {
      title: artist.name + " · Arquivo de Convocados — O Sindicato do Trap",
      description: "Arquivo oficial de " + artist.name + " dentro do Sindicato do Trap.",
      canonical: SITE_ORIGIN + path,
      ogImage: artist.img || OG_IMAGE,
      ogType: "profile",
      noIndex: false,
    };
  }

  const base = STATIC_SEO[path];
  const title = base?.title || (path === "/" && fallbackHomeTitle ? fallbackHomeTitle : path === "/carteira" ? "Carteira — O Sindicato do Trap" : "O Sindicato do Trap");
  const description = base?.description || "Portal clandestino do Sindicato do Trap — 1ª edição.";
  const noIndex = controlRoom || wallet;
  const ogType = path === "/camera" ? "website" : "website";

  return {
    title,
    description,
    canonical: SITE_ORIGIN + (path === "/" ? "/" : path),
    ogImage: OG_IMAGE,
    ogType,
    noIndex,
  };
}

export function musicEventJsonLd(dropAt: number) {
  return {
    "@context": "https://schema.org",
    "@type": "MusicEvent",
    name: "O Sindicato do Trap — 1ª Edição",
    startDate: new Date(dropAt).toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: "Studio XOYENS",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Maputo",
        addressCountry: "MZ",
      },
    },
    description: "Camp de estúdio e lançamento da 1ª edição do Sindicato do Trap.",
    image: [OG_IMAGE],
    url: SITE_ORIGIN + "/",
  };
}

export function merchProductJsonLd(product: {
  id: string;
  name: string;
  spec?: string;
  img: string;
  price: number;
  left: number;
}) {
  const image = product.img || OG_IMAGE;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.spec || "Peça oficial da 1ª edição do Sindicato do Trap.",
    image: [image],
    sku: product.id,
    offers: {
      "@type": "Offer",
      price: String(product.price),
      priceCurrency: "MZN",
      availability: product.left > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: SITE_ORIGIN + "/merch",
      seller: {
        "@type": "Organization",
        name: "O Sindicato do Trap",
      },
    },
  };
}
