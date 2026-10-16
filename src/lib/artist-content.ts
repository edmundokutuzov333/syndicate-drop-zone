import { ARTIST_PROFILES, type ArtistProfile, type ArtistVideo } from "@/lib/artist-profiles";

export type { ArtistProfile, ArtistVideo };

export function getArtistChannels(slug: string) {
  const artist = ARTIST_PROFILES.find((item) => item.slug === slug);
  if (!artist) return null;
  return {
    spotifyArtistId: artist.spotifyArtistId,
    youtube: artist.youtube,
  };
}

export function getArtistBySlug(slug: string): ArtistProfile | null {
  return ARTIST_PROFILES.find((artist) => artist.slug === slug) ?? null;
}
