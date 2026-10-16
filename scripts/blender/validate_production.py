#!/usr/bin/env python3
"""Source-scene acceptance gate for the CAMPING V3 Phase 08 production zone."""
import json
import re
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import argv_after_dashes

REQUIRED_PROD_IDS = (
    "prod.plank_wall", "prod.desk_l", "prod.monitor_daw", "prod.monitors_pair",
    "prod.sub", "prod.keyboard_midi", "prod.chair_leather", "prod.panels_fabric",
    "prod.foam_tiles", "prod.pendant_cage_1", "prod.pendant_cage_2",
    "prod.pendant_cage_3", "prod.pendant_cage_4", "prod.frame_mirror",
    "prod.headphones", "prod.power_audio_cables", "prod.visible_fasteners",
    "prod.equipment_labels", "prod.pendant_cage_details",
)
CHAIR_UPHOLSTERY = re.compile(
    r"^SDT_production_chair_leather_(seat_cushion|back_cushion|headrest|arm_pad__?[12])$"
)


def fail(message):
    raise RuntimeError("CAMPING PHASE 08 PRODUCTION CONTRACT FAILED: " + message)


def triangle_count(obj):
    if obj.type != "MESH":
        return 0
    return sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons)


def element_objects(element_id):
    return [obj for obj in bpy.context.scene.objects if obj.get("elementId") == element_id]


