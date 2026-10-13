"""Production-zone geometry, preserving legacy interaction IDs."""
from common import build_element, clear_module, set_active_module

def build(bible, ctx):
    owned = [e["id"] for e in bible.get("elements", []) if e["id"].startswith("prod.") and e["id"] in ctx["placements"]]
    clear_module(ctx, "production", owned)
    set_active_module("production")
    try:
        for element in bible.get("elements", []):
            if element["id"] in owned:
                build_element(element, ctx)
    finally:
        set_active_module("bootstrap")
