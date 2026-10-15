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
export type CampingFloorBounds = {
  minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
  width: number; depth: number;
  source: "floor-node" | "floor-element";
};
type FloorBounds = CampingFloorBounds;

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) return (minimum + maximum) / 2;
  return Math.max(minimum, Math.min(maximum, value));
}

function toFloorBounds(bounds: THREE.Box3, source: CampingFloorBounds["source"]): FloorBounds | null {
  if (bounds.isEmpty()) return null;
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  const depth = bounds.max.z - bounds.min.z;

  // The published CAMPING V3 contract is 7.6 m × 5.6 m. A scene-root/room
  // collection can have the same X/Z size but includes the 2.85–3.45 m walls
  // and roof. Reject it instead of using the roof apex as the camera's floor Y.
  if (
    !Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(depth) ||
    width < 5.2 || width > 9.8 || depth < 3.8 || depth > 7.4 ||
    height < 0 || height > 0.35
  ) return null;

  return {
    minX: bounds.min.x, maxX: bounds.max.x,
    minY: bounds.min.y, maxY: bounds.max.y,
    minZ: bounds.min.z, maxZ: bounds.max.z,
    width, depth, source,
  };
}

function getFloorBounds(root: THREE.Object3D): FloorBounds | null {
  root.updateMatrixWorld(true);
  const candidates: Array<{ object: THREE.Object3D; source: CampingFloorBounds["source"]; priority: number }> = [];
  const parquet = root.getObjectByName("studio.parquet");
  const floor = root.getObjectByName("studio.floor");
  if (parquet) candidates.push({ object: parquet, source: "floor-node", priority: 0 });
  if (floor) candidates.push({ object: floor, source: "floor-node", priority: 1 });

  root.traverse((object) => {
    const userData = (object as THREE.Object3D & { userData?: Record<string, unknown> }).userData;
    if (userData?.elementId === "floor.wood" || /SDT_shell_floor_wood_hero/i.test(object.name)) {
      candidates.push({ object, source: "floor-element", priority: 2 });
    }
  });

  const valid = candidates
    .map((candidate) => ({
      ...candidate,
      bounds: toFloorBounds(new THREE.Box3().setFromObject(candidate.object), candidate.source),
    }))
    .filter((candidate): candidate is typeof candidate & { bounds: FloorBounds } => candidate.bounds !== null)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      // If multiple floor meshes exist, prefer the one closest to the certified
      // 7.6 × 5.6 metre footprint, not the largest grouping object.
      const score = (bounds: FloorBounds) =>
        Math.abs(Math.log((bounds.width * bounds.depth) / (7.6 * 5.6)));
      return score(a.bounds) - score(b.bounds);
    });

  // Never substitute the full scene bounds for floor bounds. That is how a
  // ceiling apex can be mistaken for ground level and place the camera above the room.
  return valid[0]?.bounds ?? null;
}

export function deriveCampingFloorBounds(root: THREE.Object3D): CampingFloorBounds | null {
  return getFloorBounds(root);
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
  const floor = deriveCampingFloorBounds(root);
  if (!floor) return null;
  const allBounds = new THREE.Box3().setFromObject(root);
  if (allBounds.isEmpty()) return null;

  const floorY = floor.maxY;
  const eyeY = floorY + cameraHeight;
  const center = new THREE.Vector3((floor.minX + floor.maxX) / 2, floorY, (floor.minZ + floor.maxZ) / 2);
  const marginX = Math.min(0.35, floor.width * 0.06);
  const marginZ = Math.min(0.32, floor.depth * 0.07);
  const minX = floor.minX + marginX, maxX = floor.maxX - marginX;
  const minZ = floor.minZ + marginZ, maxZ = floor.maxZ - marginZ;
  const roofY = allBounds.max.y;
  const position = (x: number, z: number) =>
    new THREE.Vector3(clamp(x, minX, maxX), eyeY, clamp(z, minZ, maxZ));

  const targetPose = (names: readonly string[], distance: number, lateral = 0): CampingCameraPose | null => {
    const bounds = getObjectBounds(root, names);
    if (!bounds) return null;
    const target = bounds.getCenter(new THREE.Vector3());
    const camera = position(target.x + lateral, target.z + distance);
    const targetY = clamp(target.y, floorY + 0.9, Math.min(floorY + 1.8, roofY - 0.35));
    return serializePose(camera, new THREE.Vector3(target.x, targetY, target.z));
  };

  // Entry composition is computed from the measured room footprint, not from
  // the doorway edge. Staying 40% of the room depth behind the +Z wall prevents
  // the door leaf/frame from filling the camera while keeping a first-person view.
  const entryPosition = position(center.x, center.z + floor.depth * 0.1);
  const entryLook = new THREE.Vector3(
    clamp(center.x - floor.width * 0.08, minX, maxX),
    floorY + 1.48,
    clamp(center.z - floor.depth * 0.36, minZ, maxZ),
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
    const targetY = clamp(wall.y, floorY + 0.9, Math.min(floorY + 1.8, roofY - 0.35));
    artists = serializePose(camera, new THREE.Vector3(wall.x, targetY, wall.z));
  }

  const leftPosition = position(floor.minX + floor.width * 0.22, center.z + floor.depth * 0.08);
  const rightPosition = position(floor.maxX - floor.width * 0.22, center.z + floor.depth * 0.08);
  const leftTarget = new THREE.Vector3(floor.minX + floor.width * 0.4, eyeY, center.z - floor.depth * 0.08);
  const rightTarget = new THREE.Vector3(floor.maxX - floor.width * 0.4, eyeY, center.z - floor.depth * 0.08);
  const centerLook = new THREE.Vector3(center.x, eyeY, center.z);
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
  const floor = deriveCampingFloorBounds(root);
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
