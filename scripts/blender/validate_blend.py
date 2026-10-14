#!/usr/bin/env python3
"""Validate a reopened Blender source scene against the committed Scene Bible."""
import json
import sys
from pathlib import Path
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from common import argv_after_dashes, validate_scene_contract

def main():
    args = argv_after_dashes()
    bible_path = Path(args[0] if args else "docs/camping-v3/scene-bible.json").resolve()
    if not bible_path.is_file():
        raise FileNotFoundError("Scene Bible not found: " + str(bible_path))
    bible = json.loads(bible_path.read_text(encoding="utf-8"))
    path = bpy.data.filepath
    report = validate_scene_contract(bible, path)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    report.update({
        "blender_version": bpy.app.version_string,
        "blend_path": path,
        "objects": len(bpy.context.scene.objects),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles_estimate": sum(sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons) for obj in meshes),
        "collections": sorted(collection.name for collection in bpy.data.collections if collection.name.startswith("COL_")),
        "blend_bytes": Path(path).stat().st_size if path and Path(path).is_file() else 0,
    })
    print("CAMPING BLEND CONTRACT OK", json.dumps(report, sort_keys=True))

if __name__ == "__main__":
    import bpy
    main()
