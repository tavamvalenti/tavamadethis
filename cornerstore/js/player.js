// You: first-person camera, walking, crouching behind the counter, your hands, the bat, the guns, and "press E".
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Player {
  constructor(camera, dom, store, audio) {
    this.camera = camera; this.store = store; this.audio = audio;
    this.controls = new PointerLockControls(camera, dom);
    this.keys = {};
    this.vel = new THREE.Vector3();
    this.eye = 1.66; this.crouch = 0; this.health = 100; this.frozen = false;
    this.stepT = 0; this.bob = 0;
    // weapon: 'none' (bare hands), 'bat', 'pistol', 'shotgun'
    this.weapon = 'none'; this.hasShotgun = false; this.drawT = 0; this.swingT = 0;
    this.ammo = 15; this.mag = 15; this.reserve = 45; this.shells = 6; this.shellMag = 6; this.shellReserve = 0;
    this.reloadT = 0; this.cool = 0; this.recoil = 0;
    this.hurtT = 0;
    camera.position.set(-4.7, this.eye, 3.3);
    camera.rotation.set(0, -Math.PI / 2, 0, 'YXZ');
    this.controls.object.rotation.order = 'YXZ';
    addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    this._viewmodel();
    this.ray = new THREE.Raycaster();
  }

  _viewmodel() {
    const root = this.vm = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.35, metalness: 0.75 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x7a4a32, roughness: 0.6 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.9 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.55 });
    const tape = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const box = (g, w, h, d, m, x, y, z, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); return b; };
    const handArm = (g, x = 0.004, y = -0.055, z = 0.015) => {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin); hand.scale.set(0.9, 1.1, 1.2); hand.position.set(x, y, z); g.add(hand);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.3, 4, 8), sleeve); arm.rotation.x = Math.PI / 2 - 0.2; arm.position.set(x + 0.016, y - 0.035, z + 0.185); g.add(arm);
    };
    // 9mm
    const p = this.vmPistol = new THREE.Group(); root.add(p);
    box(p, 0.032, 0.035, 0.19, dark, 0, 0.02, -0.07); box(p, 0.03, 0.025, 0.15, dark, 0, -0.005, -0.05); box(p, 0.03, 0.09, 0.045, dark, 0, -0.05, 0, -0.2); handArm(p);
    // pump shotgun
    const s = this.vmShot = new THREE.Group(); root.add(s);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 10), dark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.03, -0.3); s.add(barrel);
    const tube = barrel.clone(); tube.scale.set(1, 0.8, 1); tube.position.set(0, 0.0, -0.26); s.add(tube);
    this.pump = box(s, 0.045, 0.04, 0.16, wood, 0, -0.002, -0.3);
    box(s, 0.04, 0.06, 0.2, dark, 0, 0.012, 0.02); box(s, 0.036, 0.07, 0.24, wood, 0, -0.02, 0.2, 0.18); handArm(s, 0.004, -0.045, 0.06);
    // bat
    const b = this.vmBat = new THREE.Group(); root.add(b);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.018, 0.78, 12), wood); shaft.position.y = 0.36; b.add(shaft);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 8), wood); cap.position.y = 0.75; b.add(cap);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 10), tape); grip.position.y = 0.06; b.add(grip);
    handArm(b, 0, 0.03, 0.02);
    // bare hand (only seen during a shove)
    const h = this.vmHand = new THREE.Group(); root.add(h); handArm(h, 0, 0, -0.1);
    for (const g of [p, s, b, h]) g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 }));
    this.flash.position.set(0, 0.02, -0.18); root.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffb060, 0, 6, 2); this.flashLight.position.set(0.17, -0.18, -0.7); this.camera.add(this.flashLight);   // on the camera, not the gun: hiding a light recompiles shaders
    root.position.set(0.17, -0.2, -0.38); root.visible = false;
    this.camera.add(root);
  }

  get position() { return this.camera.position; }
  get inBooth() { return this.store.inBooth(this.camera.position.x, this.camera.position.z); }
  get crouching() { return this.crouch > 0.5; }
  get gunOut() { return this.weapon === 'pistol' || this.weapon === 'shotgun'; }
  get batOut() { return this.weapon === 'bat'; }

  forward(out = new THREE.Vector3()) { return this.camera.getWorldDirection(out); }

  _set(w) { this.weapon = w; this.drawT = 0; this.reloadT = 0; this.audio.play(w === 'none' ? 'drawer-close' : w === 'bat' ? 'footstep' : 'reload', { vol: 0.5 }); }
  // G: 9mm, then the shotgun if you own one, then away
  toggleGun() {
    if (this.reloadT > 0) return;
    this._set(this.weapon === 'pistol' ? (this.hasShotgun ? 'shotgun' : 'none') : this.weapon === 'shotgun' ? 'none' : 'pistol');
    return this.gunOut;
  }
  toggleBat() { this._set(this.weapon === 'bat' ? 'none' : 'bat'); return this.batOut; }
  holster() { if (this.weapon !== 'none') this._set('none'); }

  reload() {
    if (this.reloadT > 0) return;
    if (this.weapon === 'pistol' && this.ammo < this.mag && this.reserve > 0) { this.reloadT = 1.4; this.audio.play('reload'); }
    if (this.weapon === 'shotgun' && this.shells < this.shellMag && this.shellReserve > 0) { this.reloadT = 2.2; this.audio.play('reload'); setTimeout(() => this.audio.play('reload', { rate: 0.8 }), 900); }
  }

  // returns the weapon fired ('pistol' | 'shotgun') or false
  tryShoot() {
    if (!this.gunOut || this.cool > 0 || this.reloadT > 0 || this.drawT < 0.9) return false;
    const sg = this.weapon === 'shotgun';
    if ((sg ? this.shells : this.ammo) <= 0) { this.audio.play('dry-fire'); this.cool = 0.3; return false; }
    if (sg) { this.shells--; this.cool = 0.95; this.recoil = 1.8; setTimeout(() => this.audio.play('reload', { vol: 0.7, rate: 0.85 }), 320); }
    else { this.ammo--; this.cool = 0.22; this.recoil = 1; }
    this.flash.material.opacity = 1; this.flashLight.intensity = sg ? 60 : 30;
    this.audio.play('gunshot', { verb: true, rate: sg ? 0.7 : 1, vol: sg ? 1.3 : 1 }); setTimeout(() => this.audio.play('casing'), sg ? 420 : 50);
    return this.weapon;
  }

  // a shove (bare hands) or a swing (bat); returns 'none' | 'bat' or false
  tryMelee() {
    if (this.gunOut || this.cool > 0 || this.frozen) return false;
    this.cool = this.weapon === 'bat' ? 0.75 : 0.5; this.swingT = 1;
    this.audio.play('sigh', { vol: 0.5, rate: 1.6 });
    return this.weapon;
  }

  hurt(dmg) {
    this.health = Math.max(0, this.health - dmg); this.hurtT = 1;
    this.audio.play('grunt', { rate: 0.9 });
  }

  update(dt) {
    const c = this.camera;
    const want = this.keys.KeyC || this.keys.ControlLeft ? 1 : 0;
    this.crouch += (want - this.crouch) * Math.min(1, dt * 10);
    const speed = this.frozen ? 0 : (this.keys.ShiftLeft && !want ? 4.6 : want ? 1.4 : 2.6);
    const f = new THREE.Vector3(), r = new THREE.Vector3();
    c.getWorldDirection(f); f.y = 0; f.normalize(); r.crossVectors(f, c.up).normalize();
    const mv = new THREE.Vector3();
    if (!this.frozen) {
      if (this.keys.KeyW) mv.add(f); if (this.keys.KeyS) mv.sub(f);
      if (this.keys.KeyD) mv.add(r); if (this.keys.KeyA) mv.sub(r);
    }
    if (mv.lengthSq() > 0) mv.normalize().multiplyScalar(speed);
    this.vel.lerp(mv, Math.min(1, dt * 12));
    const p = new THREE.Vector3(c.position.x + this.vel.x * dt, 0, c.position.z + this.vel.z * dt);
    this.store.collide(p, 0.3); this.store.collide(p, 0.3);
    c.position.x = p.x; c.position.z = p.z;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * sp * 3.2;
    c.position.y = this.eye - this.crouch * 0.72 + Math.sin(this.bob * 2) * 0.025 * Math.min(1, sp / 2);
    this.stepT -= dt * sp;
    if (sp > 0.5 && this.stepT < 0) { this.stepT = 1.1; this.audio.play('footstep', { vol: 0.5 }); }
    // what's in your hands
    const w = this.weapon;
    this.drawT += ((w !== 'none' ? 1 : 0) - this.drawT) * Math.min(1, dt * 8);
    this.swingT = Math.max(0, this.swingT - dt * (w === 'bat' ? 2.6 : 4));
    this.vmPistol.visible = w === 'pistol'; this.vmShot.visible = w === 'shotgun'; this.vmBat.visible = w === 'bat';
    this.vmHand.visible = w === 'none' && this.swingT > 0;
    this.vm.visible = (w !== 'none' && this.drawT > 0.02) || this.vmHand.visible;
    this.cool -= dt; this.recoil = Math.max(0, this.recoil - dt * 8);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        if (w === 'shotgun') { const n = Math.min(this.shellMag - this.shells, this.shellReserve); this.shells += n; this.shellReserve -= n; }
        else { const n = Math.min(this.mag - this.ammo, this.reserve); this.ammo += n; this.reserve -= n; }
      }
    }
    const reloadDip = this.reloadT > 0 ? Math.sin(Math.min(1, (1.4 - Math.min(1.4, this.reloadT)) / 1.4) * Math.PI) * 0.15 + 0.05 : 0;
    const sw = Math.sin((1 - this.swingT) * Math.PI) * (this.swingT > 0 ? 1 : 0);   // 0 -> 1 -> 0 over the swing
    if (w === 'bat') {
      this.vm.position.set(0.24 - sw * 0.3, -0.42 - (1 - this.drawT) * 0.4 + Math.sin(this.bob) * 0.008, -0.42 - sw * 0.18);
      this.vm.rotation.set(-0.25 - sw * 1.2, 0, -0.35 + sw * 1.5);
    } else if (w === 'none') {
      this.vm.position.set(0.12 - sw * 0.06, -0.22 + sw * 0.06, -0.2 - sw * 0.3); this.vm.rotation.set(0.1, 0, 0);
    } else {
      this.vm.position.set(0.17, -0.2 - (1 - this.drawT) * 0.3 - reloadDip + Math.sin(this.bob) * 0.006, -0.38 + this.recoil * 0.05);
      this.vm.rotation.set(this.recoil * 0.25 + reloadDip * 2, 0, 0);
    }
    this.pump.position.z = -0.3 + (w === 'shotgun' && this.cool > 0.35 && this.cool < 0.7 ? 0.09 : 0);
    this.flash.position.z = w === 'shotgun' ? -0.64 : -0.18;
    this.flash.material.opacity *= Math.pow(0.0001, dt); this.flashLight.intensity *= Math.pow(0.00001, dt);
    if (this.recoil > 0.9) c.rotation.x += w === 'shotgun' ? 0.02 : 0.012;
    this.hurtT = Math.max(0, this.hurtT - dt * 0.8);
    if (this.health > 0 && this.health < 100) this.health = Math.min(100, this.health + dt * 1.5);
  }

  // the nearest interactable you are looking at
  lookTarget() {
    const c = this.camera, dir = this.forward(new THREE.Vector3());
    let best = null, bestScore = Infinity;
    for (const it of this.store.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const to = it.pos.clone().sub(c.position), d = to.length();
      if (d > (it.reach || 2.3)) continue;
      const along = to.dot(dir); if (along < 0) continue;
      const off = to.clone().sub(dir.clone().multiplyScalar(along)).length();
      if (off > it.r) continue;
      const score = off + d * 0.2;
      if (score < bestScore) { bestScore = score; best = it; }
    }
    return best;
  }
}
