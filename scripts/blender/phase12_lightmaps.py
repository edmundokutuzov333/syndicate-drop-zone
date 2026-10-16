#!/usr/bin/env python3
"""Fase 12: UV2 independente e packing por lmGroup."""
import bpy,bmesh,json,math,os,re,subprocess,sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent))
from common import argv_after_dashes
GROUPS=("shell","production","photo","left","right")
COLS={"COL_shell":"shell","COL_production":"production","COL_photo":"photo","COL_left":"left","COL_right":"right"}
BLACK={"paint_black_matte","vinyl_black_matte","paper_black_seamless","foam_black_grid","fabric_black_acoustic","cotton_black","leather_black_quilted","leather_black_tufted","fabric_black_flag","fabric_black_softbox","plastic_black","rubber_black","steel_black"}
HERO=re.compile(r"(desk|chair|sofa|rack)",re.I); SHARED=re.compile(r"(foam[_-]?tile|hanger)",re.I)
ANGLE=66.0; MARGIN=.004; LIMIT=1.15

def commit():
    if os.environ.get("GITHUB_SHA"): return os.environ["GITHUB_SHA"]
    try:return subprocess.check_output(["git","rev-parse","HEAD"],text=True,stderr=subprocess.DEVNULL).strip()
    except Exception:return "unknown"
def meshes():return [o for o in bpy.context.scene.objects if o.type=="MESH" and not o.name.startswith("COL_") and not any(c.name=="COL_colliders" for c in o.users_collection)]
def group(o):
    vals=[str(o.get("lmGroup","")),str(o.get("zone","")),str(o.get("elementId","")).split(".",1)[0]]
    vals.extend(COLS.get(c.name,"") for c in o.users_collection)
    for v in vals:
        if v in GROUPS:o["lmGroup"]=v;return v
    return None
def shared(o):return bool(o.get("lightmapSharedAOIBL")) or bool(SHARED.search(o.name))
def density(o,g):
    if HERO.search(str(o.get("elementId",""))) or HERO.search(o.name):return 128
    mats={m.name for m in o.data.materials if m}
    if o.hide_render or bool(o.get("lightmapHidden")) or (mats and mats.issubset(BLACK)):return 32
    return 96 if g=="shell" else 64
def unique(items):
    out=[];seen=set()
    for o in items:
        p=o.data.as_pointer()
        if p not in seen:seen.add(p);out.append(o)
    return out
def select(items):
    bpy.ops.object.select_all(action="DESELECT")
    for o in items:o.select_set(True);o.data.uv_layers.active_index=o.data.uv_layers.find("UV_Lightmap")
    bpy.context.view_layer.objects.active=items[0]
def uv_area(poly,layer):
    p=[layer.data[i].uv for i in poly.loop_indices]
    return abs(sum(a.x*p[(i+1)%len(p)].y-p[(i+1)%len(p)].x*a.y for i,a in enumerate(p)))*.5 if len(p)>=3 else 0
def world_area(o):
    bm=bmesh.new()
    try:bm.from_mesh(o.data);bm.transform(o.matrix_world);bm.normal_update();return sum(x.calc_area() for x in bm.faces)
    finally:bm.free()
def scale_density(o,d):
    layer=o.data.uv_layers.get("UV_Lightmap");area=world_area(o);ua=sum(uv_area(p,layer) for p in o.data.polygons) if layer else 0
    if not layer or area<=1e-10 or ua<=1e-12:raise RuntimeError(o.name+": área UV degenerada")
    factor=math.sqrt(area*d*d/ua);pts=[x.uv.copy() for x in layer.data];centre=sum(pts,start=pts[0].copy()*0)/max(1,len(pts))
    for x in layer.data:x.uv=centre+(x.uv-centre)*factor
def mark_uv_seams(items):
    """Preserve Smart UV Project island boundaries for a stretch-minimising unwrap."""
    for o in items:
        bm=bmesh.new()
        try:
            bm.from_mesh(o.data)
            uv=bm.loops.layers.uv.get("UV_Lightmap")
            if uv is None:continue
            for edge in bm.edges:
                if len(edge.link_faces)!=2:continue
                maps=[]
                for face in edge.link_faces:
                    maps.append({loop.vert:loop[uv].uv.copy() for loop in face.loops if loop.vert in edge.verts})
                if len(maps)==2 and all(v in maps[0] and v in maps[1] for v in edge.verts):
                    if any((maps[0][v]-maps[1][v]).length>1e-6 for v in edge.verts):edge.seam=True
            bm.to_mesh(o.data)
        finally:bm.free()
def unwrap(items):
    if not items:return
    select(items)
    try:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(ANGLE),island_margin=.003)
    finally:
        if bpy.context.object and bpy.context.object.mode!="OBJECT":bpy.ops.object.mode_set(mode="OBJECT")
        bpy.ops.object.select_all(action="DESELECT")
    # Keep the mandated 66-degree island boundaries, then refine each island
    # without relaxing the 1.15 stretch gate.
    mark_uv_seams(items)
    select(items)
    try:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.unwrap(method="ANGLE_BASED",margin=.003)
        bpy.ops.uv.minimize_stretch(iterations=10)
    finally:
        if bpy.context.object and bpy.context.object.mode!="OBJECT":bpy.ops.object.mode_set(mode="OBJECT")
        bpy.ops.object.select_all(action="DESELECT")
