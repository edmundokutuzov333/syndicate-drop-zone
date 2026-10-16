import * as THREE from "three";

export function createLightCone(color: THREE.ColorRepresentation, radius: number, height: number): THREE.Mesh {
  const geometry = new THREE.ConeGeometry(radius, height, 24, 1, true);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(geometry, material);
  cone.userData.campingVolumetricCone = true;
  return cone;
}
