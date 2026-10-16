"""Phase 08 production-zone geometry for CAMPING V3. Units: metres."""
import math

import bpy
from common import (
    ZONE_COLLECTION, box, cylinder, cylinder_between, finish_mesh,
    placement_for, tag,
)

PHASE08_HANDLED_IDS = {
    "prod.plank_wall", "prod.desk_l", "prod.monitor_daw", "prod.monitors_pair",
    "prod.sub", "prod.keyboard_midi", "prod.chair_leather", "prod.panels_fabric",
    "prod.foam_tiles", "prod.pendant_cage_1", "prod.pendant_cage_2",
    "prod.pendant_cage_3", "prod.pendant_cage_4", "prod.frame_mirror",
    "prod.headphones", "prod.power_audio_cables", "prod.visible_fasteners",
    "prod.equipment_labels", "prod.pendant_cage_details",
}


def _slug(value):
    return "".join(ch.lower() if ch.isalnum() else "_" for ch in str(value)).strip("_")


def _name(element, suffix=""):
    zone = _slug(element.get("zone", "production"))
    element_name = _slug(element["id"].split(".", 1)[-1])
    return "SDT_" + zone + "_" + element_name + (("_" + _slug(suffix)) if suffix else "")


def _collection(ctx, element):
    return ctx["collections"].get(
        ZONE_COLLECTION.get(element.get("zone"), "COL_production"),
        ctx["collections"]["COL_production"],
    )


def _root_box(element, ctx, col, suffix, dimensions, location, mat, bevel=0.002):
    obj = box(_name(element, suffix), dimensions, location, mat, col, element=element,
              collider="none", bevel=bevel, zone=element.get("zone", "production"))
    ctx["built"].add(element["id"])
    return obj


def _box(element, ctx, col, suffix, dimensions, location, mat, bevel=0.0015, rotation=(0, 0, 0)):
    return box(_name(element, suffix), dimensions, location, mat, col,
               collider="none", bevel=bevel, zone=element.get("zone", "production"), rotation=rotation)


def _rod(element, ctx, col, suffix, start, end, radius, mat):
    return cylinder_between(_name(element, suffix), start, end, radius, mat, col,
                            element.get("zone", "production"))


def _torus(element, col, name, location, major_radius, minor_radius, mat,
           zone=None, rotation=(math.pi / 2, 0, 0), root=False):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=32, minor_segments=8, location=location, rotation=rotation,
        major_radius=major_radius, minor_radius=minor_radius,
    )
    obj = bpy.context.object
    obj.name = name
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    col.objects.link(obj)
    finish_mesh(obj, mat, element=element if root else None, collider="none",
                zone=zone or element.get("zone", "production"),
                lm_group=zone or element.get("zone", "production"), bevel=0, smooth=True)
    return obj


