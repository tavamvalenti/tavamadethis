// Real characters: rigged, textured GLB people made with Higgsfield (image -> 3D, auto-rigged), animated with a
// shared clip library. Everything that talks to a body goes through the Person API in people.js, and this file
// provides a body with the same API (root, parts, head/neck/spine/hips, arm.R.hand, setPose, hold, lookAt, update,
// die, worldHead), so the rest of the game does not care which kind of body it got.
//
// assets/models/manifest.json:
// "characters": { "young": { "file": "chars/young.glb", "outfits": ["hoodie", "puffer"], "height": 1.8, "female": false } }
// "animations": { "walk": "anims/walk.glb", ... }   one clip per file, all on the same auto-rig skeleton
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BASE = './assets/models/';
export const library = { chars: [], clips: {}, ready: false };

// pose name -> clip name (first one that exists wins). Poses without a clip are done with bone overrides.
const POSE_CLIPS = {
  idle: ['idle'], talk: ['talk', 'idle'], angry: ['angry', 'talk'], laugh: ['laugh', 'talk'], phone: ['phone', 'idle'],
  dance: ['dance', 'idle'], browse: ['idle2', 'idle'], film: ['idle'], shrug: ['shrug', 'talk'], hurt: ['hurt', 'idle'],
  bang: ['angry', 'talk'], stab: ['stab', 'angry'], knifeOut: ['idle'], gunSide: ['idle'], aim: ['idle'], recoil: ['idle'],
  point: ['talk', 'idle'], handsUp: ['idle'], cower: ['cower', 'idle'],
};
const LOOPING_ONCE = new Set(['dieBack', 'dieFwd']);

function findBone(root, ...names) {
  const want = names.map(n => n.toLowerCase());
  let hit = null;
  // clip-only files have no skin, so their joints load as plain nodes: accept those too
  root.traverse((o) => { if (!hit && (o.isBone || !o.isMesh) && want.includes(o.name.toLowerCase().replace(/^mixamorig:?/, ''))) hit = o; });
  return hit;
}

// Make a clip safe to share: keep bone rotations, keep the hips' height (scaled to this body) and drop the hips'
// horizontal travel, because the game moves people itself.
// Some clips stand at an angle (the stock idle faces ~45° off); the hips' average heading is turned back to face +z.
function adaptClip(clip, hipsName, hipScale, hipsRest) {
  const tracks = [];
  for (const t of clip.tracks) {
    const [node, prop] = t.name.split('.');
    if (prop === 'scale') continue;
    if (prop === 'quaternion' && node === hipsName && hipsRest) {
      const v = t.values.slice(), q = new THREE.Quaternion(), f = new THREE.Vector3();
      let sx = 0, sz = 0;
      const restFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(hipsRest); const restYaw = Math.atan2(restFwd.x, restFwd.z);
      for (let i = 0; i < v.length; i += 4) { f.set(0, 0, 1).applyQuaternion(q.fromArray(v, i)); const a = Math.atan2(f.x, f.z) - restYaw; sx += Math.sin(a); sz += Math.cos(a); }
      const yaw = Math.atan2(sx, sz);
      if (Math.abs(yaw) > 0.05) {
        const fix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
        for (let i = 0; i < v.length; i += 4) q.fromArray(v, i).premultiply(fix).toArray(v, i);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(t.name, t.times, v)); continue;
    }
    if (prop === 'position') {
      if (node !== hipsName) continue;
      const v = t.values.slice(), x0 = v[0], z0 = v[2];
      for (let i = 0; i < v.length; i += 3) { v[i] = x0 * hipScale; v[i + 1] *= hipScale; v[i + 2] = z0 * hipScale; }
      tracks.push(new THREE.VectorKeyframeTrack(t.name, t.times, v)); continue;
    }
    tracks.push(t);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export async function loadCharacters(manifest) {
  const loader = new GLTFLoader();
  const anims = manifest.animations || {};
  await Promise.all(Object.entries(anims).map(async ([name, file]) => {
    try { const g = await loader.loadAsync(BASE + file); if (g.animations[0]) library.clips[name] = { clip: g.animations[0], scene: g.scene }; }
    catch (e) { console.warn('[characters] no animation', name, e); }
  }));
  await Promise.all(Object.entries(manifest.characters || {}).map(async ([name, def]) => {
    try {
      const g = await loader.loadAsync(BASE + def.file);
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene);
      g.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) { if (m.map) m.map.anisotropy = 4; m.envMapIntensity = 0.6; if (m.metalness > 0.4) m.metalness = 0.15; }
        }
      });
      // the character's own clip (usually idle) joins the shared library if it has none yet
      if (g.animations[0] && !library.clips.idle) library.clips.idle = { clip: g.animations[0], scene: g.scene };
      library.chars.push({ name, ...def, scene: g.scene, ownClip: g.animations[0] || null, nativeHeight: box.max.y - box.min.y });
    } catch (e) { console.warn('[characters] could not load', name, e); }
  }));
  library.ready = library.chars.length > 0;
  return library;
}

