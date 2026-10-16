import { ARTIST_PROFILES, type ArtistProfile } from "@/lib/artist-profiles";

export type Artist = ArtistProfile & {
  code: string;
};

export const ARTISTS: Artist[] = ARTIST_PROFILES.map((artist, index) => ({
  ...artist,
  code: `SDT-${String(index + 1).padStart(2, "0")}`,
}));
