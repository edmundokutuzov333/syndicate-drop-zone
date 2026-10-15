"""Phase 09: detailed photo set, official decals, garments and studio lighting fixtures."""
import json, math, os
from pathlib import Path
import bpy
from mathutils import Vector
from common import box, cylinder, cylinder_between, finish_mesh, material, placement_for

def _slug(v):
    return "".join(c.lower() if c.isalnum() else "_" for c in str(v)).strip("_")

def _col(ctx):
    return ctx["collections"]["COL_photo"]

def _name(element, suffix=""):
    return "SDT_photo_" + _slug(element["id"].split(".", 1)[1]) + (("_" + _slug(suffix)) if suffix else "")

def _root_box(element, ctx, suffix, dims, pos, mat, bevel=0.001):
    obj = box(_name(element, suffix), dims, pos, mat, _col(ctx), element=element,
              collider="none", bevel=bevel, zone="photo")
    return obj

def _child_box(element, ctx, suffix, dims, pos, mat, bevel=0.001, rotation=(0,0,0)):
    return box(_name(element, suffix), dims, pos, mat, _col(ctx), collider="none",
               bevel=bevel, zone="photo", rotation=rotation)

def _rod(element, ctx, suffix, a, b, radius, mat):
    return cylinder_between(_name(element, suffix), a, b, radius, mat, _col(ctx), "photo")

def _tag(obj, element):
    obj["elementId"] = element["id"]
    if element.get("interactionId"):
        obj["interactionId"] = element["interactionId"]
    obj["zone"] = "photo"
    obj["lmGroup"] = "photo"
    obj["phase"] = 9

def _image_material(name, filepath, base=(1,1,1,1)):
    if not os.path.isfile(filepath):
        raise FileNotFoundError("Official brand image missing: " + filepath)
    img = bpy.data.images.load(filepath, check_existing=True)
    img.pack()
    img.colorspace_settings.name = "sRGB"
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = base
    nodes, links = m.node_tree.nodes, m.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Linear"
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    alpha = tex.outputs.get("Alpha")
    if alpha and bsdf.inputs.get("Alpha"):
        links.new(alpha, bsdf.inputs["Alpha"])
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "DITHERED"
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    m["officialAssetPath"] = filepath
    return m

def _plane(element, ctx, name, center, width, height, material_name, uv=True, tag_element=True, normal_sign=1):
    # Horizontal image axis follows room Z. normal_sign=+1 faces into the room; -1 faces the backdrop wall.
    x, y, z = center
    verts = [(x, y-height/2, z-width/2), (x, y-height/2, z+width/2),
             (x, y+height/2, z+width/2), (x, y+height/2, z-width/2)]
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(verts, [], [(0,3,2,1)] if normal_sign > 0 else [(0,1,2,3)])
    mesh.materials.append(material_name if isinstance(material_name, bpy.types.Material) else material(material_name))
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    _col(ctx).objects.link(obj)
    finish_mesh(obj, [], element=element if tag_element else None, collider="none", zone="photo", lm_group="photo", bevel=0)
    if uv:
        layer = mesh.uv_layers.get("UVMap") or mesh.uv_layers.new(name="UVMap")
        uv_by_vertex = {0: (0,0), 1: (1,0), 2: (1,1), 3: (0,1)}
        for loop_index, loop in enumerate(layer.data):
            loop.uv = uv_by_vertex[mesh.loops[loop_index].vertex_index]
    return obj

def _tube_between(name, a, b, radius, mat, col):
    return cylinder_between(name, a, b, radius, mat, col, "photo")

def _roller(element, ctx, center, dims):
    x,y,z=center
    root = _root_box(element,ctx,"mount", (0.08,0.12,0.16),(x+0.02,y,z),"plastic_white_abs",0.01)
    _tube_between(_name(element,"roller_tube"),(x,y,z-dims[0]/2),(x,y,z+dims[0]/2),0.070,"plastic_white_abs",_col(ctx))
    for side in (-1,1):
        _child_box(element,ctx,"end_cap_"+str(side),(0.16,0.15,0.08),(x,y,z+side*(dims[0]/2-0.01)),"plastic_white_abs",0.01)
        _child_box(element,ctx,"wall_bracket_"+str(side),(0.08,0.24,0.10),(x+0.025,y-0.02,z+side*(dims[0]/2-0.07)),"steel_brushed",0.006)
    root["phase9RollerWidthM"] = 2.7
    return root

