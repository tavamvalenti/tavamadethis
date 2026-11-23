// Placeholder people: a jointed body built from simple shapes and posed in code.
// Real characters (Higgsfield + Blender + Mixamo) replace these in Phase 3; the rest of the game
// only talks to the Person API (setPose, lookAt, hold, hit parts), so the swap is local to this file.
import * as THREE from 'three';

const SKIN = [0x3b2219, 0x4a2c1f, 0x5c3a28, 0x6e4630, 0x8a5a3c, 0xa8724f, 0xc58e68, 0xe0b48f, 0xf1cfb0];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const mats = new Map();
function mat(color, rough = 0.8, extra = {}) {
  const k = color + ':' + rough + JSON.stringify(extra);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }));
  return mats.get(k);
}
const G = {
  cap: (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10),
  sph: (r) => new THREE.SphereGeometry(r, 16, 12),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
};

export const OUTFITS = {
  hoodie: { top: [0x1b1b1f, 0x5a5f66, 0x2b3d5a, 0x6b1d24, 0x3c4b2f, 0xd8d5cc], bottom: [0x23252b, 0x3b4252, 0x5a5a5a, 0x1d1d1d], hood: true },
  puffer: { top: [0x111214, 0xd64b1a, 0x2b2b2b, 0xe9e6da, 0x1d3b2a], bottom: [0x1d1d1d, 0x3b4252], puffer: true },
  scrubs: { top: [0x3a6f9e, 0x4b8c7a, 0x6a5a9e], bottom: 'same' },
  tee: { top: [0xf4f4f0, 0x111111, 0x9e2a2b, 0x2a6fbd, 0xe0b13a], bottom: [0x2c4a7a, 0x23252b, 0x8a7a5a], short: true },
  tourist: { top: [0xf2d27a, 0x7ac0e8, 0xf4f4f0, 0xe88aa0], bottom: [0xc8b48a, 0x8a8a7a], short: true, fanny: true },
  church: { top: [0x7a2a5a, 0x2a2a6a, 0xd8c8a8], bottom: [0x2a2a2a, 0x5a2a4a], hat: 'church' },
  ragged: { top: [0x4a4234, 0x3a3a30, 0x5a4a3a], bottom: [0x3a3328, 0x2a2a24], dirty: true },
  work: { top: [0xf27a1a, 0x2a4a2a, 0x4a4a4a], bottom: [0x3a3a3a, 0x2a3a5a], vest: true },
  cop: { top: [0x1a2340], bottom: [0x1a2340], hat: 'cop', cop: true },
  robber: { top: [0x111111, 0x1a1a1a, 0x2a2a2a], bottom: [0x111111, 0x1a1a1a], hood: true, mask: true },
  track: { top: [0xc41f2e, 0x0e5a2e, 0x1b2b6b, 0x111111, 0xe9e9e9], bottom: 'same', stripe: true },
};
const HATS = ['none', 'none', 'cap', 'beanie', 'durag', 'none'];

