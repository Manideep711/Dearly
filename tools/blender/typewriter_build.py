"""Build Dearly's typewriter in Blender (run with blender --background --python).

Coordinates: Blender Z-up. glTF export converts to three.js Y-up as
three (x, y, z) = blender (x, z, -y). The machine origin is the desk
surface under its centre (three: Machine group position).

Animated parts are separate roots:
  Body     - static
  Carriage - origin at three (0, 2.28, -0.95) -> blender (0, 0.95, 2.28)
  Typebar  - origin at three (0, 1.35, 0.55)  -> blender (0, -0.55, 1.35)
Each root's mesh children are merged per material to keep draw calls low.
Args after "--": <out.glb> <preview.png>
"""
import math
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_GLB, OUT_PNG = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
coll = scene.collection


# ---------------------------------------------------------------- materials
def mat(name, color, metallic=0.0, rough=0.5, coat=0.0, coat_rough=0.05):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = rough
    if coat:
        p.inputs["Coat Weight"].default_value = coat
        p.inputs["Coat Roughness"].default_value = coat_rough
    return m


ENAMEL = mat("Enamel", (0.085, 0.16, 0.115), 0.0, 0.32, coat=0.8)
CHROME = mat("Chrome", (0.92, 0.92, 0.93), 1.0, 0.13)
DARKMETAL = mat("DarkMetal", (0.035, 0.035, 0.04), 0.85, 0.38)
RUBBER = mat("Rubber", (0.018, 0.018, 0.018), 0.0, 0.78)
KEYFACE = mat("KeyFace", (0.80, 0.75, 0.62), 0.0, 0.18, coat=1.0, coat_rough=0.02)
BRASS = mat("Brass", (0.80, 0.58, 0.28), 1.0, 0.28)
RECESS = mat("Recess", (0.012, 0.012, 0.014), 0.2, 0.55)


# ---------------------------------------------------------------- helpers
def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    coll.objects.link(e)
    return e


def finish(name, bm, material, parent, smooth_angle=35):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(smooth_angle))
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.parent = parent
    return ob


def xform(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    S = Matrix.Diagonal((*scale, 1))
    return Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4() @ S


def cyl(name, r, depth, material, parent, loc=(0, 0, 0), rot=(0, 0, 0), seg=24, r2=None, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=r, radius2=r if r2 is None else r2, depth=depth)
    if bevel:
        rim = [e for e in bm.edges if len(e.link_faces) == 2 and
               abs(e.link_faces[0].normal.dot(e.link_faces[1].normal)) < 0.5]
        bmesh.ops.bevel(bm, geom=rim, offset=bevel, segments=2, profile=0.5, affect='EDGES')
    bmesh.ops.transform(bm, matrix=xform(loc, rot), verts=bm.verts)
    return finish(name, bm, material, parent)


def box(name, size, material, parent, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*size, 1)), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, profile=0.5, affect='EDGES')
    bmesh.ops.transform(bm, matrix=xform(loc, rot), verts=bm.verts)
    return finish(name, bm, material, parent)


def torus(name, major, minor, material, parent, loc=(0, 0, 0), rot=(0, 0, 0), su=24, sv=8):
    bm = bmesh.new()
    rings = []
    for i in range(su):
        a = 2 * math.pi * i / su
        ring = []
        for j in range(sv):
            b = 2 * math.pi * j / sv
            r = major + minor * math.cos(b)
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), minor * math.sin(b))))
        rings.append(ring)
    for i in range(su):
        for j in range(sv):
            a, b = rings[i], rings[(i + 1) % su]
            bm.faces.new((a[j], b[j], b[(j + 1) % sv], a[(j + 1) % sv]))
    bmesh.ops.transform(bm, matrix=xform(loc, rot), verts=bm.verts)
    return finish(name, bm, material, parent, smooth_angle=80)


def rod(name, p0, p1, r, material, parent, seg=10):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=d.length)
    M = Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return finish(name, bm, material, parent, smooth_angle=60)


