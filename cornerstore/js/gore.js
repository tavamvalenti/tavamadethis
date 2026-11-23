// Blood and wounds. Dark, wet arterial red rather than cartoon red.
// Sprays fly in the shot direction and leave spatter where they land; wounds stick to the body part that
// was hit and spread; a pool grows under anyone who goes down. Settings: full / reduced / off.
import * as THREE from 'three';
import { bloodSplat } from './textures.js';

const CAP = 600, DECALS = 260;
export class Gore {
  constructor(scene, store) {
    this.scene = scene; this.store = store; this.level = 'full';
    const geo = new THREE.SphereGeometry(1, 6, 4);
    this.dropMat = new THREE.MeshStandardMaterial({ color: 0x5a0306, roughness: 0.2, metalness: 0.1, emissive: 0x120000 });
    this.drops = new THREE.InstancedMesh(geo, this.dropMat, CAP); this.drops.count = 0; this.drops.frustumCulled = false;
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.drops);
    this.p = []; this.decals = []; this.pools = []; this.wounds = [];
    this.decalMats = [0, 1, 2, 3].map(i => new THREE.MeshStandardMaterial({ color: 0x3d0204, roughness: 0.18, metalness: 0.05, alphaMap: bloodSplat(i), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.poolMat = new THREE.MeshStandardMaterial({ color: 0x2e0103, roughness: 0.06, metalness: 0.2, alphaMap: bloodSplat(9), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    this.woundMat = new THREE.MeshStandardMaterial({ color: 0x3a0002, roughness: 0.25, emissive: 0x0a0000 });
    this.stainMat = new THREE.MeshStandardMaterial({ color: 0x2a0002, roughness: 0.4, transparent: true, opacity: 0.85 });
    this.ray = new THREE.Raycaster();
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._v = new THREE.Vector3();
  }
  get k() { return this.level === 'off' ? 0 : this.level === 'reduced' ? 0.35 : 1; }

  // a hit: spray out of the exit side, mist at the entry, and spatter on whatever is behind
  hit(point, dir, power = 1) {
    const k = this.k; if (!k) return;
    const n = Math.round((26 + power * 30) * k);
    for (let i = 0; i < n; i++) {
      const v = dir.clone().multiplyScalar(2 + Math.random() * 4 * power);
      v.x += (Math.random() - 0.5) * 2.2; v.y += Math.random() * 1.8 - 0.3; v.z += (Math.random() - 0.5) * 2.2;
      this._add(point, v, 0.006 + Math.random() * 0.016);
    }
    for (let i = 0; i < n / 3; i++) { const v = dir.clone().multiplyScalar(-1 - Math.random()); v.y += Math.random(); this._add(point, v, 0.004 + Math.random() * 0.006); }
    // spatter on a wall/shelf/glass behind the victim
    this.ray.set(point, dir); this.ray.far = 3.5;
    const hit = this.ray.intersectObjects(this.store.surfaces, false)[0];
    if (hit) this.decal(hit.point, hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : dir.clone().negate(), 0.25 + Math.random() * 0.35 * power);
  }

  _add(pos, vel, size) {
    if (this.p.length >= CAP) this.p.shift();
    this.p.push({ pos: pos.clone(), vel, size, life: 3 });
  }

  decal(point, normal, size) {
    const k = this.k; if (!k) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.decalMats[Math.floor(Math.random() * 4)]);
    m.position.copy(point).addScaledVector(normal, 0.004);
    m.lookAt(point.clone().add(normal)); m.rotateZ(Math.random() * Math.PI * 2);
    this.scene.add(m); this.decals.push(m);
    if (this.decals.length > DECALS) { const old = this.decals.shift(); this.scene.remove(old); old.geometry.dispose(); }
  }

  // a wound on the hit body part, in that part's local space so it moves with the body
  wound(partMesh, worldPoint) {
    const k = this.k; if (!k) return;
    const local = partMesh.worldToLocal(worldPoint.clone());
    const w = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), this.woundMat);
    w.position.copy(local); w.scale.setScalar(0.018); partMesh.add(w);
    const stain = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), this.stainMat);
    stain.position.copy(local).multiplyScalar(0.97); stain.scale.setScalar(0.01); partMesh.add(stain);
    this.wounds.push({ stain, grow: 0, max: 0.05 + Math.random() * 0.04, part: partMesh, local: local.clone(), dripT: 0 });
  }

  pool(person) {
    const k = this.k; if (!k) return;
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), this.poolMat);
    m.rotation.x = -Math.PI / 2;
    const p = person.spine.getWorldPosition(new THREE.Vector3());
    m.position.set(p.x, 0.006 + this.pools.length * 0.0004, p.z); m.scale.setScalar(0.05);
    this.scene.add(m); this.pools.push({ m, r: 0.05, max: (0.7 + Math.random() * 0.5) * (this.level === 'reduced' ? 0.5 : 1), person });
  }

  clear() {
    for (const d of this.decals) this.scene.remove(d);
    for (const p of this.pools) this.scene.remove(p.m);
    this.decals = []; this.pools = []; this.p = [];
  }

  update(dt) {
    let i = 0;
    for (const d of this.p) {
      d.vel.y -= 9.8 * dt; d.pos.addScaledVector(d.vel, dt); d.life -= dt;
      if (d.pos.y < 0.005) { if (Math.random() < 0.35) this.decal(new THREE.Vector3(d.pos.x, 0.002, d.pos.z), new THREE.Vector3(0, 1, 0), 0.04 + d.size * 6); d.life = 0; }
    }
    this.p = this.p.filter(d => d.life > 0);
    for (const d of this.p) {
      this._s.setScalar(d.size); this._m.compose(d.pos, this._q, this._s); this.drops.setMatrixAt(i++, this._m);
    }
    this.drops.count = i; this.drops.instanceMatrix.needsUpdate = true;
    for (const w of this.wounds) {
      if (w.grow < 1) { w.grow = Math.min(1, w.grow + dt * 0.12); w.stain.scale.setScalar(0.01 + w.max * w.grow); }
      w.dripT -= dt;
      if (w.dripT < 0 && w.grow < 1 && this.k) {
        w.dripT = 0.25 + Math.random() * 0.6;
        const wp = w.part.localToWorld(w.local.clone());
        this._add(wp, new THREE.Vector3((Math.random() - 0.5) * 0.2, -0.2, (Math.random() - 0.5) * 0.2), 0.006);
      }
    }
    for (const p of this.pools) if (p.r < p.max) { p.r = Math.min(p.max, p.r + dt * 0.05 * (1.2 - p.r / p.max)); p.m.scale.setScalar(p.r); }
  }
}
