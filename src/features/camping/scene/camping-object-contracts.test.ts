import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertCampingModelBytesMatchMetadata,
  assertCampingModelMetadata,
  createCampingMaxQualityProfile,
  getCampingMaterialRenderPolicy,
  getCampingShadowPolicy,
  resolveCampingEffectivePixelRatio,
} from "./CampingStudioEngine";
import { ARTISTS } from "@/lib/artists";
import { buildCampingArtistPortraitBindings } from "./camping-visual-contracts";
import { canReserveLiveProduct, getArtistSlotIndex, getCampingObjectSection, getRoomTransitionTarget, roomRequiresBackendAuthorization } from "./camping-object-contracts";

describe("CAMPING public model cache and integrity contract", () => {
  const validMetadata = () => {
    const sha256 = "a".repeat(64);
    return {
      version: 3,
      phase: 9,
      productionPhase: 9,
      surfacePhase: 7,
      status: "blender-v3-published",
      model: "/models/camping/xoyens-studio.glb",
      geometry: { sha256, bytes: 120 },
      frontendDelivery: {
        canonicalUrl: "/models/camping/xoyens-studio.glb",
        sha256,
        bytes: 120,
      },
    };
  };

  it("accepts only fully certified Phase 09+ public model metadata", () => {
    expect(() => assertCampingModelMetadata(validMetadata())).not.toThrow();
    expect(() => assertCampingModelMetadata({
      ...validMetadata(), phase: 8, productionPhase: 8,
    })).toThrow(/refusing a stale public model/i);
  });

  it("rejects a served GLB when byte count or SHA-256 differs from its metadata", () => {
    const metadata = validMetadata();
    expect(() => assertCampingModelBytesMatchMetadata(metadata, 120, "a".repeat(64))).not.toThrow();
    expect(() => assertCampingModelBytesMatchMetadata(metadata, 119, "a".repeat(64))).toThrow(/stale or differs/i);
    expect(() => assertCampingModelBytesMatchMetadata(metadata, 120, "b".repeat(64))).toThrow(/stale or differs/i);
  });
});

describe("CAMPING object interaction contracts", () => {
  it("maps each model interaction to the correct content surface", () => {
    expect(getCampingObjectSection("studio.imac")).toBe("ROOT");
    expect(getCampingObjectSection("studio.artists-wall")).toBe("ARTISTS");
    expect(getCampingObjectSection("studio.merch-rack")).toBe("MERCH");
    expect(getCampingObjectSection("studio.photo-backdrop")).toBe("ARCHIVE");
    expect(getCampingObjectSection("studio.inner-door")).toBe("ARCHIVE");
    expect(getCampingObjectSection("studio.audio-system")).toBe("LISTEN");
    expect(getCampingObjectSection("studio.production-desk")).toBe("SESSIONS");
  });

  it("resolves only valid one-based member slots without inventing a profile", () => {
    expect(getArtistSlotIndex("studio.artist-photo.001")).toBe(0);
    expect(getArtistSlotIndex("studio.artist-photo.017")).toBe(16);
    expect(getArtistSlotIndex("studio.artist-photo.018")).toBe(17);
    expect(getArtistSlotIndex("studio.artist-photo.000")).toBeNull();
    expect(getArtistSlotIndex("studio.artist-photo.999")).toBeNull();
    expect(getArtistSlotIndex("studio.artists-wall")).toBeNull();
  });

  it("allows reservations only for IDs resolved from the published product catalogue", () => {
    expect(canReserveLiveProduct("merch-products-uuid")).toBe(true);
    expect(canReserveLiveProduct("static-01")).toBe(false);
    expect(canReserveLiveProduct(null)).toBe(false);
  });

  it("routes physical doors to real room destinations and back", () => {
    expect(getRoomTransitionTarget("studio", "studio.inner-door")).toBe("archive");
    expect(getRoomTransitionTarget("archive", "room.archive.return-door")).toBe("studio");
    expect(getRoomTransitionTarget("archive", "room.archive.listening-door")).toBe("listening");
    expect(getRoomTransitionTarget("archive", "room.archive.secret-door")).toBe("secret");
    expect(getRoomTransitionTarget("listening", "room.listening.return-door")).toBe("archive");
    expect(getRoomTransitionTarget("secret", "room.secret.return-door")).toBe("archive");
    expect(getRoomTransitionTarget("studio", "studio.imac")).toBeNull();
  });

  it("keeps secret-room discovery separate from backend authorization", () => {
    expect(getCampingObjectSection("studio.secret-drawer")).toBe("SECRET");
    expect(getCampingObjectSection("studio.secret-vault")).toBe("SECRET");
    expect(roomRequiresBackendAuthorization("secret")).toBe(true);
    expect(roomRequiresBackendAuthorization("archive")).toBe(false);
    expect(roomRequiresBackendAuthorization("studio")).toBe(false);
  });
});

describe("CAMPING entry asset initialization", () => {
  it("loads the door stamp from the imported asset instead of an undefined identifier", () => {
    const engineSource = readFileSync(resolve(process.cwd(), "src/features/camping/scene/CampingStudioEngine.ts"), "utf8");

    expect(engineSource).toContain('import sindicatoSeloAsset from "@/assets/brand/sindicato-selo.png.asset.json";');
    expect(engineSource).toContain("sindicatoSeloAsset.url");
    expect(engineSource).not.toContain("sindicatoLogo.url");
  });
});

