#!/usr/bin/env python3
"""Phase 11 organic-prop budgets, UVs and source metadata acceptance gate."""
import json
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from common import argv_after_dashes

BUDGETS = {
    "left.guitar_strat": 14000,
    "left.palm_areca": 22000,
    "right.pothos": 18000,
}

def tri_count(obj):
    if obj.type != "MESH":
        return 0
    return sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons)

def main():
    args = argv_after_dashes()
    output = Path(args[0] if args else "art/xoyens-studio.phase11.report.json").resolve()
    objects = list(bpy.context.scene.objects)
    by_id = {}
    for obj in objects:
        element_id = str(obj.get("elementId", ""))
        if element_id:
            by_id.setdefault(element_id, []).append(obj)

    failures = []
    results = {}
    for element_id, budget in BUDGETS.items():
        candidates = by_id.get(element_id, [])
        meshes = [obj for obj in candidates if obj.type == "MESH"]
        count = sum(tri_count(obj) for obj in meshes)
        sources = sorted({str(obj.get("source", "")) for obj in candidates if obj.get("source")})
        uv_missing = []
        material_missing = []
        for obj in meshes:
            uv_names = {layer.name for layer in obj.data.uv_layers}
            if not uv_names:
                uv_missing.append(obj.name)
            if not obj.data.materials or all(mat is None for mat in obj.data.materials):
                material_missing.append(obj.name)
        if not candidates:
            failures.append("missing organic prop: " + element_id)
        if not meshes:
            failures.append("no mesh for organic prop: " + element_id)
        if count > budget:
            failures.append(f"{element_id}: {count} triangles exceeds budget {budget}")
        if uv_missing:
            failures.append(f"{element_id}: meshes without UVs: " + ", ".join(uv_missing))
        if material_missing:
            failures.append(f"{element_id}: meshes without materials: " + ", ".join(material_missing))
        if not sources:
            failures.append(element_id + ": source/licence metadata missing")
        results[element_id] = {
            "meshCount": len(meshes),
            "triangles": count,
            "triangleBudget": budget,
            "budgetPass": count <= budget,
            "sources": sources,
            "uvMissingMeshes": uv_missing,
            "materialMissingMeshes": material_missing,
        }

    report = {
        "version": 1,
        "phase": 11,
        "status": "source-validated" if not failures else "failed",
        "blenderVersion": bpy.app.version_string,
        "props": results,
        "splatRAnd": {
            "status": "not-evaluated",
            "decision": "retain mesh-only runtime until commercial licence, <=25 MB, >=45 FPS mid and >=8-point hero-sector score gain are measured",
        },
        "failures": failures,
        "certificationNote": "Does not assert de-lighting, clean ORM, alpha-tested instancing or splat performance without separate evidence.",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("PHASE 11 ORGANIC PROP VALIDATION", json.dumps(report, sort_keys=True))
    if failures:
        raise RuntimeError("Phase 11 failed: " + "; ".join(failures))

if __name__ == "__main__":
    main()