export class Person {
  constructor(opts = {}) {
    const o = this.opts = {
      height: rnd(1.62, 1.92), build: rnd(0.9, 1.25), skin: pick(SKIN), outfit: 'hoodie', hat: null, female: Math.random() < 0.45, ...opts,
    };
    const of = OUTFITS[o.outfit] || OUTFITS.hoodie;
    const topC = o.top ?? pick(of.top), botC = o.bottom ?? (of.bottom === 'same' ? topC : pick(of.bottom));
    const shoeC = o.shoes ?? pick([0xf4f4f4, 0x111111, 0xf4f4f4, 0x8a5a2a, 0xc8202a]);
    const s = o.height / 1.75, b = o.build * (o.female ? 0.92 : 1);
    this.s = s;
    const mTop = mat(topC, of.puffer ? 0.45 : 0.85), mBot = mat(botC, 0.85), mSkin = mat(o.skin, 0.55), mShoe = mat(shoeC, 0.6);
    const mHair = mat(pick([0x0b0806, 0x1a120c, 0x2b1d12, 0x5a4030, 0x777066]), 0.9);
    const limbTop = of.short ? mSkin : mTop;
    this.root = new THREE.Group();
    this.root.userData.person = this;
    this.parts = [];
    const add = (parent, geo, material, part, y = 0, x = 0, z = 0) => {
      const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      m.userData.part = part; m.userData.person = this; parent.add(m); this.parts.push(m); return m;
    };
    const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    const hipY = 0.93 * s;
    this.hips = pivot(this.root, 0, hipY, 0);
    add(this.hips, G.cap(0.15 * s * b, 0.12 * s), mBot, 'torso', 0.02 * s).scale.set(1.15, 1, 0.75);
    this.spine = pivot(this.hips, 0, 0.08 * s, 0);
    const torso = add(this.spine, G.cap(0.16 * s * b * (of.puffer ? 1.25 : 1), 0.3 * s), mTop, 'torso', 0.25 * s);
    torso.scale.set(1.18, 1, 0.72 * (o.female ? 1.05 : 1));
    if (of.vest) add(this.spine, G.box(0.38 * s * b, 0.4 * s, 0.26 * s), mat(0xd8ff1a, 0.6, { emissive: 0x222a00 }), 'torso', 0.3 * s);
    if (of.stripe) for (const sx of [-1, 1]) add(this.spine, G.box(0.02 * s, 0.4 * s, 0.03 * s), mat(0xffffff, 0.6), 'torso', 0.3 * s, sx * 0.17 * s * b, 0.11 * s);
    if (of.cop) { add(this.spine, G.box(0.06 * s, 0.05 * s, 0.02), mat(0xd8b84a, 0.3, { metalness: 0.8 }), 'torso', 0.4 * s, -0.08 * s, 0.13 * s); add(this.hips, G.box(0.36 * s * b, 0.06 * s, 0.26 * s), mat(0x111111, 0.4), 'torso', 0.06 * s); }
    if (of.fanny) add(this.hips, G.box(0.22 * s, 0.08 * s, 0.08 * s), mat(0x1a1a1a, 0.6), 'torso', 0.08 * s, 0, 0.13 * s);
    this.neck = pivot(this.spine, 0, 0.5 * s, 0);
    add(this.neck, G.cap(0.05 * s, 0.06 * s), mSkin, 'head', 0.03 * s);
    this.head = pivot(this.neck, 0, 0.1 * s, 0);
    const skull = add(this.head, G.sph(0.105 * s), o.outfit === 'robber' ? mat(0x111111, 0.9) : mSkin, 'head', 0.09 * s);
    skull.scale.set(0.92, 1.12, 1.0);
    const eyeM = mat(0x0a0a0a, 0.2), whiteM = mat(0xe8e2d8, 0.3);
    for (const sx of [-1, 1]) {
      add(this.head, G.sph(0.016 * s), whiteM, 'head', 0.105 * s, sx * 0.038 * s, 0.088 * s);
      add(this.head, G.sph(0.009 * s), eyeM, 'head', 0.105 * s, sx * 0.038 * s, 0.101 * s);
    }
    add(this.head, G.box(0.018 * s, 0.035 * s, 0.03 * s), mSkin, 'head', 0.075 * s, 0, 0.105 * s); // nose
    this.mouth = add(this.head, G.box(0.045 * s, 0.008 * s, 0.01 * s), mat(0x3a1a16, 0.6), 'head', 0.045 * s, 0, 0.098 * s);
    const hat = o.hat ?? (of.hat || (of.mask ? 'mask' : pick(HATS)));
    if (hat === 'cap' || hat === 'cop') {
      add(this.head, G.sph(0.112 * s), mat(hat === 'cop' ? 0x1a2340 : pick([0x111111, 0xc41f2e, 0x1b2b6b, 0xe9e9e9]), 0.6), 'head', 0.13 * s).scale.set(1, 0.6, 1.05);
      add(this.head, G.box(0.16 * s, 0.015 * s, 0.1 * s), mat(0x111111, 0.6), 'head', 0.15 * s, 0, 0.12 * s);
    } else if (hat === 'beanie') {
      add(this.head, G.sph(0.115 * s), mat(pick([0x111111, 0xd64b1a, 0x2b6b3a, 0x6b1d24]), 0.95), 'head', 0.14 * s).scale.set(1, 0.85, 1.02);
    } else if (hat === 'durag') {
      add(this.head, G.sph(0.11 * s), mat(pick([0x111111, 0x6b1d24, 0x1b2b6b, 0xc8a02a]), 0.25, { metalness: 0.2 }), 'head', 0.125 * s).scale.set(1, 0.85, 1.03);
    } else if (hat === 'church') {
      add(this.head, new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.015 * s, 20), mat(0x7a2a5a, 0.7), 'head', 0.17 * s);
      add(this.head, new THREE.CylinderGeometry(0.09 * s, 0.1 * s, 0.09 * s, 16), mat(0x7a2a5a, 0.7), 'head', 0.21 * s);
    } else if (hat === 'mask') {
      for (const sx of [-1, 1]) add(this.head, G.box(0.03 * s, 0.012 * s, 0.01 * s), mat(o.skin, 0.6), 'head', 0.105 * s, sx * 0.038 * s, 0.092 * s);
    } else {
      const hairStyle = o.female ? pick(['bun', 'long', 'puff', 'short']) : pick(['short', 'short', 'locs', 'bald', 'fro']);
      if (hairStyle !== 'bald') add(this.head, G.sph(0.11 * s), mHair, 'head', (hairStyle === 'fro' || hairStyle === 'puff' ? 0.14 : 0.12) * s, 0, -0.008 * s).scale.set(hairStyle === 'fro' ? 1.3 : 1.02, hairStyle === 'fro' ? 1.1 : 0.75, hairStyle === 'fro' ? 1.25 : 1.04);
      if (hairStyle === 'bun') add(this.head, G.sph(0.05 * s), mHair, 'head', 0.23 * s, 0, -0.04 * s);
      if (hairStyle === 'long' || hairStyle === 'locs') add(this.head, G.box(0.2 * s, 0.22 * s, 0.06 * s), mHair, 'head', 0.03 * s, 0, -0.08 * s);
    }
    if (of.hood && hat !== 'cap') add(this.neck, G.sph(0.13 * s), mTop, 'torso', -0.02 * s, 0, -0.06 * s).scale.set(1.2, 0.6, 1);
    // arms
    this.arm = {};
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      const sh = pivot(this.spine, sx * 0.2 * s * b * (of.puffer ? 1.15 : 1), 0.44 * s, 0);
      add(sh, G.cap(0.05 * s * b * (of.puffer ? 1.4 : 1), 0.22 * s), mTop, 'arm', -0.14 * s);
      const el = pivot(sh, 0, -0.29 * s, 0);
      add(el, G.cap(0.042 * s * b * (of.puffer ? 1.3 : 1), 0.2 * s), limbTop, 'arm', -0.13 * s);
      const hand = pivot(el, 0, -0.27 * s, 0);
      add(hand, G.sph(0.045 * s), mSkin, 'arm').scale.set(0.8, 1.1, 0.6);
      this.arm[side] = { sh, el, hand };
    }
    this.leg = {};
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      const hp = pivot(this.hips, sx * 0.095 * s * b, -0.02 * s, 0);
      add(hp, G.cap(0.07 * s * b, 0.32 * s), mBot, 'leg', -0.21 * s);
      const kn = pivot(hp, 0, -0.44 * s, 0);
      add(kn, G.cap(0.055 * s * b, 0.32 * s), mBot, 'leg', -0.2 * s);
      const ft = pivot(kn, 0, -0.44 * s, 0);
      add(ft, G.box(0.1 * s, 0.07 * s, 0.26 * s), mShoe, 'leg', -0.025 * s, 0, 0.05 * s);
      this.leg[side] = { hp, kn, ft };
    }
    this.pose = 'idle'; this.phase = Math.random() * 10; this.t = Math.random() * 10;
    this.speed = 0; this.lookTarget = null; this.deadT = 0; this.hitT = 0; this.held = null;
    this.drunk = !!o.drunk; this.jitter = o.jitter ?? 0;
  }

  setPose(p) { if (this.pose !== 'dead') this.pose = p; }

  hold(kind) {
    if (this.held) { this.held.parent?.remove(this.held); this.held = null; }
    if (!kind) return;
    const g = new THREE.Group(), s = this.s, dark = mat(0x151515, 0.35, { metalness: 0.7 });
    if (kind === 'gun') {
      const slide = new THREE.Mesh(G.box(0.035, 0.04, 0.18), dark); slide.position.set(0, 0.0, 0.07); g.add(slide);
      const grip = new THREE.Mesh(G.box(0.03, 0.09, 0.04), dark); grip.position.set(0, -0.05, 0); grip.rotation.x = 0.25; g.add(grip);
      g.position.set(0, -0.04 * s, 0.03); g.rotation.x = -Math.PI / 2;
    } else if (kind === 'knife') {
      const blade = new THREE.Mesh(G.box(0.008, 0.02, 0.2), mat(0xcfd3d8, 0.15, { metalness: 1 })); blade.position.z = 0.12; g.add(blade);
      const hd = new THREE.Mesh(G.box(0.025, 0.03, 0.1), mat(0x2a1a10, 0.7)); g.add(hd);
      g.position.set(0, -0.04 * s, 0.02); g.rotation.x = -Math.PI / 2;
    } else if (kind === 'phone') {
      const p = new THREE.Mesh(G.box(0.07, 0.14, 0.01), dark); g.add(p);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.12), new THREE.MeshBasicMaterial({ color: 0xbfe0ff })); sc.position.z = 0.006; g.add(sc);
      g.position.set(0, -0.05 * s, 0.03);
    } else if (kind === 'bottle') {
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.3, 10), mat(0x4a2a0a, 0.15, { transparent: true, opacity: 0.85 })); bt.position.y = -0.08; g.add(bt);
    } else if (kind === 'bag') {
      const bg = new THREE.Mesh(G.box(0.22, 0.3, 0.12), mat(0xf4f4ee, 0.9)); bg.position.y = -0.2; g.add(bg);
    }
    g.userData.kind = kind;
    this.arm.R.hand.add(g); this.held = g;
  }

  lookAt(v) { this.lookTarget = v; }

  get worldHead() { return this.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.1 * this.s, 0)); }

  // poses are computed fresh each frame, then every joint eases toward its target so nothing snaps
  update(dt) {
    this._pose(dt);
    if (this.pose === 'dead') return;
    const J = this._joints || (this._joints = [this.hips, this.spine, this.neck, this.arm.L.sh, this.arm.L.el, this.arm.R.sh, this.arm.R.el, this.leg.L.hp, this.leg.L.kn, this.leg.R.hp, this.leg.R.kn, this.leg.L.ft, this.leg.R.ft, this.arm.L.hand, this.arm.R.hand].map(o => ({ o, q: o.quaternion.clone() })));
    const k = 1 - Math.exp(-dt * (this.speed > 0.05 ? 22 : 11));
    for (const j of J) { j.q.slerp(j.o.quaternion, k); j.o.quaternion.copy(j.q); }
    this._hy = this._hy === undefined ? this.hips.position.y : this._hy + (this.hips.position.y - this._hy) * Math.min(1, dt * 14); this.hips.position.y = this._hy;
  }

  _pose(dt) {
    this.t += dt;
    const p = this.pose, t = this.t, s = this.s;
    const A = this.arm, L = this.leg;
    // reset
    const zero = (o) => o.rotation.set(0, 0, 0);
    [this.hips, this.spine, this.neck, A.L.sh, A.L.el, A.R.sh, A.R.el, L.L.hp, L.L.kn, L.R.hp, L.R.kn, L.L.ft, L.R.ft, A.L.hand, A.R.hand].forEach(zero);
    this.hips.position.y = 0.93 * s;
    A.L.sh.rotation.z = 0.08; A.R.sh.rotation.z = -0.08;
    const breathe = Math.sin(t * 1.8) * 0.02;
    this.spine.rotation.x = breathe;
    if (p === 'dead') { this._dead(dt); return; }
    const moving = this.speed > 0.05;
    if (moving) {
      const run = this.speed > 2.6;
      this.phase += dt * this.speed * (run ? 3.0 : 4.3);
      const w = Math.sin(this.phase), amp = run ? 0.95 : Math.min(0.62, 0.3 + this.speed * 0.2);
      this.hips.rotation.y = w * 0.09; this.hips.rotation.z = Math.cos(this.phase) * 0.035; this.spine.rotation.y = -w * 0.13;
      L.L.ft.rotation.x = Math.max(-0.35, Math.sin(this.phase + 0.9) * 0.3); L.R.ft.rotation.x = Math.max(-0.35, -Math.sin(this.phase + 0.9) * 0.3);
      L.L.hp.rotation.x = w * amp; L.R.hp.rotation.x = -w * amp;
      L.L.kn.rotation.x = Math.max(0, -Math.cos(this.phase)) * amp * 1.3 + 0.05;
      L.R.kn.rotation.x = Math.max(0, Math.cos(this.phase)) * amp * 1.3 + 0.05;
      A.L.sh.rotation.x = -w * amp * 0.8; A.R.sh.rotation.x = w * amp * 0.8;
      A.L.el.rotation.x = -0.3 - (run ? 0.9 : 0); A.R.el.rotation.x = -0.3 - (run ? 0.9 : 0);
      this.hips.position.y += Math.abs(Math.cos(this.phase)) * 0.03 * s;
      this.spine.rotation.x += run ? 0.25 : 0.05;
      if (this.opts.swagger) { this.spine.rotation.z = Math.sin(this.phase) * 0.08; A.R.sh.rotation.x *= 0.3; A.R.el.rotation.x = -0.2; }
    }
    if (this.drunk) { this.spine.rotation.z += Math.sin(t * 0.9) * 0.12; this.hips.rotation.z = Math.sin(t * 0.7) * 0.05; this.neck.rotation.x = 0.2; }
    switch (p) {
      case 'talk': {
        const k = Math.sin(t * 3.1), k2 = Math.sin(t * 2.3 + 1);
        A.R.sh.rotation.x = -0.5 - k * 0.25; A.R.el.rotation.x = -1.1 + k2 * 0.3; A.R.sh.rotation.z = -0.2;
        A.L.sh.rotation.x = -0.2 + k2 * 0.15; A.L.el.rotation.x = -0.6;
        this.mouth.scale.y = 1 + Math.abs(Math.sin(t * 11)) * 3;
        break;
      }
      case 'angry': {
        const k = Math.sin(t * 6);
        A.R.sh.rotation.x = -1.1 - k * 0.3; A.R.el.rotation.x = -0.4; A.L.sh.rotation.x = -0.4; A.L.sh.rotation.z = 0.5; A.L.el.rotation.x = -1.2;
        this.spine.rotation.x = 0.2 + k * 0.05; this.mouth.scale.y = 3;
        break;
      }
      case 'laugh': {
        const k = Math.abs(Math.sin(t * 9));
        this.spine.rotation.x = -0.15 + k * 0.25; A.L.sh.rotation.x = -0.3; A.L.el.rotation.x = -1.4; A.R.sh.rotation.x = -0.3; A.R.el.rotation.x = -1.4;
        this.neck.rotation.x = -0.3; this.mouth.scale.y = 4;
        break;
      }
      case 'handsUp': {
        A.L.sh.rotation.x = -2.9; A.R.sh.rotation.x = -2.9; A.L.sh.rotation.z = 0.3; A.R.sh.rotation.z = -0.3; A.L.el.rotation.x = -0.5; A.R.el.rotation.x = -0.5;
        this.spine.rotation.x = -0.05 + Math.sin(t * 15) * 0.01;
        break;
      }
      case 'aim': {
        A.R.sh.rotation.x = -1.5; A.R.sh.rotation.y = 0.1; A.R.el.rotation.x = 0;
        A.L.sh.rotation.x = -1.35; A.L.sh.rotation.z = -0.45; A.L.el.rotation.x = -0.25;
        const j = this.jitter * 0.05; A.R.sh.rotation.x += Math.sin(t * 13) * j; A.R.sh.rotation.y += Math.sin(t * 11) * j;
        break;
      }
      case 'gunSide': { A.R.sh.rotation.x = -0.3; A.R.el.rotation.x = -0.5; break; }
      case 'recoil': { A.R.sh.rotation.x = -1.8; A.L.sh.rotation.x = -1.5; A.L.sh.rotation.z = -0.45; break; }
      case 'stab': {
        const k = (Math.sin(t * 7) + 1) / 2;
        A.R.sh.rotation.x = -0.6 - k * 1.0; A.R.el.rotation.x = -1.4 + k * 1.3; this.spine.rotation.x = 0.15 + k * 0.15; this.mouth.scale.y = 3;
        break;
      }
      case 'knifeOut': { A.R.sh.rotation.x = -0.8; A.R.el.rotation.x = -0.9; A.L.sh.rotation.x = -0.5; A.L.el.rotation.x = -0.8; this.spine.rotation.x = 0.15; break; }
      case 'browse': {
        A.R.sh.rotation.x = -0.9 + Math.sin(t * 0.8) * 0.3; A.R.el.rotation.x = -0.5; this.neck.rotation.x = 0.15 + Math.sin(t * 0.5) * 0.1;
        break;
      }
      case 'phone': { A.R.sh.rotation.x = -0.6; A.R.el.rotation.x = -1.6; A.R.sh.rotation.z = 0.2; this.neck.rotation.x = 0.35; break; }
      case 'film': { A.R.sh.rotation.x = -1.5; A.R.el.rotation.x = -0.3; A.R.sh.rotation.y = -0.2; break; }
      case 'dance': {
        const k = Math.sin(t * 7);
        this.hips.position.y += Math.abs(k) * 0.04; this.spine.rotation.z = k * 0.15; A.L.sh.rotation.x = -1.2 + k * 0.4; A.R.sh.rotation.x = -1.2 - k * 0.4; A.L.el.rotation.x = -1; A.R.el.rotation.x = -1;
        L.L.kn.rotation.x = Math.max(0, k) * 0.5; L.R.kn.rotation.x = Math.max(0, -k) * 0.5;
        break;
      }
      case 'cower': {
        this.hips.position.y -= 0.35 * s; L.L.hp.rotation.x = -1.3; L.R.hp.rotation.x = -1.3; L.L.kn.rotation.x = 2.1; L.R.kn.rotation.x = 2.1;
        this.spine.rotation.x = 0.6; A.L.sh.rotation.x = -2.2; A.R.sh.rotation.x = -2.2; A.L.el.rotation.x = -1.8; A.R.el.rotation.x = -1.8;
        break;
      }
      case 'bang': {
        const k = Math.max(0, Math.sin(t * 8));
        A.R.sh.rotation.x = -1.9 + k * 0.4; A.R.el.rotation.x = -0.4; A.L.sh.rotation.x = -1.7 + (1 - k) * 0.4; A.L.el.rotation.x = -0.4; this.spine.rotation.x = 0.1; this.mouth.scale.y = 3;
        break;
      }
      case 'point': { A.R.sh.rotation.x = -1.5; A.R.el.rotation.x = 0; break; }
      case 'shrug': { A.L.sh.rotation.z = 0.5; A.R.sh.rotation.z = -0.5; A.L.el.rotation.x = -1.2; A.R.el.rotation.x = -1.2; this.neck.rotation.z = 0.15; break; }
      case 'hurt': { this.spine.rotation.x = 0.45; A.L.sh.rotation.x = -0.7; A.L.el.rotation.x = -1.2; this.neck.rotation.x = 0.3; break; }
      default: {
        if (!moving) { A.L.sh.rotation.x = Math.sin(t * 0.7) * 0.03; A.R.sh.rotation.x = Math.sin(t * 0.7 + 1) * 0.03; this.hips.rotation.y = Math.sin(t * 0.25) * 0.05; }
      }
    }
    if (p !== 'talk' && p !== 'angry' && p !== 'laugh' && p !== 'stab' && p !== 'bang') this.mouth.scale.y = 1;
    // a hit makes the body jerk for a moment
    if (this.hitT > 0) { this.hitT -= dt; const k = this.hitT * 4; this.spine.rotation.x -= k * 0.5 * this.hitDir; this.neck.rotation.x -= k * 0.3; }
    // look-at with the head (and a bit of the spine)
    if (this.lookTarget && p !== 'cower') {
      const hp = this.neck.getWorldPosition(_v);
      const local = this.root.worldToLocal(_v2.copy(this.lookTarget));
      const nl = this.root.worldToLocal(_v3.copy(hp));
      const dx = local.x - nl.x, dz = local.z - nl.z, dy = local.y - nl.y;
      let yaw = Math.atan2(dx, dz); yaw = Math.max(-1.2, Math.min(1.2, yaw));
      const pitch = -Math.atan2(dy, Math.hypot(dx, dz));
      this.neck.rotation.y = yaw * 0.7; this.spine.rotation.y += yaw * 0.25;
      this.neck.rotation.x += Math.max(-0.5, Math.min(0.5, pitch)) * 0.8;
    }
  }

  die(dir = 1) {
    if (this.pose === 'dead') return;
    this.pose = 'dead'; this.deadT = 0; this.fallDir = dir; this.speed = 0;
    this.fallSide = (Math.random() - 0.5) * 0.6;
  }

  _dead(dt) {
    this.deadT = Math.min(1, this.deadT + dt * 1.8);
    const k = 1 - Math.pow(1 - this.deadT, 3), s = this.s;
    // fall backwards (or forwards) onto the floor, limbs loose
    this.hips.position.y = THREE.MathUtils.lerp(0.93 * s, 0.12 * s, k);
    this.hips.rotation.x = -this.fallDir * k * 1.5; this.hips.rotation.z = this.fallSide * k;
    this.spine.rotation.x = -this.fallDir * k * 0.05;
    this.neck.rotation.x = -this.fallDir * k * 0.25; this.neck.rotation.y = 0.6 * k;
    const A = this.arm, L = this.leg;
    A.L.sh.rotation.z = 0.08 + k * 1.2; A.R.sh.rotation.z = -0.08 - k * 0.9; A.L.el.rotation.x = -0.4 * k; A.R.el.rotation.x = -0.2 * k;
    L.L.hp.rotation.x = this.fallDir * k * 0.15; L.R.hp.rotation.x = this.fallDir * k * 0.35; L.L.kn.rotation.x = 0.3 * k; L.R.kn.rotation.x = 0.1 * k;
    L.L.hp.rotation.z = 0.15 * k; L.R.hp.rotation.z = -0.2 * k;
    this.mouth.scale.y = 2;
  }
}
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

export function randomLook(kind) {
  // archetype -> outfit defaults; individual variation on top
  const map = {
    regular: ['hoodie', 'puffer', 'tee', 'track'], yn: ['hoodie', 'puffer', 'track'], tourist: ['tourist'], nurse: ['scrubs'],
    church: ['church'], unhoused: ['ragged'], worker: ['work'], robber: ['robber'], cop: ['cop'], drunk: ['tee', 'hoodie', 'puffer'],
    streamer: ['tee', 'puffer', 'track'], kid: ['hoodie', 'tee'], driver: ['puffer', 'hoodie', 'work'],
  };
  return { outfit: pick(map[kind] || map.regular) };
}
