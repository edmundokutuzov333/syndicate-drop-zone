import { ARTISTS } from "@/lib/artists";

export type ArtistVideo = {
  id: string;
  youtubeId: string;
  label: string;
};

export type ArtistChannels = {
  spotifyArtistId: string;
  youtube: ArtistVideo[];
};

export const ARTIST_CHANNELS: Record<string, ArtistChannels> = {
  "masepurp": {
    spotifyArtistId: "7uOMkYjLobQzJdO5LaNuwL",
    youtube: [
      { id: "masepurp-01", youtubeId: "1tfLq0VraiQ", label: "Lançamento 01" },
      { id: "masepurp-02", youtubeId: "vbb5RJTRv04", label: "Lançamento 02" },
      { id: "masepurp-03", youtubeId: "wecXt8accQk", label: "Lançamento 03" },
    ],
  },
  "kametee": {
    spotifyArtistId: "0MtXCW1LGdsVwyYpLsslZy",
    youtube: [
      { id: "kametee-01", youtubeId: "N-AQkMGjpNI", label: "Lançamento 01" },
      { id: "kametee-02", youtubeId: "eWogXs9IUDY", label: "Lançamento 02" },
      { id: "kametee-03", youtubeId: "BbzZETffYPA", label: "Lançamento 03" },
    ],
  },
  "3go": {
    spotifyArtistId: "7a0U3cgTT4uStYXnZJFXgs",
    youtube: [
      { id: "3go-01", youtubeId: "N-AQkMGjpNI", label: "Lançamento 01" },
      { id: "3go-02", youtubeId: "8e7uROy4UOs", label: "Lançamento 02" },
      { id: "3go-03", youtubeId: "QEQnzob8wLk", label: "Lançamento 03" },
    ],
  },
  "cipher": {
    spotifyArtistId: "5xbGmD0sbNSmqXj3VzsSZY",
    youtube: [
      { id: "cipher-01", youtubeId: "kj5rPWCf1Ro", label: "Lançamento 01" },
      { id: "cipher-02", youtubeId: "ZLwqokBhqbQ", label: "Lançamento 02" },
      { id: "cipher-03", youtubeId: "P-dnE_-1AVs", label: "Lançamento 03" },
    ],
  },
  "kingston-siriro": {
    spotifyArtistId: "0V8GXIuiejkGA6m0159YNl",
    youtube: [
      { id: "kingston-siriro-01", youtubeId: "RgumO1E_7q4", label: "Lançamento 01" },
      { id: "kingston-siriro-02", youtubeId: "3rFGkLU_byw", label: "Lançamento 02" },
      { id: "kingston-siriro-03", youtubeId: "ATjMF69GV10", label: "Lançamento 03" },
    ],
  },
  "herkey-hk": {
    spotifyArtistId: "2g183yVpFQpPrLtBhOy8zF",
    youtube: [
      { id: "herkey-hk-01", youtubeId: "7J5b0kE_c_w", label: "Lançamento 01" },
      { id: "herkey-hk-02", youtubeId: "_T5Bv7BKTPQ", label: "Lançamento 02" },
      { id: "herkey-hk-03", youtubeId: "6JUypUpQ7l4", label: "Lançamento 03" },
    ],
  },
  "reinaldo-king": {
    spotifyArtistId: "3wnx882xKoP5KKfbgRCOIZ",
    youtube: [
      { id: "reinaldo-king-01", youtubeId: "CrSRCHJU5c4", label: "Lançamento 01" },
      { id: "reinaldo-king-02", youtubeId: "V9Ler_77JHE", label: "Lançamento 02" },
      { id: "reinaldo-king-03", youtubeId: "7J5b0kE_c_w", label: "Lançamento 03" },
    ],
  },
  "twista": {
    spotifyArtistId: "3c2TqwIinkQvVK0JYPYrLR",
    youtube: [
      { id: "twista-01", youtubeId: "VUwGqPWlrxI", label: "Lançamento 01" },
      { id: "twista-02", youtubeId: "p5PxNepr0Ww", label: "Lançamento 02" },
      { id: "twista-03", youtubeId: "yDUQ3-5XnT4", label: "Lançamento 03" },
    ],
  },
  "txopheer-wawa": {
    spotifyArtistId: "5GBgb1VlOXQN5jBu6Z3zMk",
    youtube: [
      { id: "txopheer-wawa-01", youtubeId: "zs9pRhWzxi4", label: "Lançamento 01" },
      { id: "txopheer-wawa-02", youtubeId: "rQ3v4CT1YZQ", label: "Lançamento 02" },
      { id: "txopheer-wawa-03", youtubeId: "NkCbNUx7xUU", label: "Lançamento 03" },
    ],
  },
  "5ir0w": {
    spotifyArtistId: "3xn6GYqDbmzCbkJtvdlbRF",
    youtube: [
      { id: "5ir0w-01", youtubeId: "iJfHBXcssns", label: "Lançamento 01" },
      { id: "5ir0w-02", youtubeId: "4qkmugBjSbc", label: "Lançamento 02" },
      { id: "5ir0w-03", youtubeId: "qc4fe0BjQQU", label: "Lançamento 03" },
    ],
  },
  "khriys": {
    spotifyArtistId: "2zLSeGbduePeKdpiuRYSry",
    youtube: [
      { id: "khriys-01", youtubeId: "XKzbL5wsFNw", label: "Lançamento 01" },
      { id: "khriys-02", youtubeId: "yeqKHuM_NXM", label: "Lançamento 02" },
      { id: "khriys-03", youtubeId: "RJNhU3afjT0", label: "Lançamento 03" },
    ],
  },
  "kaka-machava": {
    spotifyArtistId: "52sVhfDGmWOXmaiddgfWix",
    youtube: [
      { id: "kaka-machava-01", youtubeId: "mhX0o3hGisg", label: "Lançamento 01" },
      { id: "kaka-machava-02", youtubeId: "CzhomfU1AyA", label: "Lançamento 02" },
      { id: "kaka-machava-03", youtubeId: "hXjLPOKhbJg", label: "Lançamento 03" },
    ],
  },
  "kong-v12": {
    spotifyArtistId: "78YVPqfXcElqqfwbR1Egus",
    youtube: [
      { id: "kong-v12-01", youtubeId: "KJKkbNXcqfE", label: "Lançamento 01" },
      { id: "kong-v12-02", youtubeId: "9a5hsYvddSw", label: "Lançamento 02" },
      { id: "kong-v12-03", youtubeId: "TpPc2dIKcKY", label: "Lançamento 03" },
    ],
  },
  "skyler": {
    spotifyArtistId: "3BsJWmIWPWDtnNf2ppYa8c",
    youtube: [
      { id: "skyler-01", youtubeId: "CLXEDmeQ7IU", label: "Lançamento 01" },
      { id: "skyler-02", youtubeId: "xit5C-wY-GE", label: "Lançamento 02" },
      { id: "skyler-03", youtubeId: "KJKkbNXcqfE", label: "Lançamento 03" },
    ],
  },
  "pita-shana": {
    spotifyArtistId: "0MYxw3F13ZkgVex2ztSfeb",
    youtube: [
      { id: "pita-shana-01", youtubeId: "8nm7U2yhEoc", label: "Lançamento 01" },
      { id: "pita-shana-02", youtubeId: "OlhZwxQQ3ZM", label: "Lançamento 02" },
      { id: "pita-shana-03", youtubeId: "c8-WV3DG8ZM", label: "Lançamento 03" },
    ],
  },
  "bruno-the-goat": {
    spotifyArtistId: "0ZOd9IlBNOIDPKIYUKkPHp",
    youtube: [
      { id: "bruno-the-goat-01", youtubeId: "UNRJZB2sd7o", label: "Lançamento 01" },
      { id: "bruno-the-goat-02", youtubeId: "RvPESv5C8I0", label: "Lançamento 02" },
      { id: "bruno-the-goat-03", youtubeId: "QKFQmEvAzKA", label: "Lançamento 03" },
    ],
  },
  "keew080": {
    spotifyArtistId: "63M4Lo07MGOC1eEaVAXIMo",
    youtube: [
      { id: "keew080-01", youtubeId: "AqNsJCaa8kI", label: "Lançamento 01" },
      { id: "keew080-02", youtubeId: "NwP4mUA-to0", label: "Lançamento 02" },
      { id: "keew080-03", youtubeId: "A8ZhoDHcPRk", label: "Lançamento 03" },
    ],
  },
};

export function getArtistChannels(slug: string): ArtistChannels | null {
  return ARTIST_CHANNELS[slug] ?? null;
}

export function getArtistBySlug(slug: string) {
  return ARTISTS.find((artist) => artist.slug === slug) ?? null;
}
