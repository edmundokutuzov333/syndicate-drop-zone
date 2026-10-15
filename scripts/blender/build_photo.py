"""Phase 09 photography zone: deterministic, detailed meshes with official decals."""
from common import clear_module, set_active_module
from phase09_photo import build_phase09_element

def build(bible, ctx):
    owned = [
        e["id"] for e in bible.get("elements", [])
        if e["id"].startswith("photo.")
        and (e["id"] in ctx["placements"] or e["id"] in ctx["assemblies"])
    ]
    clear_module(ctx, "photo", owned)
    set_active_module("photo")
    try:
        for element in bible.get("elements", []):
            if element["id"] not in owned:
                continue
            if element["id"] == "photo.paper_folds":
                # Phase 07 owns the continuous cyclorama and its sweep; Phase 09 refines its photo use.
                continue
            built = build_phase09_element(element, ctx)
            if built is None:
                from common import build_element
                build_element(element, ctx)
    finally:
        set_active_module("bootstrap")
