#!/usr/bin/env python3
"""Export the editable Blender source to an uncompressed glTF 2.0 GLB artefact.

Custom properties are exported as glTF extras. The colliders collection is not
exported as visible geometry; collision metadata remains on renderable objects.
"""
import sys
from pathlib import Path
import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from common import argv_after_dashes

def main():
    args = argv_after_dashes()
    output = Path(args[0] if args else "art/out/xoyens-studio.raw.glb").resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    excluded = {"COL_colliders"}
    selected = []
    for obj in bpy.context.scene.objects:
        if obj.type not in ("MESH", "EMPTY"):
            continue
        if any(c.name in excluded for c in obj.users_collection):
            continue
        obj.select_set(True)
        selected.append(obj)
    if not selected:
        raise RuntimeError("No renderable objects selected for GLB export")
    bpy.context.view_layer.objects.active = selected[0]
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", use_selection=True,
        export_extras=True, export_apply=True, export_texcoords=True,
        export_normals=True, export_tangents=True, export_materials="EXPORT",
        export_cameras=False, export_lights=False, export_image_format="AUTO",
        export_draco_mesh_compression_enable=False,
    )
    print("EXPORTED", str(output), "bytes=" + str(output.stat().st_size), "nodes=" + str(len(selected)))

if __name__ == "__main__":
    main()
