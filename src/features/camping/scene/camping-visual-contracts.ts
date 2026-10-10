export const CAMPING_ARTIST_SLOT_COUNT = 17;

export type CampingArtistPortraitSource = {
  code: string;
  img?: string | null;
};

export type CampingArtistPortraitBinding = {
  slot: number;
  nodeName: string;
  code: string;
  src: string;
};

/**
 * Binds only published artist records with a canonical member code and a real image URL.
 * No synthetic portrait or slot is generated when the backend omits a record.
 */
export function buildCampingArtistPortraitBindings(
  artists: readonly CampingArtistPortraitSource[],
): CampingArtistPortraitBinding[] {
  const bySlot = new Map<number, CampingArtistPortraitBinding>();

  for (const artist of artists) {
    const code = typeof artist.code === "string" ? artist.code.trim().toUpperCase() : "";
    const match = /^SDT-(\d{1,2})$/.exec(code);
    if (!match) continue;

    const slot = Number(match[1]);
    const src = typeof artist.img === "string" ? artist.img.trim() : "";
    if (!Number.isInteger(slot) || slot < 1 || slot > CAMPING_ARTIST_SLOT_COUNT || !src) continue;
    if (bySlot.has(slot)) continue;

    bySlot.set(slot, {
      slot,
      nodeName: "studio.artist-slot-" + String(slot).padStart(3, "0"),
      code,
      src,
    });
  }

  return [...bySlot.values()].sort((a, b) => a.slot - b.slot);
}
