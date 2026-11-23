// One NPC: a Person body plus a small brain (where to go, what to do next, how they feel).
import * as THREE from 'three';
import { Person } from './people.js';
import { nav, spots, browsePoints } from './store.js';

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
let nextId = 1;

function nearestNode(p, allowBooth) {
  let best = null, bd = Infinity;
  for (const [k, v] of Object.entries(nav.nodes)) {
    if (!allowBooth && (k === 'boothIn' || k === 'behind')) continue;
    const d = dist2(p, v); if (d < bd) { bd = d; best = k; }
  }
  return best;
}
function path(from, to, boothOpen) {
  // Dijkstra over the tiny nav graph
  const dist = {}, prev = {}, q = new Set(Object.keys(nav.nodes));
  for (const k of q) dist[k] = Infinity; dist[from] = 0;
  while (q.size) {
    let u = null; for (const k of q) if (u === null || dist[k] < dist[u]) u = k;
    q.delete(u); if (u === to || dist[u] === Infinity) break;
    for (const [a, b] of nav.edges) {
      const v = a === u ? b : b === u ? a : null; if (!v || !q.has(v)) continue;
      if (!boothOpen && ((u === 'boothOut' && v === 'boothIn') || (u === 'boothIn' && v === 'boothOut'))) continue;
      const alt = dist[u] + Math.sqrt(dist2(nav.nodes[u], nav.nodes[v]));
      if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
    }
  }
  if (dist[to] === Infinity) return null;
  const out = []; for (let k = to; k; k = prev[k]) out.unshift(k);
  return out.map(k => nav.nodes[k].clone());
}

