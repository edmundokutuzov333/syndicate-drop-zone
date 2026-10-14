"""Attached construction details defined by metricPlan.assemblyRules."""
from common import build_element, clear_module, set_active_module

def build(bible, ctx):
    owned = [e["id"] for e in bible.get("elements", []) if not e["id"].startswith("arch.") and e["id"] in ctx["assemblies"] and e["id"] not in ctx["placements"]]
    clear_module(ctx, "props", owned)
    set_active_module("props")
    try:
        for element in bible.get("elements", []):
            if element["id"] in owned:
                build_element(element, ctx, ctx["collections"]["COL_props"])
    finally:
        set_active_module("bootstrap")