describe("CAMPING uniform max-quality renderer profile", () => {
  it("uses the same maximum quality settings for desktop and mobile", () => {
    const devicePixelRatios = [1, 1.5, 2, 3, 4];
    const profiles = devicePixelRatios.map((ratio) => createCampingMaxQualityProfile(ratio));

    for (const profile of profiles) {
      expect(profile.tier).toBe("high");
      expect(profile.antialias).toBe(true);
      expect(profile.shadowsEnabled).toBe(true);
      expect(profile.shadowMapSize).toBe(2048);
      expect(profile.powerPreference).toBe("high-performance");
    }

    expect(profiles.map((profile) => ({
      tier: profile.tier,
      antialias: profile.antialias,
      shadowsEnabled: profile.shadowsEnabled,
      shadowMapSize: profile.shadowMapSize,
      powerPreference: profile.powerPreference,
    }))).toEqual(Array.from({ length: devicePixelRatios.length }, () => ({
      tier: "high",
      antialias: true,
      shadowsEnabled: true,
      shadowMapSize: 2048,
      powerPreference: "high-performance",
    })));
    expect(profiles.map((profile) => profile.pixelRatio)).toEqual(devicePixelRatios);
  });

  it("uses a valid default ratio when the browser reports a bad value", () => {
    expect(createCampingMaxQualityProfile(Number.NaN).pixelRatio).toBe(1);
    expect(createCampingMaxQualityProfile(0).pixelRatio).toBe(1);
  });
});

describe("CAMPING render workload policies", () => {
  it("caps rendered pixel density at 2x without selecting a different graphics tier", () => {
    expect([1, 1.5, 2, 3, 4].map(resolveCampingEffectivePixelRatio)).toEqual([1, 1.5, 2, 2, 2]);
    expect(resolveCampingEffectivePixelRatio(Number.NaN)).toBe(1);
    expect(resolveCampingEffectivePixelRatio(0)).toBe(1);
    expect(resolveCampingEffectivePixelRatio(-2)).toBe(1);
  });

  it("keeps plaster and fabric matte while retaining controlled wood reflections", () => {
    expect(getCampingMaterialRenderPolicy("plaster")).toMatchObject({
      envMapIntensity: 0.14,
      roughnessFloor: 0.88,
      metalnessCeiling: 0,
      normalScale: 0.12,
    });
    expect(getCampingMaterialRenderPolicy("fabric")).toMatchObject({
      envMapIntensity: 0.12,
      roughnessFloor: 0.82,
      metalnessCeiling: 0,
    });
    expect(getCampingMaterialRenderPolicy("wood")).toMatchObject({
      envMapIntensity: 0.2,
      roughnessFloor: 0.68,
      metalnessCeiling: 0.05,
    });
    expect(getCampingMaterialRenderPolicy("studio.floor wood")).toMatchObject({
      envMapIntensity: 0.28,
      roughnessFloor: 0.35,
      roughnessTarget: 0.48,
      metalnessCeiling: 0.02,
    });
    expect(getCampingMaterialRenderPolicy("studio.photo-floor vinyl")).toMatchObject({
      envMapIntensity: 0.06,
      roughnessFloor: 0.92,
      roughnessTarget: 0.96,
      metalnessCeiling: 0,
    });
    expect(getCampingMaterialRenderPolicy("screen").envMapIntensity).toBe(0.06);
  });

  it("avoids shadow work on large floor boards and decorative flat details", () => {
    expect(getCampingShadowPolicy("studio.floor")).toEqual({ castShadow: false, receiveShadow: true });
    expect(getCampingShadowPolicy("studio.parquet")).toEqual({ castShadow: false, receiveShadow: true });
    expect(getCampingShadowPolicy("studio.imac-screen")).toEqual({ castShadow: false, receiveShadow: false });
    expect(getCampingShadowPolicy("studio.syndicate-banner.fabric")).toEqual({ castShadow: true, receiveShadow: true });
    expect(getCampingShadowPolicy("studio.production-desk")).toEqual({ castShadow: true, receiveShadow: true });
  });
});

describe("CAMPING physical artist wall", () => {
  it("binds all 17 bundled real portrait assets to visible wall slots without creating synthetic records", () => {
    const bindings = buildCampingArtistPortraitBindings(ARTISTS);

    expect(bindings).toHaveLength(17);
    expect(new Set(bindings.map((binding) => binding.nodeName)).size).toBe(17);
    expect(bindings.every((binding) => /^studio\.artist-slot-\d{3}$/.test(binding.nodeName))).toBe(true);
    expect(bindings.every((binding) => binding.src.length > 0)).toBe(true);
    expect(bindings[0]?.nodeName).toBe("studio.artist-slot-001");
    expect(bindings[16]?.nodeName).toBe("studio.artist-slot-017");
  });

  it("does not fabricate portrait bindings for an empty live roster", () => {
    expect(buildCampingArtistPortraitBindings([])).toEqual([]);
  });
});
