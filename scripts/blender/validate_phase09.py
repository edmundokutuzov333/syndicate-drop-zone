#!/usr/bin/env python3
"""Source-level acceptance gate for Phase 09 photography geometry."""
import json, math, sys
from pathlib import Path
import bpy
SCRIPT_DIR=Path(__file__).resolve().parent
sys.path.insert(0,str(SCRIPT_DIR))
from common import argv_after_dashes

def main():
    args=argv_after_dashes()
    output=Path(args[0] if args else "art/xoyens-studio.phase09.report.json").resolve()
    scene=bpy.context.scene
    objects=list(scene.objects)
    mesh=[o for o in objects if o.type=="MESH"]
    elements={str(o.get("elementId","")) for o in objects}
    photo={o.get("elementId"):o for o in objects if str(o.get("elementId","")).startswith("photo.")}
    required=["photo.roller_backdrop","photo.backdrop_seal","photo.rack","photo.garments","photo.softbox_octa","photo.led_panel_1","photo.light_grid","photo.led_panel_barn_doors","photo.rack_wheels"]
    failures=[]
    for eid in required:
        if eid not in photo: failures.append("missing source root: "+eid)
    seal=photo.get("photo.backdrop_seal")
    if seal and (abs(float(seal.get("phase9SealDiameterM",0))-2.2)>0.03 or seal.get("officialAssetPath") is None):
        failures.append("official seal decal contract missing")
    rack=photo.get("photo.rack")
    if rack and (rack.get("phase9RackWidthM")!=1.6 or rack.get("phase9Wheels")!=4):
        failures.append("rack dimensions/wheel count mismatch")
    garments=photo.get("photo.garments")
    if garments and (garments.get("phase9GarmentCount")!=5 or len(garments.get("phase9GarmentTypes",[]))!=5):
        failures.append("five garment contract missing")
    materials={m.name for m in bpy.data.materials}
    for name in ("print_official_seal","print_official_xoyens","led_panel_emissive","led_warm_emissive"):
        if name not in materials: failures.append("material missing: "+name)
    if len([o for o in mesh if o.name.startswith("SDT_photo_garments_garment_")])<5:
        failures.append("less than five garment meshes")
    for obj in mesh:
        if str(obj.get("elementId","")).startswith("photo.") and not obj.data.materials:
            failures.append(obj.name+": no material")
        if str(obj.get("elementId","")).startswith("photo.") and ("UVMap" not in {u.name for u in obj.data.uv_layers} or "UV_Lightmap" not in {u.name for u in obj.data.uv_layers}):
            failures.append(obj.name+": UVMap/UV_Lightmap missing")
    report={"phase":9,"status":"source-validated" if not failures else "failed","blenderVersion":bpy.app.version_string,
            "photoElements":len(required),"photoRootsFound":len([x for x in required if x in photo]),
            "garments":5 if garments else 0,"rackWidthM":1.6 if rack else None,"sealDiameterM":2.2 if seal else None,
            "requiredMaterials":sorted(name for name in ("print_official_seal","print_official_xoyens","led_panel_emissive","led_warm_emissive") if name in materials),
            "meshCount":len(mesh),"photoMeshCount":len([o for o in mesh if str(o.get("elementId","")).startswith("photo.")]),
            "failures":failures}
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print("PHASE 09 PHOTO VALIDATION",json.dumps(report,sort_keys=True))
    if failures: raise RuntimeError("Phase 09 failed: "+"; ".join(failures))
if __name__=="__main__": main()
