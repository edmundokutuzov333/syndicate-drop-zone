"""CAMPING V3 Blender pipeline helpers.

All dimensions are metres. UVMap uses local metre coordinates (1 UV unit = 1 m);
UV_Lightmap is independently unwrapped for baked illumination.
"""
import bpy
import math
import re
import sys
from mathutils import Vector

ACTIVE_MODULE = "bootstrap"


def set_active_module(name):
    global ACTIVE_MODULE
    ACTIVE_MODULE = name


def clear_module(ctx, module_name, element_ids=()):
    for obj in list(bpy.context.scene.objects):
        if obj.get("buildModule") == module_name:
            bpy.data.objects.remove(obj, do_unlink=True)
    ctx["built"].difference_update(set(element_ids))


COLLECTION_NAMES = (
    "COL_shell", "COL_production", "COL_photo", "COL_left",
    "COL_right", "COL_props", "COL_colliders",
)
ZONE_COLLECTION = {
    "shell": "COL_shell",
    "production": "COL_production",
    "photo": "COL_photo",
    "left": "COL_left",
    "right": "COL_right",
}
MATERIAL_COLOURS = {
    "floor_walnut_semi_gloss": ((0.095, 0.033, 0.012, 1), 0.42, 0.02),
    "wood_dark_stained": ((0.055, 0.022, 0.009, 1), 0.56, 0.05),
    "wood_reclaimed_planks": ((0.16, 0.061, 0.018, 1), 0.66, 0.0),
    "wood_reclaimed_top": ((0.13, 0.048, 0.014, 1), 0.48, 0.0),
    "bamboo_weave": ((0.26, 0.12, 0.035, 1), 0.75, 0.0),
    "wood_rib_dark": ((0.07, 0.025, 0.008, 1), 0.48, 0.04),
    "plaster_stucco_cream": ((0.48, 0.38, 0.26, 1), 0.93, 0.0),
    "paint_black_matte": ((0.006, 0.005, 0.004, 1), 0.84, 0.0),
    "steel_black": ((0.012, 0.012, 0.011, 1), 0.34, 0.72),
    "steel_black_tube": ((0.016, 0.016, 0.014, 1), 0.32, 0.7),
    "steel_brushed": ((0.34, 0.32, 0.29, 1), 0.28, 0.82),
    "plastic_black": ((0.009, 0.009, 0.008, 1), 0.34, 0.08),
    "rubber_black": ((0.006, 0.005, 0.004, 1), 0.82, 0.0),
    "plastic_white_abs": ((0.78, 0.76, 0.71, 1), 0.36, 0.0),
    "fabric_black_acoustic": ((0.018, 0.016, 0.014, 1), 0.94, 0.0),
    "foam_black_grid": ((0.012, 0.011, 0.010, 1), 0.9, 0.0),
    "leather_black_quilted": ((0.025, 0.021, 0.018, 1), 0.39, 0.0),
    "leather_black_tufted": ((0.022, 0.018, 0.016, 1), 0.42, 0.0),
    "cotton_black": ((0.018, 0.015, 0.014, 1), 0.92, 0.0),
    "fabric_black_flag": ((0.01, 0.009, 0.008, 1), 0.9, 0.0),
    "fabric_black_softbox": ((0.012, 0.011, 0.010, 1), 0.91, 0.0),
    "paper_black_seamless": ((0.004, 0.004, 0.004, 1), 0.88, 0.0),
    "vinyl_black_matte": ((0.006, 0.006, 0.005, 1), 0.72, 0.0),
    "screen_emissive": ((0.025, 0.11, 0.18, 1), 0.24, 0.0),
    "bulb_edison_emissive": ((1.0, 0.34, 0.06, 1), 0.3, 0.0),
    "led_warm_emissive": ((1.0, 0.19, 0.025, 1), 0.32, 0.0),
    "led_panel_emissive": ((0.8, 0.75, 0.64, 1), 0.42, 0.0),
    "key_ivory": ((0.74, 0.71, 0.63, 1), 0.35, 0.0),
    "ceramic_red": ((0.42, 0.018, 0.012, 1), 0.22, 0.0),
    "guitar_body_white": ((0.76, 0.72, 0.62, 1), 0.26, 0.1),
    "maple_neck": ((0.34, 0.19, 0.075, 1), 0.43, 0.0),
    "steel_chrome": ((0.48, 0.46, 0.42, 1), 0.2, 0.88),
    "leaf_areca": ((0.025, 0.16, 0.045, 1), 0.75, 0.0),
    "leaf_pothos": ((0.035, 0.18, 0.05, 1), 0.72, 0.0),
    "pot_brass": ((0.38, 0.19, 0.045, 1), 0.25, 0.78),
    "glass_mirror": ((0.42, 0.46, 0.48, 1), 0.12, 0.92),
    "foil_silver": ((0.38, 0.39, 0.38, 1), 0.25, 0.72),
    "paper_matte": ((0.58, 0.53, 0.44, 1), 0.94, 0.0),
    "print_official_seal": ((0.66, 0.60, 0.49, 1), 0.9, 0.0),
    "print_official_xoyens": ((0.73, 0.69, 0.59, 1), 0.9, 0.0),
    "canvas_print_mural": ((0.18, 0.055, 0.12, 1), 0.84, 0.0),
    "canvas_print_painting": ((0.25, 0.075, 0.04, 1), 0.84, 0.0),
    "wood_hanger": ((0.26, 0.12, 0.035, 1), 0.58, 0.0),
    "speaker_cone_black": ((0.008, 0.008, 0.007, 1), 0.4, 0.16),
}

def argv_after_dashes():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("SDT_World") if not bpy.data.worlds else bpy.data.worlds[0]
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.018, 0.012, 0.008, 1)
        bg.inputs["Strength"].default_value = 0.22

