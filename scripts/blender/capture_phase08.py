#!/usr/bin/env python3
"""Render deterministic source-scene evidence for CAMPING V3 Phase 08."""
import hashlib
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from common import argv_after_dashes


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def create_camera(name, position, target, lens):
    data = bpy.data.cameras.new(name + "_data")
    data.lens = lens
    camera = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = position
    look_at(camera, target)
    return camera


def create_area(name, position, target, power, size, color):
    data = bpy.data.lights.new(name + "_data", type="AREA")
    data.energy = power
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = position
    look_at(obj, target)
    return obj


def main():
    args = argv_after_dashes()
    output = Path(args[0] if args else "art/_delivery/phase-08").resolve()
    output.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    original_camera = scene.camera
    original_engine = scene.render.engine
    original_resolution = (scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage)
    original_filepath = scene.render.filepath
    original_format = scene.render.image_settings.file_format
    original_color_mode = scene.render.image_settings.color_mode
    original_compression = scene.render.image_settings.compression
    original_film = scene.render.film_transparent
    original_view = scene.view_settings.view_transform
    temporary = []
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
        scene.render.resolution_x = 1280
        scene.render.resolution_y = 720
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGBA"
        scene.render.image_settings.compression = 18
        scene.render.film_transparent = False
        scene.view_settings.view_transform = "AgX"
        if scene.world:
            scene.world.use_nodes = True
            background = scene.world.node_tree.nodes.get("Background")
            if background:
                background.inputs["Color"].default_value = (0.10, 0.047, 0.020, 1.0)
                background.inputs["Strength"].default_value = 0.20
        # Temporary lights reveal actual source geometry, then are removed.
        temporary.append(create_area("SDT_phase08_evidence_key", (0.50, 3.15, 0.75), (2.45, 1.10, 2.20), 720.0, 2.3, (1.0, 0.45, 0.20)))
        temporary.append(create_area("SDT_phase08_evidence_fill", (3.7, 2.15, 0.90), (2.45, 1.0, 2.20), 420.0, 1.6, (1.0, 0.72, 0.48)))
        temporary.append(create_area("SDT_phase08_evidence_rim", (2.5, 2.9, 3.5), (2.45, 1.0, 2.2), 260.0, 1.4, (0.42, 0.61, 1.0)))
        cameras = [
            ("production-overview.png", create_camera("SDT_phase08_camera_overview", (0.35, 1.55, 0.28), (2.45, 1.20, 2.25), 28.0)),
            ("production-detail.png", create_camera("SDT_phase08_camera_detail", (1.20, 1.24, 1.08), (2.52, 0.92, 2.31), 44.0)),
        ]
        temporary.extend(camera for _, camera in cameras)
        views = {}
        for filename, camera in cameras:
            scene.camera = camera
            scene.render.filepath = str(output / filename)
            bpy.ops.render.render(write_still=True)
            path = output / filename
            if not path.is_file() or path.stat().st_size < 10000:
                raise RuntimeError("Phase 08 evidence render missing or too small: " + str(path))
            views[filename] = {
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "bytes": path.stat().st_size,
                "width": 1280,
                "height": 720,
            }
        manifest = {"version": 1, "phase": 8, "status": "source-rendered",
                    "blenderVersion": bpy.app.version_string, "views": views}
        (output / "capture-manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print("PHASE 08 PRODUCTION CAPTURES VERIFIED", json.dumps(manifest, sort_keys=True))
    finally:
        scene.camera = original_camera
        scene.render.engine = original_engine
        scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = original_resolution
        scene.render.filepath = original_filepath
        scene.render.image_settings.file_format = original_format
        scene.render.image_settings.color_mode = original_color_mode
        scene.render.image_settings.compression = original_compression
        scene.render.film_transparent = original_film
        scene.view_settings.view_transform = original_view
        for obj in temporary:
            if obj.name in bpy.data.objects:
                bpy.data.objects.remove(obj, do_unlink=True)


if __name__ == "__main__":
    main()
