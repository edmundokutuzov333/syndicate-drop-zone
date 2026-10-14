import * as THREE from "three";

export type CampingModelSource = "legacy-glb" | "blender-v3";
type ModelObject = THREE.Object3D & { userData: Record<string, unknown> };

const ELEMENT_NAME_ALIASES: Readonly<Record<string, string>> = {
  "floor.wood": "studio.parquet",
  "floor.vinyl_sweep": "studio.photo-floor",
  "arch.vault_ceiling": "studio.vaulted-timber-ceiling",
  "photo.backdrop_seal": "studio.photo-backdrop-seal",
  "photo.garments": "studio.garments",
};
const RUNTIME_NAME_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^SDT_production_monitor_daw_screen$/i, "studio.imac-screen"],
  [/^SDT_shell_door_main_lever$/i, "studio.door-handle"],
  [/^SDT_shell_door_main_handle_plate$/i, "studio.door-handle-plate"],
];

export function normalizeCampingModel(root: THREE.Group): CampingModelSource {
  const objects: ModelObject[] = [];
  root.traverse((object) => objects.push(object as ModelObject));
  const isGenerated = objects.some((object) =>
    object.name.startsWith("SDT_") ||
    (typeof object.userData.elementId === "string" && object.userData.elementId.startsWith("arch.")),
  );
  if (!isGenerated) return "legacy-glb";

  const originalNames = new Map<THREE.Object3D, string>();
  for (const object of objects) originalNames.set(object, object.name);
  root.updateMatrixWorld(true);

  for (const object of objects) {
    const originalName = originalNames.get(object) ?? object.name;
    const elementId = object.userData.elementId;
    const interactionId = object.userData.interactionId;
    if (typeof interactionId === "string" && interactionId.startsWith("studio.")) {
      object.name = interactionId;
      continue;
    }
    if (typeof elementId === "string" && ELEMENT_NAME_ALIASES[elementId]) {
      object.name = ELEMENT_NAME_ALIASES[elementId]!;
      continue;
    }
    const alias = RUNTIME_NAME_ALIASES.find(([pattern]) => pattern.test(originalName));
    if (alias) object.name = alias[1];
  }

  const floor = objects.find((object) => object.name === "studio.parquet");
  if (floor && !root.getObjectByName("studio.floor")) {
    const group = new THREE.Group();
    group.name = "studio.floor";
    root.add(group);
    root.updateMatrixWorld(true);
    group.attach(floor);
  }

  const ribs = objects.filter((object) => (originalNames.get(object) ?? "").startsWith("SDT_shell_vault_rib_"));
  if (!root.getObjectByName("studio.ceiling-arches")) {
    const arches = new THREE.Group();
    arches.name = "studio.ceiling-arches";
    root.add(arches);
    root.updateMatrixWorld(true);
    for (const rib of ribs) arches.attach(rib);
  }
  if (!root.getObjectByName("studio.ceiling-cross-beams")) {
    const crossBeams = new THREE.Group();
    crossBeams.name = "studio.ceiling-cross-beams";
    root.add(crossBeams);
  }

  // Blender keeps frame, blank face and the printed number as separate objects
  // in COL_right. Parent only the slot's own surface/number to its interaction
  // root so the runtime can replace the blank face with the real backend portrait.
  for (let index = 1; index <= 17; index += 1) {
    const slotId = "studio.artist-slot-" + String(index).padStart(3, "0");
    const slotRoot = root.getObjectByName(slotId);
    if (!slotRoot) continue;
    const slotSuffix = String(index).padStart(3, "0");
    const children = objects.filter((object) => {
      const name = originalNames.get(object) ?? "";
      return name === "SDT_right_artist_slot_" + slotSuffix + "_blank" ||
        name === "SDT_right_artist_slot_number_" + slotSuffix;
    });
    root.updateMatrixWorld(true);
    for (const child of children) slotRoot.attach(child);
  }

  const mainDoor = root.getObjectByName("studio.inner-door");
  if (mainDoor) {
    const originalDoorName = originalNames.get(mainDoor) ?? "";
    root.updateMatrixWorld(true);
    const details = objects.filter((object) => {
      if (object === mainDoor) return false;
      const name = originalNames.get(object) ?? "";
      if (!name.startsWith(originalDoorName + "_")) return false;
      return /_(stile_|rail_|handle_plate|lever|lock_cylinder|hinge_)/i.test(name);
    });
    for (const detail of details) mainDoor.attach(detail);
  }

  root.userData.campingModelVersion = 3;
  root.updateMatrixWorld(true);
  return "blender-v3";
}
