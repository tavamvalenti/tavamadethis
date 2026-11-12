"""Build the Craighill Summit Card Case scene (speculative FRAMEWORK piece).
Units: 1 BU ~= 100 mm. Case stands upright, Z up, front faces -Y.
"""
import bpy, bmesh, math, sys
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "/tmp/summit.blend"

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene

W, H, D = 0.64, 1.00, 0.15      # case outer size
WALL = 0.012
CR = 0.11                        # front-view corner radius
ER = 0.055                       # edge roundover (depth)

def seam(x, off=0.0):
    """S-curve seam height. Left high (hinge side), right low."""
    t = (x + W / 2) / W
    t = min(max(t, 0.0), 1.0)
    s = t * t * t * (t * (t * 6 - 15) + 10)   # smootherstep
    return 0.30 - 0.15 * s + off

# ---------------------------------------------------------------- helpers
def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob

def rounded_box(name, w, h, d, cr, er, seg=10):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    # front-view corners: edges parallel to Y
    ey = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().y) > 0.9]
    bmesh.ops.bevel(bm, geom=ey, offset=cr, segments=seg, affect='EDGES', profile=0.5)
    rest = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().y) < 0.1
            and (abs(e.verts[0].co.y) > d / 2 - 1e-4 and abs(e.verts[1].co.y) > d / 2 - 1e-4)]
    bmesh.ops.bevel(bm, geom=rest, offset=er, segments=seg, affect='EDGES', profile=0.5, clamp_overlap=True)
    bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new(name, me))
    for p in me.polygons: p.use_smooth = True
    return ob

