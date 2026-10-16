// Dimensiona atlas de lightmap por zona a partir da área e da densidade-alvo.
export type Zone = { id: string; surfaceM2: number; targetTexelsPerM: number };
export type AtlasPlan = { id: string; atlasPx: number; atlases: number; effectiveTexelsPerM: number };

const SIZES = [512, 1024, 2048, 4096] as const;
const PACKING_EFFICIENCY = 0.72;

export function planAtlas(zone: Zone, maxPx = 4096): AtlasPlan {
  if (!Number.isFinite(zone.surfaceM2) || zone.surfaceM2 <= 0) {
    throw new Error("surfaceM2 deve ser um número positivo.");
  }
  if (!Number.isFinite(zone.targetTexelsPerM) || zone.targetTexelsPerM <= 0) {
    throw new Error("targetTexelsPerM deve ser um número positivo.");
  }
  const maxSize = Math.min(4096, Math.max(512, maxPx));
  const requiredTexels = (zone.surfaceM2 * zone.targetTexelsPerM ** 2) / PACKING_EFFICIENCY;
  let atlasPx = 0;
  let atlases = 1;
  for (const size of SIZES) {
    if (size > maxSize) break;
    if (size * size >= requiredTexels) { atlasPx = size; break; }
  }
  if (atlasPx === 0) {
    atlasPx = maxSize;
    atlases = Math.ceil(requiredTexels / (atlasPx * atlasPx));
  }
  const effective = Math.sqrt((atlasPx * atlasPx * atlases * PACKING_EFFICIENCY) / zone.surfaceM2);
  return { id: zone.id, atlasPx, atlases, effectiveTexelsPerM: Math.round(effective * 10) / 10 };
}

/** Estimativa em MiB para uma lightmap comprimida a 8 bits/texel, incluindo mipmaps. */
export const lightmapMemoryMB = (plan: AtlasPlan, bytesPerTexel = 1): number =>
  (plan.atlasPx * plan.atlasPx * plan.atlases * Math.max(0, bytesPerTexel) * 1.333) / (1024 * 1024);
