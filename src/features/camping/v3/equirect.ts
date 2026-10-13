// Matemática da panorâmica equirectangular de referência 1774×887.
export type Dir = { x: number; y: number; z: number };
export type Pano = { width: number; height: number };

export function pixelToAngles(px: number, py: number, pano: Pano): { az: number; el: number } {
  const az = (((px / pano.width) * 360) % 360 + 360) % 360;
  const el = 90 - (py / pano.height) * 180;
  return { az, el };
}

export function anglesToPixel(az: number, el: number, pano: Pano): { x: number; y: number } {
  const a = ((az % 360) + 360) % 360;
  return { x: (a / 360) * pano.width, y: ((90 - el) / 180) * pano.height };
}

export function anglesToDir(az: number, el: number): Dir {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  const c = Math.cos(e);
  return { x: Math.sin(a) * c, y: Math.sin(e), z: -Math.cos(a) * c };
}

export function dirToAngles(direction: Dir): { az: number; el: number } {
  const len = Math.hypot(direction.x, direction.y, direction.z) || 1;
  const el = (Math.asin(direction.y / len) * 180) / Math.PI;
  const az = ((((Math.atan2(direction.x, -direction.z) * 180) / Math.PI) % 360) + 360) % 360;
  return { az, el };
}

export function groundDistance(el: number, cameraHeight: number): number | null {
  if (!Number.isFinite(el) || !Number.isFinite(cameraHeight) || cameraHeight <= 0 || el >= -0.5) return null;
  return cameraHeight / Math.tan((-el * Math.PI) / 180);
}

export function verticalExtent(elBase: number, elTop: number, cameraHeight: number): { distance: number; height: number } | null {
  const distance = groundDistance(elBase, cameraHeight);
  if (distance === null) return null;
  const height = cameraHeight + distance * Math.tan((elTop * Math.PI) / 180);
  return Number.isFinite(height) ? { distance, height } : null;
}

export function solveCameraHeight(elBase: number, elTop: number, knownHeight: number): number | null {
  if (!Number.isFinite(knownHeight) || knownHeight <= 0 || elBase >= -0.5) return null;
  const k = 1 + Math.tan((elTop * Math.PI) / 180) / Math.tan((-elBase * Math.PI) / 180);
  return k > 0 ? knownHeight / k : null;
}
