"""Create only the authored Scene Bible light sources."""
import math
from common import add_scene_light, placement_for, clear_module, set_active_module

def build(bible, ctx):
    clear_module(ctx, "lights", [])
    set_active_module("lights")
    try:
        col = ctx["collections"]["COL_props"]
        count = 0
        for element in bible.get("elements", []):
            for index, light in enumerate(element.get("lights", []), 1):
                center, _ = placement_for(element, ctx)
                kind = light.get("kind", "point")
                if kind == "led_strip":
                    loc = (2.5, 1.78, 2.68)
                    area = (max(0.2, float(light.get("lengthM", 2.0))), 0.035)
                    light_kind = "rect"
                elif kind == "rect":
                    loc = (center[0], max(center[1], 1.7), center[2])
                    area_size = math.sqrt(max(0.05, float(light.get("areaM2", 0.5))))
                    area = (area_size, area_size)
                    light_kind = "rect"
                else:
                    loc = (center[0], max(center[1], 2.6), center[2])
                    area = (0.2, 0.2)
                    light_kind = "point"
                obj = add_scene_light("SDT_light_" + element["id"].replace(".", "_") + "_" + str(index),
                    light_kind, loc, light.get("lumens", light.get("lumensPerM", 250) * light.get("lengthM", 1)),
                    light.get("kelvin", 2200), col, area_size=area,
                    rotation=(1.57079632679, 0, 0) if light_kind == "rect" else (0, 0, 0))
                obj["sourceElementId"] = element["id"]
                count += 1
        expected = sum(len(e.get("lights", [])) for e in bible.get("elements", []))
        if count != expected:
            raise RuntimeError("Light count mismatch: " + str(count) + " != " + str(expected))
        print("Lights created:", count)
    finally:
        set_active_module("bootstrap")