def prism(name, profile, x0, x1, material, parent, bevel=0.0, segs=3):
    """Extrude a (y, z) profile along X from x0 to x1."""
    bm = bmesh.new()
    vs = [bm.verts.new((x0, y, z)) for (y, z) in profile]
    face = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(x1 - x0, 0, 0), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segs, profile=0.5,
                        affect='EDGES', clamp_overlap=True)
    return finish(name, bm, material, parent, smooth_angle=40)


# ---------------------------------------------------------------- body
body = empty("Body", (0, 0, 0))

# Chassis: side profile (y, z), front of the machine is -Y (toward the typist).
chassis = [(-1.62, 0.06), (1.72, 0.06), (1.72, 1.72), (1.42, 1.98), (0.58, 1.98),
           (0.28, 1.86), (-0.2, 1.84), (-1.5, 1.38), (-1.62, 1.26)]
prism("Chassis", chassis, -3.0, 3.0, ENAMEL, body, bevel=0.09)

# Dark recess where the typebar basket sits (between keys and carriage).
box("SegmentWell", (4.4, 0.5, 0.04), RECESS, body, loc=(0, 0.04, 1.86), rot=(-0.05, 0, 0))

# Typebar basket: a fan of thin bars resting toward the strike point.
for i in range(34):
    a = math.radians(-78 + i * (156 / 33))
    base = Vector((math.sin(a) * 1.05, 0.05 - math.cos(a) * 0.22, 1.87))
    tip = Vector((math.sin(a) * 0.32, 0.55, 1.97))
    rod("TypebarRest", base, tip, 0.016, DARKMETAL, body, seg=6)
box("Segment", (0.9, 0.12, 0.16), CHROME, body, loc=(0, 0.6, 1.9), bevel=0.02)

# Ribbon spool covers and caps.
for x in (-2.05, 2.05):
    cyl("SpoolCover", 0.46, 0.08, ENAMEL, body, loc=(x, 1.0, 2.02), seg=40, bevel=0.025)
    cyl("SpoolCap", 0.14, 0.06, CHROME, body, loc=(x, 1.0, 2.08), seg=24, bevel=0.012)
    torus("SpoolRim", 0.46, 0.022, CHROME, body, loc=(x, 1.0, 2.04), su=48)

# Ribbon (two strands crossing to the strike point).
box("Ribbon", (2.5, 0.035, 0.07), RECESS, body, loc=(0, 0.78, 2.12))

# Keys: four staggered rows of glass-topped keys on angled levers.
def slope_z(y):  # height of the sloped keyboard deck under a key
    t = max(0.0, min(1.0, (y + 1.5) / 1.3))
    return 1.38 + t * (1.84 - 1.38)


LEGENDS = ["ZXCVBNM,.?", "ASDFGHJKL;'", "QWERTYUIOP", "1234567890"]
_font_curve = None


def legend(ch, x, y, z, tilt):
    """Print a dark legend on a key face as real geometry."""
    if not ch:
        return
    cu = bpy.data.curves.new("Legend", 'FONT')
    cu.body = ch
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.size = 0.12
    cu.resolution_u = 3
    tmp = bpy.data.objects.new("LegendTmp", cu)
    coll.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bmesh.ops.transform(bm, matrix=xform((x, y, z), (tilt, 0, 0)) @ Matrix.Translation((0, 0, 0.0285)), verts=bm.verts)
    finish("Legend", bm, RECESS, body, smooth_angle=10)


for r in range(4):
    n = 11 if r == 1 else 10
    for k in range(n):
        x = -2.36 + k * 0.5 + r * 0.2 - (0.25 if r == 1 else 0)
        y = -1.3 + r * 0.31
        z = slope_z(y) + 0.24
        tilt = 0.32
        cyl("KeyFace", 0.104, 0.055, KEYFACE, body, loc=(x, y, z), rot=(tilt, 0, 0), seg=20, bevel=0.012)
        torus("KeyRim", 0.108, 0.019, CHROME, body, loc=(x, y, z - 0.005), rot=(tilt, 0, 0), su=20, sv=6)
        legend(LEGENDS[r][k] if k < len(LEGENDS[r]) else "", x, y, z, tilt)
        rod("KeyLever", (x, y + 0.02, z - 0.04), (x, y + 0.12, slope_z(y + 0.12) - 0.03), 0.017, CHROME, body, seg=6)
        box("KeySlot", (0.07, 0.16, 0.02), RECESS, body, loc=(x, y + 0.12, slope_z(y + 0.12) + 0.004),
            rot=(-math.atan2(1.84 - 1.38, 1.3), 0, 0))