def _ellipsoid(element, ctx, col, suffix, dimensions, location, mat,
               segments=32, rings=20, root=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = _name(element, suffix)
    obj.scale = tuple(float(value) / 2.0 for value in dimensions)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    col.objects.link(obj)
    finish_mesh(obj, mat, element=element if root else None, collider="none",
                zone=element.get("zone", "production"), lm_group=element.get("zone", "production"),
                bevel=0, smooth=True)
    if root:
        ctx["built"].add(element["id"])
    return obj


def _wall(element, ctx, col):
    x, y, z = placement_for(element, ctx)[0]
    width, height = 2.60, 2.30
    # The backing is deliberately dark; the visible reclaimed boards sit on its room-facing (-Z) side.
    _root_box(element, ctx, col, "", (width, height, 0.018), (x, y, z + 0.035), "wood_dark_stained", 0.001)
    board_count = 15
    gap = 0.003
    board_width = (width - (board_count - 1) * gap) / board_count
    board_tones = ("wood_reclaimed_planks", "wood_reclaimed_top", "wood_reclaimed_planks",
                   "wood_dark_stained", "wood_reclaimed_top")
    for i in range(board_count):
        px = x - width / 2 + board_width / 2 + i * (board_width + gap)
        variation = (i % 4 - 1.5) * 0.0007
        _box(element, ctx, col, "reclaimed_board_{:02d}".format(i + 1),
             (board_width, height - 0.022, 0.028),
             (px, y + variation, z + 0.007), board_tones[i % len(board_tones)], 0.0018)
        # Subtle dark board joints and a few real countersunk nail heads.
        for side in (-1, 1):
            if side == 1:
                cylinder(_name(element, "wall_nail_{}_{}".format(i + 1, side)), 0.0035, 0.0025,
                         (px + board_width * 0.35, y + 0.72, z - 0.009), "steel_black",
                         col, vertices=10, rotation=(math.pi / 2, 0, 0), zone="production")
    # Continuous top/bottom 2200 K tape in a recessed black aluminium channel.
    for level, py in (("upper", y + height / 2 - 0.025), ("lower", y - height / 2 + 0.025)):
        _box(element, ctx, col, "led_channel_" + level, (width - 0.045, 0.018, 0.030),
             (x, py, z - 0.018), "steel_black", 0.002)
        _box(element, ctx, col, "led_diffuser_" + level, (width - 0.075, 0.008, 0.012),
             (x, py, z - 0.036), "led_warm_emissive", 0)
    for i in range(9):
        px = x - 1.08 + i * 0.27
        for py in (y + height / 2 - 0.050, y - height / 2 + 0.050):
            cylinder(_name(element, "channel_screw_{}_{}".format(i + 1, round(py, 2))),
                     0.003, 0.002, (px, py, z - 0.039), "steel_brushed", col,
                     vertices=10, rotation=(math.pi / 2, 0, 0), zone="production")


def _desk(element, ctx, col):
    x, _, z = placement_for(element, ctx)[0]
    # Main tabletop with 6 mm edge radii, plus a real perpendicular return.
    _root_box(element, ctx, col, "", (2.30, 0.040, 0.80), (x, 0.730, z), "wood_reclaimed_top", 0.006)
    _box(element, ctx, col, "return", (0.68, 0.040, 0.76), (x - 0.78, 0.730, z - 0.42), "wood_reclaimed_top", 0.006)
    _box(element, ctx, col, "front_fascia", (2.25, 0.070, 0.028), (x, 0.674, z - 0.366), "wood_dark_stained", 0.002)
    for sx in (-1, 1):
        for sz in (-1, 1):
            px, pz = x + sx * 1.035, z + sz * 0.335
            _box(element, ctx, col, "steel_leg_{}_{}".format(sx, sz), (0.040, 0.675, 0.040),
                 (px, 0.355, pz), "steel_black", 0.002)
            _box(element, ctx, col, "leg_foot_{}_{}".format(sx, sz), (0.048, 0.018, 0.048),
                 (px, 0.018, pz), "rubber_black", 0.003)
    for index, point in enumerate(((x - 1.05, 0.35, z - 0.66), (x - 0.55, 0.35, z - 0.66)), 1):
        _box(element, ctx, col, "return_leg_" + str(index), (0.040, 0.665, 0.040), point, "steel_black", 0.002)
    for i, px in enumerate((x - 1.03, x - 0.52, x + 0.52, x + 1.03), 1):
        _rod(element, ctx, col, "underframe_" + str(i), (px, 0.635, z + 0.31), (px, 0.635, z - 0.31),
             0.014, "steel_black")
    _box(element, ctx, col, "keyboard_tray", (1.05, 0.025, 0.30), (x, 0.615, z - 0.13), "steel_black", 0.003)
    for i in range(9):
        _box(element, ctx, col, "tray_slot_" + str(i + 1), (0.064, 0.0015, 0.006),
             (x - 0.43 + i * 0.107, 0.629, z - 0.13), "paint_black_matte", 0)
    # Two grommets and steel mounting plates.
    for i, px in enumerate((x - 0.90, x + 0.88), 1):
        _torus(element, col, _name(element, "cable_grommet_ring_" + str(i)), (px, 0.752, z + 0.32),
               0.020, 0.003, "steel_brushed", rotation=(math.pi / 2, 0, 0))
        cylinder(_name(element, "cable_grommet_dark_" + str(i)), 0.016, 0.006, (px, 0.751, z + 0.32),
                 "paint_black_matte", col, vertices=24, rotation=(math.pi / 2, 0, 0), zone="production")
    for side in (-1, 1):
        _box(element, ctx, col, "leg_mount_" + str(side), (0.10, 0.008, 0.10),
             (x + side * 1.02, 0.704, z + 0.30), "steel_brushed", 0.001)


def _monitor(element, ctx, col):
    x, y, z = placement_for(element, ctx)[0]
    _root_box(element, ctx, col, "", (0.620, 0.370, 0.050), (x, y, z), "plastic_black", 0.004)
    # The exact name is a runtime contract: CampingStudioEngine paints this UV surface with the live DAW.
    _box(element, ctx, col, "screen", (0.596, 0.335, 0.004), (x, y, z - 0.028), "screen_emissive", 0)
    _box(element, ctx, col, "bottom_bezel", (0.620, 0.018, 0.054), (x, y - 0.184, z), "plastic_black", 0.003)
    _box(element, ctx, col, "camera_pin", (0.010, 0.003, 0.002), (x, y + 0.177, z - 0.027), "steel_brushed", 0.001)
    _box(element, ctx, col, "stand_neck", (0.082, 0.145, 0.046), (x, y - 0.258, z + 0.015), "steel_black", 0.004)
    _box(element, ctx, col, "stand_base", (0.230, 0.014, 0.145), (x, y - 0.342, z + 0.018), "steel_black", 0.004)


def _speaker(element, ctx, col, center, suffix, root=False):
    x, y, z = center
    body = _root_box(element, ctx, col, suffix, (0.250, 0.380, 0.280), center, "plastic_black", 0.006) if root else \
        _box(element, ctx, col, suffix, (0.250, 0.380, 0.280), center, "plastic_black", 0.006)
    front_z = z - 0.143
    _torus(element, col, _name(element, suffix + "_woofer_outer"), (x, y - 0.035, front_z),
           0.078, 0.006, "steel_black_tube", rotation=(0, 0, 0))
    _ellipsoid(element, ctx, col, suffix + "_woofer_surround", (0.142, 0.142, 0.016),
               (x, y - 0.035, front_z - 0.006), "rubber_black", 40, 24)
    _ellipsoid(element, ctx, col, suffix + "_woofer_cone", (0.112, 0.112, 0.018),
               (x, y - 0.035, front_z - 0.010), "speaker_cone_black", 40, 24)
    _ellipsoid(element, ctx, col, suffix + "_dust_cap", (0.048, 0.048, 0.016),
               (x, y - 0.035, front_z - 0.018), "rubber_black", 32, 20)
    _torus(element, col, _name(element, suffix + "_tweeter_rim"), (x, y + 0.112, front_z),
           0.031, 0.004, "steel_brushed", rotation=(0, 0, 0))
    _ellipsoid(element, ctx, col, suffix + "_tweeter_waveguide", (0.054, 0.054, 0.012),
               (x, y + 0.112, front_z - 0.005), "steel_black", 28, 18)
    _ellipsoid(element, ctx, col, suffix + "_tweeter_dome", (0.025, 0.025, 0.010),
               (x, y + 0.112, front_z - 0.011), "speaker_cone_black", 24, 16)
    _torus(element, col, _name(element, suffix + "_bass_port_rim"), (x, y - 0.138, front_z - 0.001),
           0.022, 0.003, "steel_black_tube", rotation=(0, 0, 0))
    cylinder(_name(element, suffix + "_bass_port_dark"), 0.019, 0.007, (x, y - 0.138, front_z - 0.003),
             "paint_black_matte", col, vertices=24, zone="production")
    for ix in (-1, 1):
        for iz in (-1, 1):
            _ellipsoid(element, ctx, col, suffix + "_isolation_{}_{}".format(ix, iz),
                       (0.036, 0.014, 0.036), (x + ix * 0.085, y - 0.196, z + iz * 0.098),
                       "rubber_black", 16, 10)
    return body


def _speakers(element, ctx, col):
    anchors = ctx["assemblies"].get("prod.monitors_pair", {}).get(
        "instanceCentersM", [[1.70, 0.94, 2.32], [3.30, 0.94, 2.32]]
    )
    _speaker(element, ctx, col, tuple(anchors[0]), "", root=True)
    _speaker(element, ctx, col, tuple(anchors[1]), "speaker_2", root=False)


def _subwoofer(element, ctx, col):
    x, y, z = placement_for(element, ctx)[0]
    _root_box(element, ctx, col, "", (0.300, 0.400, 0.350), (x, y, z), "plastic_black", 0.006)
    front_z = z - 0.180
    _torus(element, col, _name(element, "woofer_outer"), (x, y + 0.018, front_z),
           0.092, 0.006, "steel_black_tube", rotation=(0, 0, 0))
    _ellipsoid(element, ctx, col, "woofer_surround", (0.168, 0.168, 0.018),
               (x, y + 0.018, front_z - 0.006), "rubber_black", 48, 28)
    _ellipsoid(element, ctx, col, "woofer_cone", (0.132, 0.132, 0.020),
               (x, y + 0.018, front_z - 0.012), "speaker_cone_black", 40, 24)
    _ellipsoid(element, ctx, col, "woofer_cap", (0.052, 0.052, 0.018),
               (x, y + 0.018, front_z - 0.022), "rubber_black", 32, 18)
    _torus(element, col, _name(element, "port_rim"), (x, y - 0.125, front_z - 0.002),
           0.022, 0.003, "steel_black_tube", rotation=(0, 0, 0))
    cylinder(_name(element, "port_dark"), 0.019, 0.008, (x, y - 0.125, front_z - 0.004),
             "paint_black_matte", col, vertices=24, zone="production")
    for i, px in enumerate((x - 0.09, x + 0.09), 1):
        _box(element, ctx, col, "rubber_foot_" + str(i), (0.05, 0.016, 0.08),
             (px, y - 0.208, z + 0.11), "rubber_black", 0.004)


def _midi(element, ctx, col):
    x, y, z = placement_for(element, ctx)[0]
    _root_box(element, ctx, col, "", (1.000, 0.070, 0.280), (x, y, z), "plastic_black", 0.004)
    white_count, white_width, white_depth = 36, 0.022, 0.132
    white_start = x - (white_count * white_width) / 2.0
    for index in range(white_count):
        px = white_start + (index + 0.5) * white_width
        _box(element, ctx, col, "white_key_{:02d}".format(index + 1),
             (white_width - 0.0015, 0.010, white_depth), (px, y + 0.041, z - 0.052), "key_ivory", 0.0008)
    black_after = {0, 1, 3, 4, 5}
    black_index = 0
    for index in range(white_count - 1):
        if index % 7 not in black_after:
            continue
        px = white_start + (index + 1) * white_width
        _box(element, ctx, col, "black_key_{:02d}".format(black_index + 1),
             (0.013, 0.014, 0.082), (px, y + 0.052, z - 0.028), "plastic_black", 0.0012)
        black_index += 1
    for wheel, px in enumerate((x - 0.435, x - 0.390), 1):
        cylinder(_name(element, "wheel_" + str(wheel)), 0.013, 0.020, (px, y + 0.046, z + 0.092),
                 "steel_black", col, vertices=20, rotation=(math.pi / 2, 0, 0), zone="production")
    for knob in range(8):
        px = x + 0.16 + (knob % 4) * 0.042
        pz = z + 0.093 + (knob // 4) * 0.036
        cylinder(_name(element, "control_knob_" + str(knob + 1)), 0.009, 0.010, (px, y + 0.045, pz),
                 "steel_brushed", col, vertices=16, rotation=(math.pi / 2, 0, 0), zone="production")
    _box(element, ctx, col, "control_display", (0.12, 0.003, 0.025),
         (x + 0.24, y + 0.036, z + 0.016), "screen_emissive", 0)


def _chair(element, ctx, col):
    x, _, z = placement_for(element, ctx)[0]
    # Dense ellipsoid upholstery totals approx. 14.8k source triangles before the low/mid LOD pass.
    _ellipsoid(element, ctx, col, "seat_cushion", (0.630, 0.165, 0.580),
               (x, 0.490, z), "leather_black_quilted", 64, 40, root=True)
    _ellipsoid(element, ctx, col, "back_cushion", (0.565, 0.575, 0.155),
               (x, 0.790, z - 0.235), "leather_black_quilted", 64, 50)
    _ellipsoid(element, ctx, col, "headrest", (0.390, 0.145, 0.140),
               (x, 1.045, z - 0.235), "leather_black_quilted", 48, 20)
    _box(element, ctx, col, "tilt_plate", (0.260, 0.045, 0.270), (x, 0.390, z), "steel_black", 0.004)
    cylinder(_name(element, "gas_lift"), 0.030, 0.300, (x, 0.245, z), "steel_brushed", col,
             vertices=24, zone="production")
    cylinder(_name(element, "lift_cover"), 0.045, 0.110, (x, 0.340, z), "plastic_black", col,
             vertices=24, zone="production")
    for spoke in range(5):
        angle = math.tau * spoke / 5.0
        end_x, end_z = x + math.cos(angle) * 0.315, z + math.sin(angle) * 0.315
        _rod(element, ctx, col, "base_spoke_" + str(spoke + 1), (x, 0.135, z), (end_x, 0.070, end_z), 0.018, "steel_black")
        cylinder(_name(element, "caster_stem_" + str(spoke + 1)), 0.010, 0.060, (end_x, 0.048, end_z),
                 "steel_brushed", col, vertices=12, zone="production")
        cylinder(_name(element, "caster_wheel_" + str(spoke + 1)), 0.035, 0.022, (end_x, 0.040, end_z),
                 "rubber_black", col, vertices=24, rotation=(0, math.pi / 2, 0), zone="production")
    for side in (-1, 1):
        arm_x = x + side * 0.335
        _rod(element, ctx, col, "arm_post_" + str(side), (arm_x, 0.410, z + 0.035), (arm_x, 0.575, z + 0.035), 0.014, "steel_black")
        _ellipsoid(element, ctx, col, "arm_pad_" + str(side), (0.105, 0.055, 0.355),
                   (arm_x, 0.600, z + 0.010), "leather_black_quilted", 28, 16)
    for row in range(3):
        py = 0.675 + row * 0.105
        for column in range(5):
            px = x - 0.190 + column * 0.095
            cylinder(_name(element, "back_tuft_{}_{}".format(row + 1, column + 1)), 0.007, 0.004,
                     (px, py, z - 0.317), "steel_black", col, vertices=12, zone="production")
    for seam in range(5):
        px = x - 0.190 + seam * 0.095
        _rod(element, ctx, col, "back_stitch_" + str(seam + 1),
             (px, 0.570, z - 0.313), (px, 0.990, z - 0.313), 0.0014, "leather_black_quilted")


def _panels(element, ctx, col):
    x, y, z = placement_for(element, ctx)[0]
    for index, pz in enumerate((z - 0.62, z, z + 0.62)):
        suffix = "panel_" + str(index + 1)
        dimensions, location = (0.068, 1.20, 0.540), (x - 0.045, y, pz)
        if index == 0:
            _root_box(element, ctx, col, suffix, dimensions, location, "fabric_black_acoustic", 0.008)
        else:
            _box(element, ctx, col, suffix, dimensions, location, "fabric_black_acoustic", 0.008)
        for side in (-1, 1):
            _box(element, ctx, col, suffix + "_side_trim_" + str(side), (0.008, 1.215, 0.012),
                 (x - 0.082, y, pz + side * 0.263), "steel_black_tube", 0.001)
        for py in (y - 0.50, y + 0.50):
            cylinder(_name(element, suffix + "_wall_fastener_" + str(round(py, 2))), 0.006, 0.004,
                     (x - 0.086, py, pz), "steel_brushed", col, vertices=12,
                     rotation=(0, math.pi / 2, 0), zone="production")


def _foam(element, ctx, col):
    x, y, z = placement_for(element, ctx)[0]
    _root_box(element, ctx, col, "", (0.050, 1.20, 0.600), (x - 0.045, y, z), "plastic_black", 0.002)
    for row in range(6):
        for column in range(5):
            pz, py = z - 0.228 + column * 0.114, y - 0.505 + row * 0.202
            depth = 0.012 + ((row + column) % 3) * 0.002
            _box(element, ctx, col, "foam_tile_{}_{}".format(row + 1, column + 1),
                 (depth, 0.176, 0.092), (x - 0.078, py, pz), "foam_black_grid", 0.0015,
                 rotation=(0, 0, math.radians(4 if (row + column) % 2 else -4)))


def _pendant(element, ctx, col):
    x, y, z = placement_for(element, ctx)[0]
    cylinder(_name(element, "ceiling_canopy"), 0.045, 0.018, (x, y + 0.155, z), "steel_black",
             col, element=element, vertices=32, rotation=(math.pi / 2, 0, 0), zone=element.get("zone", "production"))
    ctx["built"].add(element["id"])
    _rod(element, ctx, col, "textile_cord", (x, y + 0.145, z), (x, y + 0.055, z), 0.004, "fabric_black_flag")
    cylinder(_name(element, "bulb_holder"), 0.028, 0.040, (x, y + 0.012, z), "steel_brushed",
             col, vertices=24, rotation=(math.pi / 2, 0, 0), zone=element.get("zone", "production"))
    _ellipsoid(element, ctx, col, "edison_bulb", (0.064, 0.092, 0.064), (x, y - 0.055, z),
               "bulb_edison_emissive", 32, 20)
    _torus(element, col, _name(element, "cage_top_ring"), (x, y + 0.042, z),
           0.066, 0.004, "steel_black", zone=element.get("zone", "production"))
    _torus(element, col, _name(element, "cage_lower_ring"), (x, y - 0.115, z),
           0.066, 0.004, "steel_black", zone=element.get("zone", "production"))
    for rail in range(8):
        angle = math.tau * rail / 8.0
        px, pz = x + math.cos(angle) * 0.066, z + math.sin(angle) * 0.066
        _rod(element, ctx, col, "cage_rail_" + str(rail + 1),
             (px, y - 0.112, pz), (px, y + 0.040, pz), 0.0032, "steel_black")
    for screw in range(4):
        angle = math.tau * screw / 4.0
        cylinder(_name(element, "canopy_screw_" + str(screw + 1)), 0.0045, 0.003,
                 (x + math.cos(angle) * 0.031, y + 0.166, z + math.sin(angle) * 0.031),
                 "steel_brushed", col, vertices=10, zone=element.get("zone", "production"))


def _mirror(element, ctx, col):
    x, y, z = placement_for(element, ctx)[0]
    _root_box(element, ctx, col, "", (0.700, 0.220, 0.028), (x, y, z), "steel_black", 0.003)
    _box(element, ctx, col, "mirror_glass", (0.652, 0.177, 0.003), (x, y, z - 0.017), "glass_mirror", 0.001)
    for sx in (-1, 1):
        _box(element, ctx, col, "frame_vertical_" + str(sx), (0.018, 0.220, 0.035),
             (x + sx * 0.341, y, z - 0.020), "steel_brushed", 0.002)
    for sy in (-1, 1):
        _box(element, ctx, col, "frame_horizontal_" + str(sy), (0.700, 0.018, 0.035),
             (x, y + sy * 0.101, z - 0.020), "steel_brushed", 0.002)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cylinder(_name(element, "mirror_fixing_{}_{}".format(sx, sy)), 0.004, 0.003,
                     (x + sx * 0.321, y + sy * 0.086, z - 0.041), "steel_black", col,
                     vertices=12, rotation=(math.pi / 2, 0, 0), zone="production")


def _headphones(element, ctx, col):
    x, y, z = placement_for(element, ctx)[0]
    # The Scene Bible element anchors the real audio interface.
    _root_box(element, ctx, col, "", (0.220, 0.065, 0.145), (x, y - 0.055, z), "plastic_black", 0.004)
    for knob in range(4):
        px = x - 0.075 + knob * 0.045
        cylinder(_name(element, "interface_knob_" + str(knob + 1)), 0.009, 0.012,
                 (px, y - 0.016, z - 0.045), "steel_brushed", col, vertices=16,
                 rotation=(math.pi / 2, 0, 0), zone="production")
    _box(element, ctx, col, "interface_status_led", (0.040, 0.004, 0.004),
         (x + 0.065, y - 0.016, z - 0.060), "led_warm_emissive", 0)
    points = [
        (x - 0.065, y + 0.035, z + 0.020), (x - 0.060, y + 0.105, z + 0.025),
        (x - 0.030, y + 0.145, z + 0.028), (x + 0.030, y + 0.145, z + 0.028),
        (x + 0.060, y + 0.105, z + 0.025), (x + 0.065, y + 0.035, z + 0.020),
    ]
    for index, (a, b) in enumerate(zip(points, points[1:]), 1):
        _rod(element, ctx, col, "headband_segment_" + str(index), a, b, 0.006, "plastic_black")
    for side in (-1, 1):
        px = x + side * 0.066
        _ellipsoid(element, ctx, col, "earcup_" + str(side), (0.052, 0.068, 0.038),
                   (px, y + 0.030, z + 0.016), "plastic_black", 24, 16)
        _ellipsoid(element, ctx, col, "earpad_" + str(side), (0.044, 0.056, 0.021),
                   (px, y + 0.030, z - 0.003), "rubber_black", 24, 16)
        _rod(element, ctx, col, "yoke_" + str(side), (px, y + 0.038, z + 0.018),
             (px, y + 0.088, z + 0.026), 0.0035, "steel_brushed")
    # Red ceramic mug with a real handle and dark inner well.
    mug_x, mug_y, mug_z = x + 0.285, y - 0.015, z + 0.090
    cylinder(_name(element, "ceramic_mug_body"), 0.043, 0.082, (mug_x, mug_y, mug_z),
             "ceramic_red", col, vertices=40, rotation=(math.pi / 2, 0, 0), zone="production")
    cylinder(_name(element, "ceramic_mug_inner"), 0.033, 0.003, (mug_x, mug_y + 0.043, mug_z),
             "paint_black_matte", col, vertices=40, rotation=(math.pi / 2, 0, 0), zone="production")
    _torus(element, col, _name(element, "mug_rim"), (mug_x, mug_y + 0.042, mug_z),
           0.038, 0.0035, "ceramic_red", rotation=(math.pi / 2, 0, 0))
    _torus(element, col, _name(element, "mug_handle"), (mug_x + 0.046, mug_y, mug_z),
           0.025, 0.0055, "ceramic_red", rotation=(0, 0, 0))


def _cable_segment(name, a, b, col, zone, radius, mat, element=None):
    from mathutils import Vector
    start, end = Vector(a), Vector(b)
    delta = end - start
    if delta.length < 1e-5:
        return None
    obj = cylinder(name, radius, delta.length, (start + end) / 2.0, mat, col, element=element,
                   vertices=10, zone=zone)
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def _bezier_points(p0, p1, p2, p3, count=10):
    result = []
    for index in range(count + 1):
        t, u = index / count, 1.0 - index / count
        result.append(tuple(u**3*p0[i] + 3*u*u*t*p1[i] + 3*u*t*t*p2[i] + t**3*p3[i] for i in range(3)))
    return result


def _cables(element, ctx, col):
    routes = [
        ((2.50, 0.675, 2.42), (2.52, 0.650, 2.49), (2.75, 0.620, 2.48), (2.82, 0.420, 2.43)),
        ((2.10, 0.650, 2.20), (2.15, 0.600, 2.40), (2.50, 0.510, 2.46), (3.05, 0.210, 2.15)),
        ((3.35, 0.665, 2.22), (3.45, 0.600, 2.35), (3.45, 0.420, 2.15), (3.20, 0.200, 1.79)),
        ((2.72, 0.650, 2.05), (2.82, 0.590, 1.98), (3.00, 0.400, 1.83), (3.18, 0.200, 1.78)),
    ]
    first = True
    for route_index, control in enumerate(routes, 1):
        pts = _bezier_points(*control, count=10)
        for index, (a, b) in enumerate(zip(pts, pts[1:]), 1):
            obj = _cable_segment(_name(element, "route_{}_segment_{}".format(route_index, index)),
                                 a, b, col, "production", 0.0030 if route_index != 4 else 0.0024,
                                 "plastic_black", element=element if first else None)
            first = False
        for tie, point_index in enumerate((3, 7), 1):
            px, py, pz = pts[point_index]
            _box(element, ctx, col, "cable_tie_{}_{}".format(route_index, tie), (0.018, 0.005, 0.012),
                 (px, py + 0.004, pz), "rubber_black", 0.001)
    ctx["built"].add(element["id"])


def _fasteners(element, ctx, col):
    # Real heads and Phillips recesses repeat on the desk brackets and acoustic supports.
    locations = [(x, 0.708, z) for x in (1.48, 1.92, 3.08, 3.52) for z in (1.81, 2.42)]
    locations.extend((x, y, 2.665) for x in (1.32, 3.68) for y in (0.95, 1.50, 2.05))
    for index, point in enumerate(locations, 1):
        cylinder(_name(element, "screw_head_" + str(index)), 0.008, 0.003, point,
                 "steel_brushed" if index % 3 == 0 else "steel_black", col,
                 element=element if index == 1 else None, vertices=12,
                 rotation=(math.pi / 2, 0, 0), zone="production")
        _box(element, ctx, col, "screw_slot_h_" + str(index), (0.008, 0.0008, 0.001),
             (point[0], point[1], point[2] - 0.0022), "paint_black_matte", 0)
        _box(element, ctx, col, "screw_slot_v_" + str(index), (0.0008, 0.008, 0.001),
             (point[0], point[1], point[2] - 0.0022), "paint_black_matte", 0)
    ctx["built"].add(element["id"])


def _text_label(element, suffix, body, location, size=0.013):
    bpy.ops.object.text_add(location=location, rotation=(0, math.pi, 0))
    obj = bpy.context.object
    obj.name = _name(element, suffix)
    obj.data.body = body
    obj.data.size = size
    obj.data.extrude = 0.0001
    obj.data.align_x = "CENTER"
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = _name(element, suffix)
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    col = bpy.data.collections.get("COL_production")
    col.objects.link(obj)
    finish_mesh(obj, "paper_matte", element=None, collider="none", zone="production", lm_group="production", bevel=0)
    return obj


def _labels(element, ctx, col):
    x, y, z = placement_for(ctx["elements"]["prod.headphones"], ctx)[0]
    labels = [
        ("interface_gain", "GAIN", (x - 0.055, y - 0.026, z - 0.073)),
        ("interface_out", "OUT", (x + 0.030, y - 0.026, z - 0.073)),
        ("keyboard_midi", "MIDI 61", (2.50, 0.833, 2.055)),
        ("speaker_left", "L / R", (1.70, 0.895, 2.166)),
    ]
    for index, (suffix, body, point) in enumerate(labels):
        obj = _text_label(element, suffix, body, point, 0.013 if index < 3 else 0.012)
        if index == 0:
            tag(obj, element=element, collider="none", zone="production", lm_group="production")
    ctx["built"].add(element["id"])


def _pendant_details(element, ctx, col):
    # Additional rings and fasteners belong to the existing four lamps; no fifth lamp/light is created.
    first = True
    for lamp_index in range(1, 5):
        lamp = ctx["elements"]["prod.pendant_cage_" + str(lamp_index)]
        x, y, z = placement_for(lamp, ctx)[0]
        ring = _torus(element, col, _name(element, "cage_joint_" + str(lamp_index)),
                      (x, y - 0.113, z), 0.061, 0.0025, "steel_brushed",
                      zone=lamp.get("zone", "production"), root=first)
        if first:
            tag(ring, element=element, collider="none", zone="shell", lm_group="shell")
            first = False
        for screw in range(4):
            angle = math.tau * screw / 4.0
            cylinder(_name(element, "cage_screw_{}_{}".format(lamp_index, screw + 1)), 0.0038, 0.0025,
                     (x + math.cos(angle) * 0.061, y - 0.113, z + math.sin(angle) * 0.061),
                     "steel_brushed", col, vertices=10, zone=lamp.get("zone", "production"))
    ctx["built"].add(element["id"])


_BUILDERS = {
    "prod.plank_wall": _wall,
    "prod.desk_l": _desk,
    "prod.monitor_daw": _monitor,
    "prod.monitors_pair": _speakers,
    "prod.sub": _subwoofer,
    "prod.keyboard_midi": _midi,
    "prod.chair_leather": _chair,
    "prod.panels_fabric": _panels,
    "prod.foam_tiles": _foam,
    "prod.pendant_cage_1": _pendant,
    "prod.pendant_cage_2": _pendant,
    "prod.pendant_cage_3": _pendant,
    "prod.pendant_cage_4": _pendant,
    "prod.frame_mirror": _mirror,
    "prod.headphones": _headphones,
    "prod.power_audio_cables": _cables,
    "prod.visible_fasteners": _fasteners,
    "prod.equipment_labels": _labels,
    "prod.pendant_cage_details": _pendant_details,
}


def build_phase08_element(element, ctx):
    builder = _BUILDERS.get(element["id"])
    if builder is None:
        return False
    col = _collection(ctx, element)
    builder(element, ctx, col)
    if element["id"] not in ctx["built"]:
        ctx["built"].add(element["id"])
    return True
