"""Left/right wall objects and backend-driven artist frames."""
from common import build_element, clear_module, set_active_module

def build(bible, ctx):
    owned = [e["id"] for e in bible.get("elements", []) if
             (e["id"].startswith("left.") or e["id"].startswith("right.") or e["id"] == "artists.wall")
             and (e["id"] in ctx["placements"] or e["id"] == "artists.wall")]
    clear_module(ctx, "sides", owned)
    set_active_module("sides")
    try:
        for element in bible.get("elements", []):
            if element["id"] in owned:
                build_element(element, ctx)
    finally:
        set_active_module("bootstrap")
