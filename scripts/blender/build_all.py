#!/usr/bin/env python3
"""Rebuild the CAMPING V3 Blender source from Scene Bible.

Usage:
  blender -b -P scripts/blender/build_all.py -- docs/camping-v3/scene-bible.json art/xoyens-studio.blend
"""
import importlib
import json
import os
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from common import reset_scene, create_collections, material_library, new_context, validate_scene_contract, argv_after_dashes

MODULE_ORDER = (
    ("build_shell", "shell"),
    ("build_surfaces", "surfaces"),
    ("build_production", "production"),
    ("build_photo", "photo"),
    ("build_sides", "sides"),
    ("build_props", "props"),
    ("lights", "lights"),
    ("build_colliders", "colliders"),
)

def main():
    args = argv_after_dashes()
    bible_path = Path(args[0] if len(args) > 0 else "docs/camping-v3/scene-bible.json").resolve()
    output_path = Path(args[1] if len(args) > 1 else "art/xoyens-studio.blend").resolve()
    if not bible_path.is_file():
        raise FileNotFoundError("Scene Bible not found: " + str(bible_path))
    bible = json.loads(bible_path.read_text(encoding="utf-8"))
    if bible.get("version") != 3 or not isinstance(bible.get("metricPlan"), dict):
        raise ValueError("Scene Bible v3 with metricPlan is required")
    started = time.monotonic()
    reset_scene()
    collections = create_collections()
    material_library(bible)
    ctx = new_context(bible, collections)
    for module_name, label in MODULE_ORDER:
        module = importlib.import_module(module_name)
        print("[CAMPING] Building " + label + " with " + module_name)
        module.build(bible, ctx)
    report = validate_scene_contract(bible)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy = __import__("bpy")
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path))
    size_bytes = output_path.stat().st_size
    if size_bytes >= 200 * 1024 * 1024:
        raise RuntimeError("Blend output exceeds 200 MiB: " + str(size_bytes))
    elapsed = time.monotonic() - started
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    report.update({
        "output": str(output_path),
        "blendBytes": size_bytes,
        "elapsedSeconds": round(elapsed, 3),
        "blenderVersion": bpy.app.version_string,
        "vertices": sum(len(obj.data.vertices) for obj in mesh_objects),
        "polygons": sum(len(obj.data.polygons) for obj in mesh_objects),
        "estimatedTriangles": sum(sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons) for obj in mesh_objects),
        "collectionObjects": {name: len(collection.objects) for name, collection in ctx["collections"].items()},
        "sourceElements": len(bible.get("elements", [])),
        "lightSources": sum(len(element.get("lights", [])) for element in bible.get("elements", [])),
    })
    report_path = output_path.with_suffix(".report.json")
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + chr(10), encoding="utf-8")
    print("[CAMPING] VALIDATION", json.dumps(report, sort_keys=True))
    print("[CAMPING] OUTPUT", str(output_path), "bytes=" + str(size_bytes), "seconds=" + str(round(elapsed, 2)))
    print("[CAMPING] REPORT", str(report_path))
    if elapsed >= 600:
        raise RuntimeError("Build exceeded the 10-minute acceptance budget")

if __name__ == "__main__":
    main()
