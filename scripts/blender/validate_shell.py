#!/usr/bin/env python3
"""Phase 06 enclosure topology and sampled visibility closure contract."""
import json, math, bmesh, bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

BOUNDARY_IDS={"arch.walls_plaster","arch.vault_ceiling","arch.door_main","arch.door_left","floor.wood"}
PRIMARY="SDT_shell_vault_rib_primary_"
SECONDARY="SDT_shell_vault_rib_secondary_"

def _triangles(mesh):
    return sum(max(1,len(p.vertices)-2) for p in mesh.polygons)

def _boundary_meshes():
    return [o for o in bpy.context.scene.objects if o.type=="MESH" and
            (o.get("shellBoundary") is True or o.get("elementId") in BOUNDARY_IDS)]

def _bvh(objects):
    verts=[]; faces=[]
    for obj in objects:
        offset=len(verts)
        verts.extend(tuple(obj.matrix_world @ v.co) for v in obj.data.vertices)
        faces.extend(tuple(offset+i for i in p.vertices) for p in obj.data.polygons if len(p.vertices)>=3)
    if not verts or not faces: raise RuntimeError("empty boundary geometry")
    tree=BVHTree.FromPolygons(verts,faces,all_triangles=False,epsilon=0.00001)
    if tree is None: raise RuntimeError("BVH construction returned no tree")
    return tree

def validate_architectural_shell(bible):
    errors=[]; objs=list(bpy.context.scene.objects); names={o.name for o in objs}
    actual={o.get("elementId") for o in objs if o.get("elementId")}
    expected={e["id"] for e in bible.get("elements",[]) if e["id"].startswith("arch.")}
    missing=sorted(expected-actual)
    if missing: errors.append("missing arch IDs: "+", ".join(missing))
    if "SDT_shell_vault_ceiling" not in names: errors.append("solid vault missing")
    primary=sum(n.startswith(PRIMARY) for n in names)
    secondary=sum(n.startswith(SECONDARY) for n in names)
    vents=sum(n.startswith("SDT_shell_ac_vent_") for n in names)
    if primary!=2: errors.append("primary ribs expected 2, got "+str(primary))
    if secondary!=14: errors.append("secondary ribs expected 14, got "+str(secondary))
    if vents!=9: errors.append("AC vents expected 9, got "+str(vents))
    for n in ("SDT_shell_ac_display","SDT_shell_conduit_pvc","SDT_shell_switch_toggle","SDT_shell_cove_front",
              "SDT_shell_shadow_gap_front","SDT_shell_cove_led_front","SDT_shell_soffit_front_trim"):
        if n not in names: errors.append("detail missing "+n)

    shell=[o for o in objs if o.type=="MESH" and o.get("buildModule")=="shell"]
    tris=sum(_triangles(o.data) for o in shell)
    if not 18000<=tris<=25000: errors.append("shell triangles outside 18000..25000: "+str(tris))
    boundary=_boundary_meshes(); nonmanifold=[]
    for obj in boundary:
        bm=bmesh.new()
        try:
            bm.from_mesh(obj.data)
            count=sum(1 for edge in bm.edges if not edge.is_manifold)
            if count: nonmanifold.append(obj.name+"="+str(count))
        finally: bm.free()
    if not boundary: errors.append("enclosure boundary empty")
    if nonmanifold:
        errors.append("non-manifold boundary meshes: "+", ".join(nonmanifold[:20]))
        for obj in boundary:
            bm=bmesh.new()
            try:
                bm.from_mesh(obj.data)
                count=sum(1 for edge in bm.edges if not edge.is_manifold)
            finally: bm.free()
            if count:
                errors.append("boundary detail "+obj.name+": elementId="+str(obj.get("elementId"))+", buildModule="+str(obj.get("buildModule"))+", shellBoundary="+str(obj.get("shellBoundary"))+", nonManifoldEdges="+str(count))
    rays={"origins":3,"directionsPerOrigin":1000,"total":3000,"misses":0}
    if boundary:
        try:
            tree=_bvh(boundary)
            room=bible["metricPlan"]["room"]; hw=float(room["clearWidthM"])/2; hd=float(room["clearDepthM"])/2
            origins=((0,1.45,0),(hw*0.46,1.25,hd*0.50),(-hw*0.42,1.25,-hd*0.42))
            golden=math.pi*(3-math.sqrt(5)); misses=[]
            for oi,origin in enumerate(origins):
                for i in range(1000):
                    y=1-2*(i+0.5)/1000.0; r=math.sqrt(max(0,1-y*y)); a=golden*i
                    direction=Vector((math.cos(a)*r,y,math.sin(a)*r))
                    location,_normal,_face,_distance=tree.ray_cast(Vector(origin),direction,20.0)
                    if location is None: misses.append((oi,i))
            rays["misses"]=len(misses); rays["missSamples"]=misses[:10]
            if misses: errors.append(str(len(misses))+"/3000 enclosure rays missed the shell; sample (originIndex, directionIndex, rayDirection)="+repr([(oi, i, (round(math.cos(golden*i)*math.sqrt(max(0,1-(1-2*(i+0.5)/1000.0)**2)),5), round(1-2*(i+0.5)/1000.0,5), round(math.sin(golden*i)*math.sqrt(max(0,1-(1-2*(i+0.5)/1000.0)**2)),5))) for oi,i in misses[:12]]))
        except Exception as exc: errors.append("ray closure test failed: "+str(exc))
    if errors: raise RuntimeError("Phase 06 shell contract failed: "+"; ".join(errors[:30]))
    result={"archElementIds":len(expected),"primaryRibs":primary,"secondaryRibs":secondary,"acLouvers":vents,
            "shellMeshObjects":len(shell),"shellTriangles":tris,"boundaryMeshObjects":len(boundary),
            "nonManifoldEdges":0,"rayClosure":rays}
    print("CAMPING PHASE 06 SHELL CONTRACT OK",json.dumps(result,sort_keys=True))
    return result
