import { describe, expect, it } from "vitest";
import { getCampingRendererAttempts, resolveCampingRenderProfile } from "./CampingStudioEngine";
import { ARTISTS } from "@/lib/artists";
import { buildCampingArtistPortraitBindings } from "./camping-visual-contracts";
import { canReserveLiveProduct, getArtistSlotIndex, getCampingObjectSection, getRoomTransitionTarget, roomRequiresBackendAuthorization } from "./camping-object-contracts";

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

describe("CAMPING WebGL renderer recovery", () => {
  it("retries the preferred renderer with conservative settings before declaring WebGL unavailable", () => {
    const preferred = resolveCampingRenderProfile({
      devicePixelRatio: 2,
      viewportWidth: 1920,
      deviceMemory: 16,
      hardwareConcurrency: 16,
      coarsePointer: false,
    });
    const attempts = getCampingRendererAttempts(preferred);

    expect(attempts).toHaveLength(3);
    expect(attempts[0]).toMatchObject({ antialias: true, powerPreference: "high-performance" });
    expect(attempts[1]).toMatchObject({
      antialias: false,
      powerPreference: "default",
      profile: { shadowsEnabled: false, shadowMapSize: 512 },
    });
    expect(attempts[2]).toMatchObject({
      antialias: false,
      powerPreference: "low-power",
      profile: { tier: "low", shadowsEnabled: false, pixelRatio: 0.9 },
    });
  });
});

describe("CAMPING adaptive rendering profile", () => {
  it("reduces pixel ratio and expensive shadows on constrained mobile hardware", () => {
    const profile = resolveCampingRenderProfile({
      devicePixelRatio: 3,
      viewportWidth: 390,
      deviceMemory: 4,
      hardwareConcurrency: 4,
      coarsePointer: true,
    });

    expect(profile.tier).toBe("low");
    expect(profile.pixelRatio).toBe(0.95);
    expect(profile.antialias).toBe(false);
    expect(profile.shadowsEnabled).toBe(false);
    expect(profile.shadowMapSize).toBe(512);
    expect(profile.powerPreference).toBe("low-power");
  });

  it("preserves high visual quality on a capable desktop", () => {
    const profile = resolveCampingRenderProfile({
      devicePixelRatio: 2,
      viewportWidth: 1920,
      deviceMemory: 16,
      hardwareConcurrency: 16,
      coarsePointer: false,
    });

    expect(profile.tier).toBe("high");
    expect(profile.pixelRatio).toBe(1.65);
    expect(profile.antialias).toBe(true);
    expect(profile.shadowsEnabled).toBe(true);
    expect(profile.shadowMapSize).toBe(2048);
    expect(profile.powerPreference).toBe("high-performance");
  });

  it("handles missing device-memory APIs without producing invalid budgets", () => {
    const profile = resolveCampingRenderProfile({
      devicePixelRatio: Number.NaN,
      viewportWidth: 1440,
      hardwareConcurrency: 8,
    });

    expect(profile.pixelRatio).toBe(1);
    expect(Number.isFinite(profile.pixelRatio)).toBe(true);
    expect(profile.shadowsEnabled).toBe(true);
    expect(profile.shadowMapSize).toBe(1024);
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
