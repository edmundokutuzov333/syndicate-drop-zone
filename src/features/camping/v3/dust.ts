import * as THREE from "three";

export function createDust(count: number, bounds: THREE.Box3, seed = 17): THREE.Points {
  const safeCount = Math.max(0, Math.floor(count));
  const positions = new Float32Array(safeCount * 3);
  let state = seed >>> 0;
  const next = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 0x100000000; };
  for (let i = 0; i < safeCount; i += 1) {
    positions[i * 3] = THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, next());
    positions[i * 3 + 1] = THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, next());
    positions[i * 3 + 2] = THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, next());
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xffd9a3, size: 0.018, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
  return new THREE.Points(geometry, material);
}
