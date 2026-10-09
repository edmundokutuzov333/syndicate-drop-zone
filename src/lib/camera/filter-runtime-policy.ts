import type { FilterId } from "./types";

/**
 * Filters that consume tracked face geometry or movement.
 * Keep this policy aligned with the uniforms used by the filter shaders.
 */
const FACE_TRACKING_FILTERS: ReadonlySet<FilterId> = new Set([
  "vamp",
  "astro-haze",
  "xray-mesh",
  "kinetic-melt",
]);

/**
 * Filters that composite a separate Three.js scene over the WebGL output.
 * Astro haze uses the scene for particles; the other two use face geometry.
 */
const THREE_D_OVERLAY_FILTERS: ReadonlySet<FilterId> = new Set([
  "vamp",
  "astro-haze",
  "xray-mesh",
]);

export function requiresFaceTracking(filter: FilterId): boolean {
  return FACE_TRACKING_FILTERS.has(filter);
}

export function requires3DOverlay(filter: FilterId): boolean {
  return THREE_D_OVERLAY_FILTERS.has(filter);
}
