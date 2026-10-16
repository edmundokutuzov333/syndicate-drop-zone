#!/usr/bin/env python3
"""Export the visual GLB and its collision-only companion from Blender.

Visible scene geometry is exported to xoyens-studio.raw.glb. Objects in the
COL_colliders collection are deliberately kept out of that visual asset and
exported to xoyens-studio.colliders.glb instead. Blender custom properties are
preserved as glTF extras, including extras.collider on every collision proxy.
"""
import sys
from pathlib import Path
import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from common import argv_after_dashes


def export_subset(output, colliders_only):
    output.parent.mkdir(parents=True, exist_ok=True)
    for obj in list(bpy.context.selected_objects):
        obj.select_set(False)

    selected = []
    hidden_states = {}
    for obj in bpy.context.scene.objects:
        if obj.type not in ("MESH", "EMPTY"):
            continue
        is_collider = any(c.name == "COL_colliders" for c in obj.users_collection)
        if is_collider != colliders_only:
            continue

        hidden_states[obj.name] = obj.hide_get()
        if hidden_states[obj.name]:
            obj.hide_set(False)
        obj.select_set(True)
        selected.append(obj)

    if not selected:
        kind = "collision" if colliders_only else "visual"
        raise RuntimeError("No " + kind + " objects selected for GLB export")

    # Publish stable artist-slot names in glTF as a second, exporter-independent
    # representation of the interaction contract. Preserve source object names in
    # the .blend by restoring them immediately after export.
    original_names = {obj: obj.name for obj in selected}
    for obj in selected:
        interaction_id = obj.get("interactionId")
        if isinstance(interaction_id, str) and interaction_id.startswith("studio.artist-slot-"):
            suffix = interaction_id.removeprefix("studio.artist-slot-")
            if len(suffix) == 3 and suffix.isdigit() and 1 <= int(suffix) <= 17:
                obj.name = interaction_id

    try:
        bpy.context.view_layer.objects.active = selected[0]
        # CAMPING's Scene Bible and Blender builders deliberately author geometry in
        # a +Y-up frame. Blender's default export_yup=True assumes native +Z-up and
        # rotates this scene a second time, leaving the floor in XY with thickness Z.
        # Preserve the authored coordinates; the resulting GLB is already +Y-up.
        bpy.ops.export_scene.gltf(
            filepath=str(output), export_format="GLB", use_selection=True,
            export_extras=True, export_apply=True, export_texcoords=True,
            export_yup=False,
            export_normals=True, export_tangents=True, export_materials="EXPORT",
            export_cameras=False, export_lights=False, export_image_format="AUTO",
            export_draco_mesh_compression_enable=False,
        )
    finally:
        for obj in selected:
            obj.select_set(False)
            obj.name = original_names[obj]
            if obj.name in hidden_states:
                obj.hide_set(hidden_states[obj.name])

    print(
        "EXPORTED", str(output),
        "kind=" + ("colliders" if colliders_only else "visual"),
        "bytes=" + str(output.stat().st_size),
        "objects=" + str(len(selected)),
    )


def main():
    args = argv_after_dashes()
    output = Path(args[0] if args else "art/out/xoyens-studio.raw.glb").resolve()
    collider_output = Path(
        args[1] if len(args) > 1 else output.with_name("xoyens-studio.colliders.glb")
    ).resolve()
    if output == collider_output:
        raise ValueError("Visual and collider GLB output paths must differ")

    export_subset(output, colliders_only=False)
    export_subset(collider_output, colliders_only=True)


if __name__ == "__main__":
    main()