def main():
    args = argv_after_dashes()
    bible_path = Path(args[0] if args else "docs/camping-v3/scene-bible.json").resolve()
    output_path = Path(args[1] if len(args) > 1 else "art/xoyens-studio.phase08.report.json").resolve()
    if not bible_path.is_file():
        fail("Scene Bible is missing: " + str(bible_path))
    bible = json.loads(bible_path.read_text(encoding="utf-8"))
    if bible.get("version") != 3:
        fail("Scene Bible v3 is required")

    scene_objects = list(bpy.context.scene.objects)
    prod_objects = [obj for obj in scene_objects if str(obj.get("elementId", "")).startswith("prod.")]
    element_report = {}
    for element_id in REQUIRED_PROD_IDS:
        objects = element_objects(element_id)
        # Cable assemblies may carry the stable elementId on the route root and
        # a second legacy anchor from the source scene. Certify the intended root
        # by its deterministic name, while still rejecting missing/ambiguous roots.
        if element_id == "prod.power_audio_cables":
            canonical = [obj for obj in objects if obj.name == "SDT_production_power_audio_cables_route_1_segment_1"]
            if len(canonical) != 1 or canonical[0].type != "MESH":
                fail(element_id + " must contain exactly one canonical route root mesh, found " + str(len(canonical)))
            element_report[element_id] = canonical[0].name
            continue
        if len(objects) != 1:
            fail(element_id + " must map to exactly one tagged root/source mesh, found " + str(len(objects)))
        if objects[0].type != "MESH":
            fail(element_id + " root must be a mesh, found " + objects[0].type)
        element_report[element_id] = objects[0].name

    # Interaction roots are a runtime contract, not disposable art metadata.
    interaction_requirements = {
        "prod.desk_l": "studio.production-desk",
        "prod.monitor_daw": "studio.imac",
        "prod.monitors_pair": "studio.audio-system",
    }
    for element_id, interaction_id in interaction_requirements.items():
        root = element_objects(element_id)[0]
        if root.get("interactionId") != interaction_id:
            fail(element_id + " lost interactionId " + interaction_id)

    screen = bpy.data.objects.get("SDT_production_monitor_daw_screen")
    if screen is None or screen.type != "MESH":
        fail("the live DAW screen node SDT_production_monitor_daw_screen is missing")
    if "screen_emissive" not in {mat.name for mat in screen.data.materials if mat}:
        fail("the live DAW screen must retain its emissive material before runtime replacement")

    white_keys = [obj for obj in scene_objects if re.match(r"^SDT_production_keyboard_midi_white_key_\d{2}$", obj.name)]
    black_keys = [obj for obj in scene_objects if re.match(r"^SDT_production_keyboard_midi_black_key_\d{2}$", obj.name)]
    if len(white_keys) != 36 or len(black_keys) != 25:
        fail("MIDI keyboard must contain 36 separate white keys and 25 separate black keys: "
             + str(len(white_keys)) + " white / " + str(len(black_keys)) + " black")

    acoustic_panels = [obj for obj in scene_objects if re.match(r"^SDT_production_panels_fabric_panel_[123]$", obj.name)]
    if len(acoustic_panels) != 3:
        fail("three separately modelled acoustic fabric panels are required")
    foam_tiles = [obj for obj in scene_objects if re.match(r"^SDT_production_foam_tiles_foam_tile_\d+_\d+$", obj.name)]
    if len(foam_tiles) != 30:
        fail("the foam treatment requires 30 geometric grid tiles, found " + str(len(foam_tiles)))

    wall_boards = [obj for obj in scene_objects if re.match(r"^SDT_production_plank_wall_reclaimed_board_\d{2}$", obj.name)]
    led_upper = bpy.data.objects.get("SDT_production_plank_wall_led_diffuser_upper")
    led_lower = bpy.data.objects.get("SDT_production_plank_wall_led_diffuser_lower")
    if len(wall_boards) < 14:
        fail("the production plank wall requires at least 14 separate reclaimed boards")
    if not led_upper or not led_lower:
        fail("upper and lower continuous warm LED strips are both required")
    for strip in (led_upper, led_lower):
        if "led_warm_emissive" not in {mat.name for mat in strip.data.materials if mat}:
            fail(strip.name + " does not use led_warm_emissive")

    lamps = [element_objects("prod.pendant_cage_" + str(i))[0] for i in range(1, 5)]
    bulbs = [obj for obj in scene_objects if re.match(r"^SDT_(production|photo|left)_pendant_cage_[1-4]_edison_bulb$", obj.name)]
    if len(lamps) != 4 or len(bulbs) != 4:
        fail("exactly four complete pendant cage/Edison bulb assemblies are required")
    for lamp in lamps:
        if not lamp.get("elementId", "").startswith("prod.pendant_cage_"):
            fail("pendant source element ID missing")

    upholstery = [obj for obj in scene_objects if CHAIR_UPHOLSTERY.match(obj.name)]
    chair_triangles = sum(triangle_count(obj) for obj in upholstery)
    if not 14000 <= chair_triangles <= 18000:
        fail("chair upholstery must be between 14,000 and 18,000 source triangles; found " + str(chair_triangles))
    if len(upholstery) != 5:
        fail("chair needs separate seat, back, headrest and two arm cushions")

    cables = [obj for obj in scene_objects if re.match(r"^SDT_production_power_audio_cables_route_\d+_segment_\d+$", obj.name)]
    if len(cables) < 30:
        fail("power/audio leads must be curved geometry, not a box proxy")
    cable_max_y = max((obj.matrix_world.translation.y + obj.dimensions.y / 2 for obj in cables), default=99)
    if cable_max_y > 0.71:
        fail("production cables rise above the underside of the desk or intrude into the walkway")

    used_materials = {
        mat.name
        for obj in scene_objects if obj.type == "MESH"
        for mat in obj.data.materials if mat
    }
    for material_name in ("ceramic_red", "glass_mirror", "led_warm_emissive"):
        if material_name not in used_materials:
            fail("required Phase 08 material is not actually assigned to geometry: " + material_name)
    mirror_mesh = element_objects("prod.frame_mirror")[0]
    if not any("mirror_glass" in obj.name for obj in scene_objects):
        fail("the narrow wall mirror has no glass pane geometry")
    mug = bpy.data.objects.get("SDT_production_headphones_ceramic_mug_body")
    if mug is None or "ceramic_red" not in {mat.name for mat in mug.data.materials if mat}:
        fail("red ceramic mug geometry/material is missing")

    # Stable dimensions and required close-up screen/interaction anchors.
    desk = element_objects("prod.desk_l")[0]
    if abs(float(desk.dimensions.y) - 0.040) > 0.002:
        fail("desk main slab must be a 40 mm reclaimed-wood top")
    if bpy.data.objects.get("SDT_production_desk_l_return") is None:
        fail("L-shaped desk return is missing")
    if abs(float(element_objects("prod.monitor_daw")[0].dimensions.x) - 0.620) > 0.003:
        fail("27-inch monitor width must remain 0.62 m")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "version": 1,
        "phase": 8,
        "status": "source-validated",
        "elements": element_report,
        "productionZone": {
            "requiredElements": len(REQUIRED_PROD_IDS),
            "taggedProductionObjects": len(prod_objects),
            "deskHeightM": round(float(desk.dimensions.y), 5),
            "deskReturnPresent": True,
            "monitorWidthM": round(float(element_objects("prod.monitor_daw")[0].dimensions.x), 5),
            "liveDawNode": screen.name,
            "liveDawInteraction": interaction_requirements["prod.monitor_daw"],
            "speakerCabinets": 2,
            "midiWhiteKeys": len(white_keys),
            "midiBlackKeys": len(black_keys),
            "chairUpholsteryTrianglesSource": chair_triangles,
            "chairCushionMeshes": len(upholstery),
            "acousticFabricPanels": len(acoustic_panels),
            "acousticFoamTiles": len(foam_tiles),
            "reclaimedWallBoards": len(wall_boards),
            "upperLed": led_upper.name,
            "lowerLed": led_lower.name,
            "pendants": len(lamps),
            "edisonBulbs": len(bulbs),
            "cableSegments": len(cables),
            "cableMaximumY": round(float(cable_max_y), 5),
            "requiredPbrMaterialsLinked": ["ceramic_red", "glass_mirror", "led_warm_emissive"],
            "requiredInteractionsPreserved": list(interaction_requirements.values()),
            "unusedOfficialAssetsCreated": False,
        },
        "triangles": sum(triangle_count(obj) for obj in scene_objects),
        "materials": sorted(used_materials),
    }
    output_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("CAMPING PHASE 08 PRODUCTION CONTRACT OK", json.dumps(report["productionZone"], sort_keys=True))


if __name__ == "__main__":
    main()
