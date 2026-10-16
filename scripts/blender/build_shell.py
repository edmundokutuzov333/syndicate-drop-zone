"""CAMPING V3 architectural enclosure; Scene Bible is the dimensional source."""
import bmesh
import math
import bpy
from common import box, build_element, build_structural_walls, clear_module, cylinder, element_box, finish_mesh, set_active_module

def _boundary(obj):
    obj["shellBoundary"] = True
    return obj

def _detail(name, dims, loc, mat, col, bevel=0.0015, boundary=False):
    obj = box(name, dims, loc, mat, col, collider="none", bevel=bevel, zone="shell")
    obj["architecturalDetail"] = name.replace("SDT_shell_", "")
    if boundary: _boundary(obj)
    return obj

def _rib(name, x, width, depth, radius, cy, half_angle, segments, col, kind):
    verts, faces = [], []
    r0, r1 = radius-depth, radius
    for j in range(segments+1):
        a=-half_angle+2.0*half_angle*j/segments
        c,s=math.cos(a),math.sin(a)
        for dx,r in ((-width/2,r0),(width/2,r0),(width/2,r1),(-width/2,r1)):
            verts.append((x+dx,cy+r*c,r*s))
    for j in range(segments):
        a,b=j*4,(j+1)*4
        for k in range(4):
            n=(k+1)%4
            faces.append((a+k,a+n,b+n,b+k))
    faces.extend(((3,2,1,0),(segments*4,segments*4+1,segments*4+2,segments*4+3)))
    mesh=bpy.data.meshes.new(name+"_mesh")
    mesh.from_pydata(verts,[],faces); mesh.update()
    bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(mesh); bm.free()
    obj=bpy.data.objects.new(name,mesh); col.objects.link(obj)
    finish_mesh(obj,"wood_rib_dark",collider="none",zone="shell",lm_group="shell",bevel=0,smooth=True)
    obj["ribClass"]=kind
    return obj

def _vault(element,ctx,col):
    room=ctx["bible"]["metricPlan"]["room"]
    w,d=float(room["clearWidthM"]),float(room["clearDepthM"])
    h,crown,t=float(room["wallHeightM"]),float(room["vaultCrownY"]),float(room["wallThicknessM"])
    half=d/2; rise=crown-h
    ri=(half*half+rise*rise)/(2*rise); cyi=crown-ri; ai=math.asin(half/ri)
    ho=half+t; roRise=rise+t
    ro=(ho*ho+roRise*roRise)/(2*roRise); cyo=crown+t-ro; ao=math.asin(ho/ro)
    nx=na=56; verts=[]
    inn=[[0]*(na+1) for _ in range(nx+1)]; out=[[0]*(na+1) for _ in range(nx+1)]
    for i in range(nx+1):
        x=-w/2+w*i/nx
        for j in range(na+1):
            a=-ai+2*ai*j/na; inn[i][j]=len(verts); verts.append((x,cyi+ri*math.cos(a),ri*math.sin(a)))
    for i in range(nx+1):
        x=-(w/2+t)+(w+2*t)*i/nx
        for j in range(na+1):
            a=-ao+2*ao*j/na; out[i][j]=len(verts); verts.append((x,cyo+ro*math.cos(a),ro*math.sin(a)))
    faces=[]
    for i in range(nx):
        for j in range(na):
            faces.append((inn[i][j],inn[i+1][j],inn[i+1][j+1],inn[i][j+1]))
            faces.append((out[i][j+1],out[i+1][j+1],out[i+1][j],out[i][j]))
    for i in (0,nx):
        for j in range(na): faces.append((inn[i][j],inn[i][j+1],out[i][j+1],out[i][j]))
    for j in (0,na):
        for i in range(nx): faces.append((inn[i][j],inn[i+1][j],out[i+1][j],out[i][j]))
    mesh=bpy.data.meshes.new("SDT_shell_vault_closed_mesh")
    mesh.from_pydata(verts,[],faces); mesh.update()
    bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(mesh); bm.free()
    obj=bpy.data.objects.new("SDT_shell_vault_ceiling",mesh); col.objects.link(obj)
    finish_mesh(obj,"bamboo_weave",element=element,collider="mesh",zone="shell",lm_group="shell",bevel=0,smooth=True)
    _boundary(obj); ctx["built"].add(element["id"])
    for i,x in enumerate((-1.75,1.75),1):
        _rib("SDT_shell_vault_rib_primary_"+str(i).zfill(2),x,0.06,0.12,ri,cyi,ai,na,col,"primary")
    for i in range(14):
        x=-w/2+w*(i+0.5)/14
        _rib("SDT_shell_vault_rib_secondary_"+str(i+1).zfill(2),x,0.04,0.08,ri,cyi,ai,na,col,"secondary")
    for x in (-1.75,1.75):
        for side in (-1,1):
            cylinder("SDT_shell_vault_fastener_"+str(x)+"_"+str(side),0.009,0.012,
                     (x,h-0.045,side*(half-0.055)),"steel_brushed",col,vertices=16,zone="shell")


