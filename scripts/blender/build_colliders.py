"""Hidden collision meshes for navigation and export validation."""
from common import box, clear_module, set_active_module

def build(bible, ctx):
    clear_module(ctx, "colliders", [])
    set_active_module("colliders")
    try:
        col = ctx["collections"]["COL_colliders"]
        plan = bible["metricPlan"]
        room = plan["room"]
        w, d, h, t = room["clearWidthM"], room["clearDepthM"], room["wallHeightM"], room["wallThicknessM"]
        # Split front/back blockers around the two real door openings. Door apertures remain walkable.
        for wall_id, z, door_x, door_w in (
            ("back", -d / 2 - t / 2, 0.8, 0.9),
            ("front", d / 2 + t / 2, 0.0, 0.92),
        ):
            side_a = door_x - door_w / 2 + w / 2
            side_b = w / 2 - (door_x + door_w / 2)
            if side_a > 0:
                box("COL_wall_" + wall_id + "_a", (side_a, h, t),
                    (-w / 2 + side_a / 2, h / 2, z), "plastic_black", col,
                    collider="box", bevel=0, zone="shell")
            if side_b > 0:
                box("COL_wall_" + wall_id + "_b", (side_b, h, t),
                    (door_x + door_w / 2 + side_b / 2, h / 2, z), "plastic_black", col,
                    collider="box", bevel=0, zone="shell")
            box("COL_wall_" + wall_id + "_lintel", (door_w, h - 2.04, t),
                (door_x, (h + 2.04) / 2, z), "plastic_black", col,
                collider="box", bevel=0, zone="shell")
        for name, dims, loc in (
            ("wall_left", (t, h, d), (-w / 2 - t / 2, h / 2, 0)),
            ("wall_right", (t, h, d), (w / 2 + t / 2, h / 2, 0)),
            ("production_desk", (2.3, 0.75, 0.8), (2.5, 0.375, 2.12)),
            ("production_chair", (0.7, 1.15, 0.7), (2.5, 0.575, 1.25)),
            ("merch_rack", (1.6, 1.7, 0.5), (-2.78, 0.85, 1.25)),
            ("sofa", (1.9, 0.45, 0.95), (0.75, 0.225, -1.85)),
        ):
            box("COL_" + name, dims, loc, "plastic_black", col,
                collider="box", bevel=0, zone="shell" if name.startswith("wall_") else "props")
        for obj in list(col.objects):
            obj.hide_render = True
            obj.hide_set(True)
            obj["collisionOnly"] = True
        print("Hidden collision proxies:", len(col.objects))
    finally:
        set_active_module("bootstrap")
