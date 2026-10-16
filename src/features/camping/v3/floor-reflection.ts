import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

export function createFloorReflection(
  renderer: THREE.WebGLRenderer,
  width: number,
  depth: number,
  tier: "ultra" | "high" | "mid" | "low" | "pano",
): THREE.Object3D | null {
  if (tier !== "ultra" && tier !== "high") return null;
  const reflector = new Reflector(new THREE.PlaneGeometry(width, depth), {
    textureWidth: Math.min(renderer.domElement.width, 2048),
    textureHeight: Math.min(renderer.domElement.height, 2048),
    clipBias: 0.003,
    color: new THREE.Color(0x241b16),
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.userData.campingReflection = { fresnelPower: 3.2, blurTaps: 9 };
  return reflector;
}