export class NPC {
  constructor(game, spec) {
    this.game = game; this.id = nextId++;
    this.spec = spec;
    this.name = spec.name || 'Customer';
    this.kind = spec.kind || 'regular';
    this.body = new Person({ ...(spec.look || {}), drunk: spec.drunk, swagger: spec.swagger, jitter: spec.jitter, ...(spec.height ? { height: spec.height } : {}), ...(spec.build ? { build: spec.build } : {}) });
    this.root = this.body.root;
    this.root.position.copy(spots.outside).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, Math.random()));
    game.scene.add(this.root);
    this.health = spec.health ?? 100;
    this.mood = spec.mood ?? 0;          // -5 furious .. 5 delighted
    this.wild = spec.wild ?? 0;          // >0: police will want this person
    this.state = 'enter'; this.stateT = 0;
    this.route = []; this.target = null; this.onArrive = null;
    this.speedMax = spec.speed ?? (1.45 + Math.random() * 0.4) * (spec.drunk ? 0.65 : 1) * (spec.swagger ? 0.9 : 1);
    this.vel = 0; this.nerve = spec.nerve ?? ({ tourist: 0.1, church: 0.45, nurse: 0.3, kid: 0.25, regular: 0.35, worker: 0.45, driver: 0.4, streamer: 0.3, drunk: 0.6, unhoused: 0.6, yn: 0.72, robber: 0.85, cop: 1 }[this.kind] ?? 0.4) + (Math.random() - 0.5) * 0.2;
    this.pushed = 0; this.greeted = false; this.ruckus = null; this.poseHold = 0;
    this.armed = spec.armed ?? (this.kind === 'yn' && Math.random() < 0.2);
    this.browseLeft = spec.browse ?? (1 + Math.floor(Math.random() * 3));
    this.encounter = spec.encounter || null;   // encounter to run at the counter
    this.hostile = false; this.fireT = 2; this.barkT = 4 + Math.random() * 8;
    this.yaw = 0; this.waitT = 0; this.alive = true; this.gone = false;
    if (spec.hold) this.body.hold(spec.hold);
    if (spec.at) {   // already standing somewhere (the clerk, a guard, police outside)
      this.root.position.copy(spec.at); this.state = 'idle';
      if (spec.hunter) setTimeout(() => { if (this.alive && !this.gone) { game.makeHostile(this, 'gun'); this.stateT = 1e9; } }, 0);
    } else this.goTo(spots.doorIn, () => this.afterEnter());
  }

  get pos() { return this.root.position; }
  get busy() { return this.state === 'talking'; }

  goTo(point, then, { run = false } = {}) {
    const p = this.pos;
    const boothOpen = this.game.store.boothDoorOpen;
    const goal = point.clone ? point.clone() : new THREE.Vector3(point.x, 0, point.z);
    const inside = p.z < 6.1;
    let r = [];
    if (!inside) r.push(new THREE.Vector3(4, 0, 6.9), spots.doorIn.clone());
    const start = nearestNode(inside ? p : spots.doorIn, this.game.store.inBooth(p.x, p.z));
    const end = nearestNode(goal, this.game.store.inBooth(goal.x, goal.z) && boothOpen);
    const pth = path(start, end, boothOpen);
    if (pth) r.push(...pth);
    if (goal.z > 6.1) r.push(new THREE.Vector3(4, 0, 6.9));   // out through the door, not the window
    r.push(goal);
    // drop route points that are behind us
    if (r.length > 1 && inside && dist2(p, r[1]) < dist2(r[0], r[1])) r.shift();
    this.route = r; this.onArrive = then; this.run = run;
    if (goal.z > 6.1) this.game.store.doorNudge();
  }

  afterEnter() {
    this.game.audio.play('door-chime');
    if (this.spec.onEnter) { this.spec.onEnter(this); if (this.state !== 'enter') return; }
    if (this.spec.hunter) { this.game.makeHostile(this, 'gun'); this.stateT = 1e9; return; }
    if (this.spec.companionOf) return this.toCompanion();
    if (this.spec.cop) return this.game.copArrived(this);
    if (this.spec.direct || this.browseLeft <= 0) return this.toCounter();
    this.browse();
  }
  browse() {
    this.state = 'browse';
    const pts = browsePoints.filter(b => !this.game.npcs.some(n => n !== this && n.target === b));
    const b = pts[Math.floor(Math.random() * pts.length)] || browsePoints[0];
    this.target = b;
    this.goTo(b.p, () => { this.state = 'browsing'; this.stateT = 4 + Math.random() * 7; this.body.lookAt(b.look); if (b.kind === 'fridge') this.game.openFridge(b.p.x); });
  }
  toCompanion() {
    const k = this.spec.companionIndex || 0;
    const spot = new THREE.Vector3(-1.6 + k * 0.7, 0, 2.4 + k * 0.9);
    this.state = 'companionWalk';
    this.goTo(spot, () => { if (this.state === 'companionWalk') this.state = 'companion'; });
  }
  toCounter() {
    this.target = null; this.body.lookAt(null);
    if (this.encounter?.here) { this.state = 'waitHere'; this.game.pendingHere.push(this); return; }
    if (!this.encounter && !this.spec.leaveAfterBrowse) this.encounter = this.game.director.makeCustomer(this);
    if (!this.encounter) return this.leave();
    this.state = 'queue';
    this.game.director.joinQueue(this);
  }
  leave({ run = false, then = null } = {}) {
    if (!this.alive) return;
    this.state = run ? 'flee' : 'leave'; this.target = null; this.body.lookAt(null);
    this.game.director.leaveQueue(this);
    this.goTo(spots.outside.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, 1.5)), () => { this.game.heist?.onExit(this); this.despawn(); then?.(); }, { run });

  }
  // shoved or hit: pushed back and staggered for a moment
  knock(dir, dist) {
    const p = this.pos.clone(); p.x += dir.x * dist; p.z += dir.z * dist; this.game.store.collide(p, 0.25);
    this.pos.x = p.x; this.pos.z = p.z; this.stun = 0.7; this.poseHold = 0; this.body.setPose('hurt'); this.poseHold = 0.8;
  }
  despawn() { this.gone = true; this.game.scene.remove(this.root); }

  hurt(dmg, part, dir) {
    if (!this.alive) return;
    const mult = part === 'head' ? 3.5 : part === 'torso' ? 1 : 0.55;
    this.health -= dmg * mult;
    this.body.hitT = 0.25; this.body.hitDir = 1;
    if (this.health <= 0) { this.kill(dir); return; }
    this.game.audio.play(Math.random() < 0.5 ? 'grunt' : 'scream', { pos: this.pos, rate: this.spec.voice || 1 });
    if (this.state === 'clerk') { const h = this.game.heist; if (h?.cs) h.cs.down = 60; return; }   // the clerk drops behind the counter
    if (!this.hostile || this.health < 45) {
      this.hostile = false; this.body.hold(null); this.body.setPose('hurt');
      this.state = 'flee'; setTimeout(() => this.leave({ run: true }), 300);
    }
  }
  kill(dir) {
    this.alive = false; this.hostile = false; this.state = 'dead';
    const toBody = dir ? new THREE.Vector3(dir.x, 0, dir.z) : new THREE.Vector3(0, 0, 1);
    const facing = new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    this.body.die(toBody.dot(facing) < 0 ? 1 : -1);
    this.body.hold(null);
    this.game.director.leaveQueue(this);
    this.game.audio.play('body-fall', { pos: this.pos });
    setTimeout(() => this.game.gore.pool(this.body), 600);
    this.game.onDeath(this);
  }

  say(text, opts) { this.game.bark(this, text, opts); }

  update(dt) {
    this.stateT -= dt;
    const body = this.body;
    this.poseHold = Math.max(0, this.poseHold - dt);
    const sp = (p) => { if (this.poseHold <= 0) body.setPose(p); };   // a reaction pose holds for a beat before the brain takes over again
    if (this.state === 'dead') { body.speed = 0; body.update(dt); return; }
    // movement along the route
    let speed = 0;
    if (this.stun > 0) this.stun -= dt;
    if (this.route.length && !this.frozen && !(this.stun > 0)) {
      const tgt = this.route[0], p = this.pos;
      const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
      const vmax = this.run ? Math.max(4.4, this.speedMax) : this.speedMax;
      const last = this.route.length === 1;
      // cut corners: move on to the next waypoint a little early so the path curves instead of zig-zagging
      if (d < (last ? 0.1 : 0.45)) { this.route.shift(); if (!this.route.length) { const f = this.onArrive; this.onArrive = null; f?.(); } }
      else {
        const want = last ? Math.min(vmax, 0.4 + d * 2.5) : vmax;
        this.vel += (want - this.vel) * Math.min(1, dt * (this.run ? 7 : 4));
        // slow down while turning hard, like a person does
        let turn = Math.atan2(dx, dz) - this.root.rotation.y; turn = Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)));
        speed = this.vel * (turn > 1.2 ? 0.45 : turn > 0.6 ? 0.75 : 1);
        const fy = this.root.rotation.y, blend = turn > 1.6 ? 0 : 0.35;   // drift along the facing direction a little
        const mx = dx / d * (1 - blend) + Math.sin(fy) * blend, mz = dz / d * (1 - blend) + Math.cos(fy) * blend, ml = Math.hypot(mx, mz) || 1;
        p.x += mx / ml * speed * dt; p.z += mz / ml * speed * dt;
        this.yaw = Math.atan2(dx, dz);
        if (p.z > 5.3 && p.z < 6.8 && Math.abs(p.x - 4) < 0.8) this.game.store.doorNudge();
      }
      // keep a little distance from other people
      for (const o of this.game.npcs) if (o !== this && o.alive && !o.gone) {
        const ox = p.x - o.pos.x, oz = p.z - o.pos.z, od = Math.hypot(ox, oz);
        if (od < 0.45 && od > 0.001) { p.x += ox / od * (0.45 - od) * 0.5; p.z += oz / od * (0.45 - od) * 0.5; }
      }
    } else { this.vel = 0; }
    if (!(this.route.length && !this.frozen) && this.faceTarget) {
      const p = this.pos; this.yaw = Math.atan2(this.faceTarget.x - p.x, this.faceTarget.z - p.z);
    }
    // smooth turn
    let dy = this.yaw - this.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.root.rotation.y += dy * Math.min(1, dt * (this.run ? 9 : 5.5));
    body.speed = speed;
    // brain
    switch (this.state) {
      case 'browsing':
        sp(this.spec.idlePose || 'browse');
        if (this.stateT < 0 && this.troublemaker) { this.troublemaker = false; this.game.director.startRuckus(this); break; }
        if (this.stateT < 0) { this.browseLeft--; if (this.browseLeft > 0) this.browse(); else if (this.spec.leaveAfterBrowse) this.leave(); else this.toCounter(); }
        break;
      case 'queue': case 'atCounter':
        sp(this.spec.idlePose || 'idle');
        if (this.state === 'atCounter') { this.waitT += dt; this.faceTarget = this.game.player.position; body.lookAt(this.game.player.position); }
        break;
      case 'talking':
        this.faceTarget = this.game.player.position; body.lookAt(this.game.player.position);
        break;
      case 'loiter':
        sp(this.spec.loiterPose || 'phone');
        if (this.stateT < 0) this.leave();
        break;
      case 'cower':
        sp('cower'); if (this.stateT < 0) this.leave({ run: true });
        break;
      case 'fight':
        if (this.fightWith && this.fightWith.alive && !this.fightWith.gone) {
          this.faceTarget = this.fightWith.pos; sp(Math.sin(this.stateT * 3 + this.id) > 0 ? 'stab' : 'angry');
          if (Math.random() < dt * 1.6) this.game.audio.play('punch', { pos: this.pos });
        }
        if (this.stateT < 0) { this.fightWith = null; this.wild = Math.max(0, this.wild - 1); this.leave({ run: Math.random() < 0.5 }); }
        break;
      case 'hostile': this.game.combat.hostileUpdate(this, dt); break;
      case 'shooter': sp('aim'); break;
      case 'cop': if (!this.route.length && !this.target) sp('idle'); break;
      case 'escorted': sp('handsUp'); body.lookAt(null); break;
      case 'companion': { const m = this.spec.companionOf; if (!m || !m.alive || m.gone || (!m.encounter && !['talking', 'queue', 'atCounter', 'waitHere', 'enter', 'browsing'].includes(m.state))) { this.game.applyBehavior(this, this._lateAfter || 'leave'); this._lateAfter = null; break; } } sp(this.spec.idlePose || 'idle'); body.lookAt(this.game.player.position); this.faceTarget = this.game.player.position; break;
      case 'watch': sp(body.held ? 'film' : 'idle'); if (this.stateT < 0) { body.hold(null); this.leave(); } break;
      case 'ruckus': if (!this.ruckus) this.leave(); break;
      case 'clerk': case 'guard': break;   // posed by the job (heist.js)
      case 'flee': if (!this.route.length) this.leave({ run: true }); break;
      default:
        if (speed < 0.01 && !['talking'].includes(this.state)) sp(this.spec.idlePose || 'idle');
        else if (speed > 0.01 && !this.hostile) sp('idle');
    }
    // random barks while browsing / waiting
    this.barkT -= dt;
    if (this.barkT < 0 && (this.state === 'browsing' || this.state === 'queue' || this.state === 'loiter')) {
      this.barkT = 10 + Math.random() * 18;
      if (Math.random() < 0.55) { const line = this.game.director.idleBark(this); if (line) this.say(line); }
    }
    body.update(dt);
  }
}
