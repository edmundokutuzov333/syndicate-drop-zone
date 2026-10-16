#!/usr/bin/env python3
"""Phase 13: bake DIFFUSE irradiance, denoise, export EXR/PNG and studio IBL."""
import json
import math
import os
import time
from pathlib import Path

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent))
import bpy
import numpy as np
from common import argv_after_dashes
from phase13_bake_helpers import ROOT, configure_world, relative, save_png, stat_record, uv_coverage

GROUPS = ("shell", "production", "photo", "left", "right")
TIERS = {"ultra": {"px": 4096, "samples": 2048}, "high": {"px": 2048, "samples": 1024}, "mid": {"px": 1024, "samples": 512}}
LM_SCALE = 4.0
MARGIN = 8


def bake_group(group, tier, cfg, out_dir):
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.name.startswith("COL_")
               and not any(c.name == "COL_colliders" for c in o.users_collection)
               and str(o.get("lmGroup", "")) == group and o.get("lightmapPolicy") != "shared-ao-ibl"
               and not o.hide_render and not any(t in o.name.lower() for t in ("foam_tile", "foam-tile", "hanger", "cabide"))]
    if not objects:
        raise RuntimeError(group + ": não há malhas baked com lmGroup válido")
    for obj in objects:
        layer = obj.data.uv_layers.get("UV_Lightmap")
        if layer is None:
            raise RuntimeError(obj.name + ": UV_Lightmap em falta; fase 12 não produziu UV2")
        if len(layer.data) != len(obj.data.loops):
            raise RuntimeError(obj.name + ": contagem UV2 inválida")
        for entry in layer.data:
            uv = entry.uv
            if not math.isfinite(uv.x) or not math.isfinite(uv.y) or uv.x < -0.001 or uv.y < -0.001 or uv.x > 1.001 or uv.y > 1.001:
                raise RuntimeError(obj.name + ": UV2 inválida ou fora do atlas")
    px = cfg["px"]
    image = bpy.data.images.new("SDT_LM_" + group + "_" + tier, px, px, alpha=False, float_buffer=True)
    targets = []
    try:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
            obj.data.uv_layers.active_index = obj.data.uv_layers.find("UV_Lightmap")
            for material in obj.data.materials:
                if material is None:
                    raise RuntimeError(obj.name + ": slot de material vazio")
                material.use_nodes = True
                node = material.node_tree.nodes.new("ShaderNodeTexImage")
                node.name = "__SDT_PHASE13_BAKE_TARGET__"
                node.image = image
                for other in material.node_tree.nodes:
                    other.select = False
                node.select = True
                material.node_tree.nodes.active = node
                targets.append((material.node_tree, node))
        bpy.context.view_layer.objects.active = objects[0]
        scene = bpy.context.scene
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = cfg["samples"]
        scene.cycles.use_denoising = True
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
        scene.render.bake.use_pass_direct = True
        scene.render.bake.use_pass_indirect = True
        scene.render.bake.use_pass_color = False
        scene.render.bake.margin = MARGIN
        if "FINISHED" not in bpy.ops.object.bake(type="DIFFUSE", use_clear=True, margin=MARGIN):
            raise RuntimeError("Cycles bake não terminou")
        raw = np.empty(px * px * 4, dtype=np.float32)
        image.pixels.foreach_get(raw)
        rgba = raw.reshape((px, px, 4))
        rgb = np.maximum(rgba[:, :, :3], 0.0)
        lum = rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722
        positive = lum[lum > 1e-8]
        if positive.size == 0:
            raise RuntimeError("bake totalmente preto")
        clamp = float(np.percentile(positive, 99.9))
        if not math.isfinite(clamp) or clamp <= 0:
            raise RuntimeError("percentil de fireflies inválido")
        rgb *= np.minimum(1.0, clamp / np.maximum(lum, 1e-12))[:, :, None]
        rgba[:, :, :3], rgba[:, :, 3] = rgb, 1.0
        image.pixels.foreach_set(rgba.reshape(-1))
        exr = out_dir / tier / ("LM_" + group + "_" + tier + ".exr")
        exr.parent.mkdir(parents=True, exist_ok=True)
        image.filepath_raw = str(exr)
        image.file_format = "OPEN_EXR"
        image.color_mode = "RGB"
        image.color_depth = "32"
        image.save()
        coverage = uv_coverage(objects, 256)
        occupied = int(coverage.sum())
        if occupied == 0:
            raise RuntimeError("atlas UV2 sem cobertura")
        factor = px // 256
        grid = lum.reshape((256, factor, 256, factor)).mean(axis=(1, 3))
        black_pct = float(np.count_nonzero(coverage & (grid <= 1e-7)) * 100 / occupied)
        clipped_pct = float(np.count_nonzero(coverage & (np.max(rgb / LM_SCALE, axis=2) >= 1.0)) * 100 / occupied)
        if black_pct > 1.0 or clipped_pct > 0.5:
            raise RuntimeError("histograma fora do limite: black=" + str(round(black_pct, 4)) + "% clip=" + str(round(clipped_pct, 4)) + "%")
        png = save_png(out_dir / tier / ("LM_" + group + "_" + tier + ".png"), rgb / LM_SCALE, px, px, "SDT_LDR_" + group + "_" + tier)
        return {"group": group, "tier": tier, "samples": cfg["samples"], "exr": stat_record(exr, px, px), "png": png,
                "histogram": {"fireflyClampPercentile": 99.9, "fireflyClampLuminance": clamp, "clippedOccupiedPct": round(clipped_pct, 5), "blackOccupiedPct": round(black_pct, 5)},
                "dilateMarginPx": MARGIN, "lmScale": LM_SCALE, "bakeType": "DIFFUSE", "direct": True, "indirect": True,
                "usePassColor": False, "denoiser": "OPENIMAGEDENOISE", "meshCount": len(objects)}
    finally:
        for tree, node in targets:
            try:
                tree.nodes.remove(node)
            except (ReferenceError, RuntimeError):
                pass
        bpy.ops.object.select_all(action="DESELECT")
        bpy.data.images.remove(image)