def _garment_mesh(element, ctx, index, center, width, height, color_mat):
    x,y,z=center
    # Tailored tee/hoodie silhouette in the Y-Z plane; slight asymmetric hem and shoulder folds.
    half=width/2
    outline=[(-half*.52,height*.50),(-half*.36,height*.50),(-half*.23,height*.40),
             (half*.23,height*.40),(half*.36,height*.50),(half*.52,height*.50),
             (half*.78,height*.24),(half*.60,height*.15),(half*.48,height*.26),
             (half*.47,-height*.48),(-half*.47,-height*.48),(-half*.48,height*.26),
             (-half*.60,height*.15),(-half*.78,height*.24)]
    front=x+0.018
    back=x-0.018
    verts=[]
    for xx in (front,back):
        for zz, yy in outline:
            wrinkle=0.006*math.sin((yy+height)*19+index)*math.cos(zz*17+index)
            verts.append((xx+wrinkle,y+yy,z+zz))
    n=len(outline)
    faces=[tuple(range(n)),tuple(range(n,2*n))]
    for i in range(n):
        j=(i+1)%n
        faces.append((i,j,n+j,n+i))
    mesh=bpy.data.meshes.new(_name(element,"garment_"+str(index)+"_mesh"))
    mesh.from_pydata(verts,[],faces)
    mesh.materials.append(material(color_mat))
    mesh.update()
    obj=bpy.data.objects.new(_name(element,"garment_"+str(index)),mesh)
    _col(ctx).objects.link(obj)
    finish_mesh(obj,[],element=element if index==1 else None,collider="none",zone="photo",lm_group="photo",bevel=0)
    # UVs scaled by physical garment dimensions.
    layer=mesh.uv_layers.get("UVMap") or mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            vi=mesh.loops[li].vertex_index % n
            zz,yy=outline[vi]
            layer.data[li].uv=((zz/width)+0.5,(yy/height)+0.5)
    obj["garmentIndex"]=index
    obj["garmentType"]="hoodie" if index in (4,5) else "tee"
    obj["fabricThicknessM"]=0.036
    if index==5:
        obj["lightSleeve"]="light-grey"
    # Reinforced neckline seam and shoulder seams, real mesh curves rendered as thin tubes.
    _tube_between(_name(element,"neck_seam_"+str(index)),(x+0.025,y+height*.34,z-half*.19),(x+0.025,y+height*.34,z+half*.19),0.003,"cotton_black",_col(ctx))
    return obj

def _hanger(element,ctx,index,x,y,z,width):
    mat="wood_hanger"
    _rod(element,ctx,"hanger_"+str(index)+"_left",(x,y,z-width*.45),(x,y+0.09,z-width*.18),0.008,mat)
    _rod(element,ctx,"hanger_"+str(index)+"_rail",(x,y+0.09,z-width*.18),(x,y+0.09,z+width*.18),0.008,mat)
    _rod(element,ctx,"hanger_"+str(index)+"_right",(x,y+0.09,z+width*.18),(x,y,z+width*.45),0.008,mat)
    _rod(element,ctx,"hanger_"+str(index)+"_hook",(x,y+0.09,z),(x,y+0.17,z),0.004,"steel_brushed")

