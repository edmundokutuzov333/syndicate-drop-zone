import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { canOccupyStudio } from "../camera/camping-collision";
import {
  createCampingV3CollisionConfig,
  deriveCampingCameraPoses,
  deriveCampingEntryPoseFromSceneBounds,
  deriveCampingFloorBounds,
  deriveCampingPoseFloorBounds,
  inspectCampingFloorGeometry,
} from "./camping-camera-poses";

function addBox(root: Group, name: string, size: [number, number, number], position: [number, number, number]): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), new MeshBasicMaterial());
  mesh.name = name;
  mesh.position.set(...position);
  root.add(mesh);
  return mesh;
}

function makeMetricStudio(): { root: Group; floor: Mesh } {
  const root = new Group();
  const floor = addBox(root, "studio.floor", [7.6, 0.1, 5.6], [0, 0, 0]);
  addBox(root, "studio.production-desk", [1.5, 1.1, 0.8], [-2, 0.75, -1]);
  addBox(root, "studio.photo-backdrop", [2.5, 2.8, 0.08], [2, 1.4, -2.45]);
  addBox(root, "studio.merch-rack", [0.8, 1.7, 0.6], [2.4, 0.95, -0.55]);
  addBox(root, "studio.artists-wall", [0.12, 2.4, 2.0], [3.45, 1.2, 0]);
  // This door-like interaction is intentionally on the back wall. Camera
  // framing must follow the declared +Z entry axis, not whichever named object
  // happens to be returned first by getObjectByName().
  addBox(root, "studio.inner-door", [0.3, 2.2, 0.12], [0, 1.1, -2.7]);
  root.updateMatrixWorld(true);
  return { root, floor };
}