def render_ibl(out_dir, report):
    scene = bpy.context.scene
    old = (scene.camera, scene.render.engine, scene.view_settings.view_transform, scene.render.resolution_x,
           scene.render.resolution_y, scene.render.resolution_percentage, scene.render.image_settings.file_format,
           scene.render.image_settings.color_depth, scene.render.image_settings.color_mode)
    hidden = []
    data = bpy.data.cameras.new("SDT_Phase13_IBL_Camera")
    camera = bpy.data.objects.new("SDT_Phase13_IBL_Camera", data)
    scene.collection.objects.link(camera)
    try:
        for obj in scene.objects:
            if obj.name.startswith("COL_") or obj.get("collider"):
                hidden.append((obj, obj.hide_render))
                obj.hide_render = True
        camera.location = (0.0, 1.45, 0.0)
        camera.rotation_euler = (0.0, 0.0, 0.0)
        data.type = "PANO"
        data.cycles.panorama_type = "EQUIRECTANGULAR"
        data.clip_start, data.clip_end = 0.05, 70
        scene.camera = camera
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 128
        scene.cycles.use_denoising = True
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
        scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 4096, 2048, 100
        scene.render.image_settings.file_format = "OPEN_EXR"
        scene.render.image_settings.color_mode = "RGB"
        scene.render.image_settings.color_depth = "32"
        scene.view_settings.view_transform = "Standard"
        ibl = out_dir / "ibl" / "studio-ibl.exr"
        ibl.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(ibl)
        bpy.ops.render.render(write_still=True)
        report["ibl"] = {**stat_record(ibl, 4096, 2048), "samples": 128, "cameraPosition": [0, 1.45, 0], "projection": "EQUIRECTANGULAR"}
        image = bpy.data.images.load(str(ibl), check_existing=False)
        try:
            w, h = image.size
            pixels = np.empty(w * h * 4, dtype=np.float32)
            image.pixels.foreach_get(pixels)
            pano = pixels.reshape((h, w, 4))
            x0, x1 = int(math.floor(100 / 360 * w)), int(math.ceil(170 / 360 * w))
            yt, yb = int(math.floor(65 / 180 * h)), int(math.ceil(105 / 180 * h))
            crop = pano[max(0, h-yb):min(h, h-yt), x0:x1, :3].copy()
            capture_path = ROOT / "art" / "_delivery" / "phase-13" / "orange-spill.png"
            report["capture"] = {**save_png(capture_path, crop / LM_SCALE, crop.shape[1], crop.shape[0], "SDT_Phase13_OrangeSpill"),
                                 "azimuthRange": [100, 170], "elevationRange": [-15, 25], "source": relative(ibl)}
        finally:
            bpy.data.images.remove(image)
    finally:
        scene.camera, scene.render.engine, scene.view_settings.view_transform = old[0], old[1], old[2]
        scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = old[3], old[4], old[5]
        scene.render.image_settings.file_format, scene.render.image_settings.color_depth, scene.render.image_settings.color_mode = old[6], old[7], old[8]
        for obj, value in hidden:
            obj.hide_render = value
        bpy.data.objects.remove(camera, do_unlink=True)
        bpy.data.cameras.remove(data)


