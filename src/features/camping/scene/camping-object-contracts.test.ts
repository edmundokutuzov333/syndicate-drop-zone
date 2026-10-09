import { describe, expect, it } from "vitest";
import { canReserveLiveProduct, getArtistSlotIndex, getCampingObjectSection } from "./camping-object-contracts";

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
});
