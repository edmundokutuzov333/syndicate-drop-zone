import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { normalizeCampingModel } from "./camping-model-compatibility";

describe("Camping frontend model compatibility", () => {
  it("leaves the current legacy GLB untouched", () => {
    const root = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    floor.name = "studio.floor";
    root.add(floor);
    expect(normalizeCampingModel(root)).toBe("legacy-glb");
    expect(root.getObjectByName("studio.floor")).toBe(floor);
  });

  it("normalizes Blender V3 anchors and keeps articulated door details on the hinge root", () => {
    const root = new THREE.Group();
    const mesh = () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    const floor = mesh();
    floor.name = "SDT_shell_floor_wood";
    floor.userData.elementId = "floor.wood";
    root.add(floor);
    const ceiling = mesh();
    ceiling.name = "SDT_shell_vault_ceiling";
    ceiling.userData.elementId = "arch.vault_ceiling";
    root.add(ceiling);
    const rib = mesh();
    rib.name = "SDT_shell_vault_rib_primary_01";
    root.add(rib);
    const door = mesh();
    door.name = "SDT_shell_door_main";
    door.userData.elementId = "arch.door_main";
    door.userData.interactionId = "studio.inner-door";
    root.add(door);
    const handle = mesh();
    handle.name = "SDT_shell_door_main_lever";
    handle.position.set(0.55, 1, 2);
    root.add(handle);
    const slot = mesh();
    slot.name = "SDT_right_artist_slot_001";
    slot.userData.interactionId = "studio.artist-slot-001";
    root.add(slot);
    const blank = mesh();
    blank.name = "SDT_right_artist_slot_001_blank";
    root.add(blank);

    expect(normalizeCampingModel(root)).toBe("blender-v3");
    expect(root.userData.campingModelVersion).toBe(3);
    expect(root.getObjectByName("studio.floor")).toBeTruthy();
    expect(root.getObjectByName("studio.parquet")).toBe(floor);
    expect(root.getObjectByName("studio.vaulted-timber-ceiling")).toBe(ceiling);
    expect(root.getObjectByName("studio.ceiling-arches")?.getObjectByName(rib.name)).toBe(rib);
    expect(root.getObjectByName("studio.inner-door")).toBe(door);
    expect(root.getObjectByName("studio.door-handle")).toBe(handle);
    expect(handle.parent).toBe(door);
    expect(root.getObjectByName("studio.artist-slot-001")).toBe(slot);
    expect(blank.parent).toBe(slot);
  });
});