def main():
    start = time.monotonic()
    args = argv_after_dashes()
    out = Path(args[0] if args else "art/bake")
    tier_arg = args[1] if len(args) > 1 else "all"
    if tier_arg not in ("all", *TIERS):
        raise SystemExit("tier deve ser all, ultra, high ou mid")
    if not out.is_absolute():
        out = ROOT / out
    out.mkdir(parents=True, exist_ok=True)
    tiers = list(TIERS) if tier_arg == "all" else [tier_arg]
    report = {"version":1,"phase":13,"status":"failed","sourceCommit":os.environ.get("GITHUB_SHA","unknown"),
              "generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"durationSeconds":0,
              "bakeType":"DIFFUSE","direct":True,"indirect":True,"usePassColor":False,"lmScale":LM_SCALE,
              "dilateMarginPx":MARGIN,"denoiser":"OPENIMAGEDENOISE","outputs":[],"ibl":None,"capture":None,
              "lightingInventory":{},"failures":[]}
    try:
        report["lightingInventory"] = configure_world(bpy.context.scene)
        if report["lightingInventory"]["missingSourceElementIds"]:
            report["failures"].append("fontes de luz em falta: " + ", ".join(report["lightingInventory"]["missingSourceElementIds"]))
        for tier in tiers:
            for group in GROUPS:
                try:
                    item = bake_group(group, tier, TIERS[tier], out)
                    report["outputs"].append(item)
                    print("BAKED", group, tier, item["png"]["path"])
                except Exception as exc:
                    report["failures"].append(group + "/" + tier + ": " + str(exc))
                    print("BAKE_FAILED", group, tier, str(exc))
        try:
            render_ibl(out, report)
        except Exception as exc:
            report["failures"].append("IBL/captura: " + str(exc))
    except Exception as exc:
        report["failures"].append("fase 13: " + str(exc))
    report["durationSeconds"] = round(time.monotonic() - start, 3)
    if len(report["outputs"]) != len(GROUPS) * len(tiers):
        report["failures"].append("outputs baked " + str(len(report["outputs"])) + "/" + str(len(GROUPS) * len(tiers)))
    report["status"] = "baked" if not report["failures"] else "failed"
    dest = ROOT / "art" / "xoyens-studio.phase13.report.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("PHASE13_REPORT", relative(dest), report["status"], len(report["outputs"]))
    if report["failures"]:
        for failure in report["failures"]:
            print("PHASE13_FAILURE", failure)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
