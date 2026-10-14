"""Build attached props outside architectural and production-owned scene zones."""
from common import build_element, clear_module, set_active_module


def build(bible, ctx):
    surface_owned = {"floor.wood", "floor.vinyl_sweep", "photo.paper_folds"}
    owned = [
        element["id"]
        for element in bible.get("elements", [])
        if not element["id"].startswith(("arch.", "prod."))
        and element["id"] in ctx["assemblies"]
        and element["id"] not in ctx["placements"]
        and element["id"] not in surface_owned
    ]
    clear_module(ctx, "props", owned)
    set_active_module("props")
    try:
        for element in bible.get("elements", []):
            if element["id"] in owned:
                build_element(element, ctx, ctx["collections"]["COL_props"])
    finally:
        set_active_module("bootstrap")
