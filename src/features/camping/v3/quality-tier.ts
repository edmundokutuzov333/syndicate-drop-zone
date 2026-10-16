export type Tier = "ultra" | "high" | "mid" | "low" | "pano";

export type TierInput = {
  gpuTier: 0 | 1 | 2 | 3;
  isMobile: boolean;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number;
  webgl2: boolean;
  maxTextureSize: number;
  saveData: boolean;
  reducedMotion: boolean;
  forced?: Tier | null;
};

export type TierProfile = {
  tier: Tier;
  pixelRatioMax: number;
  lightmapPx: 4096 | 2048 | 1024 | 0;
  textureMax: 2048 | 1024 | 512 | 0;
  ao: "n8ao-high" | "n8ao-low" | "baked" | "none";
  bloom: boolean;
  smaa: boolean;
  reflections: "planar" | "probe" | "none";
  shadows: "off" | "baked+1dynamic";
  particles: number;
  drs: boolean;
  budgetMB: number;
};

export const TIER_PROFILES: Readonly<Record<Tier, TierProfile>> = {
  ultra: { tier: "ultra", pixelRatioMax: 2, lightmapPx: 4096, textureMax: 2048, ao: "n8ao-high", bloom: true, smaa: true, reflections: "planar", shadows: "baked+1dynamic", particles: 900, drs: true, budgetMB: 28 },
  high: { tier: "high", pixelRatioMax: 1.75, lightmapPx: 2048, textureMax: 2048, ao: "n8ao-low", bloom: true, smaa: true, reflections: "planar", shadows: "baked+1dynamic", particles: 500, drs: true, budgetMB: 20 },
  mid: { tier: "mid", pixelRatioMax: 1.5, lightmapPx: 2048, textureMax: 1024, ao: "baked", bloom: true, smaa: true, reflections: "probe", shadows: "off", particles: 220, drs: true, budgetMB: 12 },
  low: { tier: "low", pixelRatioMax: 1.25, lightmapPx: 1024, textureMax: 512, ao: "baked", bloom: false, smaa: false, reflections: "none", shadows: "off", particles: 0, drs: true, budgetMB: 6 },
  pano: { tier: "pano", pixelRatioMax: 1.5, lightmapPx: 0, textureMax: 0, ao: "none", bloom: false, smaa: false, reflections: "none", shadows: "off", particles: 0, drs: false, budgetMB: 4 },
};

export function pickTier(input: TierInput): TierProfile {
  if (input.forced) return TIER_PROFILES[input.forced];
  if (!input.webgl2 || input.gpuTier === 0 || input.maxTextureSize < 4096) return TIER_PROFILES.pano;

  const lowMemory = input.deviceMemoryGb !== null && input.deviceMemoryGb <= 3;
  if (input.saveData || lowMemory || input.hardwareConcurrency <= 2) {
    return input.gpuTier >= 2 && !lowMemory ? TIER_PROFILES.low : TIER_PROFILES.pano;
  }
  if (input.isMobile) return input.gpuTier >= 3 && !input.reducedMotion ? TIER_PROFILES.mid : TIER_PROFILES.low;
  if (input.gpuTier === 3) return TIER_PROFILES.ultra;
  if (input.gpuTier === 2) return TIER_PROFILES.high;
  return TIER_PROFILES.mid;
}
