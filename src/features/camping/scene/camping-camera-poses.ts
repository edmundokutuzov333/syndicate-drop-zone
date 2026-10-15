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
  source: "floor-node" | "floor-element" | "floor-inferred" | "room-envelope";
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
  const footprintArea = width * depth;

  // Accept only an explicitly identified floor surface (or the measured lowest
  // horizontal plane fallback below), never the room root. The published asset's
  // metricPlan and runtimeCompatibility currently describe different generations,
  // so dimensions alone cannot be used as the identity check for the actual floor.
  // Keep a finite envelope around both documented footprints and require a genuinely
  // thin surface; a ceiling, wall, or whole-room group therefore remains invalid.
  const longSide = Math.max(width, depth);
  const shortSide = Math.min(width, depth);
  if (
    !Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(depth) ||
    width < 3.8 || depth < 3.8 ||
    longSide > 16 ||
    footprintArea < 30 || footprintArea > 180 ||
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

  const documentedAreas = [7.6 * 5.6, 13.1 * 8.26, 14.2 * 9.2];
  const score = (bounds: FloorBounds) => {
    const area = bounds.width * bounds.depth;
    return Math.min(...documentedAreas.map((expected) => Math.abs(Math.log(area / expected))));
  };
  const valid = candidates
    .map((candidate) => ({
      ...candidate,
      bounds: toFloorBounds(new THREE.Box3().setFromObject(candidate.object), candidate.source),
    }))
    .filter((candidate): candidate is typeof candidate & { bounds: FloorBounds } => candidate.bounds !== null)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return score(a.bounds) - score(b.bounds);
    });
  if (valid[0]) return valid[0].bounds;

  // Recovery path for exports whose floor node was renamed or lost its extras.
  // Find a thin, broad mesh at the measured bottom of the actual scene. This is
  // still geometry-derived: roof/furniture at elevated Y, tall boxes, COL_* objects,
  // and arbitrarily large planes are rejected. No camera pose is guessed from the roof.
  const sceneBounds = new THREE.Box3().setFromObject(root);
  if (sceneBounds.isEmpty()) return null;
  const lowestSceneY = sceneBounds.min.y;
  const inferred: FloorBounds[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || /^COL_/i.test(mesh.name)) return;
    const bounds = new THREE.Box3().setFromObject(mesh);
    if (bounds.isEmpty()) return;
    if (bounds.min.y > lowestSceneY + 0.65 || bounds.max.y > lowestSceneY + 1.0) return;
    const floorBounds = toFloorBounds(bounds, "floor-inferred");
    if (floorBounds) inferred.push(floorBounds);
  });
  inferred.sort((a, b) => {
    const areaDifference = b.width * b.depth - a.width * a.depth;
    return Math.abs(areaDifference) > 0.01 ? areaDifference : score(a) - score(b);
  });
  return inferred[0] ?? null;
}

export function deriveCampingFloorBounds(root: THREE.Object3D): CampingFloorBounds | null {
  return getFloorBounds(root);
}

/**
 * Camera-only bounds when the certified visual GLB contains no measurable floor mesh.
 * The room envelope must come from many real architectural meshes and a documented
 * footprint/height range. This plane is NOT a physical collider and is never used to
 * certify a floor mesh; it only lets entry and guided camera poses remain usable.
 */
type StructuralRoomEnvelope = {
  bounds: THREE.Box3;
  groundY: number;
  width: number;
  depth: number;
  meshCount: number;
  wallCount: number;
  ceilingCount: number;
};

const STRUCTURAL_ROOM_MESH =
  /^(?:SDT_shell_(?:walls?_plaster(?:_.*)?|wall_.*|vault_.*|door_.*|soffit.*|baseboard.*|ac_split.*|conduit.*|outlet.*|switch.*)|studio\.(?:inner-door|vaulted-timber-ceiling|ceiling-arches)|arch\.(?:walls_plaster|wall_.*|vault_ceiling|door_.*|soffit_box)|(?:wall|ceiling|vault|door)[._ -].*)/i;

/**
 * Measure the architectural shell independently from the full GLB root.
 * Decorative meshes can extend beyond the room envelope and must not invalidate
 * the camera. Only each mesh's own geometry bounds are used, never parent bounds.
 */
function getStructuralRoomEnvelope(root: THREE.Object3D): StructuralRoomEnvelope | null {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  const wallBottoms: number[] = [];
  let meshCount = 0;
  let wallCount = 0;
  let ceilingCount = 0;

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || /^COL_/i.test(mesh.name) || !STRUCTURAL_ROOM_MESH.test(mesh.name)) return;

    const geometry = mesh.geometry;
    if (!geometry?.attributes?.position?.count) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const localBounds = geometry.boundingBox;
    if (!localBounds || localBounds.isEmpty()) return;

    const meshBounds = localBounds.clone().applyMatrix4(mesh.matrixWorld);
    if (meshBounds.isEmpty()) return;
    const width = meshBounds.max.x - meshBounds.min.x;
    const height = meshBounds.max.y - meshBounds.min.y;
    const depth = meshBounds.max.z - meshBounds.min.z;
    if (![width, height, depth, meshBounds.min.y, meshBounds.max.y].every(Number.isFinite)) return;

    bounds.union(meshBounds);
    meshCount += 1;
    if (/wall/i.test(mesh.name) && height >= 1.8) {
      wallCount += 1;
      wallBottoms.push(meshBounds.min.y);
    }
    if (/vault|ceiling/i.test(mesh.name)) ceilingCount += 1;
  });

  if (bounds.isEmpty() || meshCount < 3 || wallCount < 2 || ceilingCount < 1) return null;

  const width = bounds.max.x - bounds.min.x;
  const depth = bounds.max.z - bounds.min.z;
  const structuralHeight = bounds.max.y - bounds.min.y;
  const area = width * depth;
  const longSide = Math.max(width, depth);
  const shortSide = Math.min(width, depth);

  // Accept only the documented metric and legacy room envelopes.
  if (
    ![width, depth, structuralHeight, area].every(Number.isFinite) ||
    longSide < 5.2 || longSide > 16 ||
    shortSide < 4.2 || shortSide > 10 ||
    area < 30 || area > 180 ||
    structuralHeight < 1.8 || structuralHeight > 6.5
  ) return null;

  wallBottoms.sort((a, b) => a - b);
  const middle = Math.floor(wallBottoms.length / 2);
  const groundY = wallBottoms.length % 2 === 1
    ? wallBottoms[middle]
    : (wallBottoms[middle - 1] + wallBottoms[middle]) / 2;
  if (!Number.isFinite(groundY) || groundY < bounds.min.y - 0.35 || groundY > bounds.min.y + 0.65) return null;

  return { bounds, groundY, width, depth, meshCount, wallCount, ceilingCount };
}

