#!/usr/bin/env python3
"""Source-level acceptance gate for Phase 10 left/right studio zones."""
import json
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from common import argv_after_dashes

REQUIRED = {
    "left.mural_print": (1.9, 2.4, 0.02),
    "left.roller_white": (2.15, 0.14, 0.14),
    "left.flag_yen": (1.0, 0.8, 0.02),
    "left.sofa_tufted": (1.9, 0.45, 0.95),
    "right.shelf_unit": (0.9, 1.8, 0.4),
    "right.painting": (0.9, 1.2, 0.04),
}
REQUIRED_MATERIALS = {
    "canvas_print_mural", "plastic_white_abs", "fabric_black_flag",
    "print_official_xoyens", "leather_black_tufted", "foil_silver",
    "steel_black", "wood_reclaimed_top", "canvas_print_painting",
    "wood_dark_stained",
}

def main():
    args = argv_after_dashes()
    output = Path(args[0] if args else "art/xoyens-studio.phase10.report.json").resolve()
    objects = list(bpy.context.scene.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    by_id = {}
    for obj in objects:
        element_id = str(obj.get("elementId", ""))
        if element_id:
            by_id.setdefault(element_id, []).append(obj)

    failures = []
    elements = {}
    for element_id, expected_size in REQUIRED.items():
        candidates = by_id.get(element_id, [])
        mesh_candidates = [obj for obj in candidates if obj.type == "MESH"]
        if not candidates:
            failures.append("missing element root: " + element_id)
        if not mesh_candidates:
            failures.append("missing mesh with elementId: " + element_id)
        measured = None
        if mesh_candidates:
            # Record the largest root mesh dimensions; dimensions are evidence,
            # not a hard gate, because scene roots may be split across components.
            obj = max(mesh_candidates, key=lambda item: item.dimensions.x * item.dimensions.y * item.dimensions.z)
            measured = [round(float(v), 4) for v in obj.dimensions]
        elements[element_id] = {
            "rootCount": len(candidates),
            "meshCount": len(mesh_candidates),
            "expectedSizeM": list(expected_size),
            "measuredLargestMeshDimensionsM": measured,
        }

    material_names = {material.name for material in bpy.data.materials}
    missing_materials = sorted(REQUIRED_MATERIALS - material_names)
    failures.extend("missing material datablock: " + name for name in missing_materials)

    # Report actual assigned materials without assuming a specific mesh naming scheme.
    assigned = {}
    for element_id in REQUIRED:
        assigned[element_id] = sorted({
            material.name
            for obj in by_id.get(element_id, [])
            if obj.type == "MESH"
            for material in obj.data.materials
            if material is not None
        })

    report = {
        "version": 1,
        "phase": 10,
        "status": "source-validated" if not failures else "failed",
        "blenderVersion": bpy.app.version_string,
        "requiredElements": len(REQUIRED),
        "elementsFound": sum(bool(by_id.get(element_id)) for element_id in REQUIRED),
        "sceneMeshCount": len(meshes),
        "elements": elements,
        "requiredMaterials": sorted(REQUIRED_MATERIALS),
        "missingMaterials": missing_materials,
        "assignedMaterialsByElement": assigned,
        "failures": failures,
        "certificationNote": "Source validation only; does not certify visual fidelity, production deployment, or phase completion.",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("PHASE 10 SIDES VALIDATION", json.dumps(report, sort_keys=True))
    if failures:
        raise RuntimeError("Phase 10 failed: " + "; ".join(failures))

if __name__ == "__main__":
    main()
