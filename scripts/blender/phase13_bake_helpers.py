"""Helpers for the reproducible Phase 13 Cycles bake."""
import hashlib
import math
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
REQUIRED_LIGHTS = {
    "prod.plank_wall", "prod.pendant_cage_1", "prod.pendant_cage_2",
    "prod.pendant_cage_3", "prod.pendant_cage_4", "photo.softbox_octa", "photo.led_panel_1",
}


def relative(path):
    return Path(path).resolve().relative_to(ROOT).as_posix()


def stat_record(path, width, height):
    p = Path(path)
    h = hashlib.sha256()
    with p.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return {"path": relative(p), "bytes": p.stat().st_size, "sha256": h.hexdigest(), "width": int(width), "height": int(height)}


def srgb_encode(linear):
    return np.where(linear <= 0.0031308, linear * 12.92, 1.055 * np.power(np.maximum(linear, 0.0), 1.0 / 2.4) - 0.055)


def save_png(path, rgb, width, height, name):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    rgba = np.ones((height, width, 4), dtype=np.float32)
    rgba[:, :, :3] = srgb_encode(np.clip(rgb, 0.0, 1.0))
    image = bpy.data.images.new(name, width, height, alpha=False, float_buffer=False)
    try:
        image.colorspace_settings.name = "sRGB"
        image.pixels.foreach_set(rgba.reshape(-1))
        image.filepath_raw = str(path)
        image.file_format = "PNG"
        image.save()
    finally:
        bpy.data.images.remove(image)
    return stat_record(path, width, height)


def uv_coverage(objects, size=256):
    mask = np.zeros((size, size), dtype=np.bool_)
    for obj in objects:
        layer = obj.data.uv_layers.get("UV_Lightmap")
        if layer is None:
            continue
        for poly in obj.data.polygons:
            pts = [(float(layer.data[i].uv.x), float(layer.data[i].uv.y)) for i in poly.loop_indices]
            if len(pts) < 3:
                continue
            ymin = max(0, int(math.floor(min(p[1] for p in pts) * size)))
            ymax = min(size, int(math.ceil(max(p[1] for p in pts) * size)))
            for py in range(ymin, ymax):
                y = (py + 0.5) / size
                xs = []
                for i, a in enumerate(pts):
                    b = pts[(i + 1) % len(pts)]
                    if (a[1] <= y < b[1]) or (b[1] <= y < a[1]):
                        xs.append(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]))
                xs.sort()
                for i in range(0, len(xs) - 1, 2):
                    x0 = max(0, int(math.floor(xs[i] * size)))
                    x1 = min(size, int(math.ceil(xs[i + 1] * size)))
                    if x1 > x0:
                        mask[py, x0:x1] = True
    return mask


def configure_world(scene):
    if scene.world is None:
        scene.world = bpy.data.worlds.new("SDT_World")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.020, 0.012, 0.008, 1.0)
        bg.inputs["Strength"].default_value = 0.22
    lights = [o for o in scene.objects if o.type == "LIGHT"]
    source_ids = sorted({str(o.get("sourceElementId")) for o in lights if o.get("sourceElementId")})
    missing = sorted(REQUIRED_LIGHTS.difference(source_ids))
    return {"sourceLightCount": len(lights), "sourceElementIds": source_ids, "missingSourceElementIds": missing, "worldColor": [0.020, 0.012, 0.008], "worldStrength": 0.22}
