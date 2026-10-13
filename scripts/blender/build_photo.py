"""Photography-zone objects and merchandise rack anchors."""
from common import build_element, clear_module, set_active_module

def build(bible, ctx):
    owned = [e["id"] for e in bible.get("elements", []) if e["id"].startswith("photo.") and e["id"] in ctx["placements"]]
    clear_module(ctx, "photo", owned)
    set_active_module("photo")
    try:
        for element in bible.get("elements", []):
            if element["id"] in owned:
                build_element(element, ctx)
    finally:
        set_active_module("bootstrap")
