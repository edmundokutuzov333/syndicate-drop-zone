"""Phase 09 photography zone, retaining the previous builder before the Phase 09 gate is enabled."""
import os
from common import build_element, clear_module, set_active_module
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
            if os.environ.get("CAMPING_PHASE", "8").isdigit() and int(os.environ.get("CAMPING_PHASE", "8")) < 9:
                # Keep the published Phase 08 build runnable while Phase 09 is being wired into CI.
                if element["id"] != "photo.paper_folds":
                    build_element(element, ctx)
                continue
            if element["id"] == "photo.paper_folds":
                # Phase 07 owns the continuous cyclorama and its sweep.
                continue
            built = build_phase09_element(element, ctx)
            if built is None:
                build_element(element, ctx)
    finally:
        set_active_module("bootstrap")