def collection(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
    target = parent or bpy.context.scene.collection
    if c.name not in target.children:
        target.children.link(c)
    return c

def create_collections():
    return {name: collection(name) for name in COLLECTION_NAMES}

def clear_collection(col):
    for obj in list(col.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

def slug(value):
    value = re.sub(r"[^A-Za-z0-9_]+", "_", str(value)).strip("_").lower()
    return re.sub(r"_+", "_", value)

def material(name, colour=None, roughness=None, metallic=None, emission_strength=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    base, rough, metal = MATERIAL_COLOURS.get(name, ((0.20, 0.16, 0.12, 1), 0.72, 0.0))
    if colour is not None:
        base = colour
    if roughness is not None:
        rough = roughness
    if metallic is not None:
        metal = metallic
    nodes = m.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if name.endswith("_emissive"):
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = base
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 1.4 if emission_strength is None else emission_strength
    return m


def pbr_material(name, base=None, roughness=None, metallic=None, maps=None,
                 emissive=None, emissive_strength=0.0, normal_strength=1.0,
                 coat_weight=0.0, coat_roughness=0.35, sheen_weight=0.0, sheen_roughness=0.8):
    """Principled PBR material with optional color, normal, ORM and height maps.

    ORM follows glTF packing: red=AO, green=roughness, blue=metallic.
    Color images use sRGB; data maps use Non-Color. Missing requested maps fail
    with a path error instead of silently producing a different material.
    """
    import os

    m = material(name, colour=base, roughness=roughness, metallic=metallic,
                 emission_strength=emissive_strength)
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    if emissive is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emissive
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = float(emissive_strength)
    for socket_name, socket_value in (("Coat Weight", float(coat_weight)), ("Coat Roughness", float(coat_roughness)), ("Sheen Weight", float(sheen_weight)), ("Sheen Roughness", float(sheen_roughness))):
        socket = bsdf.inputs.get(socket_name)
        if socket is not None:
            socket.default_value = socket_value

    maps = maps or {}
    # Re-running a material module removes only generated image/map nodes.
    for node in list(nodes):
        if node.get("sdtPbrNode", False):
            nodes.remove(node)
    if not maps:
        return m

    uv = nodes.new("ShaderNodeUVMap")
    uv.name = "SDT_PBR_UVMap"
    uv.uv_map = "UVMap"
    uv["sdtPbrNode"] = True

    def tex(slot, filepath, colour_space):
        if not filepath:
            return None
        resolved = os.path.abspath(os.path.expanduser(str(filepath)))
        if not os.path.isfile(resolved):
            raise FileNotFoundError("PBR texture '" + slot + "' does not exist: " + resolved)
        image = bpy.data.images.load(resolved, check_existing=True)
        image.colorspace_settings.name = colour_space
        node = nodes.new("ShaderNodeTexImage")
        node.name = "SDT_PBR_" + slot
        node.label = "SDT PBR " + slot
        node.image = image
        node["sdtPbrNode"] = True
        links.new(uv.outputs["UV"], node.inputs["Vector"])
        return node

    color_node = tex("color", maps.get("color"), "sRGB")
    orm_node = tex("orm", maps.get("orm"), "Non-Color")
    normal_node = tex("normal", maps.get("normal"), "Non-Color")
    height_node = tex("height", maps.get("height"), "Non-Color")

    sep = None
    if orm_node is not None:
        sep = nodes.new("ShaderNodeSeparateColor")
        sep.name = "SDT_PBR_ORM_Split"
        sep.mode = "RGB"
        sep["sdtPbrNode"] = True
        links.new(orm_node.outputs["Color"], sep.inputs["Color"])
        links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
        links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])

    def disconnect(target):
        for link in list(links):
            if link.to_socket == target:
                links.remove(link)

    if color_node is not None and sep is None:
        disconnect(bsdf.inputs["Base Color"])
        links.new(color_node.outputs["Color"], bsdf.inputs["Base Color"])
    elif sep is not None:
        # Blender has no glTF AO socket. Multiply the AO channel over base colour.
        mix = nodes.new("ShaderNodeMixRGB")
        mix.name = "SDT_PBR_AO_Multiply"
        mix.blend_type = "MULTIPLY"
        mix.inputs[0].default_value = 1.0
        mix["sdtPbrNode"] = True
        if color_node is not None:
            links.new(color_node.outputs["Color"], mix.inputs[1])
        else:
            mix.inputs[1].default_value = base if base is not None else MATERIAL_COLOURS.get(name, ((0.20, 0.16, 0.12, 1), 0.72, 0.0))[0]
        links.new(sep.outputs["Red"], mix.inputs[2])
        disconnect(bsdf.inputs["Base Color"])
        links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])

    normal_output = None
    if normal_node is not None:
        normal_map = nodes.new("ShaderNodeNormalMap")
        normal_map.name = "SDT_PBR_NormalMap"
        normal_map.inputs["Strength"].default_value = max(0.0, float(normal_strength))
        normal_map["sdtPbrNode"] = True
        links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
        normal_output = normal_map.outputs["Normal"]

    if height_node is not None:
        bump = nodes.new("ShaderNodeBump")
        bump.name = "SDT_PBR_HeightBump"
        bump.inputs["Distance"].default_value = 0.025
        bump.inputs["Strength"].default_value = 0.25
        bump["sdtPbrNode"] = True
        links.new(height_node.outputs["Color"], bump.inputs["Height"])
        if normal_output is not None:
            links.new(normal_output, bump.inputs["Normal"])
        disconnect(bsdf.inputs["Normal"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    elif normal_output is not None:
        disconnect(bsdf.inputs["Normal"])
        links.new(normal_output, bsdf.inputs["Normal"])

    return m


def apply_auto_smooth(mesh, angle_degrees=32.0):
    """Blender 4.x equivalent of Auto Smooth: mark edges sharp by dihedral angle."""
    import bmesh

    bm = bmesh.new()
    try:
        bm.from_mesh(mesh)
        threshold = math.radians(float(angle_degrees))
        for face in bm.faces:
            face.smooth = True
        for edge in bm.edges:
            if len(edge.link_faces) != 2:
                edge.smooth = False
                continue
            try:
                edge.smooth = edge.calc_face_angle(0.0) <= threshold
            except ValueError:
                edge.smooth = False
        bm.to_mesh(mesh)
    finally:
        bm.free()
    mesh.update()

def material_library(bible):
    """Build shared materials and connect the validated PBR texture manifest."""
    import json
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    manifest_path = root / "art" / "textures" / "materials.manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError("PBR material manifest missing: " + str(manifest_path))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("materials", [])
    if len(entries) < 18:
        raise RuntimeError("PBR material manifest must contain at least 18 material profiles")
    profiles = {entry.get("material"): entry for entry in entries}
    for name, entry in profiles.items():
        for key in ("BC", "N", "ORM"):
            asset = entry.get("maps", {}).get(key)
            if not asset or not asset.get("path"):
                raise RuntimeError(name + ": required " + key + " map missing from manifest")
            path = root / asset["path"]
            if not path.is_file():
                raise FileNotFoundError(name + ": PBR map missing: " + str(path))

    names = set()
    for element in bible.get("elements", []):
        names.update(element.get("materials", []))
    names.update(MATERIAL_COLOURS.keys())
    for name in sorted(names):
        entry = profiles.get(name)
        if entry:
            target = entry.get("target", {})
            maps = entry.get("maps", {})
            pbr_material(
                name,
                roughness=target.get("roughness"),
                metallic=target.get("metallic"),
                maps={
                    "color": str((root / maps["BC"]["path"]).resolve()),
                    "normal": str((root / maps["N"]["path"]).resolve()),
                    "orm": str((root / maps["ORM"]["path"]).resolve()),
                    **({"height": str((root / maps["H"]["path"]).resolve())} if maps.get("H") else {}),
                },
                normal_strength=target.get("normalStrength", 1.0),
                coat_weight=target.get("coatWeight", 0.0),
                coat_roughness=target.get("coatRoughness", 0.35),
                sheen_weight=target.get("sheenWeight", 0.0),
                sheen_roughness=target.get("sheenRoughness", 0.8),
            )
        else:
            material(name)

def tag(obj, element=None, interaction_id=None, collider="none", zone=None, lm_group=None):
    if element is not None:
        obj["elementId"] = element.get("id", "")
        obj["source"] = element.get("source", "model")
        zone = zone or element.get("zone", "props")
        interaction_id = interaction_id or element.get("interactionId")
    obj["collider"] = collider or "none"
    obj["buildModule"] = ACTIVE_MODULE
    obj["zone"] = zone or (element.get("zone", "props") if element else "props")
    obj["lmGroup"] = lm_group or obj["zone"]
    if interaction_id:
        obj["interactionId"] = interaction_id
    return obj

def _metric_uvs(mesh):
    uv = mesh.uv_layers.get("UVMap")
    if uv is None:
        uv = mesh.uv_layers.new(name="UVMap")
    # Each planar face uses local coordinates in metres, so one UV unit equals one metre.
    for poly in mesh.polygons:
        n = poly.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for li in poly.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            if ax >= ay and ax >= az:
                coord = (co.y, co.z)
            elif ay >= ax and ay >= az:
                coord = (co.x, co.z)
            else:
                coord = (co.x, co.y)
            uv.data[li].uv = coord
    uv2 = mesh.uv_layers.get("UV_Lightmap")
    if uv2 is None:
        uv2 = mesh.uv_layers.new(name="UV_Lightmap")
    return uv, uv2

def _smart_unwrap(obj):
    mesh = obj.data
    if mesh.uv_layers.get("UV_Lightmap") is None:
        mesh.uv_layers.new(name="UV_Lightmap")
    old_mode = bpy.context.object.mode if bpy.context.object else "OBJECT"
    if old_mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    mesh.uv_layers.active_index = mesh.uv_layers.find("UV_Lightmap")
    try:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.015)
    finally:
        if bpy.context.object and bpy.context.object.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)
    mesh.uv_layers.active_index = mesh.uv_layers.find("UVMap")

