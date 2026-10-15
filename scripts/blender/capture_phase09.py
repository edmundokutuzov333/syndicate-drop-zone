#!/usr/bin/env python3
"""Render repeatable overview and seal/garment detail evidence for Phase 09."""
import hashlib,json,sys
from pathlib import Path
import bpy
from mathutils import Vector
SCRIPT_DIR=Path(__file__).resolve().parent
sys.path.insert(0,str(SCRIPT_DIR))
from common import argv_after_dashes

def look_at(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
def camera(name,position,target,lens):
    data=bpy.data.cameras.new(name+"_data"); data.lens=lens
    obj=bpy.data.objects.new(name,data); bpy.context.scene.collection.objects.link(obj); obj.location=position; look_at(obj,target); return obj
def light(name,position,target,power,size,color):
    data=bpy.data.lights.new(name+"_data","AREA"); data.energy=power; data.shape="DISK"; data.size=size; data.color=color
    obj=bpy.data.objects.new(name,data); bpy.context.scene.collection.objects.link(obj); obj.location=position; look_at(obj,target); return obj
def main():
    args=argv_after_dashes(); out=Path(args[0] if args else "art/_delivery/phase-09").resolve(); out.mkdir(parents=True,exist_ok=True)
    scene=bpy.context.scene
    saved={"camera":scene.camera,"engine":scene.render.engine,"res":(scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage),"path":scene.render.filepath,"format":scene.render.image_settings.file_format,"mode":scene.render.image_settings.color_mode,"view":scene.view_settings.view_transform}
    temporary=[]
    try:
        scene.render.engine="BLENDER_EEVEE_NEXT"; scene.render.resolution_x=1280; scene.render.resolution_y=720; scene.render.resolution_percentage=100
        scene.render.image_settings.file_format="PNG"; scene.render.image_settings.color_mode="RGBA"; scene.render.image_settings.compression=18; scene.view_settings.view_transform="AgX"
        temporary += [light("SDT_phase09_key",(-1.2,3.1,1.8),(-3.5,1.2,-0.2),900,2.2,(1.0,0.52,0.28)),
                      light("SDT_phase09_fill",(-0.8,2.0,-2.2),(-3.5,1.4,-0.2),520,1.4,(0.78,0.84,1.0)),
                      light("SDT_phase09_rim",(-2.3,2.8,1.4),(-3.3,1.2,0.1),380,1.0,(1.0,0.75,0.46))]
        views=[
          ("photo-overview.png",camera("SDT_phase09_camera_overview",(-0.7,1.8,3.9),(-3.0,1.25,-0.25),34.0)),
          ("photo-detail.png",camera("SDT_phase09_camera_detail",(-1.35,1.55,1.8),(-3.45,1.4,0.0),55.0))]
        temporary += [c for _,c in views]
        records={}
        for filename,cam in views:
            scene.camera=cam; scene.render.filepath=str(out/filename); bpy.ops.render.render(write_still=True)
            path=out/filename
            if not path.is_file() or path.stat().st_size<10000: raise RuntimeError("Phase 09 capture missing/small: "+str(path))
            records[filename]={"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"bytes":path.stat().st_size,"width":1280,"height":720}
        manifest={"version":1,"phase":9,"status":"source-rendered","blenderVersion":bpy.app.version_string,"views":records}
        (out/"capture-manifest.json").write_text(json.dumps(manifest,indent=2,sort_keys=True)+"\n",encoding="utf-8")
        print("PHASE 09 CAPTURES VERIFIED",json.dumps(manifest,sort_keys=True))
    finally:
        scene.camera=saved["camera"]; scene.render.engine=saved["engine"]
        scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=saved["res"]
        scene.render.filepath=saved["path"]; scene.render.image_settings.file_format=saved["format"]
        scene.render.image_settings.color_mode=saved["mode"]; scene.view_settings.view_transform=saved["view"]
        for obj in temporary:
            if obj.name in bpy.data.objects:
                if obj.type=="CAMERA": bpy.data.cameras.remove(obj.data,do_unlink=True)
                elif obj.type=="LIGHT": bpy.data.lights.remove(obj.data,do_unlink=True)
                bpy.data.objects.remove(obj,do_unlink=True)
if __name__=="__main__": main()