// pick a model for this outfit (and sex, when the caller said). Several models can share an outfit; one is chosen at random.
export function pickCharacter(opts) {
  if (!library.ready) return null;
  let pool = library.chars.filter(c => c.outfits?.includes(opts.outfit));
  if (opts.female !== undefined) pool = pool.filter(c => !!c.female === !!opts.female);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const hitMat = new THREE.MeshBasicMaterial({ visible: false });

export class SkinnedPerson {
  constructor(def, o) {
    this.opts = o; this.def = def;
    this.root = new THREE.Group(); this.root.userData.person = this;
    const model = this.model = SkeletonUtils.clone(def.scene);
    this.root.add(model);
    const h = o.height || (def.height || 1.75) * (0.96 + Math.random() * 0.08);
    const k = h / def.nativeHeight;
    model.scale.multiplyScalar(k);
    this.s = h / 1.75;
    model.updateMatrixWorld(true);
    // bones
    const B = (...n) => findBone(model, ...n);
    this.hips = B('Hips', 'hip', 'pelvis');
    this.spine = B('Spine02', 'Spine2', 'Spine1', 'Spine01', 'chest', 'Spine') || this.hips;
    this.neck = B('neck', 'Neck') || this.spine;
    this.head = B('Head', 'head') || this.neck;
    const arm = (side) => ({
      sh: B(`${side}Arm`, `${side}UpperArm`, `${side.toLowerCase()}_upperarm`),
      el: B(`${side}ForeArm`, `${side}LowerArm`, `${side.toLowerCase()}_forearm`),
      hand: B(`${side}Hand`, `${side.toLowerCase()}_hand`),
    });
    this.arm = { L: arm('Left'), R: arm('Right') };
    this.leg = { L: { hp: B('LeftUpLeg', 'LeftThigh'), kn: B('LeftLeg', 'LeftShin'), ft: B('LeftFoot') }, R: { hp: B('RightUpLeg', 'RightThigh'), kn: B('RightLeg', 'RightShin'), ft: B('RightFoot') } };
    this.mouth = new THREE.Object3D();   // nothing reads it; kept for API parity
    // per-body tint so two people from one model are not identical twins
    if (o.tint !== false) {
      const tint = new THREE.Color().setHSL(Math.random(), 0.08, 0.92 + Math.random() * 0.08);
      model.traverse((m) => { if (m.isMesh && !m.material.userData.cloned) { m.material = m.material.clone(); m.material.userData.cloned = true; m.material.color.multiply(tint); } });
    }
    // invisible hit volumes on the bones (raycasts and wounds use these)
    this.parts = [];
    const addPart = (bone, child, part, radius) => {
      if (!bone) return;
      const a = bone.getWorldPosition(new THREE.Vector3()), b = child ? child.getWorldPosition(new THREE.Vector3()) : a.clone().add(new THREE.Vector3(0, 0.22 * this.s, 0));
      const len = Math.max(0.05, a.distanceTo(b));
      const geo = new THREE.CapsuleGeometry(radius * this.s, len, 2, 6);
      const m = new THREE.Mesh(geo, hitMat);
      // place in world, then re-parent under the bone keeping the world transform
      m.position.copy(a).lerp(b, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      bone.attach(m);
      m.userData.part = part; m.userData.person = this; this.parts.push(m);
    };
    addPart(this.head, null, 'head', 0.1);
    addPart(this.hips, this.neck, 'torso', 0.17);
    for (const s of ['L', 'R']) { addPart(this.arm[s].sh, this.arm[s].el, 'arm', 0.06); addPart(this.arm[s].el, this.arm[s].hand, 'arm', 0.05); addPart(this.leg[s].hp, this.leg[s].kn, 'leg', 0.08); addPart(this.leg[s].kn, this.leg[s].ft, 'leg', 0.06); }
    // swap torso to index 1 (game.js wounds parts[1] for a torso shot)
    const ti = this.parts.findIndex(p => p.userData.part === 'torso'); if (ti > 1 || ti === 0) { const [t] = this.parts.splice(ti, 1); this.parts.splice(1, 0, t); }
    // animation
    this.mixer = new THREE.AnimationMixer(model);
    const hipsRestY = this.hips.position.y;
    this.actions = {};
    for (const [name, { clip, scene }] of Object.entries(library.clips)) {
      const srcHips = findBone(scene, this.hips.name);
      const hipScale = srcHips && srcHips.position.y ? hipsRestY / srcHips.position.y : 1;
      const a = this.mixer.clipAction(adaptClip(clip, this.hips.name, hipScale, srcHips ? srcHips.quaternion : null));
      if (LOOPING_ONCE.has(name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[name] = a;
    }
    this.locoW = { idle: 1, walk: 0, run: 0 };
    for (const n of ['idle', 'walk', 'run', 'drunkWalk', 'elderWalk']) if (this.actions[n]) { this.actions[n].play(); this.actions[n].setEffectiveWeight(n === 'idle' ? 1 : 0); this.actions[n].time = Math.random() * this.actions[n].getClip().duration; }
    this.gesture = null;   // the one-shot or looping upper-body clip for the current pose
    this.pose = 'idle'; this.t = Math.random() * 10; this.speed = 0; this.lookTarget = null; this.hitT = 0; this.hitDir = 1; this.held = null;
    this.drunk = !!o.drunk; this.jitter = o.jitter ?? 0; this.deadT = 0;
    this._look = new THREE.Vector2();
  }

  setPose(p) { if (this.pose === 'dead' || this.pose === p) return; this.pose = p; this._syncGesture(); }

  _syncGesture() {
    const want = (POSE_CLIPS[this.pose] || ['idle']).find(n => this.actions[n] && n !== 'idle') || null;
    const cur = this.gesture;
    if (cur && cur.getClip().name === want) return;
    if (cur) cur.fadeOut(0.3);
    if (want) { const a = this.actions[want]; a.reset().setEffectiveWeight(1).fadeIn(0.3).play(); this.gesture = a; } else this.gesture = null;
  }

  hold(kind) {
    if (this.held) { this.held.parent?.remove(this.held); this.held = null; }
    if (!kind || !this.arm.R.hand) return;
    const g = makeHeld(kind);
    g.userData.kind = kind;
    // build in world space at the hand, then attach so the bone's scale does not shrink it
    const hand = this.arm.R.hand; hand.updateWorldMatrix(true, false);
    // bones point down their local +Y, so the fingers are along the hand's +Y: put the item in the palm, pointing that way
    hand.getWorldQuaternion(g.quaternion);
    const along = new THREE.Vector3(0, 1, 0).applyQuaternion(g.quaternion);
    hand.getWorldPosition(g.position).addScaledVector(along, 0.075 * this.s);
    g.quaternion.multiply(_q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)));
    hand.attach(g); this.held = g;
  }

  lookAt(v) { this.lookTarget = v; }
  get worldHead() { return this.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.08 * this.s, 0)); }

  update(dt) {
    this.t += dt;
    if (this.pose === 'dead') { this.mixer.update(dt); return; }
    // locomotion blend: idle / walk / run by speed, with the stride time-scaled to the ground speed so feet don't slide
    const sp = this.speed, A = this.actions;
    const walkName = this.drunk && A.drunkWalk ? 'drunkWalk' : (this.def.walk && A[this.def.walk]) ? this.def.walk : 'walk';
    const tw = { idle: 0, walk: 0, run: 0 };
    if (sp < 0.05) tw.idle = 1; else if (sp < 2.2 || !A.run) { const k = Math.min(1, sp / 0.5); tw.walk = k; tw.idle = 1 - k; } else { const k = Math.min(1, (sp - 2.2) / 0.8); tw.run = k; tw.walk = 1 - k; }
    const kk = 1 - Math.exp(-dt * 8);
    for (const n of ['idle', 'walk', 'run']) this.locoW[n] += (tw[n] - this.locoW[n]) * kk;
    const moving = this.locoW.walk + this.locoW.run > 0.05;
    const g = this.gesture, gW = g ? (moving ? 0.0 : 1) : 0;
    if (g) g.setEffectiveWeight(THREE.MathUtils.lerp(g.getEffectiveWeight(), gW, kk));
    const rest = 1 - (g ? g.getEffectiveWeight() : 0);
    if (A.idle) A.idle.setEffectiveWeight(this.locoW.idle * rest);
    for (const n of ['walk', 'drunkWalk', 'elderWalk']) if (A[n]) A[n].setEffectiveWeight(n === walkName ? this.locoW.walk : 0);
    if (A.run) A.run.setEffectiveWeight(this.locoW.run);
    if (A[walkName]) A[walkName].timeScale = THREE.MathUtils.clamp(sp / (this.def.walkSpeed || 1.3), 0.6, 1.6);
    if (A.run) A.run.timeScale = THREE.MathUtils.clamp(sp / 3.6, 0.7, 1.3);
    this.mixer.update(dt);
    this._overrides(dt);
  }

  // bone overrides on top of the clips: aiming, hands up, cowering, a flinch when hit, and looking at things
  _overrides(dt) {
    const p = this.pose, R = this.arm.R, L = this.arm.L;
    this.model.updateMatrixWorld(true);
    const fwd = _v3.set(0, 0, 1).applyQuaternion(this.root.getWorldQuaternion(_q2)).setY(0).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    if (p === 'aim' || p === 'recoil' || p === 'point') {
      const dir = this.lookTarget ? this.lookTarget.clone().sub(R.sh.getWorldPosition(_v)).normalize() : fwd.clone();
      if (p === 'recoil') dir.y += 0.35;
      if (this.jitter) { dir.x += Math.sin(this.t * 13) * this.jitter * 0.04; dir.y += Math.sin(this.t * 11) * this.jitter * 0.04; }
      pointBone(R.sh, R.el, dir, 1); this.model.updateMatrixWorld(true); pointBone(R.el, R.hand, dir, 1);
      if (p !== 'point') { const ld = dir.clone().add(_v2.crossVectors(up, fwd).multiplyScalar(-0.35)).normalize(); pointBone(L.sh, L.el, ld, 0.9); this.model.updateMatrixWorld(true); pointBone(L.el, L.hand, dir, 0.9); }
    } else if (p === 'gunSide' || p === 'knifeOut') {
      pointBone(R.el, R.hand, fwd.clone().add(new THREE.Vector3(0, -0.6, 0)).normalize(), 0.8);
    } else if (p === 'handsUp') {
      const shake = Math.sin(this.t * 15) * 0.02;
      for (const [arm, sx] of [[L, 1], [R, -1]]) {
        const side = _v2.crossVectors(up, fwd).multiplyScalar(sx * 0.55);
        pointBone(arm.sh, arm.el, up.clone().add(side).normalize(), 1); this.model.updateMatrixWorld(true);
        pointBone(arm.el, arm.hand, up.clone().add(fwd.clone().multiplyScalar(-0.1 + shake)).normalize(), 1);
      }
    } else if (p === 'cower' && !this.actions.cower) {
      for (const [arm, sx] of [[L, 1], [R, -1]]) {
        const side = _v2.crossVectors(up, fwd).multiplyScalar(sx * 0.6);
        pointBone(arm.sh, arm.el, fwd.clone().add(up).add(side).normalize(), 1); this.model.updateMatrixWorld(true);
        pointBone(arm.el, arm.hand, side.clone().multiplyScalar(-2).add(up).normalize(), 1);
      }
      this.spine.rotateX(0.35);
    }
    if (this.drunk) { this.spine.rotateZ(Math.sin(this.t * 0.9) * 0.08); }
    if (this.hitT > 0) { this.hitT -= dt; const k = Math.max(0, this.hitT) * 4; this.spine.rotateX(-k * 0.35 * this.hitDir); this.neck.rotateX(-k * 0.2); }
    // look-at: head and neck turn (and the chest a little), eased so the eyes lead and the body follows
    let yaw = 0, pitch = 0;
    if (this.lookTarget && p !== 'cower') {
      const local = this.root.worldToLocal(_v.copy(this.lookTarget));
      const nl = this.root.worldToLocal(this.neck.getWorldPosition(_v2));
      const dx = local.x - nl.x, dz = local.z - nl.z, dy = local.y - nl.y;
      yaw = THREE.MathUtils.clamp(Math.atan2(dx, dz), -1.2, 1.2); pitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.5);
    }
    const k = 1 - Math.exp(-dt * 6);
    this._look.x += (yaw - this._look.x) * k; this._look.y += (pitch - this._look.y) * k;
    if (Math.abs(this._look.x) + Math.abs(this._look.y) > 0.002) {
      turnBoneWorld(this.spine, up, this._look.x * 0.2);
      turnBoneWorld(this.neck, up, this._look.x * 0.35);
      turnBoneWorld(this.head, up, this._look.x * 0.45);
      const side = _v2.crossVectors(up, fwd).normalize().applyAxisAngle(up, this._look.x);
      turnBoneWorld(this.head, side, this._look.y * 0.8);
    }
  }

  die(dir = 1) {
    if (this.pose === 'dead') return;
    this.pose = 'dead'; this.speed = 0;
    const name = dir > 0 ? 'dieBack' : 'dieFwd';
    const a = this.actions[name] || this.actions.dieBack || this.actions.dieFwd;
    if (!a) { this.root.rotation.x = -Math.PI / 2 * dir; this.root.position.y = 0.15; return; }
    this.mixer.stopAllAction(); a.reset().setEffectiveWeight(1).play();
  }
}

