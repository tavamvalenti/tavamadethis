"""Stage + animate the Summit Card Case explode. Usage:
python scene.py -- in.blend out.blend
"""
import bpy, math, sys
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
scn = bpy.context.scene
O = bpy.data.objects
FPS = 24
scn.render.fps = FPS
scn.frame_start, scn.frame_end = 1, 216

# hide packaging for the case film
for o in O:
    if o.name == "PACKAGING" or (o.parent and o.parent.name == "PACKAGING"):
        o.hide_render = True; o.hide_viewport = True

# ------------------------------------------------ world + studio
w = bpy.data.worlds.new("Studio"); scn.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs["Color"].default_value = (0.012, 0.012, 0.013, 1)
bg.inputs["Strength"].default_value = 1.0

# cyclorama backdrop
import bmesh
me = bpy.data.meshes.new("Cyc"); bm = bmesh.new()
prof = []
for i in range(25):
    t = i / 24 * (math.pi / 2)
    prof.append((0, 6 - 1.5 * math.cos(t) - 1.5 + 1.5, -1.6 + 1.5 - 1.5 * math.sin(t) - 0 ))
# simple L-curve: floor y from -8..4.5 then curve up to wall
pts = [(-8.0, -1.2)]
R = 2.5
for i in range(25):
    t = i / 24 * (math.pi / 2)
    pts.append((4.0 + R * math.sin(t), -1.2 + R - R * math.cos(t)))
pts.append((4.0 + R, 8.0))
L = []; Rr = []
for y, z in pts:
    L.append(bm.verts.new((-12, y, z))); Rr.append(bm.verts.new((12, y, z)))
for i in range(len(pts) - 1):
    bm.faces.new((L[i], Rr[i], Rr[i + 1], L[i + 1]))
bm.to_mesh(me); bm.free()
cyc = bpy.data.objects.new("Cyclorama", me); scn.collection.objects.link(cyc)
for p in me.polygons: p.use_smooth = True
cm = bpy.data.materials.new("Backdrop"); cm.use_nodes = True
p = cm.node_tree.nodes["Principled BSDF"]
p.inputs["Base Color"].default_value = (0.025, 0.025, 0.027, 1); p.inputs["Roughness"].default_value = 0.7
me.materials.append(cm)

