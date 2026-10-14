"""Attached construction details defined by metricPlan.assemblyRules."""
from common import build_element, clear_module, set_active_module
from phase08_production import PHASE08_HANDLED_IDS

def build(bible, ctx):
    surface_owned = {"floor.wood", "floor.vinyl_sweep", "photo.paper_folds"}
    owned = [
        e["id"] for e in bible.get("elements", [])
        if not e["id"].startswith("arch.")
        and e["id"] in ctx["assemblies"]
        and e["id"] not in ctx["placements"]
        and e["id"] not in surface_owned
        and e["id"] not in PHASE08_HANDLED_IDS
    ]
    clear_module(ctx, "props", owned)
    set_active_module("props")
    try:
        for element in bible.get("elements", []):
            if element["id"] in owned:
                build_element(element, ctx, ctx["collections"]["COL_props"])
    finally:
        set_active_module("bootstrap")
