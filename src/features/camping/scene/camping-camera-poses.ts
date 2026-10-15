import * as THREE from "three";
import {
  createStudioCollisionConfig,
  type RectCollider,
  type StudioCollisionConfig,
} from "../camera/camping-collision";

export type CampingCameraPoseName =
  | "entrada" | "producao" | "foto" | "esquerda" | "direita"
  | "tecto" | "chao" | "vestuario" | "artistas";

export type CampingCameraPose = {
  position: [number, number, number];
  look: [number, number, number];
};
export type CampingCameraPoseMap = Record<CampingCameraPoseName, CampingCameraPose>;
type FloorBounds = { minX: number; maxX: number; minZ: number; maxZ: number; width: number; depth: number };

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) return (minimum + maximum) / 2;
  return Math.max(minimum, Math.min(maximum, value));
}

function getFloorBounds(root: THREE.Object3D): FloorBounds | null {
  root.updateMatrixWorld(true);
  const floor = root.getObjectByName("studio.floor") ?? root.getObjectByName("studio.parquet");
  if (!floor) return null;
  const bounds = new THREE.Box3().setFromObject(floor);
  if (bounds.isEmpty()) return null;
  const width = bounds.max.x - bounds.min.x;
  const depth = bounds.max.z - bounds.min.z;
  if (!Number.isFinite(width) || !Number.isFinite(depth) || width < 1.5 || depth < 1.5) return null;
  return { minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z, width, depth };
}

function getObjectBounds(root: THREE.Object3D, names: readonly string[]): THREE.Box3 | null {
  for (const name of names) {
    const object = root.getObjectByName(name);
    if (!object) continue;
    const bounds = new THREE.Box3().setFromObject(object);
    if (!bounds.isEmpty()) return bounds;
  }
  return null;
}

function serializePose(position: THREE.Vector3, look: THREE.Vector3): CampingCameraPose {
  return { position: [position.x, position.y, position.z], look: [look.x, look.y, look.z] };
}