# Space bar on two arms.
box("SpaceBar", (2.7, 0.11, 0.07), CHROME, body, loc=(0, -1.62, 1.5), rot=(0.25, 0, 0), bevel=0.03)
for x in (-1.1, 1.1):
    rod("SpaceArm", (x, -1.6, 1.48), (x, -1.42, slope_z(-1.42) - 0.02), 0.02, CHROME, body, seg=6)

# Brass maker's plate (no brand), chrome trim line and rubber feet.
box("Badge", (1.1, 0.03, 0.2), BRASS, body, loc=(0, -1.62 - 0.012, 0.36), bevel=0.012)
box("TrimLine", (5.95, 0.02, 0.025), CHROME, body, loc=(0, -1.64, 0.18))
for x in (-2.6, 2.6):
    for y in (-1.35, 1.45):
        cyl("Foot", 0.17, 0.1, RUBBER, body, loc=(x, y, 0.04), seg=16, bevel=0.02)

# Carriage rails at the back, sitting under the carriage.
box("RailBack", (6.2, 0.14, 0.12), DARKMETAL, body, loc=(0, 1.18, 2.02), bevel=0.02)
box("RailFront", (6.2, 0.1, 0.08), CHROME, body, loc=(0, 0.66, 2.02), bevel=0.02)

# ---------------------------------------------------------------- typebar (animated)
typebar = empty("Typebar", (0, -0.55, 1.35))
box("Bar", (0.06, 0.03, 1.5), CHROME, typebar, loc=(0, 0, 0.75), bevel=0.01)
box("Slug", (0.12, 0.06, 0.09), DARKMETAL, typebar, loc=(0, -0.01, 1.52), bevel=0.012)

# ---------------------------------------------------------------- carriage (animated)
carriage = empty("Carriage", (0, 0.95, 2.28))
cyl("Platen", 0.17, 5.9, RUBBER, carriage, rot=(0, math.pi / 2, 0), seg=40)
for s in (-1, 1):
    x = s * 3.12
    cyl("Knob", 0.23, 0.22, RUBBER, carriage, loc=(x, 0, 0), rot=(0, math.pi / 2, 0), seg=32, bevel=0.03)
    # knurling: a ring of small ridges on the knob
    for i in range(24):
        a = 2 * math.pi * i / 24
        box("Knurl", (0.2, 0.025, 0.03), RUBBER, carriage,
            loc=(x, math.cos(a) * 0.232, math.sin(a) * 0.232), rot=(a, 0, 0))
    cyl("KnobCap", 0.1, 0.04, CHROME, carriage, loc=(x + s * 0.12, 0, 0), rot=(0, math.pi / 2, 0), seg=20, bevel=0.01)
    box("EndPlate", (0.05, 0.62, 0.5), DARKMETAL, carriage, loc=(s * 2.98, 0.12, -0.05), bevel=0.02)

# Paper table: a curved plate behind the platen rising into a rest.
pts = []
for i in range(9):
    a = math.radians(95 + i * 9)
    pts.append((math.cos(a) * 0.24, math.sin(a) * 0.24))
bm = bmesh.new()
# behind the platen (+Y is away from the typist), curving over its top
row0 = [bm.verts.new((-2.7, -y + 0.16, z)) for (y, z) in pts]  # set back so the sheet stands in front
row1 = [bm.verts.new((2.7, v.co.y, v.co.z)) for v in row0]
for i in range(len(row0) - 1):
    bm.faces.new((row0[i], row0[i + 1], row1[i + 1], row1[i]))