def sync_build_report(path):
    report_path=Path("art/xoyens-studio.report.json").resolve()
    if not report_path.is_file():raise RuntimeError("art/xoyens-studio.report.json em falta após UV2")
    report=json.loads(report_path.read_text(encoding="utf-8"))
    report["blend_bytes"]=path.stat().st_size
    report_path.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf-8")
def pack(items):
    if not items:return
    select(items)
    try:bpy.ops.object.mode_set(mode="EDIT");bpy.ops.mesh.select_all(action="SELECT");bpy.ops.uv.pack_islands(rotate=True,margin=MARGIN)
    finally:
        if bpy.context.object and bpy.context.object.mode!="OBJECT":bpy.ops.object.mode_set(mode="OBJECT")
        bpy.ops.object.select_all(action="DESELECT")
def apply_uv2():
    failures=[];gs={g:[] for g in GROUPS};allm=meshes()
    for o in allm:
        g=group(o)
        if g is None:failures.append(o.name+": lmGroup inválido")
        else:gs[g].append(o)
    for g,items in gs.items():
        if not items:failures.append("grupo sem malhas: "+g)
    owners={}
    for g,items in gs.items():
        for o in items:
            p=o.data.as_pointer();policy="shared-ao-ibl" if shared(o) else "baked"
            if p in owners and owners[p]!=(g,policy):o.data=o.data.copy();p=o.data.as_pointer()
            owners[p]=(g,policy)
            if o.data.uv_layers.get("UVMap") is None:failures.append(o.name+": UVMap original em falta");continue
            old=o.data.uv_layers.get("UV_Lightmap")
            if old:o.data.uv_layers.remove(old)
            o.data.uv_layers.new(name="UV_Lightmap");o.data.uv_layers.active_index=o.data.uv_layers.find("UV_Lightmap")
            o["lmGroup"]=g;o["lightmapUVVersion"]=12;o["lightmapSmartProjectAngleDegrees"]=ANGLE;o["lightmapPackMargin"]=MARGIN
            o["lightmapMirroringApplied"]=False;o["lightmapPolicy"]=policy;o["lightmapDensityTarget"]=density(o,g)
    if failures:return {"phase":12,"status":"failed","sourceCommit":commit(),"failures":failures}
    try:
        for g,items in gs.items():
            us=unique(items);unwrap(us);baked=[o for o in us if not shared(o)]
            for o in baked:scale_density(o,density(o,g))
            pack(baked)
            for o in items:
                i=o.data.uv_layers.find("UVMap")
                if i>=0:o.data.uv_layers.active_index=i
        path=Path(bpy.data.filepath).resolve()
        if not path.is_file():failures.append("ficheiro Blender sem caminho guardado")
        elif not failures:
            bpy.ops.wm.save_as_mainfile(filepath=str(path))
            try:sync_build_report(path)
            except Exception as e:failures.append("sincronização do relatório Blender falhou: "+str(e))
    except Exception as e:failures.append("unwrap/packing falhou: "+str(e))
    return {"phase":12,"status":"uv2-applied" if not failures else "failed","sourceCommit":commit(),"meshCount":len(allm),"groups":list(GROUPS),"smartProjectAngleDegrees":ANGLE,"smartProjectIslandMargin":.003,"packMargin":MARGIN,"paddingAt4096Px":MARGIN*4096,"failures":failures}
def stretch(o):
    bm=bmesh.new()
    try:
        bm.from_mesh(o.data);bm.transform(o.matrix_world);bm.normal_update();bm.faces.ensure_lookup_table();bm.faces.index_update();uv=bm.loops.layers.uv.get("UV_Lightmap")
        if uv is None:return None,0,1
        ratios={};bad=0
        for face in bm.faces:
            area=face.calc_area()
            if area<=1e-10:continue
            p=[l[uv].uv for l in face.loops];ua=abs(sum(a.x*p[(i+1)%len(p)].y-p[(i+1)%len(p)].x*a.y for i,a in enumerate(p)))*.5
            if ua<=1e-12:bad+=1
            else:ratios[face.index]=area/ua
        adj={i:set() for i in ratios}
        def edgeuv(face,edge):
            vals=[]
            for v in edge.verts:
                loop=next((x for x in face.loops if x.vert==v),None)
                if loop is None:return None
                vals.append(loop[uv].uv.copy())
            return vals
        for edge in bm.edges:
            fs=[x for x in edge.link_faces if x.index in ratios]
            if len(fs)==2:
                a=edgeuv(fs[0],edge);b=edgeuv(fs[1],edge)
                if a and b and all((a[i]-b[i]).length<=1e-6 for i in range(2)):adj[fs[0].index].add(fs[1].index);adj[fs[1].index].add(fs[0].index)
        seen=set();count=0;maximum=1.0
        for i in ratios:
            if i in seen:continue
            count+=1;stack=[i];seen.add(i);vals=[]
            while stack:
                k=stack.pop();vals.append(ratios[k])
                for n in adj[k]:
                    if n not in seen:seen.add(n);stack.append(n)
            if vals and min(vals)>1e-12:maximum=max(maximum,math.sqrt(max(vals)/min(vals)))
        return maximum,count,bad
    finally:bm.free()
