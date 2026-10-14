#!/usr/bin/env python3
"""Production acceptance gate for Phase 07 hero surfaces (run inside Blender)."""
import json
import math
import statistics
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from common import argv_after_dashes

MIN_BOARDS = 100
MIN_BOARD_LENGTH_M = 0.900
MAX_BOARD_LENGTH_M = 2.200
MIN_JOINT_OFFSET_M = 0.300
MIN_ROUGHNESS_RANGE = 0.080
MIN_FLOOR_TEXEL_DENSITY = 512.0
MIN_BAMBOO_TEXEL_DENSITY = 384.0
MIN_VINYL_TEXEL_DENSITY = 256.0
HIGH_TIER_COLOR_TEXTURE_PX = 1024.0
UV_EPSILON = 1e-4


def fail(message):
    raise RuntimeError("CAMPING PHASE 07 SURFACE CONTRACT FAILED: " + message)


def bounds(obj):
    coords = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    return {
        "minX": min(v.x for v in coords), "maxX": max(v.x for v in coords),
        "minY": min(v.y for v in coords), "maxY": max(v.y for v in coords),
        "minZ": min(v.z for v in coords), "maxZ": max(v.z for v in coords),
    }


def get_element_object(element_id):
    found = [obj for obj in bpy.context.scene.objects if obj.get("elementId") == element_id]
    if not found:
        fail("missing Scene Bible element " + element_id)
    return found


