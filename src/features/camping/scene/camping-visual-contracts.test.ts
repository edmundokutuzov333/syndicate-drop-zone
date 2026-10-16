import { describe, expect, it } from "vitest";
import {
  buildCampingArtistPortraitBindings,
  CAMPING_ARTIST_SLOT_COUNT,
  resolveCampingArtistMountPose,
} from "./camping-visual-contracts";

describe("CAMPING artist wall visual contract", () => {
  it("maps official member codes to the 17 physical portrait meshes", () => {
    const artists = Array.from({ length: 17 }, (_, index) => ({
      code: "SDT-" + String(index + 1).padStart(2, "0"),
      img: "/assets/a" + String(index + 1).padStart(2, "0") + ".jpg",
    }));
    const bindings = buildCampingArtistPortraitBindings(artists);

    expect(CAMPING_ARTIST_SLOT_COUNT).toBe(17);
    expect(bindings).toHaveLength(17);
    expect(bindings[0]).toMatchObject({ slot: 1, nodeName: "studio.artist-slot-001", code: "SDT-01" });
    expect(bindings[16]).toMatchObject({ slot: 17, nodeName: "studio.artist-slot-017", code: "SDT-17" });
    expect(new Set(bindings.map((item) => item.nodeName)).size).toBe(17);
  });

  it("does not invent portraits for missing, duplicate, invalid or image-less rows", () => {
    const bindings = buildCampingArtistPortraitBindings([
      { code: "SDT-01", img: "/assets/khriys.jpg" },
      { code: "SDT-01", img: "/assets/duplicate.jpg" },
      { code: "SDT-02", img: "" },
      { code: "SDT-18", img: "/assets/not-a-member.jpg" },
      { code: "SYNTH-03", img: "/assets/not-canonical.jpg" },
      { code: "SDT-17", img: "/assets/3go.jpg" },
    ]);

    expect(bindings).toHaveLength(2);
    expect(bindings.map((item) => item.nodeName)).toEqual([
      "studio.artist-slot-001",
      "studio.artist-slot-017",
    ]);
    expect(bindings.find((item) => item.slot === 1)?.src).toBe("/assets/khriys.jpg");
  });

  it("keeps missing official slots empty instead of borrowing another artist's image", () => {
    const bindings = buildCampingArtistPortraitBindings([
      { code: "SDT-01", img: "/assets/khriys.jpg" },
      { code: "SDT-03", img: "/assets/bruno.jpg" },
    ]);

    expect(bindings.map((item) => item.slot)).toEqual([1, 3]);
    expect(bindings.some((item) => item.slot === 2)).toBe(false);
  });
});

describe("CAMPING artist wall mounting", () => {
  it("turns each portrait towards the studio and keeps its back close to the side wall", () => {
    const pose = resolveCampingArtistMountPose({
      centerX: 6.79,
      centerY: 2.61,
      centerZ: 3.1,
      depth: 0.1,
    });

    expect(pose).toMatchObject({
      centerY: 2.61,
      centerZ: 3.1,
      rotationY: -Math.PI / 2,
      wallFacing: "interior/-X",
    });
    expect(pose?.centerX).toBeCloseTo(6.895, 8);
    expect(resolveCampingArtistMountPose({
      centerX: 0,
      centerY: 1,
      centerZ: 0,
      depth: 0,
    })).toBeNull();
  });
});
