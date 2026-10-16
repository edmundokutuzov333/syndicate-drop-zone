export type PointXZ = { x: number; z: number };
export type RectCollider = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type StudioCollisionConfig = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  radius: number;
  colliders: readonly RectCollider[];
};

export const XOYENS_STUDIO_COLLIDERS: readonly RectCollider[] = [
  { id: "production-desk", minX: -4.65, maxX: -0.35, minZ: -3.84, maxZ: -2.84 },
  { id: "production-chair", minX: -3.05, maxX: -1.85, minZ: -2.58, maxZ: -1.34 },
  { id: "subwoofer", minX: -1.15, maxX: -0.55, minZ: -3.52, maxZ: -2.87 },
  { id: "sofa", minX: -6.95, maxX: -4.38, minZ: 0.98, maxZ: 2.02 },
  { id: "clothing-rack", minX: 1.05, maxX: 3.9, minZ: -1.86, maxZ: -1.19 },
  { id: "photography-backdrop", minX: 1.12, maxX: 6.76, minZ: -4.52, maxZ: -3.91 },
  { id: "audio-system", minX: 5.48, maxX: 6.24, minZ: -0.86, maxZ: -0.17 },
  { id: "air-conditioner-wall", minX: -0.9, maxX: 1.1, minZ: -4.18, maxZ: -3.96 },
];

function overlapsCircleRect(x: number, z: number, radius: number, rect: RectCollider): boolean {
  const nearestX = Math.max(rect.minX, Math.min(x, rect.maxX));
  const nearestZ = Math.max(rect.minZ, Math.min(z, rect.maxZ));
  const dx = x - nearestX;
  const dz = z - nearestZ;
  return dx * dx + dz * dz < radius * radius;
}

export function canOccupyStudio(
  point: PointXZ,
  config: StudioCollisionConfig,
  ignoredColliderIds: ReadonlySet<string> = new Set(),
): boolean {
  const { x, z } = point;
  if (x < config.minX + config.radius || x > config.maxX - config.radius) return false;
  if (z < config.minZ + config.radius || z > config.maxZ - config.radius) return false;
  return !config.colliders.some(
    (rect) => !ignoredColliderIds.has(rect.id) &&
      overlapsCircleRect(x, z, config.radius, rect),
  );
}

/**
 * Resolves X and Z separately to allow sliding along walls and furniture rather
 * than abruptly stopping the player. Inputs and results are world metres.
 */
export function resolveStudioMovement(
  current: PointXZ,
  delta: PointXZ,
  config: StudioCollisionConfig,
): PointXZ {
  let x = current.x;
  let z = current.z;
  const candidateX = x + delta.x;
  if (canOccupyStudio({ x: candidateX, z }, config)) x = candidateX;
  const candidateZ = z + delta.z;
  if (canOccupyStudio({ x, z: candidateZ }, config)) z = candidateZ;
  return { x, z };
}

export function createStudioCollisionConfig(
  overrides: Partial<StudioCollisionConfig> = {},
): StudioCollisionConfig {
  return {
    minX: -6.55,
    maxX: 6.55,
    minZ: -4.18,
    maxZ: 4.08,
    radius: 0.28,
    colliders: XOYENS_STUDIO_COLLIDERS,
    ...overrides,
  };
}