def _gable_end(name, x_sign, room, col):
    """Close each barrel-vault end with a solid, profile-matched gable.

    The inner profile follows the interior vault arc. The exterior profile
    follows the outer vault arc and expands by the wall thickness. Lofting
    the matching boundary loops creates a closed shell wall rather than a
    decorative flat triangle over the opening.
    """
    width = float(room["clearWidthM"])
    depth = float(room["clearDepthM"])
    wall_h = float(room["wallHeightM"])
    crown = float(room["vaultCrownY"])
    thickness = float(room["wallThicknessM"])
    half = depth / 2.0
    rise = crown - wall_h
    inner_r = (half * half + rise * rise) / (2.0 * rise)
    inner_cy = crown - inner_r
    inner_angle = math.asin(half / inner_r)
    half_out = half + thickness
    rise_out = rise + thickness
    outer_r = (half_out * half_out + rise_out * rise_out) / (2.0 * rise_out)
    outer_cy = crown + thickness - outer_r
    outer_angle = math.asin(half_out / outer_r)
    segments = 56
    inner_x = x_sign * width / 2.0
    outer_x = x_sign * (width / 2.0 + thickness)

    inner_profile = [(wall_h, -half)]
    for index in range(1, segments):
        a = -inner_angle + 2.0 * inner_angle * index / segments
        inner_profile.append((inner_cy + inner_r * math.cos(a), inner_r * math.sin(a)))
    inner_profile.append((wall_h, half))

    outer_profile = [(wall_h, -half_out)]
    for index in range(1, segments):
        a = -outer_angle + 2.0 * outer_angle * index / segments
        outer_profile.append((outer_cy + outer_r * math.cos(a), outer_r * math.sin(a)))
    outer_profile.append((wall_h, half_out))

    vertices = []
    for x, profile in ((inner_x, inner_profile), (outer_x, outer_profile)):
        vertices.extend((x, y, z) for y, z in profile)

    count = len(inner_profile)
    inner = list(range(count))
    outer = list(range(count, count * 2))
    faces = [tuple(inner), tuple(reversed(outer))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((inner[index], inner[nxt], outer[nxt], outer[index]))

    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    mat = "paint_black_matte" if x_sign < 0 else "plaster_stucco_cream"
    finish_mesh(obj, mat, collider="none", zone="shell", lm_group="shell", bevel=0, smooth=False)
    obj["shellBoundary"] = True
    obj["architecturalDetail"] = "closed-vault-gable"
    return obj

def _door(element,ctx,col,room):
    cx,_,wz=tuple(ctx["placements"][element["id"]]["centerM"])
    w,h=float(element["size_m"][0]),float(element["size_m"][1])
    sign=1 if wz>=0 else -1
    paint=element["materials"][0]; metal="steel_brushed" if element["id"]=="arch.door_main" else "steel_black"
    root=element_box(element,ctx,col=col,dimensions=(w-0.09,h-0.18,0.028),
                     location=(cx,h/2,wz+sign*0.028),material_names=[paint],bevel=0.002,collider="box")
    _boundary(root); rail_z=wz+sign*0.012
    for side in (-1,1):
        _detail(root.name+"_stile_"+str(side),(0.06,h,0.045),(cx+side*(w/2-0.03),h/2,rail_z),paint,col,boundary=True)
    for label,y in (("bottom",0.04),("top",h-0.04)):
        _detail(root.name+"_rail_"+label,(w,0.08,0.045),(cx,y,rail_z),paint,col,boundary=True)
    for side in (-1,1):
        _detail(root.name+"_frame_jamb_"+str(side),(0.05,h+0.05,0.075),
                (cx+side*(w/2+0.025),h/2,wz+sign*0.01),metal,col,boundary=True)
    _detail(root.name+"_frame_lintel",(w+0.10,0.05,0.075),(cx,h+0.025,wz+sign*0.01),metal,col,boundary=True)
    exterior_z=sign*(float(room["clearDepthM"])/2+float(room["wallThicknessM"]))
    _detail(root.name+"_hidden_door_seal",(w+0.02,h+0.02,0.012),(cx,h/2,exterior_z-sign*0.006),
            "paint_black_matte",col,bevel=0,boundary=True)
    _detail(root.name+"_threshold",(w+0.04,0.018,float(room["wallThicknessM"])),(cx,0.009,wz+sign*0.01),
            "wood_dark_stained",col,bevel=0.001,boundary=True)
    face=wz-sign*0.018; hx=cx+w*0.34
    _detail(root.name+"_handle_plate",(0.045,0.15,0.008),(hx,1.02,face),"steel_brushed",col,bevel=0.002)
    cylinder(root.name+"_lever",0.009,0.12,(hx+0.045,1.02,face-sign*0.006),metal,col,
             vertices=16,rotation=(0,math.pi/2,0),zone="shell")
    cylinder(root.name+"_lock_cylinder",0.012,0.007,(hx,0.91,face-sign*0.006),
             "steel_brushed",col,vertices=20,zone="shell")
    for i,y in enumerate((0.22,1.02,1.80),1):
        _detail(root.name+"_hinge_"+str(i),(0.045,0.075,0.008),
                (cx-w/2+0.025,y,face-sign*0.005),metal,col,bevel=0.001)

def _aircon(element,ctx,col):
    cx,cy,cz=tuple(ctx["placements"][element["id"]]["centerM"])
    w,h,d=(float(v) for v in element["size_m"])
    root=element_box(element,ctx,col=col,dimensions=(w,h,d),location=(cx,cy,cz),
                     material_names=element["materials"],bevel=0.018,collider="box")
    face=cz-d/2
    for i in range(9):
        _detail("SDT_shell_ac_vent_"+str(i+1).zfill(2),(w*0.72,0.007,0.009),
                (cx,cy-0.102+i*0.014,face-0.004),"steel_black",col,bevel=0)
    _detail("SDT_shell_ac_display",(0.082,0.026,0.008),(cx-w*0.34,cy+h*0.27,face-0.005),"screen_emissive",col,bevel=0.001)
    _detail("SDT_shell_ac_status_led",(0.012,0.006,0.004),(cx-w*0.34+0.047,cy+h*0.27,face-0.009),"led_panel_emissive",col,bevel=0)

def _conduit(element,ctx,col,room):
    z=float(room["halfDepthM"])-0.018
    data=bpy.data.curves.new("SDT_shell_conduit_pvc_curve","CURVE")
    data.dimensions="3D"; data.resolution_u=12; data.bevel_depth=0.016; data.bevel_resolution=4; data.use_fill_caps=True
    routes=(((1.23,2.60,z),(1.28,2.54,z),(1.28,1.12,z),(1.96,1.12,z),(1.96,0.18,z)),
            ((1.28,1.12,z),(0.98,1.12,z),(0.72,1.12,z)))
    for path in routes:
        spline=data.splines.new("BEZIER"); spline.bezier_points.add(len(path)-1)
        for bp,co in zip(spline.bezier_points,path):
            bp.co=co; bp.handle_left_type="AUTO"; bp.handle_right_type="AUTO"
    obj=bpy.data.objects.new("SDT_shell_conduit_pvc",data); col.objects.link(obj)
    bpy.context.view_layer.objects.active=obj; obj.select_set(True); bpy.ops.object.convert(target="MESH")
    obj=bpy.context.object; obj.name="SDT_shell_conduit_pvc"; obj.select_set(False)
    finish_mesh(obj,"plastic_white_abs",element=element,collider="none",zone="shell",lm_group="shell",bevel=0,smooth=True)
    ctx["built"].add(element["id"])
    for i,y in enumerate((2.10,1.70,1.30,0.78,0.38),1):
        _detail("SDT_shell_conduit_clip_"+str(i),(0.042,0.018,0.009),(1.28,y,z-0.006),"steel_black",col,bevel=0)

def _outlets(element,ctx,col,room):
    cx,cy,_=tuple(ctx["placements"][element["id"]]["centerM"]); d=0.035
    z=float(room["halfDepthM"])-d/2-0.002
    root=element_box(element,ctx,col=col,dimensions=(0.28,0.16,d),location=(cx,cy,z),
                     material_names=element["materials"],bevel=0.004,collider="box")
    face=z-d/2
    for i,x in enumerate((cx-0.067,cx+0.067),1):
        cylinder("SDT_shell_outlet_ring_"+str(i),0.025,0.007,(x,cy,face-0.004),"steel_brushed",col,vertices=24,zone="shell")
        cylinder("SDT_shell_outlet_socket_"+str(i),0.017,0.008,(x,cy,face-0.010),"plastic_black",col,vertices=24,zone="shell")
        for pin in (-1,1):
            _detail("SDT_shell_outlet_pin_"+str(i)+"_"+str(pin),(0.004,0.015,0.003),
                    (x+pin*0.006,cy,face-0.015),"steel_brushed",col,bevel=0)

def _switch(element,ctx,col,room):
    cx,cy,_=tuple(ctx["placements"][element["id"]]["centerM"]); d=0.025
    z=float(room["halfDepthM"])-d/2-0.002
    root=element_box(element,ctx,col=col,dimensions=(0.09,0.14,d),location=(cx,cy,z),
                     material_names=element["materials"],bevel=0.003,collider="box")
    face=z-d/2
    _detail("SDT_shell_switch_toggle",(0.024,0.052,0.009),(cx,cy,face-0.005),"steel_brushed",col,bevel=0.002)
    _detail("SDT_shell_switch_indicator",(0.005,0.009,0.002),(cx+0.012,cy+0.045,face-0.009),"screen_emissive",col,bevel=0)

def _baseboards(ctx,col,room,enclosure):
    elem=ctx["elements"]["arch.baseboard"]; w,d=float(room["clearWidthM"]),float(room["clearDepthM"])
    h,t=0.08,0.02; index=0
    for wall in enclosure["walls"]:
        z_axis=wall["axis"]=="z"; wall_center=float(wall["centerM"])
        opening_id=(wall.get("openings") or [None])[0]
        opening=next((o for o in enclosure["openings"] if o["elementId"]==opening_id),None)
        if z_axis:
            ranges=[(-w/2,w/2)]
            if opening:
                dc=float(opening["centerM"][0]); dw=float(opening["widthM"])
                ranges=[(-w/2,dc-dw/2),(dc+dw/2,w/2)]
            sign=1 if wall_center>=0 else -1
            for x0,x1 in ranges:
                length=x1-x0
                if length<0.05: continue
                index+=1
                obj=box("SDT_shell_baseboard_"+str(index).zfill(2),(length,h,t),
                        ((x0+x1)/2,h/2,sign*(d/2-t/2)),"wood_dark_stained",col,
                        element=elem if index==1 else None,collider="none",bevel=0.0015,zone="shell")
                obj["architecturalDetail"]="perimeter-baseboard"
        else:
            sign=1 if wall_center>=0 else -1; index+=1
            obj=box("SDT_shell_baseboard_"+str(index).zfill(2),(t,h,d),(sign*(w/2-t/2),h/2,0),
                    "wood_dark_stained",col,element=elem if index==1 else None,collider="none",bevel=0.0015,zone="shell")
            obj["architecturalDetail"]="perimeter-baseboard"
    ctx["built"].add(elem["id"])

def _cove_soffit(ctx,col,room):
    w,d,h=float(room["clearWidthM"]),float(room["clearDepthM"]),float(room["wallHeightM"])
    hw,hd=w/2,d/2
    for label,sign in (("front",1),("back",-1)):
        _detail("SDT_shell_cove_"+label,(w-0.12,0.10,0.12),(0,h-0.06,sign*(hd-0.06)),"wood_dark_stained",col,bevel=0.002)
        _detail("SDT_shell_shadow_gap_"+label,(w-0.16,0.006,0.013),(0,h-0.112,sign*(hd-0.045)),"paint_black_matte",col,bevel=0)
    for label,sign in (("left",-1),("right",1)):
        _detail("SDT_shell_cove_"+label,(0.12,0.10,d-0.12),(sign*(hw-0.06),h-0.06,0),"wood_dark_stained",col,bevel=0.002)
        _detail("SDT_shell_shadow_gap_"+label,(0.013,0.006,d-0.16),(sign*(hw-0.045),h-0.112,0),"paint_black_matte",col,bevel=0)
    _detail("SDT_shell_cove_led_front",(w-0.32,0.008,0.012),(0,h-0.115,hd-0.085),"led_warm_emissive",col,bevel=0)
    elem=ctx["elements"]["arch.soffit_box"]; dims=tuple(float(v) for v in elem["size_m"])
    loc=(hw-dims[0]/2,2.62,-hd+dims[2]/2)
    root=element_box(elem,ctx,col=col,dimensions=dims,location=loc,material_names=elem["materials"],bevel=0.012,collider="box")
    _detail("SDT_shell_soffit_shadow_line",(dims[0]-0.08,0.008,0.012),
            (loc[0],loc[1]-dims[1]/2+0.012,loc[2]+dims[2]/2-0.008),"paint_black_matte",col,bevel=0)
    _detail("SDT_shell_soffit_front_trim",(dims[0]-0.06,0.025,0.025),
            (loc[0],loc[1]-dims[1]/2+0.03,loc[2]+dims[2]/2-0.018),"wood_dark_stained",col,bevel=0.002)

def build(bible,ctx):
    owned=[e["id"] for e in bible.get("elements",[]) if e["id"].startswith("arch.")]
    clear_module(ctx,"shell",owned); set_active_module("shell")
    try:
        col=ctx["collections"]["COL_shell"]; room=ctx["bible"]["metricPlan"]["room"]; enclosure=ctx["bible"]["metricPlan"]["enclosure"]
        build_structural_walls(ctx,col)
        _gable_end("SDT_shell_gable_left", -1, room, col)
        _gable_end("SDT_shell_gable_right", 1, room, col)
        _vault(ctx["elements"]["arch.vault_ceiling"],ctx,col)
        custom={"arch.door_main","arch.door_left","arch.ac_split","arch.conduit_pvc","arch.outlet_pair","arch.switch_plate","arch.soffit_box"}
        for elem in bible.get("elements",[]):
            eid=elem["id"]
            if eid.startswith("arch.") and eid not in {"arch.walls_plaster","arch.wall_black_left","arch.baseboard","arch.vault_ceiling"}|custom:
                build_element(elem,ctx,col)
        _door(ctx["elements"]["arch.door_main"],ctx,col,room)
        _door(ctx["elements"]["arch.door_left"],ctx,col,room)
        _aircon(ctx["elements"]["arch.ac_split"],ctx,col)
        _conduit(ctx["elements"]["arch.conduit_pvc"],ctx,col,room)
        _outlets(ctx["elements"]["arch.outlet_pair"],ctx,col,room)
        _switch(ctx["elements"]["arch.switch_plate"],ctx,col,room)
        _baseboards(ctx,col,room,enclosure)
        _cove_soffit(ctx,col,room)
    finally:
        set_active_module("bootstrap")