def roughness_metrics():
    mat = bpy.data.materials.get("floor_walnut_semi_gloss")
    if mat is None or not mat.use_nodes:
        fail("walnut material is missing")
    node = mat.node_tree.nodes.get("SDT_PBR_orm")
    if node is None or node.image is None:
        fail("walnut ORM image is not connected through SDT_PBR_orm")
    image = node.image
    width, height = int(image.size[0]), int(image.size[1])
    if width < 512 or height < 512:
        fail("walnut ORM resolution is below 512 px")
    step_x, step_y = max(1, width // 64), max(1, height // 64)
    channel = image.pixels
    samples = []
    for y in range(0, height, step_y):
        for x in range(0, width, step_x):
            samples.append(float(channel[(y * width + x) * 4 + 1]))
    value_range = max(samples) - min(samples)
    std_dev = statistics.pstdev(samples)
    if value_range < MIN_ROUGHNESS_RANGE:
        fail("walnut ORM green channel has insufficient roughness variation: range=" + str(round(value_range, 4)))
    return {
        "image": image.name,
        "resolution": [width, height],
        "samples": len(samples),
        "roughnessRange": round(value_range, 6),
        "roughnessStdDev": round(std_dev, 6),
        "minimumRequiredRange": MIN_ROUGHNESS_RANGE,
    }


def main():
    args = argv_after_dashes()
    bible_path = Path(args[0] if len(args) > 0 else "docs/camping-v3/scene-bible.json").resolve()
    source_report_path = Path(args[1] if len(args) > 1 else "art/out/phase07-surfaces.json").resolve()
    output_path = Path(args[2] if len(args) > 2 else "art/xoyens-studio.phase07.report.json").resolve()
    if not bible_path.is_file():
        fail("Scene Bible is missing: " + str(bible_path))
    if not source_report_path.is_file():
        fail("deterministic surface report is missing: " + str(source_report_path))
    bible = json.loads(bible_path.read_text(encoding="utf-8"))
    source = json.loads(source_report_path.read_text(encoding="utf-8"))
    if source.get("version") != 1 or source.get("phase") != 7:
        fail("source report does not identify Phase 07")
    room = bible["metricPlan"]["room"]
    floor_y = float(room.get("floorY", 0.0))

    floor_objects = get_element_object("floor.wood")
    if len(floor_objects) != 1:
        fail("the Scene Bible floor must map to exactly one consolidated plank mesh")
    floor = floor_objects[0]
    floor_mesh = floor.data
    floor_report = source.get("floor", {})
    boards = floor_report.get("boards", [])
    rows = floor_report.get("rows", [])
    if floor.get("surfacePhase") != 7 or floor.get("floorAssembly") != "real-running-bond-walnut-planks":
        fail("floor mesh is not tagged as the Phase 07 real-plank assembly")
    if len(boards) < MIN_BOARDS or floor.get("phase7BoardCount") != len(boards):
        fail("real plank count is below the minimum or differs from the source report")
    lengths = [float(board["lengthM"]) for board in boards]
    if min(lengths) < MIN_BOARD_LENGTH_M - UV_EPSILON or max(lengths) > MAX_BOARD_LENGTH_M + UV_EPSILON:
        fail("plank lengths fall outside 0.90–2.20 m")
    if any(abs(float(board["widthM"]) - 0.19) > 0.01 for board in boards):
        fail("plank course width deviates more than 10 mm from 190 mm nominal")
    if len(rows) < 20:
        fail("too few staggered plank courses")
    for previous, current in zip(rows, rows[1:]):
        for seam in current.get("jointsX", []):
            distance = min(abs(float(seam) - float(old)) for old in previous.get("jointsX", []))
            if distance < MIN_JOINT_OFFSET_M - UV_EPSILON:
                fail("running-bond seam offset is below 300 mm between rows " + str(previous["row"]) + " and " + str(current["row"]))

    uv0 = floor_mesh.uv_layers.get("UVMap")
    uv1 = floor_mesh.uv_layers.get("UV_Lightmap")
    colors = floor_mesh.color_attributes.get("Color")
    if uv0 is None or uv1 is None:
        fail("floor lacks UVMap and independent UV_Lightmap")
    if colors is None or colors.domain != "CORNER":
        fail("per-plank COLOR_0 attribute is missing")
    unique_tints = {tuple(round(float(v), 3) for v in board["tint"][:3]) for board in boards}
    if len(unique_tints) < 20:
        fail("natural per-plank vertex-colour variation is missing")

    # Raycast the centre of every actual plank top, rather than sampling a proxy slab.
    raycast_hits = 0
    raycast_max_surface_error = 0.0
    for board in boards:
        x, z = (float(v) for v in board["centerXZ"])
        hit, location, _normal, _face = floor.ray_cast(
            Vector((x, floor_y + 1.0, z)), Vector((0.0, -1.0, 0.0)), distance=2.0
        )
        if not hit:
            fail("a real plank is floating or missing under vertical raycast: " + str(board["board"]))
        error = abs(float(location.y) - floor_y)
        raycast_max_surface_error = max(raycast_max_surface_error, error)
        if error > 0.0005:
            fail("plank top does not meet floorY=0: board " + str(board["board"]) + " error=" + str(error))
        raycast_hits += 1

    roughness = roughness_metrics()
    floor_texel_density = HIGH_TIER_COLOR_TEXTURE_PX
    if floor_texel_density < MIN_FLOOR_TEXEL_DENSITY:
        fail("walnut floor texel density is below 512 px/m in high tier")

    vinyl_objects = get_element_object("floor.vinyl_sweep")
    if len(vinyl_objects) != 1:
        fail("vinyl sweep does not resolve to exactly one geometry object")
    vinyl = vinyl_objects[0]
    vb = bounds(vinyl)
    radius_x = (vb["maxX"] - vb["minX"]) / 2.0
    radius_z = (vb["maxZ"] - vb["minZ"]) / 2.0
    if vinyl.get("surfacePhase") != 7:
        fail("vinyl surface is not tagged as Phase 07")
    if abs(radius_x - 2.3) > 0.003 or abs(radius_z - 2.3) > 0.003:
        fail("vinyl sweep is not a true 2.3 m radius circle")
    if abs(float(vinyl.get("phase7VinylThicknessM", -1)) - 0.0012) > UV_EPSILON:
        fail("vinyl thickness is not 1.2 mm")
    if abs(float(vinyl.get("phase7VinylEdgeLiftM", -1)) - 0.004) > UV_EPSILON:
        fail("vinyl edge lift is not 4 mm")
    vinyl_texel_density = HIGH_TIER_COLOR_TEXTURE_PX

    roof = bpy.data.objects.get("SDT_shell_vault_ceiling")
    if roof is None or roof.type != "MESH":
        fail("Phase 06 bamboo ceiling mesh is missing")
    if abs(float(roof.get("phase7BambooTileMeters", -1)) - 1.2) > UV_EPSILON:
        fail("bamboo weave is not tiled at 1.2 m")
    roof_uv = roof.data.uv_layers.get("UVMap")
    if roof_uv is None or roof.data.uv_layers.get("UV_Lightmap") is None:
        fail("bamboo ceiling must preserve material UV and UV_Lightmap")
    roof_u = [float(item.uv.x) for item in roof_uv.data]
    roof_v = [float(item.uv.y) for item in roof_uv.data]
    if max(roof_u) - min(roof_u) < float(room["clearWidthM"]) / 1.2 - 0.01:
        fail("bamboo horizontal UV tiling does not cover the full ceiling width")
    if max(roof_v) - min(roof_v) < 4.5:
        fail("bamboo arc UVs do not cover the full ceiling span")
    bamboo_texel_density = HIGH_TIER_COLOR_TEXTURE_PX / 1.2
    if bamboo_texel_density < MIN_BAMBOO_TEXEL_DENSITY:
        fail("bamboo high-tier texel density is below 384 px/m")

    paper_objects = [obj for obj in get_element_object("photo.paper_folds") if obj.get("surfacePhase") == 7]
    wall = next((obj for obj in paper_objects if obj.name.endswith("_wall")), None)
    curve = next((obj for obj in paper_objects if obj.name.endswith("_curve")), None)
    if wall is None or curve is None:
        fail("black paper needs both vertical mesh and tangent cyclorama curve")
    wall_bounds, curve_bounds = bounds(wall), bounds(curve)
    if abs(wall_bounds["minY"] - curve_bounds["maxY"]) > 0.002:
        fail("vertical paper and curve are not tangent/connected at the 350 mm spring line")
    if abs(curve_bounds["minY"] - (floor_y + 0.0012)) > 0.002:
        fail("paper cyclorama does not meet the vinyl surface")
    if abs(float(curve.get("phase7CycloramaRadiusM", -1)) - 0.35) > UV_EPSILON:
        fail("cyclorama radius is not 350 mm")
    if abs(curve_bounds["maxZ"] - wall_bounds["maxZ"]) > 0.002:
        fail("cyclorama curve and vertical paper widths do not match")

    material_manifest_path = ROOT / "art" / "textures" / "materials.manifest.json"
    manifest = json.loads(material_manifest_path.read_text(encoding="utf-8"))
    bamboo_profile = next((entry for entry in manifest["materials"] if entry["material"] == "bamboo_weave"), None)
    if bamboo_profile is None or float(bamboo_profile["target"].get("normalStrength", 0)) < 1.0:
        fail("bamboo material does not have a strong normal-map profile")

    result = {
        "phase": 7,
        "status": "source-validated",
        "floor": {
            "boards": len(boards), "rows": len(rows),
            "lengthRangeM": [round(min(lengths), 6), round(max(lengths), 6)],
            "nominalWidthM": 0.19, "bevelM": float(floor.get("phase7BoardBevelM", 0)),
            "runningBondMinimumOffsetM": MIN_JOINT_OFFSET_M,
            "verticalRaycastHits": raycast_hits,
            "maxTopSurfaceErrorM": round(raycast_max_surface_error, 7),
            "uniqueVertexTints": len(unique_tints),
            "roughness": roughness, "highTierTexelDensityPxPerM": floor_texel_density,
            "triangles": sum(max(1, len(poly.vertices) - 2) for poly in floor_mesh.polygons),
            "uv0": uv0.name, "uv1": uv1.name,
        },
        "vinyl": {
            "radiusXM": round(radius_x, 6), "radiusZM": round(radius_z, 6),
            "thicknessM": float(vinyl["phase7VinylThicknessM"]),
            "edgeLiftM": float(vinyl["phase7VinylEdgeLiftM"]),
            "highTierTexelDensityPxPerM": vinyl_texel_density,
        },
        "bamboo": {
            "tileMeters": float(roof["phase7BambooTileMeters"]),
            "uvSpan": [round(max(roof_u) - min(roof_u), 5), round(max(roof_v) - min(roof_v), 5)],
            "normalStrength": float(bamboo_profile["target"]["normalStrength"]),
            "highTierTexelDensityPxPerM": round(bamboo_texel_density, 3),
        },
        "cyclorama": {
            "radiusM": float(curve["phase7CycloramaRadiusM"]),
            "widthM": round(wall_bounds["maxZ"] - wall_bounds["minZ"], 5),
            "wallMinYM": round(wall_bounds["minY"], 5),
            "curveFloorYM": round(curve_bounds["minY"], 5),
            "tangentJoinErrorM": round(abs(wall_bounds["minY"] - curve_bounds["maxY"]), 6),
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("CAMPING PHASE 07 SURFACE CONTRACT OK", json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
