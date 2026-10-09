import { describe, expect, it } from "vitest";
import {
  canOccupyStudio,
  createStudioCollisionConfig,
  resolveStudioMovement,
} from "./camping-collision";

describe("Xoyens studio movement collision", () => {
  const cfg = createStudioCollisionConfig();

  it("keeps the player inside the room bounds", () => {
    expect(canOccupyStudio({ x: 6.5, z: 0 }, cfg)).toBe(false);
    expect(canOccupyStudio({ x: 0, z: -4.1 }, cfg)).toBe(false);
    expect(canOccupyStudio({ x: 0, z: 3.5 }, cfg)).toBe(true);
  });

  it("prevents crossing the production desk while allowing the central aisle", () => {
    expect(canOccupyStudio({ x: -2.3, z: -3.2 }, cfg)).toBe(false);
    expect(canOccupyStudio({ x: 0, z: -2.25 }, cfg)).toBe(true);
  });

  it("prevents crossing the sofa, rack and photo backdrop", () => {
    expect(canOccupyStudio({ x: -5.5, z: 1.5 }, cfg)).toBe(false);
    expect(canOccupyStudio({ x: 3.1, z: -1.5 }, cfg)).toBe(false);
    expect(canOccupyStudio({ x: 4, z: -4.1 }, cfg)).toBe(false);
  });

  it("slides along obstacles instead of stopping both axes", () => {
    const result = resolveStudioMovement(
      { x: -4.9, z: -2.6 },
      { x: 0.8, z: 0.4 },
      cfg,
    );
    expect(result.x).toBeCloseTo(-4.9);
    expect(result.z).toBeCloseTo(-2.2);
  });
});