function deriveRoomEnvelopePoseBounds(root: THREE.Object3D): FloorBounds | null {
  const envelope = getStructuralRoomEnvelope(root);
  if (!envelope) return null;
  // Camera-only ground envelope. This is never used as a physical collider.
  return {
    minX: envelope.bounds.min.x,
    maxX: envelope.bounds.max.x,
    minY: envelope.groundY,
    maxY: envelope.groundY,
    minZ: envelope.bounds.min.z,
    maxZ: envelope.bounds.max.z,
    width: envelope.width,
    depth: envelope.depth,
    source: "room-envelope",
  };
}

export function deriveCampingPoseFloorBounds(root: THREE.Object3D): CampingFloorBounds | null {
  return deriveCampingFloorBounds(root) ?? deriveRoomEnvelopePoseBounds(root);
}



/**
 * Emergency entry framing for a SHA-verified, certified Blender room when the
 * exported floor node/extras cannot be resolved. This does not claim the root
 * bounds are the floor: it uses the root's lowest world-space Y only to recover
 * eye height, and accepts only the documented metric or legacy room envelope.
 * Guided poses and movement colliders still require real floor bounds.
 */
export function deriveCampingEntryPoseFromSceneBounds(
  root: THREE.Object3D,
  cameraHeight = 1.62,
): CampingCameraPose | null {
  const envelope = getStructuralRoomEnvelope(root);
  if (!envelope) return null;

  const { bounds, width, depth, groundY } = envelope;
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerZ = (bounds.min.z + bounds.max.z) / 2;
  const zMargin = Math.min(0.35, depth * 0.05);
  const positionInset = Math.min(1.15, depth * 0.22);
  const lookInset = Math.min(1.65, depth * 0.28);
  const positionZ = clamp(centerZ + positionInset, bounds.min.z + zMargin, bounds.max.z - zMargin);
  const lookZ = clamp(centerZ - lookInset, bounds.min.z + zMargin, bounds.max.z - zMargin);
  if (positionZ <= centerZ || lookZ >= centerZ) return null;

  return {
    position: [centerX, groundY + cameraHeight, positionZ],
    look: [centerX, groundY + 1.48, lookZ],
  };
}

/** Small, safe-to-publish measurements for diagnosing why a floor candidate was rejected. */
export function inspectCampingFloorGeometry(root: THREE.Object3D): {
  rootBounds: [number, number, number, number, number, number] | null;
  candidates: Array<{
    name: string;
    elementId: string | null;
    isMesh: boolean;
    visible: boolean;
    bounds: [number, number, number, number, number, number] | null;
    size: [number, number, number] | null;
  }>;
} {
  root.updateMatrixWorld(true);
  const tuple = (box: THREE.Box3): [number, number, number, number, number, number] => [
    box.min.x, box.max.x, box.min.y, box.max.y, box.min.z, box.max.z,
  ];
  const rootBox = new THREE.Box3().setFromObject(root);
  const candidates: Array<{
    name: string;
    elementId: string | null;
    isMesh: boolean;
    visible: boolean;
    bounds: [number, number, number, number, number, number] | null;
    size: [number, number, number] | null;
  }> = [];

  root.traverse((object) => {
    const userData = (object as THREE.Object3D & { userData?: Record<string, unknown> }).userData;
    const elementId = typeof userData?.elementId === "string" ? userData.elementId : null;
    if (elementId !== "floor.wood" && !/floor|parquet|wood|vinyl/i.test(object.name)) return;
    const box = new THREE.Box3().setFromObject(object);
    const empty = box.isEmpty();
    candidates.push({
      name: object.name,
      elementId,
      isMesh: Boolean((object as THREE.Mesh).isMesh),
      visible: object.visible,
      bounds: empty ? null : tuple(box),
      size: empty ? null : [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z],
    });
  });

  return {
    rootBounds: rootBox.isEmpty() ? null : tuple(rootBox),
    candidates: candidates.slice(0, 24),
  };
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
  const floor = deriveCampingPoseFloorBounds(root);
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
  const structuralEnvelope = getStructuralRoomEnvelope(root);
  const roofY = structuralEnvelope?.bounds.max.y ?? allBounds.max.y;
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

  // Enter from the contractually defined +Z side, but keep the camera away from
  // the door leaf and frame the usable interior. The bounded offsets maintain a
  // human first-person composition for both the metric target and current legacy room.
  const entryPositionInset = Math.min(1.15, floor.depth * 0.22);
  const entryLookInset = Math.min(1.65, floor.depth * 0.28);
  const entryPosition = position(center.x, center.z + entryPositionInset);
  const entryLook = new THREE.Vector3(
    center.x,
    floorY + 1.48,
    clamp(center.z - entryLookInset, minZ, maxZ),
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
