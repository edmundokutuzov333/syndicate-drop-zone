import { describe, expect, it } from "vitest";
import { pickTier, TIER_PROFILES, type TierInput } from "./quality-tier";

const desktop: TierInput = {
  gpuTier: 2,
  isMobile: false,
  deviceMemoryGb: 8,
  hardwareConcurrency: 8,
  webgl2: true,
  maxTextureSize: 8192,
  saveData: false,
  reducedMotion: false,
};

describe("CAMPING quality tier", () => {
  it("selects deterministic desktop profiles", () => {
    expect(pickTier(desktop)).toBe(TIER_PROFILES.high);
    expect(pickTier({ ...desktop, gpuTier: 3 })).toBe(TIER_PROFILES.ultra);
    expect(pickTier({ ...desktop, gpuTier: 1 })).toBe(TIER_PROFILES.mid);
  });

  it("falls back before attempting a WebGL load", () => {
    expect(pickTier({ ...desktop, webgl2: false }).tier).toBe("pano");
    expect(pickTier({ ...desktop, gpuTier: 0 }).tier).toBe("pano");
    expect(pickTier({ ...desktop, maxTextureSize: 2048 }).tier).toBe("pano");
  });

  it("honours data, memory and accessibility constraints", () => {
    expect(pickTier({ ...desktop, saveData: true }).tier).toBe("low");
    expect(pickTier({ ...desktop, deviceMemoryGb: 2 }).tier).toBe("pano");
    expect(pickTier({ ...desktop, isMobile: true, gpuTier: 3 }).tier).toBe("mid");
    expect(pickTier({ ...desktop, isMobile: true, gpuTier: 3, reducedMotion: true }).tier).toBe("low");
  });

  it("allows an explicit owner/admin override", () => {
    expect(pickTier({ ...desktop, forced: "pano" }).tier).toBe("pano");
  });
});
