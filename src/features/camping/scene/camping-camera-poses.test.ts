import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { canOccupyStudio } from "../camera/camping-collision";
import { createCampingV3CollisionConfig, deriveCampingCameraPoses } from "./camping-camera-poses";

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
  root.updateMatrixWorld(true);
  return { root, floor };
}

describe("CAMPING V3 camera and collision coordinates", () => {
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
    expect(poses.entrada.position[2]).toBeGreaterThan(poses.entrada.look[2]);
    expect(poses.producao.position[2]).toBeGreaterThan(poses.producao.look[2]);
    expect(poses.foto.position[2]).toBeGreaterThan(poses.foto.look[2]);
    expect(poses.artistas.position[0]).toBeLessThan(poses.artistas.look[0]);
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
    expect(canOccupyStudio({ x: (config.minX + config.maxX) / 2, z: config.minZ + 0.1 }, config)).toBe(true);
    expect(canOccupyStudio({ x: config.maxX + 1, z: 0 }, config)).toBe(false);
    expect(config.colliders.some((collider) => collider.id === "production-desk")).toBe(true);
    expect(config.colliders.some((collider) => collider.id === "photography-backdrop")).toBe(true);
  });
});