def cutter(name, off, top=True, y=1.0):
    """Prism above (top=True) or below an S-curve in XZ, extruded along Y."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    n = 64
    xs = [-W + i * (2 * W) / n for i in range(n + 1)]
    zc = 2.0 if top else -2.0
    prof = [(x, seam(x, off)) for x in xs]
    pts = prof + [(xs[-1], zc), (xs[0], zc)]
    if not top:
        pts = list(reversed(pts))
    front = [bm.verts.new((x, -y, z)) for x, z in pts]
    back = [bm.verts.new((x, y, z)) for x, z in pts]
    bm.faces.new(front[::-1])
    bm.faces.new(back)
    m = len(pts)
    for i in range(m):
        j = (i + 1) % m
        bm.faces.new((front[i], front[j], back[j], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    return link(bpy.data.objects.new(name, me))

def apply_all(ob):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects: o.select_set(False)
    ob.select_set(True)
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

def boolean(ob, cut, op):
    m = ob.modifiers.new("b", 'BOOLEAN'); m.object = cut; m.operation = op; m.solver = 'EXACT'
    apply_all(ob)

def shade(ob, ang=40):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects: o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.shade_auto_smooth(angle=math.radians(ang))

# ---------------------------------------------------------------- materials
def mat_steel(name="Brushed Steel", base=(0.78, 0.78, 0.76), rough=0.22):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    p = N["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*base, 1)
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Anisotropic"].default_value = 0.55
    tc = N.new("ShaderNodeTexCoord")
    mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (300.0, 300.0, 1.5)
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 6.0; nz.inputs["Detail"].default_value = 8
    mr = N.new("ShaderNodeMapRange")
    mr.inputs["To Min"].default_value = rough - 0.07; mr.inputs["To Max"].default_value = rough + 0.07
    L.new(tc.outputs["Object"], mp.inputs["Vector"]); L.new(mp.outputs["Vector"], nz.inputs["Vector"])
    L.new(nz.outputs["Fac"], mr.inputs["Value"]); L.new(mr.outputs["Result"], p.inputs["Roughness"])
    bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.04
    L.new(nz.outputs["Fac"], bump.inputs["Height"]); L.new(bump.outputs["Normal"], p.inputs["Normal"])
    tg = N.new("ShaderNodeTangent"); tg.direction_type = 'RADIAL'; tg.axis = 'X'
    L.new(tg.outputs["Tangent"], p.inputs["Tangent"])
    return m

def mat_simple(name, col, rough=0.5, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*col, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Coat Weight"].default_value = coat
    return m

def mat_cork():
    m = bpy.data.materials.new("Cork"); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    p = N["Principled BSDF"]; p.inputs["Roughness"].default_value = 0.85
    vor = N.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 140
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 90; nz.inputs["Detail"].default_value = 10
    ramp = N.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.30, 0.17, 0.08, 1)
    ramp.color_ramp.elements[1].color = (0.68, 0.47, 0.27, 1)
    mix = N.new("ShaderNodeMath"); mix.operation = 'MULTIPLY'
    L.new(vor.outputs["Distance"], mix.inputs[0]); L.new(nz.outputs["Fac"], mix.inputs[1])
    mix.inputs[1].default_value = 1.0
    add = N.new("ShaderNodeMath"); add.operation = 'ADD'
    L.new(vor.outputs["Distance"], add.inputs[0]); L.new(nz.outputs["Fac"], add.inputs[1])
    mul = N.new("ShaderNodeMath"); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 0.6
    L.new(add.outputs[0], mul.inputs[0])
    L.new(mul.outputs[0], ramp.inputs["Fac"]); L.new(ramp.outputs["Color"], p.inputs["Base Color"])
    bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35
    L.new(add.outputs[0], bump.inputs["Height"]); L.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m

STEEL = mat_steel(rough=0.30)
STEEL_IN = mat_steel("Steel Inner", base=(0.62, 0.62, 0.60), rough=0.32)
DARK = mat_simple("Hinge Dark Steel", (0.35, 0.35, 0.35), 0.3, 1.0)
SPRING = mat_simple("Spring Steel", (0.55, 0.55, 0.57), 0.18, 1.0)
CARD_W = mat_simple("Card White", (0.9, 0.88, 0.85), 0.45, coat=0.3)
CARD_T = mat_simple("Card Teal", (0.10, 0.42, 0.40), 0.35, coat=0.4)
CARD_K = mat_simple("Card Graphite", (0.03, 0.032, 0.035), 0.3, 0.6, coat=0.6)
CARD_O = mat_simple("Card Orange", (0.80, 0.16, 0.03), 0.4, coat=0.3)
BOX = mat_simple("Box Black Paper", (0.018, 0.018, 0.018), 0.75)
INK = mat_simple("Box White Ink", (0.85, 0.85, 0.85), 0.6)
CORK = mat_cork()
ENGRAVE = mat_simple("Engraving", (0.45, 0.45, 0.44), 0.55, 1.0)

def setmat(ob, m):
    ob.data.materials.clear(); ob.data.materials.append(m)

# ---------------------------------------------------------------- case shell
shell = rounded_box("shell_tmp", W, H, D, CR, ER)
sol = shell.modifiers.new("s", 'SOLIDIFY'); sol.thickness = WALL; sol.offset = -1
apply_all(shell)

lid = shell.copy(); lid.data = shell.data.copy(); link(lid); lid.name = "Lid"
body = shell; body.name = "Body"
c_top = cutter("cut_top", -0.0025, True)
boolean(body, c_top, 'DIFFERENCE')
c_lid = cutter("cut_lid", 0.0025, True)
boolean(lid, c_lid, 'INTERSECT')
bpy.data.objects.remove(c_lid)

# inner liner (sleeve that the lid closes over)
liner = rounded_box("Liner", W - 2 * WALL - 0.004, H - 2 * WALL - 0.004, D - 2 * WALL - 0.004,
                    CR - WALL, ER - WALL)
sol = liner.modifiers.new("s", 'SOLIDIFY'); sol.thickness = 0.006; sol.offset = -1
apply_all(liner)
c_top2 = cutter("cut_top2", 0.045, True)
boolean(liner, c_top2, 'DIFFERENCE')
# trim liner to sit on top of the body floor
for o in (c_top, c_top2): bpy.data.objects.remove(o)

for o, m in ((body, STEEL), (lid, STEEL), (liner, STEEL_IN)):
    setmat(o, m); shade(o)

# ---------------------------------------------------------------- hinge
HX, HZ = -W / 2 + 0.035, seam(-W / 2) - 0.005   # pivot
def cyl(name, r, depth, loc, rot=(math.pi / 2, 0, 0), verts=40, mat=DARK):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    ob = bpy.context.active_object; ob.name = name; setmat(ob, mat)
    bev = ob.modifiers.new("bv", 'BEVEL'); bev.width = min(r * 0.25, 0.004); bev.segments = 3
    apply_all(ob); shade(ob)
    return ob

barrel = cyl("Hinge Barrel", 0.024, D - 0.05, (HX, 0, HZ), mat=STEEL_IN)
pin = cyl("Hinge Pin", 0.0065, D - 0.01, (HX, 0, HZ), mat=DARK)

# torsion spring: helix around pin axis (Y)
def helix(name, r, wire, turns, length, loc):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); n = int(turns * 24)
    sp.points.add(n)
    pts = []
    for i in range(n + 1):
        a = i / 24 * 2 * math.pi
        pts.append((r * math.cos(a), -length / 2 + length * i / n, r * math.sin(a)))
    # tangential legs
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
    cu.bevel_depth = wire; cu.bevel_resolution = 4
    ob = link(bpy.data.objects.new(name, cu)); ob.location = loc
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects: o.select_set(False)
    ob.select_set(True); bpy.ops.object.convert(target='MESH')
    ob = bpy.context.active_object; setmat(ob, SPRING); shade(ob, 60)
    return ob
spring = helix("Torsion Spring", 0.0125, 0.0028, 7, D - 0.07, (HX, 0, HZ))

# ---------------------------------------------------------------- cards
def card(name, mat, loc, rot=(0, 0, 0)):
    ob = rounded_box(name, 0.54, 0.856, 0.0076, 0.03, 0.0025, seg=6)
    ob.location = loc; ob.rotation_euler = rot
    setmat(ob, mat)
    return ob
cards = [card("Card 1", CARD_K, (0.0, -0.022, 0.0)),
         card("Card 2", CARD_W, (0.0, 0.0, -0.004)),
         card("Card 3", CARD_O, (0.0, 0.022, -0.008))]

# ---------------------------------------------------------------- engraving
bpy.ops.object.text_add(location=(-W / 2 + 0.085, -D / 2 - 0.0004, -H / 2 + 0.085),
                        rotation=(math.pi / 2, 0, 0))
eng = bpy.context.active_object; eng.name = "Engraving"
eng.data.body = "Craighill"; eng.data.size = 0.062; eng.data.extrude = 0.0003
setmat(eng, ENGRAVE)
bpy.ops.object.convert(target='MESH')

# ---------------------------------------------------------------- rig: parent case parts to one empty
root = link(bpy.data.objects.new("CASE", None)); root.empty_display_size = 0.3
lid_pivot = link(bpy.data.objects.new("LidPivot", None)); lid_pivot.location = (HX, 0, HZ)
lid_pivot.parent = root
for o in (body, liner, barrel, pin, spring, eng, *cards):
    o.parent = root
lid.parent = lid_pivot; lid.location = (-HX, 0, -HZ)

# ---------------------------------------------------------------- packaging (box base, cork insert, sleeve)
pk = link(bpy.data.objects.new("PACKAGING", None)); pk.location = (0, 0, -3.0)
BW, BL, BH = 0.90, 1.30, 0.26
def solid_box(name, w, l, h, loc, mat, bev=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object; ob.name = name; ob.scale = (w, l, h)
    bpy.ops.object.transform_apply(scale=True)
    b = ob.modifiers.new("bv", 'BEVEL'); b.width = bev; b.segments = 3
    setmat(ob, mat); ob.parent = pk
    return ob
tray = solid_box("Box Tray", BW - 0.02, BL - 0.02, BH - 0.02, (0, 0, (BH - 0.02) / 2), BOX)
cork = solid_box("Cork Insert", BW - 0.06, BL - 0.06, 0.03, (0, 0, BH - 0.02 - 0.012), CORK, 0.002)
# recess for the case
rec = rounded_box("rec", W + 0.01, H + 0.01, 0.2, CR, 0.002)
rec.rotation_euler = (math.pi / 2, 0, 0); rec.location = (0, 0, BH - 0.02 + 0.07)
boolean(cork, rec, 'DIFFERENCE'); bpy.data.objects.remove(rec)
# sleeve: open tube along Y
sl = rounded_box("Box Sleeve", BW, BL, BH, 0.004, 0.004, seg=2)
sl.rotation_euler = (0, 0, 0)
bpy.data.objects.remove(sl)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, BH / 2))
sleeve = bpy.context.active_object; sleeve.name = "Box Sleeve"; sleeve.scale = (BW, BL, BH)
bpy.ops.object.transform_apply(scale=True)
bm = bmesh.new(); bm.from_mesh(sleeve.data)
ends = [f for f in bm.faces if abs(f.normal.y) > 0.9]
bmesh.ops.delete(bm, geom=ends, context='FACES_ONLY'); bm.to_mesh(sleeve.data); bm.free()
s = sleeve.modifiers.new("s", 'SOLIDIFY'); s.thickness = 0.008
b = sleeve.modifiers.new("bv", 'BEVEL'); b.width = 0.004; b.segments = 3
setmat(sleeve, BOX); sleeve.parent = pk
# sleeve print: wordmark + line art
bpy.ops.object.text_add(location=(-0.05, 0.25, BH + 0.0045), rotation=(0, 0, -math.pi / 2))
t = bpy.context.active_object; t.name = "Sleeve Wordmark"; t.data.body = "Craighill"; t.data.size = 0.12
t.data.align_x = 'CENTER'; setmat(t, INK); t.parent = pk
bpy.ops.object.text_add(location=(0.28, -0.2, BH + 0.0045), rotation=(0, 0, -math.pi / 2))
t2 = bpy.context.active_object; t2.name = "Sleeve Title"; t2.data.body = "SUMMIT CARD CASE"; t2.data.size = 0.05
t2.data.align_x = 'CENTER'; setmat(t2, INK); t2.parent = pk
pk.hide_render = False

bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("saved", OUT)
