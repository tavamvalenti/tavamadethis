// The game: holds the store, you, the people, and runs the job (see heist.js for the robbery itself).
import * as THREE from 'three';
import { Store, spots } from './store.js';
import { Player } from './player.js';
import { NPC } from './npc.js';
import { Director } from './director.js';
import { Dialogue } from './dialogue.js';
import { Combat } from './combat.js';
import { Gore } from './gore.js';
import { World } from './economy.js';
import { Social } from './social.js';
import { Heist } from './heist.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const COP_NAMES = ['Officer Kowalski', 'Officer Reyes', 'Officer Brooks', 'Officer Nguyen', 'Officer Daniels', 'Officer McBride'];

export class Game {
  constructor({ renderer, scene, camera, audio }) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.audio = audio;
    this.store = new Store(scene, renderer);
    this.store.onSound = (n) => audio.play(n === 'boothLock' || n === 'boothUnlock' ? 'booth-lock' : n);
    this.store.onVehicle = (v) => audio.play('car-pass', { pos: new THREE.Vector3(0, 0, 14), vol: v.bus ? 1.2 : 0.8 });
    this.store.onBusStop = () => { audio.play('bus-brakes', { pos: new THREE.Vector3(-5, 0, 13) }); setTimeout(() => audio.play('bus-hiss', { pos: new THREE.Vector3(-5, 0, 13) }), 700); };
    this.player = new Player(camera, renderer.domElement, this.store, audio);
    scene.add(camera);
    this.world = new World();
    this.gore = new Gore(scene, this.store);
    this.combat = new Combat(this);
    this.director = new Director(this);
    this.dialogue = new Dialogue(this);
    this.npcs = []; this.pendingHere = []; this.bodies = [];
    this.police = null; this.falseCalls = 0;
    this.subsEl = $('subs'); this.subs = []; this.fovTarget = 72;
    this.social = new Social(this); this.debris = [];
    this.flash = new THREE.PointLight(0xffb060, 0, 7, 2); scene.add(this.flash);
    this.cctv = false; this.paused = true; this.nightOver = false; this.dead = false;
    this.heist = new Heist(this);
    this._listen();
  }

  // ------------------------------------------------------------------ setup
  _listen() {
    addEventListener('keydown', (e) => {
      if (this.paused) return;
      if (e.code === 'KeyE' && !this.social.active) {
        if (this.cctv) return this.setCCTV(false);
        const it = this.player.lookTarget(); if (it) it.use();
      }
      if (e.code === 'Escape' && this.cctv) this.setCCTV(false);
      if (e.code === 'KeyG' && !e.repeat) { const out = this.player.toggleGun(); if (out !== undefined) this.onGunToggle(out); }
      if (e.code === 'KeyB' && !e.repeat) this.player.toggleBat();
      if (e.code === 'KeyR') this.player.reload();
    });
    addEventListener('mousedown', (e) => {
      if (this.paused || e.button !== 0 || !this.player.controls.isLocked || this.cctv) return;
      const shot = this.player.tryShoot();
      if (shot) return this.combat.playerShoot(shot);
      const hit = this.player.tryMelee();
      if (hit !== false) setTimeout(() => this.heist.strike(hit), 130);
    });
  }

  // ------------------------------------------------------------------ people
  spawn(spec) {
    const n = new NPC(this, spec);
    this.npcs.push(n);
    return n;
  }

  spawnEncounter(enc) {
    const roles = Object.entries(enc.cast || { main: { kind: 'regular' } });
    const main = this.spawn({ ...roles[0][1], encounter: enc });
    main.companions = {};
    roles.slice(1).forEach(([role, spec], i) => {
      setTimeout(() => {
        if (main.gone || !main.alive) return;
        const c = this.spawn({ ...spec, companionOf: main, companionIndex: i, direct: true });
        main.companions[role] = c;
      }, 700 + i * 900);
    });
    return main;
  }

  startEncounter(npc) {
    if (this.dialogue.open || this.dead || this.nightOver && !npc.encounter) return;
    const enc = npc.encounter; if (!enc) return;
    npc.state = 'talking';
    this.director.leaveQueue(npc); this.director.queue.unshift(npc);
    const cast = { main: npc, ...(npc.companions || {}) };
    for (const [k, c] of Object.entries(cast)) if (c && (c.gone || !c.alive)) delete cast[k];
    const ctx = this.makeCtx(npc, cast);
    this.dialogue.start(enc, cast, ctx);
  }

  endEncounter(a, how) {
    const main = a.cast.main;
    if (main) main.encounter = null;
    this.director.leaveQueue(main);
    for (const [role, n] of Object.entries(a.cast)) {
      if (!n || !n.alive || n.gone || !n.root) continue;
      const b = role === 'main' ? how : (n._after || (['flee', 'steal', 'hostile'].includes(how) ? how : 'leave'));
      n._after = null;
      if (n.state === 'talking' || n.state === 'companion' || n.state === 'companionWalk') this.applyBehavior(n, b);
      else if (role !== 'main') n._lateAfter = b;   // still walking in: acts on it when they arrive
    }
  }

  applyBehavior(n, how) {
    if (!n.alive || n.gone) return;
    n.body.lookAt(null); n.faceTarget = null;
    switch (how) {
      case 'stay': if (n.state === 'talking') { n.state = 'loiter'; n.stateT = 10; } break;
      case 'browse': n.browseLeft = 1; n.encounter = null; n.spec.leaveAfterBrowse = true; n.browse(); break;
      case 'flee': n.leave({ run: true }); break;
      case 'steal': n.body.hold('bag'); n.leave({ run: true }); n.wild = Math.max(n.wild, 1); break;
      case 'hostile': this.makeHostile(n, n.body.held?.userData.kind === 'knife' ? 'knife' : 'gun'); break;
      case 'loiter': n.state = 'loiter'; n.stateT = 25 + Math.random() * 20; n.spec.loiterPose = n.wild > 1 ? 'angry' : 'phone'; break;
      default: n.leave();
    }
  }

  makeHostile(n, mode) {
    if (!n.alive) return;
    n.hostile = mode; n.state = 'hostile'; n.wild = Math.max(n.wild, 4); n.fireT = 0.6 + Math.random() * 0.6; n.route = [];
    n.body.hold(mode === 'fist' ? null : mode); n.ruckus = null; this.alert(null);
    if (mode === 'gun') n.stateT = 12; // shoots for a while then runs
    n.fleeAfter = true;
    this.panic(n);
    this.audio.setDuck(0.4);
    this.world.note(`${n.name} attacked you`, 'danger');
  }

  // everyone who is not part of the trouble reacts to it
  panic(source) {
    for (const n of this.npcs) {
      if (n === source || n.gone || !n.alive || n.hostile || n.spec.cop || n.state === 'talking' || n.state === 'escorted' || n.state === 'clerk' || n.state === 'guard') continue;
      if (n.ruckus) this.director.endRuckus(n, 'panic');
      if (source?.companions && Object.values(source.companions).includes(n)) continue;
      if (n.spec.companionOf === source) continue;
      if (Math.random() < 0.45) { n.state = 'cower'; n.stateT = 4 + Math.random() * 5; n.route = []; this.director.leaveQueue(n); }
      else { n.leave({ run: true }); }
      if (Math.random() < 0.5) this.audio.play(Math.random() < 0.6 ? 'scream' : 'gasp', { pos: n.pos, rate: n.spec.voice || 1 });
    }
  }

  alertAll(pos, type, source) {
    if (type !== 'gunshot') return;
    // gunfire ends any conversation: robbers turn hostile, everyone else runs
    if (this.dialogue.open && (!source || !this.dialogue.active.cast.main || source !== this.dialogue.active.cast.main)) {
      const main = this.dialogue.active.cast.main;
      const how = main && main.wild >= 3 && main.body.held ? 'hostile' : 'flee';
      this.dialogue.end(how);
    }
    this.panic(source);
    this.director.tension = 1;
  }

  onPlayerHit(npc, killed) {
    this.heist.onHit(npc, killed);
  }

  onDeath(npc) {
    this.world.stats.shot++;
    this.bodies.push(npc);
    if (npc.hostile || npc.wild >= 3) this.director.leaveQueue(npc);
  }

  startFight(a, b) {
    if (!a.alive || !b.alive) return;
    for (const [x, y] of [[a, b], [b, a]]) { x.state = 'fight'; x.stateT = 7 + Math.random() * 4; x.fightWith = y; x.route = []; x.wild = Math.max(x.wild, 2); this.director.leaveQueue(x); }
    a.say('Say it again!'); setTimeout(() => b.alive && b.say('WHAT?!'), 900);
    this.world.note(`${a.name} and ${b.name} fought in the store`);
    // bystanders pull out their phones
    for (const n of this.npcs) if (n !== a && n !== b && n.alive && !n.gone && n.state === 'browsing' && Math.random() < 0.7) { n.state = 'watch'; n.stateT = 9; n.body.hold('phone'); n.faceTarget = a.pos; }
  }

  // one NPC shoots another (a beef that spills into the store)
  shootout(shooter, target) {
    if (!shooter?.alive || !target?.alive) return;
    shooter.body.hold('gun'); shooter.body.setPose('aim'); shooter.faceTarget = target.pos; shooter.state = 'shooter';
    target.leave({ run: true });
    this.panic(shooter);
    this.world.note(`${shooter.name} opened fire on ${target.name} inside the store`, 'danger');
    let shots = 3 + Math.floor(Math.random() * 3);
    const fire = () => {
      if (!shooter.alive || shots-- <= 0) { if (shooter.alive) { shooter.wild = 5; shooter.leave({ run: true }); } return; }
      shooter.faceTarget = target.pos; shooter.body.setPose('aim');
      this.audio.play('gunshot', { pos: shooter.pos, verb: true }); this.flashAt(shooter.body.arm.R.hand.getWorldPosition(new THREE.Vector3()));
      this.world.heat++; this.director.tension = 1;
      if (!this.police && !this.autoCallT) this.autoCallT = 15;
      if (target.alive && Math.random() < 0.5) {
        const parts = target.body.parts.filter(p => p.userData.part !== 'head' || Math.random() < 0.2);
        const part = parts[Math.floor(Math.random() * parts.length)];
        const pt = part.getWorldPosition(new THREE.Vector3());
        const dir = pt.clone().sub(shooter.pos).setY(0).normalize();
        this.gore.hit(pt, dir, 1); this.gore.wound(part, pt);
        target.hurt(45, part.userData.part, dir);
      } else {
        const from = shooter.body.worldHead, to = target.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2));
        this.combat.ray.set(from, to.sub(from).normalize()); this.combat.ray.far = 20;
        const h = this.combat.ray.intersectObjects(this.store.surfaces, false)[0];
        if (h) this.combat.hole(h.point, h.face.normal.clone().transformDirection(h.object.matrixWorld));
      }
      if (Math.random() < 0.15) this.combat.npcShoot(shooter); // a stray towards you
      setTimeout(fire, 380 + Math.random() * 500);
    };
    setTimeout(fire, 500);
  }

  // ------------------------------------------------------------------ the context encounters talk to
  makeCtx(main, cast) {
    const g = this, w = this.world, s = this.store;
    const rid = main.spec.rid;
    const c = {
      world: w, game: g, npc: main, cast, night: w.night,
      get mem() { return rid ? (w.memory[rid] || {}) : {}; },
      get stash() { return Math.round(w.stash); },
      get drawer() { return Math.round(w.drawer); },
      get weed() { return w.weed; },
      get gunOut() { return g.player.gunOut; },
      get inBooth() { return g.player.inBooth; },
      get crouching() { return g.player.crouching; },
      get boothOpen() { return s.boothDoorOpen; },
      remember: (patch) => { if (rid) w.remember(rid, patch); },
      sell: (amount, opts) => { w.sell(amount, opts); g.store.register.showSale('SALE', Number(amount).toFixed(2)); g.registerAnim(); },
      pocket: (n, why) => { w.pocket(n, why); g.audio.play('coins', { vol: 0.5 }); },
      spend: (n) => w.spend(n),
      mood: (n, who = main) => { who.mood += n; },
      respect: (n) => w.addRespect(n),
      note: (t) => w.note(t),
      flag: (k, v) => { w.flags[k] = v; },
      has: (k) => !!w.flags[k],
      bark: (n, t) => n?.say(t),
      after: (n, how) => { if (n) n._after = how; },
      loss: (n) => { w.debt += Math.round(n); },
      sellWeed: (price) => { if (w.weed <= 0) { main.say('You out?? Man.'); return false; } w.weed--; w.pocket(price); s.stash.out = true; g.stashT = 30; g.audio.play('drawer-open', { vol: 0.5 }); g.turntable(); return true; },
      addWeed: (n) => { w.weed += n; },
      confiscate: () => { w.weed = 0; w.debt += 250; s.stash.out = false; w.note('Police took the stash. The owner was fined $250 and passed it to you.', 'danger'); g.hint('Stash confiscated. The owner\'s $250 fine was added to your debt.', 6); },
      robDrawer: (frac = 1) => { const t = w.robbedDrawer(frac); g.registerAnim(); w.note(`${main.name} took ${fmt(t)} from the drawer`, 'danger'); return t; },
      robPockets: () => { const t = w.robbedPockets(); w.note(`${main.name} took ${fmt(t)} out of your pockets`, 'danger'); return t; },
      turntable: () => g.turntable(),
      police: (why) => g.callPolice(why),
      wild: (n, k) => { n.wild = Math.max(0, n.wild + k); },
      hostile: (n, mode) => g.makeHostile(n, mode),
      fight: (a, b) => g.startFight(a, b),
      shootout: (a, b) => g.shootout(a, b),
      drawGun: () => { if (!g.player.gunOut) { g.player.toggleGun(); g.onGunToggle(true); } },
      holster: () => { if (g.player.gunOut) { g.player.toggleGun(); g.onGunToggle(false); } },
      ammo: (n) => { g.player.reserve += n; },
      openBooth: () => s.setBoothDoor(true),
      choreDone: (id) => g.choreDone(id),
      fence: (item, value) => { w.fenced.push({ item, value }); },
      sellFenced: (price) => { const f = w.fenced.shift(); if (f) { w.pocket(price); w.note(`Sold the ${f.item} for ${fmt(price)}`); } },
      bet: (who, amt) => { w.bets.push({ who, amt }); },
      knock: (n) => { g.audio.play('glass-break', { pos: n.pos, vol: 0.5 }); g.audio.play('body-fall', { pos: n.pos, vol: 0.4 }); w.debt += 15; w.note(`${n.name} knocked stuff off the shelves`); },
      throwBottle: (n) => { g.audio.play('glass-break', { pos: n.pos }); const p = new THREE.Vector3(-3.0, 1.6, n.pos.z); if (s.plexiPanes[0]) g.combat.crack(p, s.plexiPanes[0]); },
      panic: (n) => g.panic(n),
      duck: (force) => g.hint('Hold C to crouch behind the counter. G draws your gun.', 4),
      audio: (name) => g.audio.play(name),
      later: (sec, fn) => setTimeout(fn, sec * 1000),
      rand: Math.random, chance: (p) => Math.random() < p,
    };
    return c;
  }

  registerAnim() { this.store.register.hold = 0.9; this.audio.play('scanner-beep'); setTimeout(() => this.audio.play('drawer-open', { vol: 0.6 }), 180); setTimeout(() => this.audio.play('coins', { vol: 0.5 }), 400); }
  turntable() { this.store.turntable.spin = Math.PI; this.audio.play('turntable'); }
  openFridge(x) {
    let best = null, bd = Infinity;
    for (const f of this.store.fridgeDoors) { const d = Math.abs(f.x - x); if (d < bd) { bd = d; best = f; } }
    if (best) { best.target = 1; best.hold = 2.5; this.audio.play('fridge-open', { pos: new THREE.Vector3(best.x, 1, -4.3), vol: 0.6 }); }
  }
  flashAt(p) { this.flash.position.copy(p); this.flash.intensity = 40; }

  onGunToggle(out) {
    if (!out) return;
    // people react to you pulling a gun
    for (const n of this.npcs) {
      if (!n.alive || n.gone || n.hostile || n.spec.cop || n.state === 'clerk' || n.state === 'guard') continue;
      if (n.pos.distanceTo(this.player.position) < 7 && n.state !== 'talking' && Math.random() < 0.6) {
        n.say(['Whoa, WHOA.', 'Chill, bro!', 'Why you got that out?!', 'I\'m just buying chips!'][Math.floor(Math.random() * 4)]);
        if (Math.random() < 0.4) n.leave({ run: true });
      }
    }
  }

  // ------------------------------------------------------------------ phone + police
  // anything that would have called the police now feeds the job's alarm
  callPolice(why) { this.heist.alarm(why); }

  copArrived(cop) {
    const p = this.police; if (!p) return cop.leave();
    cop.state = 'cop';
    // stash out on the counter when the cops walk in = confiscated
    if (this.store.stash.out && this.world.weed > 0 && !p.checked) {
      p.checked = true;
      setTimeout(() => { if (this.store.stash.out) { cop.say('What\'s in that drawer? ...Yeah. That\'s coming with us.'); this.makeCtx(cop, { main: cop }).confiscate(); } }, 2500);
    }
  }

  policeUpdate(dt) {
    if (this.autoCallT) { this.autoCallT -= dt; if (this.autoCallT <= 0) { this.autoCallT = 0; if (!this.police) { this.callPolice('a neighbour heard gunshots'); } } }
    const p = this.police; if (!p) return;
    if (!p.arrived) {
      p.t -= dt;
      if (p.t < 6 && !p.siren) { p.siren = true; this.audio.play('siren', { pos: new THREE.Vector3(8, 0, 14) }); }
      if (p.t <= 0) {
        p.arrived = true;
        for (let i = 0; i < 2; i++) setTimeout(() => p.cops.push(this.spawn({ kind: 'cop', name: COP_NAMES[Math.floor(Math.random() * COP_NAMES.length)], look: { outfit: 'cop' }, cop: true, direct: true, voice: 0.9, speed: 1.4 })), i * 800);
        p.timeout = 60;
      }
      return;
    }
    p.timeout -= dt;
    const cops = p.cops.filter(c => !c.gone);
    if (!cops.length) { if (p.timeout < 55) this.police = null; return; }
    for (const cop of cops) {
      if (cop.state !== 'cop') continue;
      cop.copT = (cop.copT || 0) - dt;
      if (cop.copT > 0) continue;
      cop.copT = 0.5;
      // pick the wildest person still in the store
      if (!cop.target || !cop.target.alive || cop.target.gone || cop.target.state === 'escorted') {
        const taken = cops.map(c => c.target).filter(Boolean);
        cop.target = this.npcs.filter(n => n.alive && !n.gone && !n.spec.cop && n.wild >= 2 && n.pos.z < 6.2 && n.state !== 'escorted' && !taken.includes(n)).sort((a, b) => b.wild - a.wild)[0] || null;
      }
      const t = cop.target;
      if (t) {
        cop.body.lookAt(t.body.worldHead); cop.faceTarget = t.pos;
        if (t.hostile === 'gun' || t.state === 'shooter') {
          cop.body.hold('gun'); cop.body.setPose('aim'); cop.route = [];
          if (!cop.warned) { cop.warned = true; cop.say('POLICE! DROP THE WEAPON!', { loud: true }); cop.copT = 1.6; continue; }
          if (Math.random() < 0.65) { t.hostile = false; t.body.hold(null); t.state = 'escorted'; t.route = []; this.audio.play('cuffs', { pos: t.pos }); }
          else { this.audio.play('gunshot', { pos: cop.pos, verb: true }); this.flashAt(cop.body.worldHead); const pt = t.body.spine.getWorldPosition(new THREE.Vector3()); const dir = pt.clone().sub(cop.pos).setY(0).normalize(); this.gore.hit(pt, dir, 1.2); this.gore.wound(t.body.parts[1], pt); t.hurt(80, 'torso', dir); this.world.note(`${cop.name} shot ${t.name}`, 'danger'); }
          continue;
        }
        if (cop.pos.distanceTo(t.pos) > 1.2) { if (!cop.route.length) cop.goTo(t.pos.clone(), null); }
        else {
          cop.route = []; cop.body.setPose('point');
          t.hostile = false; t.body.hold(null); t.state = 'escorted'; t.route = [];
          this.audio.play('cuffs', { pos: t.pos });
          cop.say(['You\'re coming with us.', 'Hands behind your back.', 'Let\'s go. Now.'][Math.floor(Math.random() * 3)]);
          this.world.stats.arrests++; this.world.note(`${cop.name} arrested ${t.name}`);
          setTimeout(() => { if (t.alive && !t.gone) { t.leave(); t.state = 'escorted'; } cop.state = 'leaving'; cop.leave(); }, 2200);
        }
      } else {
        // nothing to do: deal with bodies or complain
        if (!cop.said) {
          cop.said = true;
          if (this.bodies.some(b => !b.gone)) { cop.say('We\'ll take it from here. Coroner\'s on the way.'); this.world.note('Police took statements and cleared the bodies'); setTimeout(() => this.clearBodies(), 9000); }
          else if (!this.npcs.some(n => n.alive && !n.gone && n.wild >= 2)) { cop.say(['You called us for THIS?', 'Nothing here. Don\'t waste our time.', 'Whoever it was is gone. Call us if they come back.'][Math.floor(Math.random() * 3)]); this.falseCalls++; }
          cop.copT = 4; continue;
        }
        cop.state = 'leaving'; cop.leave();
      }
    }
  }

  clearBodies() { for (const b of this.bodies) if (!b.gone) b.despawn(); this.bodies = []; }

  // ------------------------------------------------------------------ subtitles (bottom of the screen, like a film)
  bark(npc, text, { loud = false, dur } = {}) {
    if (!npc || npc.gone) return;
    const d = npc.pos.distanceTo(this.camera.position);
    if (d > (loud ? 24 : 8)) return;                                // too far to hear
    this.subtitle(npc.name, text, { loud, dur });
    if (npc.spec && Math.random() < 0.6) this.audio.play(loud ? 'scoff' : 'mumble', { pos: npc.pos, rate: npc.spec.voice || 1, vol: 0.5 });
  }
  subtitle(name, text, { loud = false, dur, sticky = null, color = null, far = false } = {}) {
    if (sticky) { const old = this.subs.find(x => x.sticky === sticky); if (old) { old.el.remove(); this.subs = this.subs.filter(x => x !== old); } if (!text) return; }
    if (!text) return;
    // long lines are shown one short sentence at a time so they are easy to read
    if (!sticky && text.length > 56) {
      const parts = []; for (const s of text.match(/[^.!?]+[.!?]*\s*/g) || [text]) { if (parts.length && (parts[parts.length - 1] + s).length <= 56) parts[parts.length - 1] += s; else parts.push(s); }
      if (parts.length > 1) { parts.forEach((t, i) => setTimeout(() => this.subtitle(name, t.trim(), { loud, color, dur: 2.2 }), i * 2000)); return; }
    }
    const el = document.createElement('div'); el.className = 'sub' + (loud ? ' loud' : '') + (far ? ' far' : '');
    const b = document.createElement('b'); b.textContent = name; if (color) b.style.color = color; else b.style.color = this._nameColor(name);
    const sp = document.createElement('span'); sp.textContent = text;
    el.append(b, sp); this.subsEl.appendChild(el);
    this.subs.push({ el, t: sticky ? Infinity : (dur || Math.max(2.4, 1.2 + text.length * 0.055)), sticky });
    while (this.subs.filter(x => !x.sticky).length > 2) { const o = this.subs.find(x => !x.sticky); o.el.remove(); this.subs = this.subs.filter(x => x !== o); }
  }
  _nameColor(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 70% 72%)`; }
  _subs(dt) {
    this.subs = this.subs.filter(x => { x.t -= dt; if (x.t <= 0) { x.el.remove(); return false; } if (x.t < 0.4) x.el.style.opacity = x.t / 0.4; return true; });
  }

  // a banner for trouble in the store, and where it is
  alert(text, npc) { const el = $('alert'); this.alertNpc = text ? npc : null; el.textContent = text ? '⚠ ' + text : ''; el.classList.toggle('show', !!text); clearTimeout(this._alertT); if (text) { this.audio.play('scoff', { vol: 0.4 }); this._alertT = setTimeout(() => el.classList.remove('show'), 5000); } }

  // somebody swipes a shelf: products hit the floor and stay there until you pick them up
  knockShelf(n, at) {
    this.audio.play('glass-break', { pos: n.pos, vol: 0.4 }); this.audio.play('body-fall', { pos: n.pos, vol: 0.5 });
    n.poseHold = 0; n.body.setPose('bang'); n.poseHold = 0.8;
    this.world.debt += 8;
    if (!this.debrisMats) this.debrisMats = [0xd8312a, 0x2a6fd8, 0xf2c21f, 0x2ea84a, 0xf07f2a, 0xe8e2d0].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    const pile = { pos: new THREE.Vector3(n.pos.x, 0, n.pos.z), meshes: [] };
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1 + Math.random() * 0.08, 0.05 + Math.random() * 0.06, 0.14 + Math.random() * 0.1), this.debrisMats[Math.floor(Math.random() * 6)]);
      m.position.set(n.pos.x + (Math.random() - 0.5) * 1.3, 0.035, n.pos.z + (Math.random() - 0.5) * 1.0); m.rotation.set((Math.random() < 0.5 ? Math.PI / 2 : 0), Math.random() * 6, 0); m.castShadow = true;
      this.scene.add(m); pile.meshes.push(m);
    }
    this.debris.push(pile);
    this.store.interactables.push(pile.it = { id: 'debris', pos: pile.pos.clone().setY(0.3), r: 1.0, reach: 2.6, prompt: () => 'Pick up the mess', use: () => this.cleanPile(pile) });
    if (this.debris.length > 8) this.cleanPile(this.debris[0], true);
  }
  cleanPile(pile, silent) {
    for (const m of pile.meshes) { this.scene.remove(m); m.geometry.dispose(); }
    this.debris = this.debris.filter(d => d !== pile);
    this.store.interactables.splice(this.store.interactables.indexOf(pile.it), 1);
    if (!silent) { this.audio.play('ui-select'); this.world.debt = Math.max(0, this.world.debt - 6); this.hint('Back on the shelf. The owner won\'t charge you for most of it.', 3); }
  }

  hint(text, sec = 4) { const el = $('hint'); el.textContent = text; el.classList.add('show'); clearTimeout(this._hintT); this._hintT = setTimeout(() => el.classList.remove('show'), sec * 1000); }

  setCCTV(on) {
    this.cctv = on; $('cctv').classList.toggle('show', on);
    this.player.frozen = on;
    if (on) this.audio.play('ui-select');
  }

  onDialogue(open, enc) {
    if (open && enc?.cat === 'danger') this.audio.setDuck(0.35); else if (!open) this.audio.setDuck(1);
  }

  // ------------------------------------------------------------------ night flow
  startNight() {
    this.paused = false; this.nightOver = false; this.dead = false; this.player.frozen = false;
    this.director.resetNight(); this.alert(null);
    for (const d of [...this.debris]) this.cleanPile(d, true);
    this.heist.start();
    $('h-clock').textContent = `Job ${(this.world.jobs || 0) + 1}`; $('h-night').textContent = this.heist.job.title;
    this.audio.play('shift-start');
  }

  endNight(died = false) { this.heist.finish(died ? 'dead' : 'escaped'); }

  nextNight() {
    $('recap').classList.remove('show'); $('hud').classList.add('show');
    for (const n of this.npcs) if (!n.gone) n.despawn();
    this.npcs = []; this.bodies = []; this.police = null; this.autoCallT = 0;
    this.gore.clear();
    this.world.startNight();
    this.startNight();
    this.renderer.domElement.requestPointerLock?.();
  }

  // ------------------------------------------------------------------ frame
  update(dt, t) {
    if (this.paused) { this.store.update(dt, t); return; }
    const w = this.world;
    this.director.update(dt);
    // encounters that start where the person is standing (shoplifters)
    if (this.pendingHere.length && !this.dialogue.open) { const n = this.pendingHere.shift(); if (n.alive && !n.gone) { n.state = 'talking'; this.startEncounter(n); } }
    for (const n of this.npcs) if (!n.gone) n.update(dt);
    if (this.npcs.length > 30) this.npcs = this.npcs.filter(n => !n.gone);
    this.store.update(dt, t);
    this.player.update(dt);
    this.gore.update(dt);
    this.policeUpdate(dt);
    this._subs(dt); this.social.update(dt); this.heist.update(dt);
    if (this.stashT > 0) { this.stashT -= dt; if (this.stashT <= 0) this.store.stash.out = false; }
    this.flash.intensity *= Math.pow(0.0001, dt);
    this.audio.listener = { pos: this.camera.position, yaw: Math.atan2(-this.camera.getWorldDirection(new THREE.Vector3()).x, -this.camera.getWorldDirection(new THREE.Vector3()).z) };
    // a hostile with a gun who has been at it a while runs off
    for (const n of this.npcs) if (n.hostile === 'gun' && n.stateT < 0 && n.alive) { n.hostile = false; n.body.hold(null); n.say('I\'m out!'); n.leave({ run: true }); }
    if (!this.npcs.some(n => n.hostile && n.alive && !n.gone) && !this.dialogue.open) this.audio.setDuck(1);
    // death
    if (this.player.health <= 0 && !this.dead) {
      this.dead = true; this.player.frozen = true; this.dialogue.cancel();
      $('death').classList.add('show');
      this.audio.play('ringing');
      setTimeout(() => { $('death').classList.remove('show'); this.endNight(true); }, 3500);
    }
    this._hud();
  }

  _hud() {
    const p = this.player;
    $('vignette').style.opacity = Math.min(1, p.hurtT * 0.9 + (100 - p.health) / 140);
    const it = !this.social.active ? p.lookTarget() : null;
    $('prompt').textContent = it ? `E  ${it.prompt()}` : ''; $('prompt').style.opacity = it ? 1 : 0;
    $('crosshair').classList.toggle('gun', p.gunOut);
  }
}
