"""Architectural shell builder (re-entrant and Scene Bible driven)."""
from common import build_element, build_structural_walls, build_baseboards, clear_module, set_active_module

def build(bible, ctx):
    owned = [e["id"] for e in bible.get("elements", []) if e["id"].startswith("arch.")]
    clear_module(ctx, "shell", owned)
    set_active_module("shell")
    try:
        col = ctx["collections"]["COL_shell"]
        build_structural_walls(ctx, col)
        for element in bible.get("elements", []):
            if element["id"].startswith("arch.") and element["id"] not in ("arch.walls_plaster", "arch.wall_black_left", "arch.baseboard"):
                build_element(element, ctx, col)
        build_baseboards(ctx, col)
    finally:
        set_active_module("bootstrap")