def finish_mesh(obj, material_names, element=None, collider="box", zone=None, lm_group=None, bevel=0.002, smooth=False):
    if not isinstance(material_names, (list, tuple)):
        material_names = [material_names]
    if not material_names:
        material_names = ["plastic_black"]
    for name in material_names:
        m = material(name)
        if m.name not in [slot.name for slot in obj.data.materials if slot]:
            obj.data.materials.append(m)
    _metric_uvs(obj.data)
    _smart_unwrap(obj)
    apply_auto_smooth(obj.data)
    if bevel > 0:
        dims = obj.dimensions
        min_dim = min(float(dims.x), float(dims.y), float(dims.z))
        width = min(float(bevel), max(0.0001, min_dim * 0.12))
        mod = obj.modifiers.new("SDT_Bevel_2mm", "BEVEL")
        mod.width = width
        mod.segments = 3
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(32.0)
        mod.harden_normals = True
    normal = obj.modifiers.new("SDT_Weighted_Normal", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    tag(obj, element=element, collider=collider, zone=zone, lm_group=lm_group or (element.get("zone") if element else zone))
    return obj

def _new_object_name(element, suffix=""):
    zone = element.get("zone", "props")
    base = "SDT_" + slug(zone) + "_" + slug(element.get("id", "element").split(".", 1)[-1])
    return base + ("_" + slug(suffix) if suffix else "")

def box(name, dimensions, location, material_names, col, element=None, rotation=(0, 0, 0), collider="box", bevel=0.002, zone=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(float(v) for v in dimensions)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = rotation
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    col.objects.link(obj)
    finish_mesh(obj, material_names, element=element, collider=collider, zone=zone, bevel=bevel)
    return obj

def sphere(name, dimensions, location, material_name, col, element=None, rotation=(0, 0, 0), zone=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(float(v) / 2.0 for v in dimensions)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = rotation
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    col.objects.link(obj)
    finish_mesh(obj, material_name, element=element, collider="none", zone=zone, bevel=0, smooth=True)
    return obj

def cylinder(name, radius, depth, location, material_name, col, element=None, vertices=20, rotation=(0, 0, 0), zone=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    col.objects.link(obj)
    finish_mesh(obj, material_name, element=element, collider="none" if element is None else "box", zone=zone, bevel=min(0.002, radius * 0.12))
    return obj

def cylinder_between(name, a, b, radius, material_name, col, zone="props"):
    start, end = Vector(a), Vector(b)
    delta = end - start
    if delta.length < 0.0001:
        return None
    obj = cylinder(name, radius, delta.length, (start + end) / 2, material_name, col,
                   vertices=12, zone=zone)
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj

def _place_map(bible):
    return {a["elementId"]: a for a in bible.get("metricPlan", {}).get("anchorPlacements", [])}

def _assembly_map(bible):
    return {a["elementId"]: a for a in bible.get("metricPlan", {}).get("assemblyRules", [])}

def placement_for(element, ctx):
    placement = ctx["placements"].get(element["id"])
    if placement:
        return tuple(placement["centerM"]), math.radians(float(placement.get("rotationYDeg", 0)))
    rule = ctx["assemblies"].get(element["id"], {})
    parents = rule.get("parentIds", [])
    if parents:
        parent = ctx["placements"].get(parents[0])
        if parent:
            point = list(parent["centerM"])
            point[1] = max(0.08, float(point[1]) - 0.18)
            return tuple(point), 0.0
    return (0.0, 0.3, 0.0), 0.0

def new_context(bible, collections):
    return {
        "bible": bible,
        "collections": collections,
        "elements": {e["id"]: e for e in bible.get("elements", [])},
        "placements": _place_map(bible),
        "assemblies": _assembly_map(bible),
        "built": set(),
    }

def element_box(element, ctx, col=None, dimensions=None, location=None, rotation=None, suffix="", material_names=None, bevel=0.002, collider="box"):
    center, angle = placement_for(element, ctx)
    dims = tuple(dimensions or element.get("size_m", [0.1, 0.1, 0.1]))
    loc = tuple(location or center)
    rot = tuple(rotation) if rotation is not None else (0.0, angle, 0.0)
    zone = element.get("zone", "props")
    col = col or ctx["collections"].get(ZONE_COLLECTION.get(zone), ctx["collections"]["COL_props"])
    obj = box(_new_object_name(element, suffix), dims, loc,
              material_names or element.get("materials") or ["plastic_black"], col,
              element=element, rotation=rot, collider=collider, bevel=bevel)
    ctx["built"].add(element["id"])
    return obj

def _build_door(element, ctx, col):
    center, _ = placement_for(element, ctx)
    is_main = element["id"] == "arch.door_main"
    width, height = element["size_m"][0], element["size_m"][1]
    z = 2.775 if is_main else -2.775
    x = 0.0 if is_main else 0.8
    mat = element.get("materials", ["paint_black_matte"])
    leaf = element_box(element, ctx, col=col, dimensions=(width, height, 0.055),
                       location=(x, height / 2, z), material_names=[mat[0]], bevel=0.003)
    # A slim steel frame and a real lever are separate, UV-mapped meshes.
    frame_z = z + (0.035 if is_main else -0.035)
    steel = "steel_brushed" if is_main else "steel_black"
    for side in (-1, 1):
        box(leaf.name + "_jamb_" + str(side), (0.035, height + 0.035, 0.045),
            (x + side * (width / 2 + 0.018), height / 2, frame_z), steel, col, element=None, bevel=0.002, zone="shell")
    box(leaf.name + "_lintel", (width + 0.07, 0.035, 0.045),
        (x, height + 0.018, frame_z), steel, col, element=None, bevel=0.002, zone="shell")
    cylinder(leaf.name + "_lever", 0.012, 0.13, (x + width * 0.34, 1.02, z + (0.034 if is_main else -0.034)),
             steel, col, vertices=12, rotation=(0, math.pi / 2, 0), zone="shell")
    return leaf

def _build_vault(element, ctx, col):
    room = ctx["bible"]["metricPlan"]["room"]
    width = room["clearWidthM"]
    depth = room["clearDepthM"]
    wall_h = room["wallHeightM"]
    crown = room["vaultCrownY"]
    sag = crown - wall_h
    half = depth / 2
    radius = (half * half + sag * sag) / (2 * sag)
    cy = crown - radius
    half_angle = math.asin(half / radius)
    nx, na = 48, 40
    verts = []
    faces = []
    for i in range(nx + 1):
        x = -width / 2 + width * i / nx
        for j in range(na + 1):
            angle = -half_angle + (2 * half_angle * j / na)
            verts.append((x, cy + radius * math.cos(angle), radius * math.sin(angle)))
    for i in range(nx):
        for j in range(na):
            a = i * (na + 1) + j
            b = (i + 1) * (na + 1) + j
            faces.append((a, b, b + 1, a + 1))
    mesh = bpy.data.meshes.new("SDT_VaultMesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("SDT_shell_vault_ceiling", mesh)
    col.objects.link(obj)
    finish_mesh(obj, ["bamboo_weave"], element=element, collider="mesh", zone="shell", bevel=0, smooth=True)
    ctx["built"].add(element["id"])
    rib_mat = material("wood_rib_dark")
    # Secondary ribs follow the same arc; their curve bevel is converted to mesh before saving.
    for k in range(14):
        x = -width / 2 + width * (k + 0.5) / 14
        curve = bpy.data.curves.new("SDT_vault_rib_curve", "CURVE")
        curve.dimensions = "3D"
        curve.resolution_u = 2
        curve.bevel_depth = 0.024 if k in (0, 13) else 0.017
        curve.bevel_resolution = 3
        spline = curve.splines.new("POLY")
        spline.points.add(na)
        for j, point in enumerate(spline.points):
            angle = -half_angle + (2 * half_angle * j / na)
            point.co = (x, cy + (radius - 0.018) * math.cos(angle), (radius - 0.018) * math.sin(angle), 1)
        obj_rib = bpy.data.objects.new("SDT_shell_vault_rib_" + str(k + 1).zfill(2), curve)
        col.objects.link(obj_rib)
        bpy.ops.object.select_all(action="DESELECT")
        obj_rib.select_set(True)
        bpy.context.view_layer.objects.active = obj_rib
        bpy.ops.object.convert(target="MESH")
        obj_rib = bpy.context.object
        obj_rib.name = "SDT_shell_vault_rib_" + str(k + 1).zfill(2)
        finish_mesh(obj_rib, rib_mat.name, element=None, collider="none", zone="shell", bevel=0, smooth=True)

def build_structural_walls(ctx, col):
    plan = ctx["bible"]["metricPlan"]
    room = plan["room"]
    enclosure = plan["enclosure"]
    width, depth = room["clearWidthM"], room["clearDepthM"]
    h, t = room["wallHeightM"], room["wallThicknessM"]
    wall_element = ctx["elements"]["arch.walls_plaster"]
    plaster = "plaster_stucco_cream"
    black = "paint_black_matte"
    for wall in enclosure["walls"]:
        wall_id = wall["id"]
        z_axis = wall["axis"] == "z"
        center_wall = float(wall["centerM"])
        opening_id = (wall.get("openings") or [None])[0]
        opening = next((o for o in enclosure["openings"] if o["elementId"] == opening_id), None)
        if opening is not None:
            door_cx = float(opening["centerM"][0])
            door_w = float(opening["widthM"])
            left_end = -width / 2
            left_w = door_cx - door_w / 2 - left_end
            right_start = door_cx + door_w / 2
            right_w = width / 2 - right_start
            z = center_wall
            thickness_dims = (0, 0, t) if z_axis else (t, 0, 0)
            if z_axis:
                if left_w > 0.01:
                    box("SDT_shell_wall_" + wall_id + "_a", (left_w, h, t),
                        (left_end + left_w / 2, h / 2, z), plaster, col, element=wall_element, bevel=0.002, zone="shell")
                if right_w > 0.01:
                    box("SDT_shell_wall_" + wall_id + "_b", (right_w, h, t),
                        (right_start + right_w / 2, h / 2, z), plaster, col, element=wall_element, bevel=0.002, zone="shell")
                box("SDT_shell_wall_" + wall_id + "_lintel", (door_w, h - opening["heightM"], t),
                    (door_cx, opening["heightM"] + (h - opening["heightM"]) / 2, z),
                    plaster, col, element=wall_element, bevel=0.002, zone="shell")
            else:
                # Future-proof: opening in an X-normal wall.
                if left_w > 0.01:
                    box("SDT_shell_wall_" + wall_id + "_a", (t, h, left_w),
                        (z, h / 2, left_end + left_w / 2), plaster, col, element=wall_element, bevel=0.002, zone="shell")
                if right_w > 0.01:
                    box("SDT_shell_wall_" + wall_id + "_b", (t, h, right_w),
                        (z, h / 2, right_start + right_w / 2), plaster, col, element=wall_element, bevel=0.002, zone="shell")
                box("SDT_shell_wall_" + wall_id + "_lintel", (t, h - opening["heightM"], door_w),
                    (z, opening["heightM"] + (h - opening["heightM"]) / 2, door_cx),
                    plaster, col, element=wall_element, bevel=0.002, zone="shell")
        else:
            dims = (width, h, t) if z_axis else (t, h, depth)
            loc = (0, h / 2, center_wall) if z_axis else (center_wall, h / 2, 0)
            mat = black if wall_id == "wall.left" else plaster
            box("SDT_shell_wall_" + wall_id, dims, loc, mat, col, element=wall_element, bevel=0.002, zone="shell")
    # The wall element is represented by every wall segment. The black finish is its own mapped overlay,
    # never an absent wall or a hole in the enclosure.
    black_element = ctx["elements"].get("arch.wall_black_left")
    if black_element:
        element_box(black_element, ctx, col=col, dimensions=(3.2, 2.85, 0.018),
                    location=(-3.785, 1.425, -1.0), rotation=(0, math.pi / 2, 0),
                    material_names=["paint_black_matte"], collider="none")
    ctx["built"].add("arch.walls_plaster")

def build_baseboards(ctx, col):
    element = ctx["elements"]["arch.baseboard"]
    room = ctx["bible"]["metricPlan"]["room"]
    w, d = room["clearWidthM"], room["clearDepthM"]
    h, thick = 0.08, 0.02
    y = h / 2
    pieces = [
        ((w, h, thick), (0, y, -d / 2 + thick / 2)),
        ((w, h, thick), (0, y, d / 2 - thick / 2)),
        ((thick, h, d), (-w / 2 + thick / 2, y, 0)),
        ((thick, h, d), (w / 2 - thick / 2, y, 0)),
    ]
    for index, (dims, pos) in enumerate(pieces, 1):
        box("SDT_shell_baseboard_" + str(index), dims, pos,
            "wood_dark_stained", col, element=element, bevel=0.0015, zone="shell")
    ctx["built"].add(element["id"])

def _build_artist_wall(element, ctx, col):
    center, _ = placement_for(element, ctx)
    board = element_box(element, ctx, col=col, dimensions=(3.0, 1.2, 0.045),
                        location=(-2.25, 1.55, 2.765), material_names=["wood_dark_stained"], bevel=0.003)
    board["interactionId"] = "studio.artists-wall"
    # Seventeen blank, numbered frames are deliberate: portraits are always loaded from the backend.
    width, height = 0.13, 0.19
    board_left = -2.25 - 1.5
    edge_margin = 0.05
    start_x = board_left + edge_margin + width / 2
    gap = (3.0 - 2 * edge_margin - 17 * width) / 16
    for index in range(17):
        slot_id = "studio.artist-slot-" + str(index + 1).zfill(3)
        x = start_x + index * (width + gap)
        frame = box("SDT_right_artist_slot_" + str(index + 1).zfill(3),
                    (width, height, 0.025), (x, 1.58, 2.727), "steel_black",
                    col, element=None, bevel=0.002, collider="box", zone="right")
        frame["interactionId"] = slot_id
        frame["elementId"] = "artists.wall"
        frame["source"] = "backend"
        frame["portraitFallback"] = "empty-numbered-frame"
        blank = box(frame.name + "_blank", (width - 0.018, height - 0.018, 0.004),
                    (x, 1.58, 2.711), "paper_matte", col, element=None, bevel=0, collider="none", zone="right")
        label = _text_mesh("SDT_right_artist_slot_number_" + str(index + 1).zfill(3),
                           str(index + 1).zfill(2), (x - 0.035, 1.545, 2.704), 0.07, col, "paper_matte")
        label["elementId"] = "artists.wall"
    ctx["built"].add(element["id"])

def _text_mesh(name, body, location, size, col, material_name):
    bpy.ops.object.text_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.size = size
    obj.data.extrude = 0.0003
    obj.data.align_x = "CENTER"
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    col.objects.link(obj)
    finish_mesh(obj, material_name, collider="none", zone="right", bevel=0, smooth=False)
    return obj

def build_element(element, ctx, col=None):
    eid = element["id"]
    if eid in ctx["built"]:
        return None
    col = col or ctx["collections"].get(ZONE_COLLECTION.get(element.get("zone"), "COL_props"), ctx["collections"]["COL_props"])
    center, angle = placement_for(element, ctx)
    dims = list(element.get("size_m", [0.1, 0.1, 0.1]))
    mats = element.get("materials") or ["plastic_black"]
    primary = mats[0]
    rotation = (0, angle, 0)
    root = None

    if eid == "arch.vault_ceiling":
        _build_vault(element, ctx, col)
        return bpy.data.objects.get("SDT_shell_vault_ceiling")
    if eid == "arch.walls_plaster":
        build_structural_walls(ctx, col)
        return None
    if eid == "arch.baseboard":
        build_baseboards(ctx, col)
        return None
    if eid in ("arch.door_main", "arch.door_left"):
        root = _build_door(element, ctx, col)
    elif eid == "floor.wood":
        room = ctx["bible"]["metricPlan"]["room"]
        root = element_box(element, ctx, col=col,
            dimensions=(room["clearWidthM"], 0.035, room["clearDepthM"]),
            location=(0, -0.018, 0), material_names=["floor_walnut_semi_gloss"], bevel=0)
        # One combined mesh for staggered boards keeps the source scene light and deterministic.
        root["floorAssembly"] = "staggered-planks-ready-for-phase-07"
    elif eid == "floor.vinyl_sweep":
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1, depth=dims[1], location=center)
        root = bpy.context.object
        root.name = _new_object_name(element)
        root.scale = (dims[0] / 2, dims[2] / 2, 1)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        root.rotation_euler = (math.pi / 2, 0, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        for current in list(root.users_collection):
            current.objects.unlink(root)
        col.objects.link(root)
        finish_mesh(root, primary, element=element, collider="none", zone=element["zone"], bevel=0, smooth=True)
    elif eid == "prod.desk_l":
        x, _, z = center
        root = element_box(element, ctx, col=col, dimensions=(2.3, 0.065, 0.8),
                           location=(x, 0.72, z), material_names=["wood_reclaimed_top"], bevel=0.003)
        for sx in (-1, 1):
            for sz in (-1, 1):
                box(root.name + "_leg_" + str(sx) + "_" + str(sz), (0.045, 0.69, 0.045),
                    (x + sx * 1.03, 0.355, z + sz * 0.34), "steel_black", col, zone="production", bevel=0.002)
        box(root.name + "_keyboard_tray", (1.05, 0.035, 0.31), (x, 0.61, z - 0.12),
            "steel_black", col, zone="production", bevel=0.002)
    elif eid == "prod.monitor_daw":
        x, y, z = center
        root = element_box(element, ctx, col=col, dimensions=(dims[0], dims[1], 0.055),
                           location=(x, y, z), material_names=["plastic_black"], bevel=0.003)
        box(root.name + "_screen", (dims[0] - 0.035, dims[1] - 0.035, 0.006),
            (x, y, z - 0.031), "screen_emissive", col, zone="production", bevel=0)
        box(root.name + "_stand", (0.09, 0.18, 0.06), (x, y - dims[1] / 2 - 0.09, z + 0.015),
            "steel_black", col, zone="production", bevel=0.002)
        box(root.name + "_base", (0.23, 0.018, 0.14), (x, y - dims[1] / 2 - 0.17, z + 0.02),
            "steel_black", col, zone="production", bevel=0.002)
    elif eid == "prod.monitors_pair":
        rule = ctx["assemblies"].get(eid, {})
        centers = rule.get("instanceCentersM", [[center[0] - 0.55, center[1], center[2]], [center[0] + 0.55, center[1], center[2]]])
        first = centers[0]
        root = element_box(element, ctx, col=col, dimensions=(0.25, 0.38, 0.28),
                           location=tuple(first), material_names=["plastic_black"], bevel=0.004)
        for idx, point in enumerate(centers):
            if idx == 0:
                speaker = root
            else:
                speaker = box(_new_object_name(element, "speaker_" + str(idx + 1)),
                    (0.25, 0.38, 0.28), tuple(point), "plastic_black", col, zone="production", bevel=0.004)
            x, y, z = point
            cylinder(speaker.name + "_woofer", 0.075, 0.012, (x, y - 0.035, z - 0.146),
                     "speaker_cone_black", col, vertices=24, rotation=(0, 0, 0), zone="production")
            cylinder(speaker.name + "_tweeter", 0.027, 0.012, (x, y + 0.105, z - 0.146),
                     "steel_black", col, vertices=20, rotation=(0, 0, 0), zone="production")
        ctx["built"].add(eid)
    elif eid == "prod.chair_leather":
        x, _, z = center
        root = element_box(element, ctx, col=col, dimensions=(0.64, 0.14, 0.62),
                           location=(x, 0.47, z), material_names=["leather_black_quilted"], bevel=0.035)
        box(root.name + "_back", (0.62, 0.55, 0.16), (x, 0.77, z - 0.23),
            "leather_black_quilted", col, zone="production", bevel=0.035)
        box(root.name + "_headrest", (0.42, 0.15, 0.16), (x, 1.035, z - 0.23),
            "leather_black_quilted", col, zone="production", bevel=0.025)
        for side in (-1, 1):
            box(root.name + "_arm_" + str(side), (0.09, 0.07, 0.42),
                (x + side * 0.34, 0.58, z - 0.02), "plastic_black", col, zone="production", bevel=0.015)
            cylinder_between(root.name + "_spoke_" + str(side), (x, 0.13, z), (x + side * 0.27, 0.09, z),
                             0.018, "steel_black", col)
        cylinder(root.name + "_column", 0.04, 0.34, (x, 0.3, z), "steel_black", col, vertices=16, zone="production")
        for spoke in range(5):
            a = math.tau * spoke / 5
            cylinder_between(root.name + "_base_" + str(spoke), (x, 0.12, z),
                (x + math.cos(a) * 0.31, 0.07, z + math.sin(a) * 0.31), 0.018, "steel_black", col)
    elif eid == "prod.panels_fabric":
        x, y, z = center
        root = element_box(element, ctx, col=col, dimensions=(0.54, 1.2, 0.07),
                           location=(x - 0.62, y, z), material_names=["fabric_black_acoustic"], bevel=0.008)
        for i, off in enumerate((0, 0.62, 1.24), 1):
            if i > 1:
                box(root.name + "_panel_" + str(i), (0.54, 1.2, 0.07),
                    (x - 0.62 + off, y, z), "fabric_black_acoustic", col, zone="production", bevel=0.008)
    elif eid == "prod.foam_tiles":
        root = element_box(element, ctx, col=col, dimensions=(dims[0], dims[1], dims[2]),
                           location=center, material_names=["plastic_black"], bevel=0)
        x, y, z = center
        for row in range(6):
            for column in range(5):
                box(root.name + "_tile_" + str(row) + "_" + str(column),
                    (0.09, 0.11, 0.018), (x - 0.22 + column * 0.095, y - 0.52 + row * 0.19, z + dims[2] / 2 + 0.009),
                    "foam_black_grid", col, zone="production", bevel=0.002)
    elif eid.startswith("prod.pendant_cage_"):
        x, y, z = center
        root = element_box(element, ctx, col=col, dimensions=(dims[0], dims[1], dims[2]),
                           location=center, material_names=["steel_black"], bevel=0)
        sphere(root.name + "_edison_bulb", (0.07, 0.10, 0.07), (x, y - 0.035, z),
               "bulb_edison_emissive", col, zone=element["zone"])
        for i in range(6):
            a = math.tau * i / 6
            cylinder_between(root.name + "_cage_" + str(i), (x + math.cos(a)*0.075, y-0.08, z + math.sin(a)*0.075),
                             (x + math.cos(a)*0.075, y+0.085, z + math.sin(a)*0.075), 0.004, "steel_black", col, element["zone"])
    elif eid == "left.guitar_strat":
        x, y, z = center
        root = sphere(_new_object_name(element), (0.38, 0.48, 0.12), (x, y + 0.08, z),
                      "guitar_body_white", col, element=element, zone="left")
        box(root.name + "_neck", (0.075, 0.58, 0.055), (x, y + 0.49, z),
            "maple_neck", col, zone="left", bevel=0.002)
        box(root.name + "_headstock", (0.11, 0.16, 0.045), (x, y + 0.83, z),
            "maple_neck", col, zone="left", bevel=0.003)
        for string in range(6):
            box(root.name + "_string_" + str(string + 1), (0.003, 0.68, 0.002),
                (x - 0.0225 + string * 0.009, y + 0.46, z + 0.031), "steel_chrome", col, zone="left", bevel=0)
        ctx["built"].add(eid)
    elif eid == "left.palm_areca" or eid == "right.pothos":
        x, y, z = center
        root = cylinder(_new_object_name(element) + "_stem", 0.025, 0.45, (x, y - 0.15, z),
                        "wood_dark_stained", col, element=element, vertices=16, zone=element["zone"])
        root["elementId"] = eid
        if eid == "left.palm_areca":
            cylinder(root.name + "_pot", 0.22, 0.33, (x, 0.17, z), "pot_brass", col, vertices=32, zone="left")
            for i in range(11):
                a = math.tau * i / 11
                end = (x + math.cos(a) * (0.22 + (i % 3) * 0.05), y + 0.2 + (i % 4) * 0.055, z + math.sin(a) * (0.22 + (i % 3) * 0.05))
                cylinder_between(root.name + "_leafstem_" + str(i), (x, y - 0.1, z), end, 0.006, "leaf_areca", col, "left")
                sphere(root.name + "_leaf_" + str(i), (0.11, 0.28, 0.025), end, "leaf_areca", col, zone="left", rotation=(0.35, 0.1, a))
        else:
            for i in range(9):
                a = i * 2.0
                sphere(root.name + "_leaf_" + str(i), (0.09, 0.16, 0.035),
                       (x + math.sin(a) * 0.22, y - i * 0.08, z + math.cos(a) * 0.15),
                       "leaf_pothos", col, zone="right", rotation=(0.2, 0.4, a))
        ctx["built"].add(eid)
    elif eid == "left.sofa_tufted":
        x, _, z = center
        root = element_box(element, ctx, col=col, dimensions=(1.9, 0.22, 0.95),
                           location=(x, 0.20, z), material_names=["leather_black_tufted"], bevel=0.04)
        box(root.name + "_back", (1.9, 0.2, 0.14), (x, 0.40, z - 0.40),
            "leather_black_tufted", col, zone="left", bevel=0.035)
        for row in range(2):
            for column in range(7):
                sphere(root.name + "_tuft_" + str(row) + "_" + str(column), (0.035,0.018,0.035),
                    (x - 0.78 + column * 0.26, 0.31, z - 0.12 + row * 0.25),
                    "steel_black", col, zone="left")
        box(root.name + "_silver_pillow", (0.38, 0.12, 0.32),
            (x + 0.55, 0.38, z + 0.05), "foil_silver", col, zone="left", bevel=0.045)
    elif eid == "photo.rack":
        x, _, z = center
        root = element_box(element, ctx, col=col, dimensions=(1.55, 0.045, 0.045),
                           location=(x, 1.62, z), material_names=["steel_black_tube"], bevel=0.004)
        for sx in (-0.72, 0.72):
            cylinder_between(root.name + "_upright_" + str(sx), (x + sx, 0.11, z),
                             (x + sx, 1.66, z), 0.023, "steel_black_tube", col, "photo")
            cylinder_between(root.name + "_foot_" + str(sx), (x + sx, 0.055, z - 0.22),
                             (x + sx, 0.055, z + 0.22), 0.019, "steel_black_tube", col, "photo")
        ctx["built"].add(eid)
    elif eid == "photo.garments":
        x, y, z = center
        root = element_box(element, ctx, col=col, dimensions=(0.25, 0.68, 0.06),
                           location=(x - 0.48, y, z), material_names=["cotton_black"], bevel=0.008)
        for i in range(5):
            gx = x - 0.48 + i * 0.24
            box(root.name + "_garment_" + str(i + 1), (0.23, 0.68 if i % 2 == 0 else 0.78, 0.055),
                (gx, y - (0.0 if i % 2 == 0 else 0.04), z - i * 0.003),
                "cotton_black", col, zone="photo", bevel=0.012)
            cylinder_between(root.name + "_hanger_" + str(i + 1), (gx - 0.055, y + 0.39, z),
                             (gx + 0.055, y + 0.39, z), 0.004, "wood_hanger", col, "photo")
        ctx["built"].add(eid)
    elif eid == "artists.wall":
        return _build_artist_wall(element, ctx, col)
    else:
        # Generic dimensioned mesh proxy. Later object phases replace proxies with detailed source meshes.
        root = element_box(element, ctx, col=col, dimensions=dims, location=center,
                           material_names=mats, rotation=rotation,
                           collider="none" if element["source"] in ("official-asset", "print-reference") else "box",
                           bevel=0.002)
        if eid == "arch.ac_split":
            x, y, z = center
            for i in range(9):
                box(root.name + "_vent_" + str(i), (dims[0] * 0.72, 0.006, 0.004),
                    (x, y - 0.075 + i * 0.018, z + dims[2] / 2 + 0.002),
                    "steel_black", col, zone="shell", bevel=0)
        elif eid == "left.roller_white" or eid == "photo.roller_backdrop":
            cylinder(root.name + "_roller", 0.07, dims[0], center, "plastic_white_abs", col,
                     vertices=32, rotation=(0, math.pi / 2, 0), zone=element["zone"])
        elif eid == "right.shelf_unit":
            x, y, z = center
            for level in (0.3, 0.75, 1.2, 1.65):
                box(root.name + "_shelf_" + str(level), (dims[0], 0.025, dims[2]),
                    (x, y - dims[1] / 2 + level, z), "wood_reclaimed_top", col, zone="right", bevel=0.002)
            for sx in (-1, 1):
                for sz in (-1, 1):
                    box(root.name + "_upright_" + str(sx) + "_" + str(sz), (0.025, dims[1], 0.025),
                        (x + sx * (dims[0] / 2 - 0.02), y, z + sz * (dims[2] / 2 - 0.02)),
                        "steel_black", col, zone="right", bevel=0.002)
        elif eid == "prod.keyboard_midi":
            x, y, z = center
            for i in range(12):
                bx = x - dims[0] / 2 + 0.06 + i * (dims[0] - 0.12) / 12
                box(root.name + "_white_key_" + str(i), ((dims[0]-0.12)/12, 0.012, 0.18),
                    (bx, y + 0.043, z - dims[2] / 2 - 0.01), "key_ivory", col, zone="production", bevel=0)
        elif eid == "photo.backdrop_seal":
            # Blank decal carrier only. The official seal image is linked in the material phase; no logo is recreated here.
            root["officialAssetPending"] = "print_official_seal"
        elif eid == "left.flag_yen":
            root["officialAssetPending"] = "print_official_xoyens"
        elif eid == "right.painting" or eid == "left.mural_print":
            root["referenceImagePending"] = True
    ctx["built"].add(eid)
    return root

def build_zone_elements(ctx, predicate, collection_name=None):
    for element in ctx["bible"].get("elements", []):
        if predicate(element):
            build_element(element, ctx, ctx["collections"].get(collection_name) if collection_name else None)

def add_scene_light(name, kind, location, lumens, kelvin, col, area_size=(0.3, 0.3), rotation=(0, 0, 0)):
    t = min(40000, max(1000, float(kelvin))) / 100.0
    if t <= 66:
        r = 255.0
        g = 99.4708025861 * math.log(t) - 161.1195681661
    else:
        r = 329.698727446 * ((t - 60) ** -0.1332047592)
        g = 288.1221695283 * ((t - 60) ** -0.0755148492)
    b = 255.0 if t >= 66 else (0.0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307)
    colour = tuple(max(0.0, min(255.0, v)) / 255.0 for v in (r, g, b))
    light_type = "POINT" if kind == "point" else "AREA"
    data = bpy.data.lights.new(name, light_type)
    data.color = colour
    data.energy = float(lumens) / 683.0 * (4.0 * math.pi)
    if light_type == "POINT":
        data.shadow_soft_size = 0.045
    else:
        data.shape = "RECTANGLE"
        data.size = max(0.05, float(area_size[0]))
        data.size_y = max(0.05, float(area_size[1]))
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = rotation
    col.objects.link(obj)
    tag(obj, collider="none", zone="props", lm_group="shell")
    return obj

def validate_scene_contract(bible, path=None):
    errors = []
    expected_collections = set(COLLECTION_NAMES)
    existing = {c.name for c in bpy.data.collections}
    for name in sorted(expected_collections - existing):
        errors.append("missing collection " + name)
    mesh_objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for obj in mesh_objects:
        if len(obj.data.materials) == 0 or any(m is None for m in obj.data.materials):
            errors.append(obj.name + ": no assigned material")
        uv_names = {uv.name for uv in obj.data.uv_layers}
        if "UVMap" not in uv_names or "UV_Lightmap" not in uv_names:
            errors.append(obj.name + ": UVMap or UV_Lightmap missing")
        if any(abs(float(s) - 1.0) > 1e-5 for s in obj.scale):
            errors.append(obj.name + ": unapplied scale " + repr(tuple(obj.scale)))
        if not (obj.name.startswith("SDT_") or obj.name.startswith("COL_")):
            errors.append(obj.name + ": violates object naming contract")
    element_ids = {o.get("elementId") for o in bpy.context.scene.objects if o.get("elementId")}
    for e in bible.get("elements", []):
        if e["id"] not in element_ids:
            errors.append("Scene Bible element missing from Blender scene: " + e["id"])
    interaction_ids = {o.get("interactionId") for o in bpy.context.scene.objects if o.get("interactionId")}
    for e in bible.get("elements", []):
        expected = e.get("interactionId")
        if expected and expected not in interaction_ids:
            errors.append("interactionId missing: " + expected)
    expected_slots = ["studio.artist-slot-" + str(i).zfill(3) for i in range(1, 18)]
    got_slots = sorted(x for x in interaction_ids if x.startswith("studio.artist-slot-"))
    if sorted(expected_slots) != got_slots:
        errors.append("artist slot contract mismatch; expected exactly 17 slot IDs")
    if "studio.artists-wall" not in interaction_ids:
        errors.append("studio.artists-wall missing")
    size_limit = 200 * 1024 * 1024
    if path:
        try:
            import os
            if os.path.exists(path) and os.path.getsize(path) >= size_limit:
                errors.append("blend file must remain below 200 MiB")
        except OSError as exc:
            errors.append("cannot stat blend output: " + str(exc))
    result = {
        "objects": len(bpy.context.scene.objects),
        "meshObjects": len(mesh_objects),
        "elements": len(element_ids),
        "materials": len(bpy.data.materials),
        "interactionIds": len(interaction_ids),
        "errors": errors,
    }
    if errors:
        raise RuntimeError("Blender contract failed: " + "; ".join(errors[:30]))
    return result
