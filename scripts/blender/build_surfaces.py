"""Phase 07 hero surfaces: real walnut planks, circular vinyl and continuous paper cyclorama."""
import json
import math
import random
from pathlib import Path

import bpy

from common import box, clear_module, finish_mesh, material, placement_for, set_active_module

# Phase 07 physical dimensions, metres. The room envelope remains owned by Scene Bible.
BOARD_WIDTH_M = 0.190
BOARD_MIN_LENGTH_M = 0.900
BOARD_MAX_LENGTH_M = 2.200
BOARD_THICKNESS_M = 0.019
SUBSTRATE_THICKNESS_M = 0.001
BOARD_JOINT_M = 0.0012
BOARD_BEVEL_M = 0.0008
BOARD_BEVEL_SEGMENTS = 2
BOARD_SEGMENT_COUNT = 4
BOARD_SEED = 7007
BAMBOO_TILE_M = 1.2
VINYL_RADIUS_M = 2.3
VINYL_THICKNESS_M = 0.0012
VINYL_EDGE_LIFT_M = 0.004
VINYL_RIM_WIDTH_M = 0.050
VINYL_BEVEL_M = 0.00035
CYCLO_R_M = 0.35
CYCLO_SEGMENTS = 32
CYCLO_WIDTH_SEGMENTS = 12


def _create_or_get_layer(mesh, name="UVMap"):
    layer = mesh.uv_layers.get(name)
    return layer if layer else mesh.uv_layers.new(name=name)


def _find_material_nodes(mat):
    if not mat or not mat.use_nodes:
        raise RuntimeError("floor_walnut_semi_gloss must use Blender nodes")
    bsdf = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        raise RuntimeError("floor_walnut_semi_gloss has no Principled BSDF")
    return mat.node_tree, bsdf


def _partition_row(width, rng, previous_joints, x_min):
    """Deterministic random running-bond row with 0.9–2.2 m pieces and ≥0.3 m joint offset."""
    for _ in range(6000):
        source = [rng.uniform(1.45, 2.05) for _ in range(BOARD_SEGMENT_COUNT)]
        scale = width / sum(source)
        lengths = [value * scale for value in source]
        if any(length < BOARD_MIN_LENGTH_M + BOARD_JOINT_M or length > BOARD_MAX_LENGTH_M for length in lengths):
            continue
        seams = []
        cursor = x_min
        for length in lengths[:-1]:
            cursor += length
            seams.append(cursor)
        if previous_joints and any(
            min(abs(seam - old) for old in previous_joints) < 0.3000001
            for seam in seams
        ):
            continue
        return lengths, seams

    # Stable, physically valid half-board offset fallback. It avoids coincident joints.
    lengths = [0.95, 1.90, 1.90, 1.90, 0.95]
    seams = []
    cursor = x_min
    for length in lengths[:-1]:
        cursor += length
        seams.append(cursor)
    if previous_joints and any(
        min(abs(seam - old) for old in previous_joints) < 0.3000001
        for seam in seams
    ):
        lengths = [1.90, 1.90, 1.90, 1.90]
        seams = [x_min + 1.90, x_min + 3.80, x_min + 5.70]
    if previous_joints and any(
        min(abs(seam - old) for old in previous_joints) < 0.3000001
        for seam in seams
    ):
        raise RuntimeError("Unable to produce a compliant running-bond floor row")
    return lengths, seams