describe("CAMPING V3 camera and collision coordinates", () => {
  it("ignores a full-height floor alias and selects a flat parquet surface", () => {
    const root = new Group();
    addBox(root, "studio.floor", [7.6, 3.45, 5.6], [0, 1.7, 0]);
    const parquet = addBox(root, "studio.parquet", [7.6, 0.1, 5.6], [0, 0, 0]);
    root.updateMatrixWorld(true);

    const bounds = deriveCampingFloorBounds(root);
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error("Expected a valid flat floor candidate.");
    expect(bounds.source).toBe("floor-node");
    expect(bounds.maxY).toBeCloseTo(0.05, 3);
    expect(bounds.maxY - bounds.minY).toBeLessThan(0.35);

    const poses = deriveCampingCameraPoses(root, 1.62);
    expect(poses).not.toBeNull();
    expect(poses?.entrada.position[1]).toBeCloseTo(1.67, 2);
    expect(poses?.entrada.position[1]).toBeLessThan(2);
    expect(poses?.entrada.look[1]).toBeCloseTo(1.53, 2);
    expect(new Box3().setFromObject(parquet).max.y).toBeCloseTo(0.05, 3);
  });

  it("accepts the certified floor footprint when world X/Z dimensions are swapped", () => {
    const root = new Group();
    addBox(root, "studio.parquet", [5.6, 0.1, 7.6], [0, 0, 0]);
    addBox(root, "studio.inner-door", [0.3, 2.2, 0.12], [0, 1.1, -3.7]);
    root.updateMatrixWorld(true);

    const bounds = deriveCampingFloorBounds(root);
    expect(bounds).not.toBeNull();
    expect(bounds?.width).toBeCloseTo(5.6, 2);
    expect(bounds?.depth).toBeCloseTo(7.6, 2);

    const poses = deriveCampingCameraPoses(root, 1.62);
    expect(poses).not.toBeNull();
    if (!poses) return;
    const centerZ = (bounds!.minZ + bounds!.maxZ) / 2;
    expect(poses.entrada.position[2]).toBeGreaterThan(centerZ);
    expect(poses.entrada.look[2]).toBeLessThan(centerZ);
  });

  it("does not fall back to the complete room envelope when no flat floor exists", () => {
    const root = new Group();
    addBox(root, "studio.floor", [7.6, 3.45, 5.6], [0, 1.7, 0]);
    root.updateMatrixWorld(true);
    expect(deriveCampingFloorBounds(root)).toBeNull();
    expect(deriveCampingCameraPoses(root)).toBeNull();
  });

  it("keeps the entry and guided camera positions inside the actual floor bounds", () => {
    const { root, floor } = makeMetricStudio();
    const poses = deriveCampingCameraPoses(root, 1.62);
    expect(poses).not.toBeNull();
    if (!poses) return;
    const bounds = new Box3().setFromObject(floor);
    for (const id of ["entrada", "producao", "foto", "esquerda", "direita", "tecto", "chao", "vestuario", "artistas"] as const) {
      const pose = poses[id];
      expect(pose.position[0], id + " camera x").toBeGreaterThan(bounds.min.x);
      expect(pose.position[0], id + " camera x").toBeLessThan(bounds.max.x);
      expect(pose.position[2], id + " camera z").toBeGreaterThan(bounds.min.z);
      expect(pose.position[2], id + " camera z").toBeLessThan(bounds.max.z);
      expect(pose.look.every(Number.isFinite), id + " look target").toBe(true);
    }
    const roomCenterZ = (bounds.min.z + bounds.max.z) / 2;
    expect(poses.entrada.position[2], "entry camera must be on the declared +Z side").toBeGreaterThan(roomCenterZ);
    expect(poses.entrada.look[2], "entry camera must look into the room toward -Z").toBeLessThan(roomCenterZ);
    expect(Math.hypot(
      poses.entrada.position[0] - poses.entrada.look[0],
      poses.entrada.position[2] - poses.entrada.look[2],
    )).toBeGreaterThan(2.4);
    expect(Math.hypot(
      poses.entrada.position[0] - poses.entrada.look[0],
      poses.entrada.position[2] - poses.entrada.look[2],
    )).toBeLessThan(5.2);
    expect(poses.entrada.look[1]).toBeLessThan(poses.entrada.position[1]);
    expect(poses.entrada.position[1] - poses.entrada.look[1]).toBeLessThan(0.25);
    const entryPitch = Math.atan2(
      poses.entrada.look[1] - poses.entrada.position[1],
      Math.hypot(
        poses.entrada.look[0] - poses.entrada.position[0],
        poses.entrada.look[2] - poses.entrada.position[2],
      ),
    ) * 180 / Math.PI;
    expect(entryPitch).toBeGreaterThan(-12);
    expect(entryPitch).toBeLessThanOrEqual(0);
    expect(poses.producao.position[2]).toBeGreaterThan(poses.producao.look[2]);
    expect(poses.foto.position[2]).toBeGreaterThan(poses.foto.look[2]);
    expect(poses.artistas.position[0]).toBeLessThan(poses.artistas.look[0]);
  });

  it("accepts the documented Phase 09 legacy floor in either X/Z orientation and derives a normal entry view", () => {
    const legacyFloorSizes = [
      [13.1, 0.02, 8.26],
      [8.26, 0.02, 13.1],
    ] as const;

    for (const [width, thickness, depth] of legacyFloorSizes) {
      const root = new Group();
      const floor = addBox(root, "studio.parquet", [width, thickness, depth], [0, -thickness / 2, 0]);
      root.updateMatrixWorld(true);

      const bounds = deriveCampingFloorBounds(root);
      expect(bounds, "documented legacy floor should be accepted").not.toBeNull();
      if (!bounds) throw new Error("Expected documented legacy floor bounds.");

      expect(bounds.maxY).toBeCloseTo(0, 3);
      expect(bounds.maxY - bounds.minY).toBeLessThanOrEqual(0.35);
      expect(Math.max(bounds.width, bounds.depth)).toBeGreaterThanOrEqual(12.5);
      expect(Math.min(bounds.width, bounds.depth)).toBeGreaterThanOrEqual(7.5);

      const poses = deriveCampingCameraPoses(root, 1.62);
      expect(poses, "legacy model must not block the 808 door transition").not.toBeNull();
      if (!poses) throw new Error("Expected a camera pose from documented legacy floor bounds.");

      const entry = poses.entrada;
      const floorBounds = new Box3().setFromObject(floor);
      const centerZ = (bounds.minZ + bounds.maxZ) / 2;
      expect(entry.position[1] - bounds.maxY).toBeCloseTo(1.62, 2);
      expect(entry.look[1] - bounds.maxY).toBeCloseTo(1.48, 2);
      expect(entry.position[0]).toBeGreaterThan(floorBounds.min.x);
      expect(entry.position[0]).toBeLessThan(floorBounds.max.x);
      expect(entry.position[2]).toBeGreaterThan(floorBounds.min.z);
      expect(entry.position[2]).toBeLessThan(floorBounds.max.z);
      expect(entry.position[2], "entry is inside the room on the +Z side").toBeGreaterThan(centerZ);
      expect(entry.look[2], "camera looks into the room towards -Z").toBeLessThan(centerZ);

      const horizontalDistance = Math.hypot(
        entry.position[0] - entry.look[0],
        entry.position[2] - entry.look[2],
      );
      expect(horizontalDistance).toBeGreaterThan(2.4);
      expect(horizontalDistance).toBeLessThan(5.2);

      const pitchDegrees = Math.atan2(
        entry.look[1] - entry.position[1],
        horizontalDistance,
      ) * 180 / Math.PI;
      expect(pitchDegrees).toBeGreaterThan(-12);
      expect(pitchDegrees).toBeLessThanOrEqual(0);
      expect(createCampingV3CollisionConfig(root)).not.toBeNull();
    }
  });

  it("rejects a legacy-sized vaulted room envelope instead of treating the roof as floor", () => {
    const root = new Group();
    addBox(root, "studio.parquet", [14.2, 3.45, 9.2], [0, 1.725, 0]);
    root.updateMatrixWorld(true);

    expect(deriveCampingFloorBounds(root)).toBeNull();
    expect(deriveCampingCameraPoses(root)).toBeNull();
  });

  it("rejects a flat surface outside both documented CAMPING footprints", () => {
    const root = new Group();
    addBox(root, "studio.parquet", [20, 0.02, 15], [0, -0.01, 0]);
    root.updateMatrixWorld(true);

    expect(deriveCampingFloorBounds(root)).toBeNull();
    expect(deriveCampingCameraPoses(root)).toBeNull();
  });

  it("accepts a thin, explicitly named floor whose exported footprint differs from stale plan dimensions", () => {
    const root = new Group();
    const floor = addBox(root, "studio.parquet", [11.4, 0.02, 8.4], [0, -0.01, 0]);
    root.updateMatrixWorld(true);

    const bounds = deriveCampingFloorBounds(root);
    expect(bounds).not.toBeNull();
    expect(bounds?.source).toBe("floor-node");
    expect(bounds?.width).toBeCloseTo(11.4, 2);
    expect(bounds?.depth).toBeCloseTo(8.4, 2);
    expect(bounds?.maxY).toBeCloseTo(0, 2);

    const poses = deriveCampingCameraPoses(root, 1.62);
    expect(poses).not.toBeNull();
    if (!poses || !bounds) throw new Error("Expected pose from the measured named floor.");
    expect(poses.entrada.position[1] - bounds.maxY).toBeCloseTo(1.62, 2);
    expect(poses.entrada.position[2]).toBeGreaterThan((bounds.minZ + bounds.maxZ) / 2);
    expect(poses.entrada.look[2]).toBeLessThan((bounds.minZ + bounds.maxZ) / 2);
    expect(new Box3().setFromObject(floor).max.y).toBeCloseTo(0, 2);
  });

  it("infers the actual lowest floor plane when the exporter omits the floor node name and extras", () => {
    const root = new Group();
    addBox(root, "unlabelled-floor-mesh", [11.4, 0.02, 8.4], [0, -0.01, 0]);
    addBox(root, "studio.vaulted-timber-ceiling", [11.4, 0.1, 8.4], [0, 3.4, 0]);
    root.updateMatrixWorld(true);

    const bounds = deriveCampingFloorBounds(root);
    expect(bounds).not.toBeNull();
    expect(bounds?.source).toBe("floor-inferred");
    expect(bounds?.maxY).toBeCloseTo(0, 2);

    const poses = deriveCampingCameraPoses(root, 1.62);
    expect(poses).not.toBeNull();
    if (!poses || !bounds) throw new Error("Expected an inferred entry pose.");
    expect(poses.entrada.position[1] - bounds.maxY).toBeCloseTo(1.62, 2);
    expect(poses.entrada.look[1] - bounds.maxY).toBeCloseTo(1.48, 2);
    expect(poses.entrada.look[1]).toBeLessThan(poses.entrada.position[1]);
  });

  it("keeps the 808 entry usable when a verified room has no resolvable floor node", () => {
    const root = new Group();
    // A certified room shell with walls and a vaulted roof but no floor node.
    // The emergency entry pose must be derived from the actual room envelope,
    // not a legacy hardcoded coordinate or the roof apex as the ground plane.
    addBox(root, "wall.left", [0.12, 4.35, 9.2], [-7.04, 2.175, 0]);
    addBox(root, "wall.right", [0.12, 4.35, 9.2], [7.04, 2.175, 0]);
    addBox(root, "wall.back", [14.2, 4.35, 0.12], [0, 2.175, -4.54]);
    addBox(root, "wall.front", [14.2, 4.35, 0.12], [0, 2.175, 4.54]);
    addBox(root, "ceiling.vault", [14.2, 0.1, 9.2], [0, 4.3, 0]);
    root.updateMatrixWorld(true);

    expect(deriveCampingFloorBounds(root)).toBeNull();
    const diagnostics = inspectCampingFloorGeometry(root);
    expect(diagnostics.rootBounds).not.toBeNull();
    expect(diagnostics.candidates.every((candidate) => candidate.size === null || candidate.size[1] > 0.35)).toBe(true);

    const pose = deriveCampingEntryPoseFromSceneBounds(root, 1.62);
    expect(pose).not.toBeNull();
    if (!pose) throw new Error("Expected an entry pose from the certified room bounds.");

    expect(pose.position[1]).toBeCloseTo(1.62, 2);
    expect(pose.look[1]).toBeCloseTo(1.48, 2);
    expect(pose.position[2]).toBeGreaterThan(0);
    expect(pose.look[2]).toBeLessThan(0);

    const distance = Math.hypot(
      pose.position[0] - pose.look[0],
      pose.position[2] - pose.look[2],
    );
    expect(distance).toBeGreaterThan(2.4);
    expect(distance).toBeLessThan(5.2);
    const pitch = Math.atan2(pose.look[1] - pose.position[1], distance) * 180 / Math.PI;
    expect(pitch).toBeGreaterThan(-12);
    expect(pitch).toBeLessThanOrEqual(0);
  });

  it("derives guided camera poses from a documented room envelope without inventing a physical floor collider", () => {
    const root = new Group();
    addBox(root, "SDT_shell_wall_left", [0.12, 4.35, 9.2], [-7.04, 2.175, 0]);
    addBox(root, "SDT_shell_wall_right", [0.12, 4.35, 9.2], [7.04, 2.175, 0]);
    addBox(root, "SDT_shell_wall_back", [14.2, 4.35, 0.12], [0, 2.175, -4.54]);
    addBox(root, "SDT_shell_wall_front", [14.2, 4.35, 0.12], [0, 2.175, 4.54]);
    addBox(root, "SDT_shell_vault_ceiling", [14.2, 0.1, 9.2], [0, 4.3, 0]);
    addBox(root, "SDT_shell_door_main", [1.1, 2.04, 0.12], [0, 1.02, 4.54]);
    addBox(root, "SDT_shell_vault_rib_primary_01", [0.08, 0.08, 9.2], [-3, 4.0, 0]);
    addBox(root, "SDT_shell_vault_rib_primary_02", [0.08, 0.08, 9.2], [3, 4.0, 0]);
    addBox(root, "SDT_shell_door_main_hinge_1", [0.08, 0.15, 0.1], [-0.52, 1.02, 4.5]);
    root.updateMatrixWorld(true);

    expect(deriveCampingFloorBounds(root)).toBeNull();
    const poseBounds = deriveCampingPoseFloorBounds(root);
    expect(poseBounds).not.toBeNull();
    if (!poseBounds) throw new Error("Expected room-envelope camera bounds.");
    expect(poseBounds.source).toBe("room-envelope");
    expect(poseBounds.minY).toBeCloseTo(0, 2);
    expect(poseBounds.maxY).toBeCloseTo(0, 2);

    const poses = deriveCampingCameraPoses(root, 1.62);
    expect(poses).not.toBeNull();
    if (!poses) throw new Error("Expected all guided camera poses from certified room envelope.");
    for (const id of ["entrada", "producao", "foto", "esquerda", "direita", "tecto", "chao", "vestuario", "artistas"] as const) {
      expect(poses[id].position.every(Number.isFinite), id + " position").toBe(true);
      expect(poses[id].look.every(Number.isFinite), id + " look target").toBe(true);
      expect(poses[id].position[0]).toBeGreaterThan(poseBounds.minX);
      expect(poses[id].position[0]).toBeLessThan(poseBounds.maxX);
      expect(poses[id].position[2]).toBeGreaterThan(poseBounds.minZ);
      expect(poses[id].position[2]).toBeLessThan(poseBounds.maxZ);
      expect(poses[id].position[1]).toBeCloseTo(1.62, 2);
    }
    expect(poses.entrada.position[2]).toBeGreaterThan((poseBounds.minZ + poseBounds.maxZ) / 2);
    expect(poses.entrada.look[2]).toBeLessThan((poseBounds.minZ + poseBounds.maxZ) / 2);
    expect(createCampingV3CollisionConfig(root)).toBeNull();
  });

  it("builds collision bounds and obstacle boxes from the metric V3 floor", () => {
    const { root, floor } = makeMetricStudio();
    const config = createCampingV3CollisionConfig(root);
    expect(config).not.toBeNull();
    if (!config) return;
    const bounds = new Box3().setFromObject(floor);
    expect(config.minX).toBeGreaterThan(bounds.min.x);
    expect(config.maxX).toBeLessThan(bounds.max.x);
    expect(config.minZ).toBeGreaterThan(bounds.min.z);
    expect(config.maxZ).toBeLessThan(bounds.max.z);
    expect(config.maxX - config.minX).toBeLessThan(7.6);
    expect(config.maxZ - config.minZ).toBeLessThan(5.6);
    expect(canOccupyStudio({ x: (config.minX + config.maxX) / 2, z: (config.minZ + config.maxZ) / 2 }, config)).toBe(true);
    expect(canOccupyStudio({ x: config.maxX + 1, z: 0 }, config)).toBe(false);
    expect(config.colliders.some((collider) => collider.id === "production-desk")).toBe(true);
    expect(config.colliders.some((collider) => collider.id === "photography-backdrop")).toBe(true);
  });
});
