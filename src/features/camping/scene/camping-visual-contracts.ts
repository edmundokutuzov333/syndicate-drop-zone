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

export type CampingArtistMountInput = {
  centerX: number;
  centerY: number;
  centerZ: number;
  depth: number;
};

export type CampingArtistMountPose = {
  centerX: number;
  centerY: number;
  centerZ: number;
  rotationY: number;
  wallFacing: "interior/-X";
};

/**
 * Returns a physical pose for mounting a portrait flush to the interior side wall.
 * The source GLB has baked vertex coordinates, so the engine applies this rotation
 * around the frame centre instead of changing the shared scene root.
 */
export function resolveCampingArtistMountPose(input: CampingArtistMountInput): CampingArtistMountPose | null {
  if (
    !Number.isFinite(input.centerX) ||
    !Number.isFinite(input.centerY) ||
    !Number.isFinite(input.centerZ) ||
    !Number.isFinite(input.depth) ||
    input.depth <= 0
  ) return null;

  return {
    centerX: 6.945 - input.depth / 2,
    centerY: input.centerY,
    centerZ: input.centerZ,
    rotationY: -Math.PI / 2,
    wallFacing: "interior/-X",
  };
}