/** Resolve V3 views against its metric floor, not stale coordinates from the wider legacy studio. */
export function deriveCampingCameraPoses(root: THREE.Object3D, cameraHeight = 1.62): CampingCameraPoseMap | null {
  const floor = getFloorBounds(root);
  if (!floor) return null;
  const allBounds = new THREE.Box3().setFromObject(root);
  if (allBounds.isEmpty()) return null;

  const center = new THREE.Vector3((floor.minX + floor.maxX) / 2, 0, (floor.minZ + floor.maxZ) / 2);
  const marginX = Math.min(0.35, floor.width * 0.06);
  const marginZ = Math.min(0.32, floor.depth * 0.07);
  const minX = floor.minX + marginX, maxX = floor.maxX - marginX;
  const minZ = floor.minZ + marginZ, maxZ = floor.maxZ - marginZ;
  const floorY = allBounds.min.y, roofY = allBounds.max.y;
  const position = (x: number, z: number) =>
    new THREE.Vector3(clamp(x, minX, maxX), cameraHeight, clamp(z, minZ, maxZ));

  const targetPose = (names: readonly string[], distance: number, lateral = 0): CampingCameraPose | null => {
    const bounds = getObjectBounds(root, names);
    if (!bounds) return null;
    const target = bounds.getCenter(new THREE.Vector3());
    const camera = position(target.x + lateral, target.z + distance);
    const targetY = clamp(target.y, floorY + 0.75, roofY - 0.25);
    return serializePose(camera, new THREE.Vector3(target.x, targetY, target.z));
  };

  const entryPosition = position(center.x, floor.maxZ - Math.min(0.9, floor.depth * 0.18));
  const entryLook = new THREE.Vector3(
    center.x,
    clamp(cameraHeight - 0.05, floorY + 0.9, roofY - 0.35),
    clamp(center.z - floor.depth * 0.12, minZ, maxZ - 0.15),
  );
  const production = targetPose(["studio.production-desk", "studio.imac"], Math.min(1.65, floor.depth * 0.3));
  const photography = targetPose(["studio.photo-backdrop"], Math.min(1.55, floor.depth * 0.28));

  const clothingBounds = getObjectBounds(root, ["studio.merch-rack", "studio.clothing-rack"]);
  const clothingCenter = clothingBounds?.getCenter(new THREE.Vector3());
  const clothingOffset = clothingCenter
    ? (clothingCenter.x >= center.x ? -Math.min(0.85, floor.width * 0.12) : Math.min(0.85, floor.width * 0.12))
    : 0;
  const clothing = targetPose(["studio.merch-rack", "studio.clothing-rack"], Math.min(1.3, floor.depth * 0.24), clothingOffset);

  const artistsBounds = getObjectBounds(root, ["studio.artists-wall", "studio.artist-slot-009"]);
  let artists: CampingCameraPose | null = null;
  if (artistsBounds) {
    const wall = artistsBounds.getCenter(new THREE.Vector3());
    const directionIntoRoom = wall.x >= center.x ? -1 : 1;
    const camera = position(wall.x + directionIntoRoom * Math.min(1.2, floor.width * 0.18), wall.z);
    const targetY = clamp(wall.y, floorY + 0.75, roofY - 0.25);
    artists = serializePose(camera, new THREE.Vector3(wall.x, targetY, wall.z));
  }

  const leftPosition = position(floor.minX + floor.width * 0.22, center.z + floor.depth * 0.08);
  const rightPosition = position(floor.maxX - floor.width * 0.22, center.z + floor.depth * 0.08);
  const leftTarget = new THREE.Vector3(floor.minX + floor.width * 0.4, cameraHeight, center.z - floor.depth * 0.08);
  const rightTarget = new THREE.Vector3(floor.maxX - floor.width * 0.4, cameraHeight, center.z - floor.depth * 0.08);
  const centerLook = new THREE.Vector3(center.x, cameraHeight, center.z);
  return {
    entrada: serializePose(entryPosition, entryLook),
    producao: production ?? serializePose(position(center.x, center.z + floor.depth * 0.18), centerLook),
    foto: photography ?? serializePose(position(center.x, center.z + floor.depth * 0.2), centerLook),
    esquerda: serializePose(leftPosition, leftTarget),
    direita: serializePose(rightPosition, rightTarget),
    tecto: serializePose(position(center.x, center.z + floor.depth * 0.18), new THREE.Vector3(center.x, roofY - 0.08, center.z - floor.depth * 0.08)),
    chao: serializePose(position(center.x, center.z + floor.depth * 0.18), new THREE.Vector3(center.x, floorY + 0.04, center.z - floor.depth * 0.08)),
    vestuario: clothing ?? serializePose(rightPosition, rightTarget),
    artistas: artists ?? serializePose(leftPosition, leftTarget),
  };
}

/** Replace legacy collision rectangles with furniture bounds from the V3 model. */
export function createCampingV3CollisionConfig(root: THREE.Object3D): StudioCollisionConfig | null {
  const floor = getFloorBounds(root);
  if (!floor) return null;
  const marginX = Math.min(0.38, floor.width * 0.07);
  const marginZ = Math.min(0.36, floor.depth * 0.08);
  const minX = floor.minX + marginX, maxX = floor.maxX - marginX;
  const minZ = floor.minZ + marginZ, maxZ = floor.maxZ - marginZ;
  const colliders: RectCollider[] = [];
  const obstacles: Array<{ id: string; names: readonly string[] }> = [
    { id: "production-desk", names: ["studio.production-desk"] },
    { id: "production-chair", names: ["studio.production-chair"] },
    { id: "clothing-rack", names: ["studio.merch-rack", "studio.clothing-rack"] },
    { id: "photography-backdrop", names: ["studio.photo-backdrop"] },
    { id: "audio-system", names: ["studio.audio-system"] },
    { id: "artists-wall", names: ["studio.artists-wall"] },
  ];
  for (const obstacle of obstacles) {
    const bounds = getObjectBounds(root, obstacle.names);
    if (!bounds) continue;
    const padding = 0.1;
    const rect: RectCollider = {
      id: obstacle.id,
      minX: Math.max(minX, bounds.min.x - padding),
      maxX: Math.min(maxX, bounds.max.x + padding),
      minZ: Math.max(minZ, bounds.min.z - padding),
      maxZ: Math.min(maxZ, bounds.max.z + padding),
    };
    if (rect.maxX - rect.minX < 0.12 || rect.maxZ - rect.minZ < 0.12) continue;
    colliders.push(rect);
  }
  return createStudioCollisionConfig({ minX, maxX, minZ, maxZ, radius: 0.28, colliders });
}
