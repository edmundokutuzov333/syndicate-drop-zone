import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { TierProfile } from "./quality-tier";

export const LM_SCALE = 4;
const MODEL_ROOT = "/models/camping/";
const GROUPS = ["shell", "production", "photo", "left", "right"] as const;

type PublicManifestFile = { path: string; role: string; tier: string; sha256: string };
export type PublicModelManifest = { schema: number; phase: number; files: PublicManifestFile[] };

export type StudioAsset = {
  gltf: GLTF;
  root: THREE.Group;
  lightmaps: Map<string, THREE.Texture>;
  dispose: () => void;
};

function modelPath(manifest: PublicModelManifest | null, tier: TierProfile): string {
  const requested = tier.tier === "ultra" ? "high" : tier.tier;
  const match = manifest?.files.find((file) => file.role === "visual" && file.tier === requested);
  return match?.path ? "/" + match.path.replace(/^\//, "") : `${MODEL_ROOT}xoyens-studio.${requested}.glb`;
}

async function readManifest(): Promise<PublicModelManifest | null> {
  try {
    const response = await fetch(`${MODEL_ROOT}manifest.json?_sdt_loader=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    const value = (await response.json()) as PublicModelManifest;
    if (value.schema !== 1 || !Array.isArray(value.files)) return null;
    return value;
  } catch {
    return null;
  }
}

export function makeLoaders(renderer: THREE.WebGLRenderer, manager?: THREE.LoadingManager) {
  const ktx2 = new KTX2Loader(manager).setTranscoderPath("/basis/").detectSupport(renderer);
  const gltf = new GLTFLoader(manager).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  return { gltf, ktx2 };
}

export function bindLightmaps(root: THREE.Object3D, lightmaps: Map<string, THREE.Texture>, maxAnisotropy: number): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const group = String(mesh.userData["lmGroup"] ?? mesh.parent?.userData["lmGroup"] ?? "");
    const texture = lightmaps.get(group);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard.isMeshStandardMaterial) continue;
      if (texture && (mesh.geometry.getAttribute("uv1") || mesh.geometry.getAttribute("uv2"))) {
        texture.channel = 1;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.anisotropy = Math.min(4, maxAnisotropy);
        standard.lightMap = texture;
        standard.lightMapIntensity = LM_SCALE;
      } else if (standard.aoMap && standard.aoMap.channel === 1 && mesh.userData["lmFromAo"] !== false) {
        standard.lightMap = standard.aoMap;
        standard.lightMapIntensity = LM_SCALE;
        standard.aoMap = null;
      }
      standard.needsUpdate = true;
    }
  });
}

export async function loadStudio(
  renderer: THREE.WebGLRenderer,
  tier: TierProfile,
  onProgress?: (progress: number) => void,
): Promise<StudioAsset> {
  const manifest = await readManifest();
  const { gltf: loader, ktx2 } = makeLoaders(renderer);
  const gltf = await loader.loadAsync(modelPath(manifest, tier), (event) => {
    if (event.total > 0) onProgress?.(event.loaded / event.total);
  });
  const lightmaps = new Map<string, THREE.Texture>();
  const lightmapPx = tier.lightmapPx;
  if (lightmapPx > 0) {
    await Promise.all(GROUPS.map(async (group) => {
      try {
        const texture = await ktx2.loadAsync(`${MODEL_ROOT}lm/LM_${group}_${lightmapPx}.ktx2`);
        lightmaps.set(group, texture);
      } catch {
        // Lightmaps are an enhancement; the baked AO/IBL fallback remains valid.
      }
    }));
  }
  const root = gltf.scene;
  bindLightmaps(root, lightmaps, renderer.capabilities.getMaxAnisotropy());
  root.traverse((object) => {
    object.matrixAutoUpdate = false;
    object.updateMatrix();
  });
  return {
    gltf,
    root,
    lightmaps,
    dispose: () => {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        geometries.add(mesh.geometry);
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      lightmaps.forEach((texture) => texture.dispose());
      ktx2.dispose();
    },
  };
}
