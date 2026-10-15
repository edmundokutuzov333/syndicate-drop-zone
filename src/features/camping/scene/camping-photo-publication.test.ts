import { describe, expect, it } from "vitest";
import { countPhase09GarmentMeshes } from "../../../../scripts/camping-frontend-publication-guard";

describe("Phase 09 frontend garment gate", () => {
  it("recognizes the five numbered garment meshes", () => {
    const nodes = Array.from({ length: 5 }, (_, index) => ({
      name: "SDT_photo_garments_garment_" + (index + 1),
      mesh: index,
    }));
    expect(countPhase09GarmentMeshes(nodes)).toBe(5);
  });

  it("does not count malformed names or nodes without a mesh", () => {
    expect(countPhase09GarmentMeshes([
      { name: "SDT_photo_garments_garment_x", mesh: 0 },
      { name: "SDT_photo_garments_garment_6" },
      { name: "SDT_photo_garments_garment_7", mesh: 7 },
    ])).toBe(1);
  });
});
