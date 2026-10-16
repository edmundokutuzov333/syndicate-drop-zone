import * as THREE from "three";
import { kelvinToSrgb, lumensToCandelaPoint, lumensToCandelaSpot } from "./lighting-units";

export type RuntimeLightSpec = {
  id: string;
  kind: "point" | "spot";
  position: [number, number, number];
  lumens: number;
  kelvin: number;
  distance?: number;
  angle?: number;
  penumbra?: number;
  castShadow?: boolean;
};

export function createRuntimeLights(scene: THREE.Scene, specs: readonly RuntimeLightSpec[]): THREE.Light[] {
  const created: THREE.Light[] = [];
  for (const spec of specs) {
    const color = new THREE.Color(...kelvinToSrgb(spec.kelvin));
    const intensity = spec.kind === "spot"
      ? lumensToCandelaSpot(spec.lumens, spec.angle ?? Math.PI / 6)
      : lumensToCandelaPoint(spec.lumens);
    const light = spec.kind === "spot"
      ? new THREE.SpotLight(color, intensity, spec.distance ?? 0, spec.angle ?? Math.PI / 6, spec.penumbra ?? 0.45)
      : new THREE.PointLight(color, intensity, spec.distance ?? 0);
    light.name = `camping-runtime-light:${spec.id}`;
    light.position.set(...spec.position);
    light.castShadow = spec.castShadow === true;
    light.userData.campingLightId = spec.id;
    scene.add(light);
    created.push(light);
  }
  return created;
}

export function disposeRuntimeLights(lights: readonly THREE.Light[]): void {
  for (const light of lights) {
    light.parent?.remove(light);
    light.shadow.map?.dispose();
  }
}