def validate(area_path,report_path):
    fails=[];rows=[];gs={g:{"id":g,"meshCount":0,"bakedMeshCount":0,"sharedAoIblMeshCount":0,"surfaceM2":0.0} for g in GROUPS};maxs=1.0;allm=meshes()
    for o in allm:
        g=group(o)
        if not g:fails.append(o.name+": lmGroup inválido");continue
        m=o.data;i0=m.uv_layers.find("UVMap");i1=m.uv_layers.find("UV_Lightmap");ind=i0>=0 and i1>=0 and i0!=i1
        if not ind:fails.append(o.name+": UV2 independente em falta")
        if int(o.get("lightmapUVVersion",0))!=12:fails.append(o.name+": versão UV2 inválida")
        if abs(float(o.get("lightmapPackMargin",0))-MARGIN)>1e-7:fails.append(o.name+": margem != .004")
        if abs(float(o.get("lightmapSmartProjectAngleDegrees",0))-ANGLE)>1e-6:fails.append(o.name+": ângulo != 66")
        if o.get("lightmapMirroringApplied") is not False:fails.append(o.name+": mirroring aplicado")
        layer=m.uv_layers[i1] if i1>=0 else None;bounded=bool(layer) and all(-1e-4<=v.uv.x<=1.0001 and -1e-4<=v.uv.y<=1.0001 for v in layer.data)
        if not bounded:fails.append(o.name+": UV2 fora de 0..1")
        try:area=world_area(o);st,ic,bad=stretch(o)
        except Exception as e:area,st,ic,bad=0,None,0,1;fails.append(o.name+": medição falhou: "+str(e))
        policy=str(o.get("lightmapPolicy",""));d=int(o.get("lightmapDensityTarget",density(o,g)))
        if area<=1e-8:fails.append(o.name+": área não positiva")
        if bad:fails.append(o.name+": faces UV degeneradas "+str(bad))
        if policy!="shared-ao-ibl" and (st is None or st>LIMIT):fails.append(o.name+": stretching >1.15 "+str(st))
        if policy not in ("baked","shared-ao-ibl"):fails.append(o.name+": política inválida")
        s=gs[g];s["meshCount"]+=1;s["surfaceM2"]+=area;s["bakedMeshCount"]+=int(policy!="shared-ao-ibl");s["sharedAoIblMeshCount"]+=int(policy=="shared-ao-ibl")
        if st is not None and policy!="shared-ao-ibl":maxs=max(maxs,st)
        rows.append({"name":o.name,"elementId":str(o.get("elementId","")),"zone":str(o.get("zone",g)),"lmGroup":g,"surfaceM2":round(area,6),"targetTexelsPerM":d,"lightmapPolicy":policy,"uvMap":"UVMap" if i0>=0 else None,"uvLightmap":"UV_Lightmap" if i1>=0 else None,"uv2Independent":ind,"maxIslandStretch":round(st,5) if st is not None else None,"uvIslandCount":ic})
    for g,s in gs.items():
        if not s["meshCount"] or not s["bakedMeshCount"]:fails.append("grupo sem atlas baked: "+g)
        s["surfaceM2"]=round(s["surfaceM2"],6)
    p={"version":1,"phase":12,"status":"source-validated" if not fails else "failed","sourceCommit":commit(),"blenderVersion":bpy.app.version_string,"meshCount":len(allm),"groups":list(gs.values()),"meshAreas":sorted(rows,key=lambda x:(x["lmGroup"],x["name"])),"uv2Independent":bool(rows) and all(x["uv2Independent"] for x in rows),"smartProjectAngleDegrees":ANGLE,"smartProjectIslandMargin":.003,"packMargin":MARGIN,"paddingAt4096Px":round(MARGIN*4096,3),"maxIslandStretch":round(maxs,5),"failures":fails}
    for path in (area_path,report_path):
        d=Path(path).resolve();d.parent.mkdir(parents=True,exist_ok=True);d.write_text(json.dumps(p,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    return p
def main():
    a=argv_after_dashes()
    if not a or a[0]!="--apply":raise SystemExit("Uso: --apply [apply-report.json]")
    out=Path(a[1] if len(a)>1 else "art/xoyens-studio.phase12.apply-report.json").resolve();r=apply_uv2()
    out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(r,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    if r["status"]!="uv2-applied":raise SystemExit(1)
if __name__=="__main__":main()
