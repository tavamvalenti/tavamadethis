// You: first-person camera, walking, crouching behind the counter, the gun, and "press E" interactions.
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
    this.gunOut = false; this.gunT = 0; this.ammo = 15; this.mag = 15; this.reserve = 45; this.reloadT = 0; this.cool = 0; this.recoil = 0;
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
    const g = this.vm = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.35, metalness: 0.75 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x7a4a32, roughness: 0.6 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.9 });
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.035, 0.19), dark); slide.position.set(0, 0.02, -0.07); g.add(slide);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.15), dark); frame.position.set(0, -0.005, -0.05); g.add(frame);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.045), dark); grip.position.set(0, -0.05, 0.0); grip.rotation.x = -0.2; g.add(grip);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin); hand.scale.set(0.9, 1.1, 1.2); hand.position.set(0.004, -0.055, 0.015); g.add(hand);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.3, 4, 8), sleeve); arm.rotation.x = Math.PI / 2 - 0.2; arm.position.set(0.02, -0.09, 0.2); g.add(arm);
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 }));
    this.flash.position.set(0, 0.02, -0.18); g.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffb060, 0, 6, 2); this.flashLight.position.set(0, 0.02, -0.3); g.add(this.flashLight);
    g.position.set(0.17, -0.2, -0.38); g.visible = false;
    this.camera.add(g);
  }

  get position() { return this.camera.position; }
  get inBooth() { return this.store.inBooth(this.camera.position.x, this.camera.position.z); }
  get crouching() { return this.crouch > 0.5; }

  forward(out = new THREE.Vector3()) { return this.camera.getWorldDirection(out); }

  toggleGun() {
    if (this.reloadT > 0) return;
    this.gunOut = !this.gunOut; this.audio.play(this.gunOut ? 'reload' : 'drawer-close', { vol: 0.5 });
    return this.gunOut;
  }

  reload() {
    if (!this.gunOut || this.reloadT > 0 || this.ammo === this.mag || this.reserve <= 0) return;
    this.reloadT = 1.4; this.audio.play('reload');
  }

  // returns true if a shot was fired
  tryShoot() {
    if (!this.gunOut || this.cool > 0 || this.reloadT > 0 || this.gunT < 0.9) return false;
    if (this.ammo <= 0) { this.audio.play('dry-fire'); this.cool = 0.3; return false; }
    this.ammo--; this.cool = 0.22; this.recoil = 1;
    this.flash.material.opacity = 1; this.flashLight.intensity = 30;
    this.audio.play('gunshot', { verb: true }); setTimeout(() => this.audio.play('casing'), 50);
    return true;
  }

  hurt(dmg) {
    this.health = Math.max(0, this.health - dmg); this.hurtT = 1;
    this.audio.play('grunt', { rate: 0.9 });
  }

  update(dt) {
    const c = this.camera;
    const want = this.keys.KeyC || this.keys.ControlLeft ? 1 : 0;
    this.crouch += (want - this.crouch) * Math.min(1, dt * 10);
    const speed = this.frozen ? 0 : (this.keys.ShiftLeft && !want ? 4.2 : want ? 1.4 : 2.6);
    const f = new THREE.Vector3(), r = new THREE.Vector3();
    c.getWorldDirection(f); f.y = 0; f.normalize(); r.crossVectors(f, c.up).normalize();
    const mv = new THREE.Vector3();
    if (!this.frozen && this.controls.isLocked) {
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
    // gun
    this.gunT += ((this.gunOut ? 1 : 0) - this.gunT) * Math.min(1, dt * 8);
    this.vm.visible = this.gunT > 0.02;
    this.cool -= dt; this.recoil = Math.max(0, this.recoil - dt * 8);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { const n = Math.min(this.mag - this.ammo, this.reserve); this.ammo += n; this.reserve -= n; } }
    const reloadDip = this.reloadT > 0 ? Math.sin((1.4 - this.reloadT) / 1.4 * Math.PI) * 0.15 : 0;
    this.vm.position.set(0.17, -0.2 - (1 - this.gunT) * 0.3 - reloadDip + Math.sin(this.bob) * 0.006, -0.38 + this.recoil * 0.05);
    this.vm.rotation.set(this.recoil * 0.25 + reloadDip * 2, 0, 0);
    this.flash.material.opacity *= Math.pow(0.0001, dt); this.flashLight.intensity *= Math.pow(0.00001, dt);
    if (this.recoil > 0.9) c.rotation.x += 0.012;
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