top0, top1 = row0[0], row1[0]
r0 = bm.verts.new((-2.7, top0.co.y + 0.42, top0.co.z + 0.38))
r1 = bm.verts.new((2.7, top1.co.y + 0.42, top1.co.z + 0.38))
bm.faces.new((top0, top1, r1, r0))
bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.02)
finish("PaperTable", bm, DARKMETAL, carriage, smooth_angle=50)

# Paper bail with rollers, and the paper guide scale below the strike line.
bail_y, bail_z = -0.1, 0.62  # a few lines above the strike line, clear of the text being typed
rod("Bail", (-2.6, bail_y, bail_z), (2.6, bail_y, bail_z), 0.018, CHROME, carriage, seg=10)
for x in (-1.6, 0.0, 1.6):
    cyl("BailRoller", 0.045, 0.16, RUBBER, carriage, loc=(x, bail_y, bail_z), rot=(0, math.pi / 2, 0), seg=14)
box("Scale", (5.2, 0.02, 0.1), CHROME, carriage, loc=(0, -0.21, -0.16), rot=(-0.35, 0, 0), bevel=0.008)
box("CardHolder", (0.7, 0.02, 0.06), CHROME, carriage, loc=(0, -0.2, -0.05), rot=(-0.3, 0, 0))

# Carriage return lever on the left, swept forward and up.
lever = [(-3.0, 0.05, 0.12), (-3.05, -0.35, 0.22), (-2.95, -0.8, 0.42), (-2.7, -1.1, 0.55)]
for a, b in zip(lever, lever[1:]):
    rod("ReturnLever", a, b, 0.03, CHROME, carriage, seg=10)
cyl("LeverTip", 0.06, 0.12, CHROME, carriage, loc=lever[-1], rot=(0, math.pi / 2 - 0.4, 0), seg=14, bevel=0.015)


# ---------------------------------------------------------------- merge per material
def merge_children(root):
    by_mat = {}
    for ob in list(root.children):
        if ob.type == 'MESH':
            by_mat.setdefault(ob.data.materials[0].name, []).append(ob)
    for name, obs in by_mat.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        if len(obs) > 1:
            bpy.ops.object.join()
        obs[0].name = f"{root.name}_{name}"
        obs[0].data.name = obs[0].name


for root in (body, typebar, carriage):
    merge_children(root)

tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in scene.objects if o.type == 'MESH')
print("BUILD_TRIS", tris)

# ---------------------------------------------------------------- export
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_yup=True,
                          export_apply=True, export_cameras=False, export_lights=False)
print("EXPORTED", OUT_GLB)

# ---------------------------------------------------------------- preview render
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.04, 0.035, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6

floor_bm = bmesh.new()
bmesh.ops.create_grid(floor_bm, x_segments=1, y_segments=1, size=12)
finish("Floor", floor_bm, mat("Wood", (0.12, 0.07, 0.04), 0, 0.6), None)

key = bpy.data.lights.new("Key", 'AREA'); key.energy = 900; key.size = 4; key.color = (1, 0.82, 0.62)
k = bpy.data.objects.new("Key", key); coll.objects.link(k); k.location = (-5, -5, 7)
k.rotation_euler = Euler((math.radians(50), 0, math.radians(-45)))
rim = bpy.data.lights.new("Rim", 'AREA'); rim.energy = 400; rim.size = 3; rim.color = (0.7, 0.8, 1)
rr = bpy.data.objects.new("Rim", rim); coll.objects.link(rr); rr.location = (5, 4, 5)
rr.rotation_euler = Euler((math.radians(-50), 0, math.radians(135)))

cam_data = bpy.data.cameras.new("Cam"); cam_data.lens = 45
cam = bpy.data.objects.new("Cam", cam_data); coll.objects.link(cam)
cam.location = (3.2, -9.0, 6.0)
direction = Vector((0, 0.1, 1.3)) - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 1100, 760
scene.render.filepath = OUT_PNG
try:
    bpy.ops.render.render(write_still=True)
    print("RENDERED", OUT_PNG)
except Exception as ex:  # fall back if EEVEE has no GPU context
    print("EEVEE_FAILED", ex)
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    bpy.ops.render.render(write_still=True)
    print("RENDERED_CYCLES", OUT_PNG)