def _rack(element,ctx,center,dims):
    x,y,z=center
    root=_root_box(element,ctx,"rail",(0.035,0.035,1.58),(x,1.69,z),"steel_black_tube",0.006)
    for side in (-1,1):
        px=x+side*0.72
        _rod(element,ctx,"upright_"+str(side),(px,0.10,z),(px,1.70,z),0.018,"steel_black_tube")
        _rod(element,ctx,"foot_"+str(side),(px,0.07,z-0.23),(px,0.07,z+0.23),0.018,"steel_black_tube")
        _rod(element,ctx,"diagonal_brace_"+str(side),(px,0.16,z-0.18),(px,0.36,z),0.008,"steel_black")
    for i in range(4):
        wheel_z=z+(-0.66+i*0.44)
        # Four casters placed under the two U feet, with visible wheel and fork.
        side=-1 if i<2 else 1
        wheel_x=x+side*0.72
        _child_box(element,ctx,"caster_fork_"+str(i+1),(0.045,0.075,0.040),(wheel_x,0.045,wheel_z),"steel_brushed",0.003)
        cylinder(_name(element,"wheel_"+str(i+1)),0.027,0.030,(wheel_x,0.035,wheel_z),"rubber_black",_col(ctx),vertices=20,rotation=(0,math.pi/2,0),zone="photo")
        _child_box(element,ctx,"wheel_brake_"+str(i+1),(0.016,0.035,0.020),(wheel_x+0.018,0.065,wheel_z),"steel_black",0.002)
    garment_centers=[]
    for i in range(5):
        gz=z-0.55+i*0.275
        gy=1.34-(i%2)*0.035
        _hanger(element,ctx,i+1,x,1.64,gz,0.34)
        garment_centers.append((x+0.04,gy,gz))
    root["phase9RackWidthM"]=1.6
    root["phase9Wheels"]=4
    return root,garment_centers

def _light_stand(element,ctx,center,panel_dims,kind):
    x,y,z=center
    root=_root_box(element,ctx,"housing",panel_dims,(x,y+0.52,z),"plastic_black",0.008)
    # Diffuser/emitter surface facing into the set, plus a deep rim and four barn doors.
    face_x=x+panel_dims[0]*0.55
    face_mat=material("led_panel_emissive",colour=(0.82,0.88,1.0,1),roughness=0.45,metallic=0.0,emission_strength=2.0)
    _plane(element,ctx,_name(element,"emitter"),(face_x,y+0.52,z),panel_dims[2]*0.82,panel_dims[1]*0.82,face_mat,uv=False,normal_sign=-1)
    if kind=="softbox":
        # Octagonal rim approximated by eight real steel bars, not a flat rectangle.
        points=[]
        radius=panel_dims[2]*0.48
        for i in range(8):
            a=math.tau*i/8+math.pi/8
            points.append((face_x,y+0.52+math.sin(a)*radius,z+math.cos(a)*radius))
        for i in range(8):
            _rod(element,ctx,"octa_rim_"+str(i+1),points[i],points[(i+1)%8],0.014,"steel_black_tube")
    else:
        for side in (-1,1):
            _child_box(element,ctx,"barn_door_side_"+str(side),(0.025,panel_dims[1]*0.9,0.08),
                       (face_x+0.008,y+0.52,z+side*panel_dims[2]*0.48),"steel_black",0.003)
        for side in (-1,1):
            _child_box(element,ctx,"barn_door_top_"+str(side),(0.025,0.07,panel_dims[2]*0.9),
                       (face_x+0.008,y+0.52+side*panel_dims[1]*0.46,z),"steel_black",0.003)
    # Three-legged stand, height-adjustable centre column and locks.
    _rod(element,ctx,"stand_column",(x,y-0.10,z),(x,y+0.48,z),0.014,"steel_black_tube")
    _child_box(element,ctx,"stand_lock",(0.055,0.045,0.055),(x,y+0.12,z),"steel_brushed",0.003)
    for i in range(3):
        a=math.tau*i/3
        end=(x+math.cos(a)*0.34,y+0.015,z+math.sin(a)*0.34)
        _rod(element,ctx,"stand_leg_"+str(i+1),(x,y+0.05,z),end,0.012,"steel_black_tube")
        _child_box(element,ctx,"stand_foot_"+str(i+1),(0.055,0.018,0.055),(end[0],0.009,end[2]),"rubber_black",0.003)
    root["phase9Fixture"]=kind
    root["phase9Kelvin"]=5600
    return root