def area(name, loc, rot, size, energy, shape='RECTANGLE', sy=None, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.shape = shape
    ld.size = size; ld.size_y = sy or size; ld.color = color
    ob = bpy.data.objects.new(name, ld); scn.collection.objects.link(ob)
    ob.location = loc; ob.rotation_euler = [math.radians(r) for r in rot]
    return ob

def aim(ob, target=(0, 0, 0.2)):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

key = area("Key Softbox", (-2.6, -2.4, 3.0), (0, 0, 0), 2.2, 520, sy=1.4); aim(key, (0, 0, 0.6))
rimR = area("Rim Strip R", (2.4, 1.8, 1.4), (0, 0, 0), 0.35, 420, sy=3.0, color=(0.92, 0.96, 1.0)); aim(rimR)
rimL = area("Rim Strip L", (-2.6, 1.6, 0.8), (0, 0, 0), 0.3, 260, sy=3.0); aim(rimL)
fill = area("Fill Card", (1.8, -3.2, -0.2), (0, 0, 0), 2.5, 38, sy=1.5); aim(fill)
top = area("Top Bounce", (0.0, -0.5, 4.2), (0, 0, 0), 3.0, 120); aim(top, (0, 0, 0))
front = area("Front Softbox", (-1.6, -7.5, 2.6), (0, 0, 0), 4.5, 280, sy=2.5); aim(front)
front.visible_diffuse = False
# soft glow behind subject on the wall
glow = area("Wall Glow", (0.0, 4.0, 0.9), (0, 0, 0), 4.0, 90, shape='DISK', color=(0.85, 0.9, 1.0))
glow.rotation_euler = (math.radians(-90), 0, 0)
for l in (rimR, rimL):
    l.data.spread = math.radians(60)
glow.visible_glossy = False

# ------------------------------------------------ camera rig
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 70; cam_d.sensor_width = 36
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 4.0
cam = bpy.data.objects.new("Camera", cam_d); scn.collection.objects.link(cam); scn.camera = cam
tgt = bpy.data.objects.new("CamTarget", None); scn.collection.objects.link(tgt)
cam_d.dof.focus_object = tgt
tc = cam.constraints.new('TRACK_TO'); tc.target = tgt; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
orbit = bpy.data.objects.new("CamOrbit", None); scn.collection.objects.link(orbit)
cam.parent = orbit

def key_(ob, path, frame, val, idx=None):
    if idx is None:
        setattr(ob, path, val); ob.keyframe_insert(path, frame=frame)
    else:
        getattr(ob, path)[idx] = val; ob.keyframe_insert(path, index=idx, frame=frame)

# camera: slow push + orbit
cam_d.lens = 55
cam.location = (0, -7.0, 1.0)
key_(orbit, "rotation_euler", 1, math.radians(-30), 2)
key_(orbit, "rotation_euler", 216, math.radians(14), 2)
key_(cam, "location", 1, (0, -4.6, 0.55))
key_(cam, "location", 60, (0, -5.4, 0.75))
key_(cam, "location", 150, (0, -6.6, 1.0))
key_(cam, "location", 216, (0, -6.1, 0.95))
key_(tgt, "location", 1, (0, 0, 0.0))
key_(tgt, "location", 60, (0, 0, 0.08))
key_(tgt, "location", 150, (0.12, 0, 0.36))
key_(tgt, "location", 216, (0.14, 0, 0.36))

# ------------------------------------------------ case animation
root = O["CASE"]; lidp = O["LidPivot"]
parts = {n: O[n] for n in ("Lid", "Liner", "Hinge Barrel", "Hinge Pin", "Torsion Spring",
                            "Card 1", "Card 2", "Card 3", "Body", "Engraving")}

key_(root, "location", 1, (0, 0, -0.04))
key_(root, "location", 216, (0, 0, 0.0))
key_(root, "rotation_euler", 1, (0, 0, math.radians(20)))
key_(root, "rotation_euler", 46, (0, 0, math.radians(12)))
key_(root, "rotation_euler", 150, (math.radians(-6), math.radians(22), math.radians(-14)))
key_(root, "rotation_euler", 216, (math.radians(-6), math.radians(24), math.radians(-22)))

E0, E1 = 46, 128

def explode(ob, dloc, drot=(0, 0, 0), start=E0, end=E1):
    base_l = ob.location.copy(); base_r = ob.rotation_euler.copy()
    key_(ob, "location", start, base_l)
    key_(ob, "rotation_euler", start, base_r)
    key_(ob, "location", end, base_l + Vector(dloc))
    key_(ob, "rotation_euler", end, (base_r[0] + math.radians(drot[0]), base_r[1] + math.radians(drot[1]),
                                      base_r[2] + math.radians(drot[2])))

explode(lidp, (0.04, 0, 0.78), (0, -5, 0), E0, E1)
explode(parts["Card 3"], (0.0, 0.13, 0.50), (0, 3, 0), E0 + 8, E1 + 4)
explode(parts["Card 2"], (0.0, 0.0, 0.43), (0, 0, 0), E0 + 12, E1 + 8)
explode(parts["Card 1"], (0.0, -0.13, 0.36), (0, -3, 0), E0 + 16, E1 + 12)
explode(parts["Liner"], (0.0, 0, 0.16), (0, 0, 0), E0 + 4, E1 + 4)
for n in ("Hinge Barrel", "Torsion Spring", "Hinge Pin"):
    explode(parts[n], (-0.30, -0.05, 0.40), (0, 0, 90), E0 + 2, E1)
for n, dx in (("Hinge Barrel", 0.0), ("Torsion Spring", -0.22), ("Hinge Pin", -0.44)):
    ob = parts[n]; l = ob.location.copy()
    key_(ob, "location", E1 + 2, l)
    key_(ob, "location", E1 + 44, l + Vector((dx, 0, 0)))
explode(parts["Body"], (0, 0, -0.10), (0, 0, 0), E0, E1)
explode(parts["Engraving"], (0, 0, -0.10), (0, 0, 0), E0, E1)

# smooth, premium easing on every curve
for ob in O:
    ad = ob.animation_data
    if ad and ad.action:
        for layer in getattr(ad.action, "layers", []):
            for strip in layer.strips:
                for cb in strip.channelbags:
                    for fc in cb.fcurves:
                        for kp in fc.keyframe_points:
                            kp.interpolation = 'BEZIER'; kp.easing = 'AUTO'
                            kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
        if hasattr(ad.action, "fcurves"):
            try:
                for fc in ad.action.fcurves:
                    for kp in fc.keyframe_points:
                        kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
            except Exception:
                pass

# ------------------------------------------------ render settings
r = scn.render
scn.render.engine = 'CYCLES'
scn.cycles.device = 'CPU'
scn.cycles.samples = 64
scn.cycles.use_denoising = True
scn.cycles.use_adaptive_sampling = True
scn.cycles.max_bounces = 8
scn.cycles.glossy_bounces = 6
r.resolution_x, r.resolution_y = 1920, 1080
r.resolution_percentage = 50
scn.view_settings.view_transform = 'AgX'
scn.view_settings.look = 'AgX - Medium High Contrast'
r.film_transparent = False
r.use_motion_blur = True
r.motion_blur_shutter = 0.35

bpy.ops.wm.save_as_mainfile(filepath=a[1])
print("staged", a[1])
