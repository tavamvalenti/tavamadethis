// Guns, knives and getting hurt. Your shots are raycasts from the camera; NPC shots roll against cover.
import * as THREE from 'three';
import { spots } from './store.js';

export class Combat {
  constructor(game) {
    this.game = game; this.ray = new THREE.Raycaster();
    this.holeMat = new THREE.MeshBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.crackMat = new THREE.MeshBasicMaterial({ color: 0xe8f2f4, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    this.marks = [];
  }

  playerShoot() {
    const g = this.game, cam = g.camera;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    dir.x += (Math.random() - 0.5) * 0.008; dir.y += (Math.random() - 0.5) * 0.008; dir.normalize();
    this.ray.set(cam.position, dir); this.ray.far = 40;
    const bodies = g.npcs.filter(n => !n.gone).flatMap(n => n.body.parts);
    const hits = this.ray.intersectObjects([...bodies, ...g.store.surfaces], false);
    // bullets punch through the plexi but crack it
    const pHit = this.ray.intersectObjects(g.store.plexiPanes, false)[0];
    if (pHit && (!hits[0] || pHit.distance < hits[0].distance)) this.crack(pHit.point, pHit.object);
    const h = hits[0];
    g.alertAll(cam.position, 'gunshot');
    g.world.heat++;
    if (!h) return;
    const npc = h.object.userData.person ? g.npcs.find(n => n.body === h.object.userData.person) : null;
    if (npc) {
      const part = h.object.userData.part;
      const wasAlive = npc.alive;
      g.gore.hit(h.point, dir, part === 'head' ? 1.6 : 1);
      g.gore.wound(h.object, h.point);
      g.audio.play('blood-splat', { pos: h.point });
      npc.hurt(34, part, dir);
      if (wasAlive) g.onPlayerHit(npc, !npc.alive);
    } else {
      this.hole(h.point, h.face.normal.clone().transformDirection(h.object.matrixWorld));
      if (h.object.material === g.store.m.glass || h.object.material?.transparent) g.audio.play('glass-break', { pos: h.point });
    }
  }

  hole(point, normal) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.012 + Math.random() * 0.01, 8), this.holeMat);
    m.position.copy(point).addScaledVector(normal, 0.003); m.lookAt(point.clone().add(normal));
    this.game.scene.add(m); this.marks.push(m);
    if (this.marks.length > 120) this.game.scene.remove(this.marks.shift());
  }

  crack(point, pane) {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const len = 0.05 + Math.random() * 0.14;
      const l = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.004), this.crackMat);
      l.position.x = len / 2; const piv = new THREE.Group(); piv.rotation.z = Math.random() * Math.PI * 2; piv.add(l); g.add(piv);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.02, 10), this.crackMat); g.add(ring);
    g.position.copy(point); g.quaternion.copy(pane.getWorldQuaternion(new THREE.Quaternion()));
    this.game.scene.add(g); this.marks.push(g);
    this.game.audio.play('glass-break', { pos: point, vol: 0.4 });
  }

  // NPC on the attack: mode 'gun' (shoots from where they stand) or 'knife' (comes for you)
  hostileUpdate(n, dt) {
    const g = this.game, p = g.player, body = n.body;
    if (!n.alive) return;
    const me = n.pos, you = p.position;
    n.faceTarget = you; body.lookAt(you);
    const d = Math.hypot(me.x - you.x, me.z - you.z);
    if (n.hostile === 'gun') {
      body.setPose('aim');
      n.fireT -= dt;
      if (n.fireT < 0) {
        n.fireT = 0.9 + Math.random() * 1.1;
        this.npcShoot(n);
      }
      if (n.health < 40 || (g.world.heat > 0 && n.fleeAfter && n.stateT < 0)) { n.hostile = false; n.body.hold(null); n.leave({ run: true }); }
    } else if (n.hostile === 'knife') {
      // can't get through a locked booth door: bang on the glass and threaten
      const inBooth = p.inBooth;
      if (inBooth && !g.store.boothDoorOpen) {
        if (n.pos.distanceTo(spots.boothOut) > 0.4 && !n.route.length) n.goTo(spots.boothOut);
        if (!n.route.length) {
          body.setPose('bang'); n.faceTarget = new THREE.Vector3(-3.9, 1, 2.2);
          n.bangT = (n.bangT || 0) - dt;
          if (n.bangT < 0) { n.bangT = 0.5; g.audio.play('punch', { pos: n.pos, vol: 0.6 }); }
          n.giveUp = (n.giveUp || 0) + dt;
          if (n.giveUp > 16) { n.say('Imma catch you outside, watch!'); n.hostile = false; n.leave({ run: true }); }
        }
        return;
      }
      n.repathT = (n.repathT || 0) - dt;
      if (d > 1.0) {
        body.setPose('knifeOut');
        if (n.repathT < 0) { n.repathT = 0.7; n.goTo(new THREE.Vector3(you.x, 0, you.z), null, { run: true }); }
      } else {
        n.route = []; body.setPose('stab');
        n.stabT = (n.stabT || 0.4) - dt;
        if (n.stabT < 0) {
          n.stabT = 1.0 + Math.random() * 0.4;
          if (Math.random() < 0.7) {
            p.hurt(18 + Math.random() * 10); g.audio.play('punch', { vol: 0.7 });
            const camDir = g.camera.getWorldDirection(new THREE.Vector3()).negate();
            g.gore.hit(g.camera.position.clone().add(new THREE.Vector3(0, -0.35, 0)).addScaledVector(camDir, -0.3), camDir, 0.5);
          }
        }
      }
      if (n.health < 50) { n.hostile = false; n.body.hold(null); n.leave({ run: true }); }
    }
  }

  npcShoot(n) {
    const g = this.game, p = g.player;
    g.audio.play('gunshot', { pos: n.pos, verb: true });
    g.flashAt(n.body.arm.R.hand.getWorldPosition(new THREE.Vector3()));
    g.alertAll(n.pos, 'gunshot', n);
    g.world.heat++;
    // cover: crouching behind the counter in the booth makes you hard to hit; the plexi eats some rounds
    let chance = 0.38;
    if (p.inBooth) chance *= 0.65;
    if (p.inBooth && p.crouching) chance *= 0.15;
    else if (p.crouching) chance *= 0.6;
    const d = n.pos.distanceTo(p.position); chance *= Math.max(0.4, 1 - d / 18);
    if (p.inBooth) {
      // a round that hits the plexi on the way
      const from = n.body.worldHead, to = p.position.clone();
      this.ray.set(from, to.clone().sub(from).normalize()); this.ray.far = from.distanceTo(to);
      const ph = this.ray.intersectObjects(g.store.plexiPanes, false)[0];
      if (ph) this.crack(ph.point, ph.object);
    }
    if (Math.random() < chance) {
      p.hurt(20 + Math.random() * 18);
      const dir = p.position.clone().sub(n.pos).setY(0).normalize();
      g.gore.hit(p.position.clone().add(new THREE.Vector3(0, -0.4, 0)), dir, 0.6);
    } else {
      // miss: the bullet hits something behind you
      const from = n.body.worldHead, aim = p.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.5));
      this.ray.set(from, aim.sub(from).normalize()); this.ray.far = 30;
      const h = this.ray.intersectObjects(g.store.surfaces, false)[0];
      if (h) this.hole(h.point, h.face.normal.clone().transformDirection(h.object.matrixWorld));
    }
  }
}