def _make_plank_mesh(width, depth, floor_y, floor_element):
    rng = random.Random(BOARD_SEED)
    x_min, x_max = -width / 2.0, width / 2.0
    z_min = -depth / 2.0
    rows = max(1, round(depth / BOARD_WIDTH_M))
    row_pitch = depth / rows
    vertices, faces, board_specs, rows_report = [], [], [], []
    previous_joints = []

    for row_index in range(rows):
        z0 = z_min + row_index * row_pitch + BOARD_JOINT_M / 2.0
        z1 = z_min + (row_index + 1) * row_pitch - BOARD_JOINT_M / 2.0
        lengths, seams = _partition_row(width, rng, previous_joints, x_min)
        cursor = x_min
        centers = []
        for board_in_row, length in enumerate(lengths):
            raw_x0, raw_x1 = cursor, cursor + length
            plank_x0 = raw_x0 + BOARD_JOINT_M / 2.0
            plank_x1 = raw_x1 - BOARD_JOINT_M / 2.0
            cursor = raw_x1
            uv_u = rng.random()
            uv_v = rng.random()
            tone = rng.uniform(0.875, 1.125)
            tint = (
                min(1.0, tone),
                min(1.0, tone * rng.uniform(0.94, 1.015)),
                min(1.0, tone * rng.uniform(0.86, 0.985)),
                1.0,
            )
            board_id = len(board_specs)
            board_specs.append({
                "board": board_id,
                "row": row_index,
                "x0": plank_x0,
                "x1": plank_x1,
                "z0": z0,
                "z1": z1,
                "lengthM": round(plank_x1 - plank_x0, 6),
                "widthM": round(z1 - z0, 6),
                "centerXZ": [round((plank_x0 + plank_x1) / 2.0, 6), round((z0 + z1) / 2.0, 6)],
                "uvOffset": [round(uv_u, 6), round(uv_v, 6)],
                "tint": [round(value, 6) for value in tint],
            })
            centers.append(board_specs[-1]["centerXZ"])

            y0, y1 = floor_y - BOARD_THICKNESS_M, floor_y
            offset = len(vertices)
            vertices.extend([
                (plank_x0, y0, z0), (plank_x1, y0, z0),
                (plank_x1, y0, z1), (plank_x0, y0, z1),
                (plank_x0, y1, z0), (plank_x1, y1, z0),
                (plank_x1, y1, z1), (plank_x0, y1, z1),
            ])
            # Explicit winding: outward normals, with the top facing +Y.
            local_faces = [
                (0, 1, 2, 3), (4, 7, 6, 5),
                (0, 4, 5, 1), (3, 2, 6, 7),
                (0, 3, 7, 4), (1, 5, 6, 2),
            ]
            faces.extend(tuple(offset + vertex for vertex in face) for face in local_faces)

        rows_report.append({
            "row": row_index,
            "z0": round(z0, 6),
            "z1": round(z1, 6),
            "jointsX": [round(value, 6) for value in seams],
            "boardCentersXZ": centers,
        })
        previous_joints = seams

    mesh = bpy.data.meshes.new("SDT_Floor_Walnut_RunningBond")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("SDT_shell_floor_wood_hero", mesh)
    bpy.context.scene.collection.objects.link(obj)
    finish_mesh(obj, ["floor_walnut_semi_gloss"], element=floor_element,
                collider="none", zone="shell", lm_group="shell", bevel=0)

    # Each board has independent local UVs; U follows board length (X), V follows width (Z).
    uv = _create_or_get_layer(mesh, "UVMap")
    for poly in mesh.polygons:
        center = poly.center
        spec = min(
            board_specs,
            key=lambda item: abs(center.x - (item["x0"] + item["x1"]) / 2.0)
            + 6.0 * abs(center.z - (item["z0"] + item["z1"]) / 2.0),
        )
        nx, ny, nz = abs(poly.normal.x), abs(poly.normal.y), abs(poly.normal.z)
        u_offset, v_offset = spec["uvOffset"]
        for loop_index in poly.loop_indices:
            co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            if ny >= nx and ny >= nz:
                coord = (co.x - spec["x0"] + u_offset, co.z - spec["z0"] + v_offset)
            elif nx >= nz:
                coord = (co.z - spec["z0"] + v_offset, co.y - (floor_y - BOARD_THICKNESS_M))
            else:
                coord = (co.x - spec["x0"] + u_offset, co.y - (floor_y - BOARD_THICKNESS_M))
            uv.data[loop_index].uv = coord

    # One COLOR_0 tint per physical plank; GLTF multiplies it into the shared BaseColor map.
    colors = mesh.color_attributes.get("Color")
    if colors is None or colors.domain != "CORNER":
        if colors is not None:
            mesh.color_attributes.remove(colors)
        colors = mesh.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")
    for poly in mesh.polygons:
        center = poly.center
        spec = min(
            board_specs,
            key=lambda item: abs(center.x - (item["x0"] + item["x1"]) / 2.0)
            + 6.0 * abs(center.z - (item["z0"] + item["z1"]) / 2.0),
        )
        tint = spec["tint"]
        for loop_index in poly.loop_indices:
            colors.data[loop_index].color = tint

    # The bevel is real mesh geometry at export. Weighted normals run after the bevel.
    old_normal = obj.modifiers.get("SDT_Weighted_Normal")
    if old_normal:
        obj.modifiers.remove(old_normal)
    bevel = obj.modifiers.new("SDT_Plank_Edge_Bevel", "BEVEL")
    bevel.width = BOARD_BEVEL_M
    bevel.segments = BOARD_BEVEL_SEGMENTS
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = math.radians(32.0)
    bevel.harden_normals = True
    bevel.use_clamp_overlap = True
    normal = obj.modifiers.new("SDT_Weighted_Normal", "WEIGHTED_NORMAL")
    normal.keep_sharp = True

    obj["surfacePhase"] = 7
    obj["floorAssembly"] = "real-running-bond-walnut-planks"
    obj["phase7BoardCount"] = len(board_specs)
    obj["phase7BoardWidthTargetM"] = BOARD_WIDTH_M
    obj["phase7BoardMinLengthM"] = BOARD_MIN_LENGTH_M
    obj["phase7BoardMaxLengthM"] = BOARD_MAX_LENGTH_M
    obj["phase7BoardBevelM"] = BOARD_BEVEL_M
    obj["phase7FloorY"] = floor_y
    _PHASE7_REPORT["floor"] = {
        "widthM": width,
        "depthM": depth,
        "surfaceY": floor_y,
        "thicknessM": BOARD_THICKNESS_M,
        "boardCount": len(board_specs),
        "rows": rows_report,
        "boards": board_specs,
    }
    return obj


