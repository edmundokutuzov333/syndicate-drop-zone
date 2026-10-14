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
    manifest_path = Path(__file__).resolve().parents[2] / "art" / "textures" / "materials.manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError("PBR material manifest missing: " + str(manifest_path))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    pbr_errors = []
    for entry in manifest.get("materials", []):
        name = entry.get("material", "")
        material = bpy.data.materials.get(name)
        if material is None or not material.use_nodes:
            pbr_errors.append(name + ": Blender PBR material missing")
            continue
        expected_nodes = {"BC": "SDT_PBR_color", "N": "SDT_PBR_normal", "ORM": "SDT_PBR_orm"}
        for key, node_name in expected_nodes.items():
            node = material.node_tree.nodes.get(node_name)
            if node is None or getattr(node, "image", None) is None:
                pbr_errors.append(name + ": " + key + " map node missing")
                continue
            if tuple(node.image.size[:2]) != (2048, 2048):
                pbr_errors.append(name + ": " + key + " image is not 2048x2048")
            image_path = Path(bpy.path.abspath(node.image.filepath)).resolve()
            if not image_path.is_file():
                pbr_errors.append(name + ": relative image path missing: " + str(image_path))
    if len(manifest.get("materials", [])) < 18:
        pbr_errors.append("fewer than 18 PBR materials")
    if pbr_errors:
        raise RuntimeError("PBR Blender validation failed: " + "; ".join(pbr_errors[:30]))
    print("PBR MATERIAL CONTRACT OK", json.dumps({"materials": len(manifest["materials"]), "mapsPerMaterial": 3}, sort_keys=True))
    print("CAMPING BLEND CONTRACT OK", json.dumps(report, sort_keys=True))

if __name__ == "__main__":
    import bpy
    main()