// rotate `bone` so the direction from it to `child` points along worldDir (blended by w)
function pointBone(bone, child, worldDir, w) {
  if (!bone || !child) return;
  const a = bone.getWorldPosition(_v), b = child.getWorldPosition(_v2);
  const cur = b.sub(a).normalize();
  const delta = _q.setFromUnitVectors(cur, worldDir.clone().normalize());
  const bw = bone.getWorldQuaternion(_q2);
  const target = delta.multiply(bw);
  const pw = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  const local = pw.multiply(target);
  bone.quaternion.slerp(local, w);
  bone.updateMatrixWorld(true);
}
function turnBoneWorld(bone, worldAxis, angle) {
  if (!bone) return;
  const pw = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const axisLocal = worldAxis.clone().applyQuaternion(pw.invert()).normalize();
  bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axisLocal, angle));
}

const heldMats = {};
const hm = (k, o) => heldMats[k] || (heldMats[k] = new THREE.MeshStandardMaterial(o));
function makeHeld(kind) {
  const g = new THREE.Group(), dark = hm('dark', { color: 0x151515, roughness: 0.35, metalness: 0.7 });
  const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  if (kind === 'gun') { box(0.03, 0.035, 0.17, dark, 0, 0.02, 0.07); box(0.028, 0.09, 0.035, dark, 0, -0.03, 0).rotation.x = 0.25; }
  else if (kind === 'knife') { box(0.006, 0.02, 0.18, hm('steel', { color: 0xcfd3d8, roughness: 0.15, metalness: 1 }), 0, 0, 0.12); box(0.022, 0.028, 0.09, hm('wood', { color: 0x2a1a10, roughness: 0.7 })); }
  else if (kind === 'phone') { box(0.07, 0.01, 0.14, dark); }
  else if (kind === 'bottle') { const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.038, 0.28, 10), hm('glass', { color: 0x4a2a0a, roughness: 0.15, transparent: true, opacity: 0.85 })); bt.rotation.x = Math.PI / 2; g.add(bt); }
  else if (kind === 'bag') { box(0.22, 0.3, 0.12, hm('bag', { color: 0xf4f4ee, roughness: 0.9 }), 0, 0, -0.18); }
  return g;
}
