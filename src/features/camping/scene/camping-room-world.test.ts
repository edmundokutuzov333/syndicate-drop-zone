import { describe, expect, it } from "vitest";
import { canOccupyStudio } from "../camera/camping-collision";
import {
  createCampingRoomLayout,
  getCampingRoomCollision,
  getCampingRoomEntry,
} from "./CampingRoomWorld";

describe("CAMPING physical room navigation", () => {
  const layout = createCampingRoomLayout({ x: 0.15, z: -4.02 });

  it("places the archive beyond the actual inner-door wall and gives each room a distinct location", () => {
    expect(layout.normal).toEqual({ x: 0, z: -1 });
    expect(layout.centers.archive.z).toBeLessThan(layout.door.z);
    expect(layout.centers.listening.x).not.toBe(layout.centers.archive.x);
    expect(layout.centers.secret.z).toBeLessThan(layout.centers.archive.z);
  });

  it("aligns the archive entrance and secret passage with their room thresholds", () => {
    const archive = layout.centers.archive;
    const secret = layout.centers.secret;
    const normal = layout.normal;
    const alongNormal = (point: { x: number; z: number }) =>
      (point.x - layout.door.x) * normal.x + (point.z - layout.door.z) * normal.z;

    expect(alongNormal(archive)).toBeCloseTo(6.1, 4);
    expect(alongNormal(secret)).toBeCloseTo(17.1, 4);
  });

  it("provides a navigable spawn position for every room", () => {
    for (const roomId of ["archive", "listening", "secret"] as const) {
      const entry = getCampingRoomEntry(roomId, layout);
      const collision = getCampingRoomCollision(roomId, layout);
      expect(entry.position.y).toBeCloseTo(1.62);
      expect(canOccupyStudio({ x: entry.position.x, z: entry.position.z }, collision)).toBe(true);
    }
  });

  it("keeps room walls and closed door leaves as physical collision barriers", () => {
    const archive = getCampingRoomCollision("archive", layout);
    const listening = getCampingRoomCollision("listening", layout);
    expect(archive.colliders.some((item) => item.id === "room.archive.secret-door.closed-leaf")).toBe(true);
    expect(archive.colliders.some((item) => item.id.startsWith("room-wall-archive-"))).toBe(true);
    expect(listening.colliders.some((item) => item.id === "room.listening.return-door.closed-leaf")).toBe(true);
  });

  it("uses separate collision spaces for the room interiors", () => {
    const archive = getCampingRoomCollision("archive", layout);
    const listening = getCampingRoomCollision("listening", layout);
    const secret = getCampingRoomCollision("secret", layout);
    expect(archive.minX).not.toBe(listening.minX);
    expect(listening.minZ).not.toBe(secret.minZ);
    expect(archive.colliders.map((item) => item.id)).not.toEqual(listening.colliders.map((item) => item.id));
  });
});
