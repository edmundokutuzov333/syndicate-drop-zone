"""Hero surface blockout. Material/UV detail is refined in phase 07."""
from common import build_element, clear_module, set_active_module

def build(bible, ctx):
    owned = ["floor.wood", "floor.vinyl_sweep"]
    clear_module(ctx, "surfaces", owned)
    set_active_module("surfaces")
    try:
        col = ctx["collections"]["COL_shell"]
        for element in bible.get("elements", []):
            if element["id"] in owned:
                build_element(element, ctx, col)
    finally:
        set_active_module("bootstrap")
