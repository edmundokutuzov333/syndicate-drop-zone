import { describe, expect, it } from "vitest";
import { anglesToDir, anglesToPixel, dirToAngles, groundDistance, pixelToAngles, solveCameraHeight } from "./equirect";
import { ev100ToExposure, kelvinToSrgb, lumensToCandelaPoint, lumensToCandelaSpot } from "./lighting-units";
import { DynamicResolution } from "./dynamic-resolution";
import { lightmapMemoryMB, planAtlas } from "./lightmap-budget";
import { makeImpulseResponse } from "./procedural-ir";
import { referenceMatchScore, sectorStats, srgbToLab } from "./sector-stats";

const PANO = { width: 1774, height: 887 };

describe("CAMPING kit / equirectangular geometry", () => {
  it("maps the panorama centre to azimuth 180 and the horizon", () => {
    const a = pixelToAngles(887, 443.5, PANO);
    expect(Math.round(a.az)).toBe(180);
    expect(Math.round(a.el)).toBe(0);
  });
  it("round-trips pixels, angles and directions", () => {
    const a = pixelToAngles(1330, 300, PANO);
    const p = anglesToPixel(a.az, a.el, PANO);
    expect(Math.round(p.x)).toBe(1330);
    expect(Math.round(p.y)).toBe(300);
    const b = dirToAngles(anglesToDir(a.az, a.el));
    expect(Math.round(b.az * 100)).toBe(Math.round(a.az * 100));
    expect(Math.round(b.el * 100)).toBe(Math.round(a.el * 100));
  });
  it("solves floor distance and camera height", () => {
    expect(groundDistance(-45, 1.5)).toBeCloseTo(1.5);
    expect(groundDistance(10, 1.5)).toBeNull();
    expect(solveCameraHeight(-45, 45, 3)).toBeCloseTo(1.5);
    expect(solveCameraHeight(10, 45, 3)).toBeNull();
  });
});

describe("CAMPING kit / photometry", () => {
  it("converts lumens into candelas and Kelvin to sRGB", () => {
    expect(lumensToCandelaPoint(1000)).toBeCloseTo(79.6, 1);
    expect(lumensToCandelaSpot(1000, Math.PI / 4)).toBeCloseTo(543.4, 1);
    const warm = kelvinToSrgb(2200);
    const neutral = kelvinToSrgb(6500);
    expect(warm[0]).toBe(1);
    expect(warm[2]).toBeLessThan(0.45);
    expect(Math.abs(neutral[0] - neutral[2])).toBeLessThan(0.08);
    expect(ev100ToExposure(5)).toBeGreaterThan(ev100ToExposure(8));
  });
});

describe("CAMPING kit / dynamic resolution", () => {
  it("lowers scale when frames are slow and restores after sustained headroom", () => {
    const drs = new DynamicResolution(1);
    let changes = 0;
    for (let i = 0; i < 40; i += 1) if (drs.update(30)) changes += 1;
    expect(drs.scale).toBeLessThan(1);
    expect(changes).toBeGreaterThanOrEqual(1);
    const low = drs.scale;
    for (let i = 0; i < 400; i += 1) drs.update(8);
    expect(drs.scale).toBeGreaterThan(low);
    expect(drs.scale).toBeLessThanOrEqual(1);
    expect(drs.update(500)).toBe(false);
  });
});

describe("CAMPING kit / lightmaps", () => {
  it("plans an atlas and estimates memory", () => {
    const p = planAtlas({ id: "shell", surfaceM2: 160, targetTexelsPerM: 96 });
    expect(p.atlasPx).toBe(2048);
    expect(lightmapMemoryMB(p)).toBeLessThan(8);
    const big = planAtlas({ id: "production", surfaceM2: 400, targetTexelsPerM: 220 }, 4096);
    expect(big.atlases).toBeGreaterThan(1);
  });
});

describe("CAMPING kit / procedural room impulse", () => {
  it("creates a decaying and normalised stereo response", () => {
    const [left, right] = makeImpulseResponse({ sampleRate: 8000, rt60: 0.3, seed: 808 });
    expect(left.length).toBe(right.length);
    expect(left.length).toBeGreaterThan(2000);
    const energy = (b: Float32Array, a: number, z: number) => {
      let sum = 0;
      for (let i = a; i < z; i += 1) sum += (b[i] ?? 0) ** 2;
      return sum;
    };
    expect(energy(left, 100, 800)).toBeGreaterThan(energy(left, left.length - 800, left.length));
    let peak = 0;
    for (const v of left) peak = Math.max(peak, Math.abs(v));
    for (const v of right) peak = Math.max(peak, Math.abs(v));
    expect(Math.abs(peak - 0.9)).toBeLessThan(0.01);
  });
});

describe("CAMPING kit / reference score", () => {
  const image = (width: number, height: number, pixel: (x: number, y: number) => [number, number, number]) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
    return { data, width, height };
  };
  it("converts Lab values and pinpoints visible regional differences", () => {
    expect(Math.round(srgbToLab(255, 255, 255)[0])).toBe(100);
    expect(Math.round(srgbToLab(0, 0, 0)[0])).toBe(0);
    const reference = image(480, 240, (x) => [200 + (x % 3), 120, 60]);
    const dark = image(480, 240, () => [10, 10, 10]);
    const stats = sectorStats(reference);
    expect(referenceMatchScore(stats, stats).score).toBe(100);
    expect(referenceMatchScore(stats, sectorStats(dark)).score).toBeLessThan(60);
    const mismatch = image(480, 240, (x) => x < 20 ? [10, 10, 10] : [200 + (x % 3), 120, 60]);
    expect(referenceMatchScore(stats, sectorStats(mismatch)).worst[0]!.az).toBeLessThan(20);
  });
});