def build_phase09_element(element,ctx):
    eid=element["id"]
    center,angle=placement_for(element,ctx)
    dims=element.get("size_m",[0.1,0.1,0.1])
    if eid=="photo.roller_backdrop":
        return _roller(element,ctx,center,dims)
    if eid=="photo.backdrop_seal":
        # Reuse the official seal image from the brand asset manifest; never redraw it.
        seal_path=os.path.abspath("art/textures/brand/sindicato-selo.png")
        seal_mat=_image_material("print_official_seal",seal_path,(0.85,0.80,0.68,1))
        root=_plane(element,ctx,"SDT_photo_backdrop_seal",(-3.665,1.47,-0.15),2.2,2.2,seal_mat)
        root["phase9SealDiameterM"]=2.2
        root["officialAssetPath"]=seal_path
        return root
    if eid=="photo.rack":
        return _rack(element,ctx,center,dims)[0]
    if eid=="photo.garments":
        x,y,z=center
        root=None
        for i in range(5):
            gz=z-0.55+i*0.275
            gy=1.30-(i%2)*0.035
            is_hoodie=i in (3,4)
            width=0.31 if is_hoodie else 0.29
            height=0.72 if is_hoodie else 0.62
            obj=_garment_mesh(element,ctx,i+1,(x+0.04,gy,gz),width,height,"cotton_black")
            _hanger(element,ctx,i+1,x,1.64,gz,width)
            if i==4:
                # One contrasting light-grey sleeve is an actual fabric panel, not a colour overlay.
                _child_box(element,ctx,"garment_5_grey_sleeve",(0.006,0.27,0.105),(x+0.060,gy+0.10,gz+0.17),"fabric_grey",0.01)
            if i in (0,1):
                _plane(element,ctx,"SDT_photo_garment_seal_"+str(i+1),(x+0.061,gy+0.08,gz),0.13,0.13,
                       _image_material("print_official_seal",os.path.abspath("art/textures/brand/sindicato-selo.png")),tag_element=False)
            elif i==2:
                _plane(element,ctx,"SDT_photo_garment_xoyens",(x+0.061,gy+0.08,gz),0.12,0.12,
                       _image_material("print_official_xoyens",os.path.abspath("art/textures/brand/xoyens.png")),tag_element=False)
            if i==0: root=obj
        root["phase9GarmentCount"]=5
        root["phase9GarmentTypes"]=["tee-seal","tee-seal","tee-xoyens","hoodie","hoodie-grey-sleeve"]
        return root
    if eid=="photo.softbox_octa":
        return _light_stand(element,ctx,center,(0.10,0.72,0.72),"softbox")
    if eid=="photo.led_panel_1":
        return _light_stand(element,ctx,center,(0.08,0.54,0.42),"led-panel")
    if eid=="photo.light_grid":
        root=_light_stand(element,ctx,center,(0.08,0.46,0.38),"grid-light")
        # Honeycomb/grid over the emitter, in front of the surface.
        x,y,z=center
        for row in range(5):
            for col in range(5):
                _child_box(element,ctx,"grid_cell_"+str(row)+"_"+str(col),(0.012,0.006,0.006),
                    (x-0.035,y+0.52-0.16+row*0.08,z-0.13+col*0.065),"steel_black_tube",0)
        return root
    if eid=="photo.led_panel_barn_doors":
        x,y,z=center
        root=_root_box(element,ctx,"barn_door_contract",(0.02,0.30,0.50),(x,y,z),"steel_black",0.002)
        for i,(dy,dz,sy,sz) in enumerate(((0.16,0,0.03,0.50),(-0.16,0,0.03,0.50),(0,0.24,0.30,0.03),(0,-0.24,0.30,0.03))):
            _child_box(element,ctx,"barn_door_"+str(i+1),(0.025,sy,sz),(x,y+dy,z+dz),"steel_black",0.002)
        return root
    if eid=="photo.rack_wheels":
        x,y,z=center
        root=_root_box(element,ctx,"wheel_contract",(0.05,0.07,0.05),(x,y,z),"steel_brushed",0.002)
        # Stable Scene Bible anchor only. The physical four wheels are on photo.rack.
        root.dimensions = (0.004, 0.004, 0.004)
        bpy.context.view_layer.objects.active = root
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        return root
    return None