def _build_floor(bible, ctx, element):
    room = bible["metricPlan"]["room"]
    width, depth = float(room["clearWidthM"]), float(room["clearDepthM"])
    floor_y = float(room.get("floorY", 0.0))
    col = ctx["collections"]["COL_shell"]

    # A 1 mm dark substrate closes the hairline gaps without changing the room's 20 mm floor envelope.
    box("SDT_surfaces_floor_substrate",
        (width, SUBSTRATE_THICKNESS_M, depth),
        (0.0, floor_y - BOARD_THICKNESS_M - SUBSTRATE_THICKNESS_M / 2.0, 0.0),
        "wood_dark_stained", col, collider="none", bevel=0, zone="shell")
    obj = _make_plank_mesh(width, depth, floor_y, element)
    for current in list(obj.users_collection):
        if current != col:
            current.objects.unlink(obj)
    if col not in obj.users_collection:
        col.objects.link(obj)
    ctx["built"].add(element["id"])
    # The real planks, not an obsolete slab proxy, own the Scene Bible floor element.
    return obj


def _build_vinyl(bible, ctx, element):
    center, _ = placement_for(element, ctx)
    cx, _, cz = center
    floor_y = float(bible["metricPlan"]["room"].get("floorY", 0.0))
    radius = VINYL_RADIUS_M
    top_y = floor_y + VINYL_THICKNESS_M
    segments = 128
    rings = (radius - VINYL_RIM_WIDTH_M, radius - 0.015, radius)
    top_heights = (top_y, top_y + VINYL_EDGE_LIFT_M * 0.36, top_y + VINYL_EDGE_LIFT_M)
    vertices = [(cx, top_y, cz)]
    for r, y in zip(rings, top_heights):
        for i in range(segments):
            a = math.tau * i / segments
            vertices.append((cx + math.cos(a) * r, y, cz + math.sin(a) * r))
    bottom_center_index = len(vertices)
    vertices.append((cx, floor_y, cz))
    bottom_ring_start = len(vertices)
    for i in range(segments):
        a = math.tau * i / segments
        vertices.append((cx + math.cos(a) * radius, floor_y, cz + math.sin(a) * radius))

    def ri(ring_index, segment_index):
        return 1 + ring_index * segments + (segment_index % segments)

    faces = []
    inner_start = ri(0, 0)
    for i in range(segments):
        j = (i + 1) % segments
        faces.append((0, ri(0, j), ri(0, i)))
        for ring_index in range(len(rings) - 1):
            faces.append((ri(ring_index, i), ri(ring_index, j),
                          ri(ring_index + 1, j), ri(ring_index + 1, i)))
        faces.append((bottom_center_index, bottom_ring_start + i, bottom_ring_start + j))
        faces.append((bottom_ring_start + i, ri(2, i), ri(2, j), bottom_ring_start + j))

    mesh = bpy.data.meshes.new("SDT_Photo_Vinyl_CircularSweep")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("SDT_photo_vinyl_sweep_hero", mesh)
    ctx["collections"]["COL_photo"].objects.link(obj)
    finish_mesh(obj, ["vinyl_black_matte"], element=element,
                collider="none", zone="photo", lm_group="photo", bevel=0)
    uv = _create_or_get_layer(mesh, "UVMap")
    for poly in mesh.polygons:
        for loop_index in poly.loop_indices:
            co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv = ((co.x - cx) + 0.5, (co.z - cz) + 0.5)
        poly.use_smooth = True
    old_normal = obj.modifiers.get("SDT_Weighted_Normal")
    if old_normal:
        obj.modifiers.remove(old_normal)
    bevel = obj.modifiers.new("SDT_Vinyl_Edge_Bevel", "BEVEL")
    bevel.width = VINYL_BEVEL_M
    bevel.segments = 2
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = math.radians(38.0)
    bevel.use_clamp_overlap = True
    normal = obj.modifiers.new("SDT_Weighted_Normal", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    obj["surfacePhase"] = 7
    obj["phase7VinylRadiusM"] = radius
    obj["phase7VinylThicknessM"] = VINYL_THICKNESS_M
    obj["phase7VinylEdgeLiftM"] = VINYL_EDGE_LIFT_M
    _PHASE7_REPORT["vinyl"] = {
        "radiusM": radius, "thicknessM": VINYL_THICKNESS_M,
        "edgeLiftM": VINYL_EDGE_LIFT_M, "segments": segments,
        "centerXZ": [cx, cz], "surfaceY": floor_y,
    }
    ctx["built"].add(element["id"])
    return obj


def _build_cyclorama(bible, ctx, element):
    """A seamless black-paper wall transitions through a tangent 350 mm radius into the vinyl."""
    room = bible["metricPlan"]["room"]
    roller, _ = placement_for(next(e for e in bible["elements"] if e["id"] == "photo.roller_backdrop"), ctx)
    cx, roller_y, cz = roller
    roller_element = next(e for e in bible["elements"] if e["id"] == "photo.roller_backdrop")
    width = float(roller_element["size_m"][0])
    wall_x = cx - 0.008
    curve_floor_y = float(room.get("floorY", 0.0)) + VINYL_THICKNESS_M
    curve_top_y = CYCLO_R_M + curve_floor_y
    paper_top_y = roller_y - float(roller_element["size_m"][1]) / 2.0
    z_min, z_max = cz - width / 2.0, cz + width / 2.0

    vertical_vertices, vertical_faces = [], []
    vertical_rows = 8
    for yi in range(vertical_rows + 1):
        y = curve_top_y + (paper_top_y - curve_top_y) * yi / vertical_rows
        for zi in range(CYCLO_WIDTH_SEGMENTS + 1):
            z = z_min + width * zi / CYCLO_WIDTH_SEGMENTS
            wrinkle = 0.0012 * math.sin((z - cz) * 4.1) * math.sin(math.pi * yi / vertical_rows) ** 2
            vertical_vertices.append((wall_x + wrinkle, y, z))
    stride = CYCLO_WIDTH_SEGMENTS + 1
    for yi in range(vertical_rows):
        for zi in range(CYCLO_WIDTH_SEGMENTS):
            a = yi * stride + zi
            vertical_faces.append((a, a + stride, a + stride + 1, a + 1))

    arc_vertices, arc_faces = [], []
    for ai in range(CYCLO_SEGMENTS + 1):
        t = ai / CYCLO_SEGMENTS
        angle = math.pi + (math.pi / 2.0) * t
        base_x = wall_x + CYCLO_R_M + CYCLO_R_M * math.cos(angle)
        base_y = curve_floor_y + CYCLO_R_M + CYCLO_R_M * math.sin(angle)
        for zi in range(CYCLO_WIDTH_SEGMENTS + 1):
            z = z_min + width * zi / CYCLO_WIDTH_SEGMENTS
            end_taper = math.sin(math.pi * t) ** 2
            wrinkle = 0.0012 * math.sin((z - cz) * 4.1) * end_taper
            arc_vertices.append((base_x + wrinkle, base_y, z))
    for ai in range(CYCLO_SEGMENTS):
        for zi in range(CYCLO_WIDTH_SEGMENTS):
            a = ai * stride + zi
            # Winding faces toward the inside of the cyclorama, where the camera is.
            arc_faces.append((a, a + 1, a + stride + 1, a + stride))

    for label, vertices, faces in (
        ("wall", vertical_vertices, vertical_faces),
        ("curve", arc_vertices, arc_faces),
    ):
        mesh = bpy.data.meshes.new("SDT_Photo_Cyclorama_" + label)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new("SDT_photo_paper_cyclorama_" + label, mesh)
        ctx["collections"]["COL_photo"].objects.link(obj)
        finish_mesh(obj, ["paper_black_seamless"], element=element,
                    collider="none", zone="photo", lm_group="photo", bevel=0)
        uv = _create_or_get_layer(mesh, "UVMap")
        for poly in mesh.polygons:
            for loop_index in poly.loop_indices:
                co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                if label == "curve":
                    angle = math.atan2(co.y - (curve_floor_y + CYCLO_R_M), co.x - (wall_x + CYCLO_R_M))
                    if angle < 0:
                        angle += math.tau
                    arc_length = max(0.0, min(CYCLO_R_M * math.pi / 2.0,
                        (angle - math.pi) * CYCLO_R_M))
                    uv.data[loop_index].uv = (arc_length / BAMBOO_TILE_M, (co.z - z_min) / BAMBOO_TILE_M)
                else:
                    uv.data[loop_index].uv = ((paper_top_y - co.y) / BAMBOO_TILE_M,
                                               (co.z - z_min) / BAMBOO_TILE_M)
            poly.use_smooth = label == "curve"
        obj["surfacePhase"] = 7
        obj["phase7CycloramaRadiusM"] = CYCLO_R_M
        obj["phase7CycloramaWidthM"] = width
        obj["phase7PaperContinuousToFloor"] = True

    _PHASE7_REPORT["cyclorama"] = {
        "radiusM": CYCLO_R_M, "widthM": width,
        "wallX": wall_x, "curveTopY": curve_top_y,
        "floorY": curve_floor_y, "segments": CYCLO_SEGMENTS,
        "widthSegments": CYCLO_WIDTH_SEGMENTS,
        "continuesToFloor": True,
    }
    ctx["built"].add(element["id"])
    return True


def _retile_bamboo(bible):
    roof = bpy.data.objects.get("SDT_shell_vault_ceiling")
    if roof is None or roof.type != "MESH":
        raise RuntimeError("Phase 07 cannot find SDT_shell_vault_ceiling from Phase 06")
    room = bible["metricPlan"]["room"]
    width = float(room["clearWidthM"])
    depth = float(room["clearDepthM"])
    wall_h = float(room["wallHeightM"])
    crown = float(room["vaultCrownY"])
    sag = crown - wall_h
    half = depth / 2.0
    radius = (half * half + sag * sag) / (2.0 * sag)
    cy = crown - radius
    half_angle = math.asin(half / radius)
    uv = _create_or_get_layer(roof.data, "UVMap")
    for polygon in roof.data.polygons:
        for loop_index in polygon.loop_indices:
            co = roof.data.vertices[roof.data.loops[loop_index].vertex_index].co
            angle = math.atan2(co.z, co.y - cy)
            arc_distance = (angle + half_angle) * radius
            uv.data[loop_index].uv = ((co.x + width / 2.0) / BAMBOO_TILE_M,
                                       arc_distance / BAMBOO_TILE_M)
    roof["surfacePhase"] = 7
    roof["phase7BambooTileMeters"] = BAMBOO_TILE_M
    roof["phase7BambooSourceTexturePxPerM"] = 2048.0 / BAMBOO_TILE_M
    roof["phase7BambooParallaxOcclusion"] = False
    _PHASE7_REPORT["bamboo"] = {
        "tileMeters": BAMBOO_TILE_M, "sourceTexturePx": 2048,
        "sourceTexelDensityPxPerM": 2048.0 / BAMBOO_TILE_M,
        "normalStrength": 1.2, "parallaxOcclusion": False,
    }


_PHASE7_REPORT = {}


def build(bible, ctx):
    global _PHASE7_REPORT
    _PHASE7_REPORT = {"version": 1, "phase": 7}
    floor_element = next(e for e in bible.get("elements", []) if e["id"] == "floor.wood")
    vinyl_element = next(e for e in bible.get("elements", []) if e["id"] == "floor.vinyl_sweep")
    paper_element = next(e for e in bible.get("elements", []) if e["id"] == "photo.paper_folds")
    owned = ["floor.wood", "floor.vinyl_sweep", "photo.paper_folds"]
    clear_module(ctx, "surfaces", owned)
    # A prior phase-09 proxy may have been created by the assembly module. Remove it
    # by stable Scene Bible ID as well, so the surface module remains idempotent.
    for obj in list(bpy.context.scene.objects):
        if obj.get("elementId") in owned:
            bpy.data.objects.remove(obj, do_unlink=True)
    set_active_module("surfaces")
    try:
        _build_floor(bible, ctx, floor_element)
        _build_vinyl(bible, ctx, vinyl_element)
        _build_cyclorama(bible, ctx, paper_element)
        _retile_bamboo(bible)
    finally:
        set_active_module("bootstrap")
        report_path = Path(__file__).resolve().parents[2] / "art" / "out" / "phase07-surfaces.json"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(_PHASE7_REPORT, indent=2, sort_keys=True) + "\\n", encoding="utf-8")
