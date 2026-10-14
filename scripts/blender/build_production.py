"""Production-zone geometry, preserving legacy interaction IDs.

Scene Bible assembly-only details (cables, labels and fasteners) are included as
well as elements with explicit anchor placements; they used to be silently omitted.
"""
from common import build_element, clear_module, set_active_module
from phase08_production import PHASE08_HANDLED_IDS, build_phase08_element


def build(bible, ctx):
    owned = [
        e["id"] for e in bible.get("elements", [])
        if e["id"].startswith("prod.")
        and (e["id"] in ctx["placements"] or e["id"] in ctx["assemblies"])
    ]
    clear_module(ctx, "production", owned)
    set_active_module("production")
    try:
        for element in bible.get("elements", []):
            if element["id"] not in owned:
                continue
            if element["id"] in PHASE08_HANDLED_IDS and build_phase08_element(element, ctx):
                continue
            build_element(element, ctx)
    finally:
        set_active_module("bootstrap")
