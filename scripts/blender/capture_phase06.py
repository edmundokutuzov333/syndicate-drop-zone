#!/usr/bin/env python3
"""Render deterministic evidence views for CAMPING V3 phase 06.

Run only after build_blend.py and validate_blend.py succeeded. This script opens
the certified .blend in background mode, renders two fixed architectural poses,
and writes a provenance/hash manifest. It never saves or alters the source .blend.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from common import argv_after_dashes


VIEWS = {
    "ceiling.png": {
        "location": (0.0, 1.55, 2.0),
        "target": (0.0, 3.15, -0.15),
        "description": "Abóbada, esteira de bambu, costelas e linha de arranque",
    },
    "main-door.png": {
        "location": (0.0, 1.65, 0.1),
        "target": (0.0, 1.25, 2.78),
        "description": "Porta principal, aro, puxador, AC e conduta",
    },
}


def _render_view(scene, filename, spec, output_dir):
    camera_data = bpy.data.cameras.new("SDT_Phase06_" + filename.replace(".png", "_camera"))
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    camera.location = Vector(spec["location"])
    target = Vector(spec["target"])
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "PERSP"
    camera_data.angle = math.radians(82.0)
    camera_data.lens = 28.0
    camera_data.clip_start = 0.02
    camera_data.clip_end = 100.0
    camera_data.dof.use_dof = False
    scene.camera = camera

    path = output_dir / filename
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError("Blender did not produce a usable evidence image: " + str(path))
    digest = hashlib.sha256(path.read_bytes()).hexdigest()

    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.cameras.remove(camera_data)
    scene.camera = None
    return {
        "path": str(path),
        "sha256": digest,
        "bytes": path.stat().st_size,
        "width": scene.render.resolution_x * scene.render.resolution_percentage // 100,
        "height": scene.render.resolution_y * scene.render.resolution_percentage // 100,
        "cameraLocation": list(spec["location"]),
        "target": list(spec["target"]),
        "description": spec["description"],
    }


def main():
    args = argv_after_dashes()
    output_dir = Path(args[0] if args else "art/_delivery/phase-06").resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    original_engine = scene.render.engine
    original_camera = scene.camera
    original_x, original_y = scene.render.resolution_x, scene.render.resolution_y
    original_percentage = scene.render.resolution_percentage
    original_filepath = scene.render.filepath
    original_format = scene.render.image_settings.file_format
    original_transform = scene.view_settings.view_transform
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
        try:
            scene.eevee.taa_render_samples = 16
        except Exception:
            pass
        scene.render.resolution_x = 1280
        scene.render.resolution_y = 720
        scene.render.resolution_percentage = 75
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGB"
        scene.render.image_settings.compression = 8
        scene.render.film_transparent = False
        scene.view_settings.view_transform = "AgX"
        views = {}
        for filename, spec in VIEWS.items():
            views[filename] = _render_view(scene, filename, spec, output_dir)
            print("PHASE06_CAPTURE", filename, json.dumps(views[filename], sort_keys=True))
        manifest = {
            "version": 1,
            "purpose": "phase-06 architectural evidence",
            "blenderVersion": bpy.app.version_string,
            "sourceBlend": bpy.data.filepath,
            "renderEngine": scene.render.engine,
            "referenceFilePresent": (Path("docs/camping-v3/reference/studio-pano.png").is_file()),
            "views": views,
        }
        manifest_path = output_dir / "capture-manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print("PHASE06_CAPTURE_MANIFEST", str(manifest_path))
    finally:
        scene.camera = original_camera
        scene.render.engine = original_engine
        scene.render.resolution_x, scene.render.resolution_y = original_x, original_y
        scene.render.resolution_percentage = original_percentage
        scene.render.filepath = original_filepath
        scene.render.image_settings.file_format = original_format
        scene.view_settings.view_transform = original_transform


if __name__ == "__main__":
    main()
