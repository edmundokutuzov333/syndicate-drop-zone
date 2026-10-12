import * as THREE from "three";

/**
 * Small, deterministic runtime corrections for the authored Xoyens GLB.
 * The source asset stores its meshes in baked world coordinates, so each fix
 * is applied to a named object and never to the full scene root.
 */
export const CAMPING_REFERENCE_COMPOSITION = {
  parquetScaleY: 0.3,
  parquetOffsetY: -0.00225,
  rackCenterX: 3.05,
  rackScaleX: 0.85,
  rackShiftX: -0.55,
  photoFloorColor: 0x070707,
  photoBackdropColor: 0x090909,
  plasterColor: 0xe4d5c0,
  entryPosition: [0.08, 1.62, 3.76] as const,
  entryLookTarget: [0.12, 2.0, -1.6] as const,
} as const;

const RACK_NODE_NAMES = [
  "studio.rack-uprights",
  "studio.rack-feet",
  "studio.rack-rail",
  "studio.hangers",
  "studio.hanger-hooks",
  "studio.garments",
  "studio.clothing-rack",
] as const;

type CompositionReport = {
  applied: boolean;
  correctedNodes: string[];
  missingNodes: string[];
};

function materialsOf(object: THREE.Object3D): THREE.Material[] {
  if (!(object instanceof THREE.Mesh)) return [];
  return Array.isArray(object.material)
    ? object.material
    : object.material
      ? [object.material]
      : [];
}

function isolateMaterials(object: THREE.Object3D): THREE.Material[] {
  if (!(object instanceof THREE.Mesh)) return [];
  if (Array.isArray(object.material)) {
    object.material = object.material.map((material) => material.clone());
  } else if (object.material) {
    object.material = object.material.clone();
  }
  return materialsOf(object);
}

function tuneMaterial(
  object: THREE.Object3D | null,
  values: { color?: number; roughness?: number; metalness?: number; envMapIntensity?: number },
): boolean {
  if (!object) return false;
  const materials = isolateMaterials(object);
  if (!materials.length) return false;

  for (const material of materials) {
    const standard = material as THREE.MeshStandardMaterial;
    if (values.color !== undefined && standard.color?.isColor) standard.color.setHex(values.color);
    if (values.roughness !== undefined && "roughness" in standard) standard.roughness = values.roughness;
    if (values.metalness !== undefined && "metalness" in standard) standard.metalness = values.metalness;
    if (values.envMapIntensity !== undefined && "envMapIntensity" in standard) {
      standard.envMapIntensity = values.envMapIntensity;
    }
    if ("emissive" in standard && standard.emissive?.isColor) standard.emissive.setHex(0x000000);
    if ("emissiveIntensity" in standard) standard.emissiveIntensity = 0;
    material.needsUpdate = true;
  }
  return true;
}

export function applyCampingReferenceComposition(root: THREE.Object3D): CompositionReport {
  if (root.userData.campingReferenceCompositionApplied === true) {
    return { applied: false, correctedNodes: [], missingNodes: [] };
  }

  const correctedNodes: string[] = [];
  const expectedNodes = [
    "studio.vaulted-timber-ceiling",
    "studio.ceiling-arches",
    "studio.ceiling-cross-beams",
    "studio.parquet",
    "studio.photo-floor",
    "studio.photo-backdrop",
    ...RACK_NODE_NAMES,
  ];
  const missingNodes = expectedNodes.filter((name) => !root.getObjectByName(name));

  // The old cross-beam mesh is a broad, flat panel at wall height. It reads as
  // a black horizontal slab in the camera instead of the curved timber ribs.
  const flatCrossBeamPanel = root.getObjectByName("studio.ceiling-cross-beams");
  if (flatCrossBeamPanel) {
    flatCrossBeamPanel.visible = false;
    flatCrossBeamPanel.userData.replacedByVaultedArches = true;
    correctedNodes.push(flatCrossBeamPanel.name);
  }

  // Render the actual underside of the vaulted roof. Some GLB faces were
  // authored with outward normals, creating a large dark void from inside.
  for (const name of ["studio.vaulted-timber-ceiling", "studio.ceiling-arches"]) {
    const object = root.getObjectByName(name);
    if (!object) continue;
    for (const material of isolateMaterials(object)) {
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    }
    correctedNodes.push(name);
  }

  // Seat the baked parquet boards on the floor slab and reduce exaggerated
  // vertical edges while preserving their authored layout and wood materials.
  const parquet = root.getObjectByName("studio.parquet");
  if (parquet) {
    parquet.scale.y *= CAMPING_REFERENCE_COMPOSITION.parquetScaleY;
    parquet.position.y += CAMPING_REFERENCE_COMPOSITION.parquetOffsetY;
    parquet.userData.referenceFloorProfile = "seated-low-profile";
    correctedNodes.push(parquet.name);
  }

  const photoFloor = root.getObjectByName("studio.photo-floor");
  if (photoFloor) {
    tuneMaterial(photoFloor, {
      color: CAMPING_REFERENCE_COMPOSITION.photoFloorColor,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0.08,
    });
    if (photoFloor instanceof THREE.Mesh) {
      photoFloor.castShadow = false;
      photoFloor.receiveShadow = true;
    }
    photoFloor.userData.referenceMaterial = "matte-black";
    correctedNodes.push(photoFloor.name);
  }

  const photoBackdrop = root.getObjectByName("studio.photo-backdrop");
  if (photoBackdrop) {
    tuneMaterial(photoBackdrop, {
      color: CAMPING_REFERENCE_COMPOSITION.photoBackdropColor,
      roughness: 0.98,
      metalness: 0,
      envMapIntensity: 0.06,
    });
    for (const material of isolateMaterials(photoBackdrop)) {
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    }
    photoBackdrop.userData.referenceMaterial = "matte-black";
    correctedNodes.push(photoBackdrop.name);
  }

  // Keep the plaster warm and matte, while the engine uses a much subtler
  // procedural bump value for this material family.
  for (const name of ["studio.left-wall", "studio.right-wall", "studio.back-wall"]) {
    const wall = root.getObjectByName(name);
    if (!wall) continue;
    for (const material of isolateMaterials(wall)) {
      const standard = material as THREE.MeshStandardMaterial;
      if (standard.name.toLowerCase().includes("plaster")) {
        if (standard.color?.isColor) standard.color.setHex(CAMPING_REFERENCE_COMPOSITION.plasterColor);
        standard.roughness = Math.max(standard.roughness, 0.9);
        standard.metalness = 0;
        if ("bumpScale" in standard) standard.bumpScale = 0.0018;
        standard.needsUpdate = true;
      }
    }
    correctedNodes.push(name);
  }

  // Move the rack left and reduce its span around its own centre, so the rack
  // remains in front of the photo set without covering the centre of the seal.
  const scaleX = CAMPING_REFERENCE_COMPOSITION.rackScaleX;
  const centreX = CAMPING_REFERENCE_COMPOSITION.rackCenterX;
  const shiftX = CAMPING_REFERENCE_COMPOSITION.rackShiftX;
  const translationX = centreX * (1 - scaleX) + shiftX;
  for (const name of RACK_NODE_NAMES) {
    const object = root.getObjectByName(name);
    if (!object) continue;
    object.scale.x *= scaleX;
    object.position.x = object.position.x * scaleX + translationX;
    object.userData.referenceRackTransform = true;
    correctedNodes.push(name);
  }

  root.userData.campingReferenceCompositionApplied = true;
  root.userData.campingReferenceCompositionVersion = 1;
  return { applied: true, correctedNodes, missingNodes };
}
