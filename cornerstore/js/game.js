// The game: holds the store, you, the people, and runs the night.
import * as THREE from 'three';
import { Store, spots } from './store.js';
import { Player } from './player.js';
import { NPC } from './npc.js';
import { Director } from './director.js';
import { Dialogue } from './dialogue.js';
import { Combat } from './combat.js';
import { Gore } from './gore.js';
import { World } from './economy.js';

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
    this.barksEl = $('barks'); this.barks = [];
    this.flash = new THREE.PointLight(0xffb060, 0, 7, 2); scene.add(this.flash);
    this.cctv = false; this.paused = true; this.nightOver = false; this.dead = false;
    this._interactables();
    this._chores();
    this._listen();
    this.hint('Walk with WASD. Customers come to the counter. Number keys pick replies. G draws the gun, C crouches.', 9);
  }

  // ------------------------------------------------------------------ setup
  _interactables() {
    const s = this.store, I = s.interactables;
    I.push({ id: 'register', pos: spots.register.clone().add(new THREE.Vector3(0, 0.15, 0)), r: 0.35, prompt: () => `Open the register (${fmt(this.world.drawer)} inside)`, use: () => { s.register.hold = 1.2; this.audio.play('drawer-open'); this.hint(`Drawer: ${fmt(this.world.drawer)}. The owner wants ${fmt(this.world.float + this.world.cut)} back at 6 AM (the $${this.world.float} float plus his $${this.world.cut} cut). Anything over that is yours.`, 7); } });
    I.push({ id: 'phone', pos: s.phonePos, r: 0.3, prompt: () => this.police ? 'Police are already on the way' : 'Use the phone', use: () => !this.police && this.phoneMenu() });
    I.push({ id: 'monitor', pos: s.monitorPos, r: 0.35, prompt: () => 'Watch the security cameras', use: () => this.setCCTV(true) });
    I.push({ id: 'stash', pos: new THREE.Vector3(-3.45, 0.8, 2.45), r: 0.35, reach: 1.8, prompt: () => s.stash.out ? 'Close the stash drawer' : `Check the stash (${this.world.weed} left)`, use: () => { s.stash.out = !s.stash.out; this.audio.play(s.stash.out ? 'drawer-open' : 'drawer-close', { vol: 0.6 }); if (s.stash.out) this.stashT = 30; } });
  }

  _chores() {
    const s = this.store, I = s.interactables, w = this.world;
    const done = (id) => { const c = w.chores.find(x => x.id === id); if (c && !c.done) { c.done = true; this.audio.play('ui-select'); this.hint('Chore done: ' + c.text, 4); w.note('Did a chore for the owner'); } };
    this.choreDone = done;
    // mop puddle by the fridges
    const pud = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.02, metalness: 0.3, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    pud.rotation.x = -Math.PI / 2; pud.position.set(1.2, 0.004, -3.6); pud.scale.set(1.4, 1, 1); this.scene.add(pud); this.puddle = pud;
    const has = (id) => () => w.chores.some(c => c.id === id && !c.done);
    I.push({ id: 'mop', pos: new THREE.Vector3(1.2, 0.2, -3.6), r: 0.8, reach: 2.6, enabled: has('mop'), prompt: () => 'Mop the spill (owner\'s chore)', use: () => { done('mop'); } });
    I.push({ id: 'fridge', pos: new THREE.Vector3(0, 1.2, -4.25), r: 2.5, enabled: has('fridge'), prompt: () => 'Restock the fridge (owner\'s chore)', use: () => { this.openFridge(this.player.position.x); done('fridge'); } });
    I.push({ id: 'face', pos: new THREE.Vector3(1.5, 1.0, 0.85), r: 2.2, enabled: has('face'), prompt: () => 'Face the shelves (owner\'s chore)', use: () => done('face') });
    I.push({ id: 'count', pos: new THREE.Vector3(-6.5, 1.4, 3.9), r: 1.6, enabled: has('count'), prompt: () => 'Count the cigarettes (owner\'s chore)', use: () => done('count') });
  }

  _listen() {
    addEventListener('keydown', (e) => {
      if (this.paused) return;
      if (e.code === 'KeyE' && !this.dialogue.open) {
        if (this.cctv) return this.setCCTV(false);
        const it = this.player.lookTarget(); if (it) it.use();
      }
      if (e.code === 'Escape' && this.cctv) this.setCCTV(false);
      if (e.code === 'KeyG') { const out = this.player.toggleGun(); if (out !== undefined) this.onGunToggle(out); }
      if (e.code === 'KeyR') this.player.reload();
      if (e.code === 'Tab') { e.preventDefault(); $('chores').classList.toggle('open'); }
    });
    addEventListener('mousedown', (e) => {
      if (this.paused || e.button !== 0 || !this.player.controls.isLocked) return;
      if (this.player.tryShoot()) this.combat.playerShoot();
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
    n.body.hold(mode);
    if (mode === 'gun') n.stateT = 12; // shoots for a while then runs
    n.fleeAfter = true;
    this.panic(n);
    this.audio.setDuck(0.4);
    this.world.note(`${n.name} attacked you`, 'danger');
  }

  // everyone who is not part of the trouble reacts to it
  panic(source) {
    for (const n of this.npcs) {
      if (n === source || n.gone || !n.alive || n.hostile || n.spec.cop || n.state === 'talking' || n.state === 'escorted') continue;
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
    if (!this.police && !this.autoCallT) this.autoCallT = 20 + Math.random() * 15; // a neighbour calls it in
  }

  onPlayerHit(npc, killed) {
    const w = this.world;
    const guilty = npc.hostile || npc.wild >= 3;
    if (guilty) { w.addRespect(killed ? 6 : 3); w.note(`${killed ? 'Shot and killed' : 'Shot'} ${npc.name}`, 'danger'); }
    else { w.addRespect(-15); w.debt += 200; w.note(`Shot ${npc.name}, who wasn't a threat. The owner charged you $200 for the mess.`, 'danger'); this.hint('They weren\'t a threat. The block will remember that.', 5); }
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
      sell: (amount, opts) => { w.sell(amount, opts); g.registerAnim(); },
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
    $('ammo').classList.toggle('show', out);
    if (!out) return;
    // people react to you pulling a gun
    for (const n of this.npcs) {
      if (!n.alive || n.gone || n.hostile || n.spec.cop) continue;
      if (n.pos.distanceTo(this.player.position) < 7 && n.state !== 'talking' && Math.random() < 0.6) {
        n.say(['Whoa, WHOA.', 'Chill, bro!', 'Why you got that out?!', 'I\'m just buying chips!'][Math.floor(Math.random() * 4)]);
        if (Math.random() < 0.4) n.leave({ run: true });
      }
    }
  }

  // ------------------------------------------------------------------ phone + police
  phoneMenu() {
    const g = this;
    this.audio.play('phone-dial');
    const enc = {
      id: 'phone', nodes: {
        start: {
          who: 'main', say: 'Dial tone.', tag: 'PHONE',
          options: [
            { tone: 'shady', text: 'Call 911', do: () => g.callPolice('called from the store phone'), end: 'stay' },
            { tone: 'passive', text: 'Call the owner', next: 'owner' },
            { tone: 'hustle', text: 'Call Unc Bobby (restock)', if: () => g.world.stash >= 70, next: 'unc' },
            { tone: 'dismissive', text: 'Hang up', end: 'stay' },
          ],
        },
        owner: {
          who: 'main', say: () => g.world.debt > 0 ? `The owner: "You owe me ${fmt(g.world.debt)}. Why you calling me at ${g.world.clock}? Do the chores."` : `The owner: "Why you calling me at ${g.world.clock}? Is the store on fire? No? Goodnight."`, tag: 'PHONE',
          options: [{ tone: 'passive', text: 'Sorry, boss.', end: 'stay' }, { tone: 'sarcastic', text: 'Just checking you\'re awake.', end: 'stay' }],
        },
        unc: {
          who: 'main', say: 'Unc Bobby: "Nephew. I\'ll swing by. Have the money."', tag: 'PHONE',
          options: [{ tone: 'shady', text: 'Bet.', do: () => { g.director.played.delete('supplier'); g.world.flags.owesUnc = 0; setTimeout(() => { const e = g.director.pickById('supplier'); if (e) g.spawnEncounter(e); }, 15000); }, end: 'stay' }, { tone: 'passive', text: 'Never mind.', end: 'stay' }],
        },
      },
    };
    const phone = { name: 'Store phone', spec: {}, pos: this.store.phonePos, alive: true, body: { setPose() { }, hold() { } }, state: 'phone' };
    this.dialogue.start(enc, { main: phone }, { world: this.world, npc: phone });
  }

  callPolice(why) {
    if (this.police) return;
    const eta = 35 + this.falseCalls * 15 + Math.random() * 10;
    this.police = { t: eta, why, cops: [], arrived: false };
    this.world.note(`Called the police: ${why}`);
    this.audio.play('phone-dial', { vol: 0.5 });
    this.hint(`Police are on the way (about ${Math.round(eta)} seconds).`, 5);
  }

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

  // ------------------------------------------------------------------ captions over heads
  bark(npc, text, { loud = false, dur = 3.4 } = {}) {
    if (!npc || npc.gone) return;
    const el = document.createElement('div'); el.className = 'bark' + (loud ? ' loud' : '');
    el.innerHTML = `<b></b><span></span>`; el.querySelector('b').textContent = npc.name; el.querySelector('span').textContent = text;
    this.barksEl.appendChild(el);
    for (const b of this.barks) if (b.npc === npc) b.t = Math.min(b.t, 0.3);
    this.barks.push({ el, npc, t: dur });
    if (npc.spec && Math.random() < 0.6) this.audio.play(loud ? 'scoff' : 'mumble', { pos: npc.pos, rate: npc.spec.voice || 1, vol: 0.5 });
  }
  _barks(dt) {
    const v = new THREE.Vector3(), w = innerWidth, h = innerHeight;
    this.barks = this.barks.filter(b => {
      b.t -= dt;
      if (b.t <= 0 || b.npc.gone) { b.el.remove(); return false; }
      v.copy(b.npc.body.worldHead || b.npc.pos).add(new THREE.Vector3(0, 0.35, 0)).project(this.camera);
      const d = b.npc.pos.distanceTo(this.camera.position);
      if (v.z > 1 || d > 15 || this.cctv) { b.el.style.opacity = 0; return true; }
      b.el.style.opacity = Math.min(1, b.t * 3);
      b.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%) scale(${Math.max(0.65, Math.min(1, 4 / d))})`;
      return true;
    });
  }

  hint(text, sec = 4) { const el = $('hint'); el.textContent = text; el.classList.add('show'); clearTimeout(this._hintT); this._hintT = setTimeout(() => el.classList.remove('show'), sec * 1000); }

  setCCTV(on) {
    this.cctv = on; $('cctv').classList.toggle('show', on);
    this.player.frozen = on;
    if (on) this.audio.play('ui-select');
  }

  onDialogue(open, enc) {
    this.player.frozen = open;
    if (open && enc?.cat === 'danger') this.audio.setDuck(0.35); else if (!open) this.audio.setDuck(1);
  }

  // ------------------------------------------------------------------ night flow
  startNight() {
    this.paused = false; this.nightOver = false; this.dead = false;
    this.director.resetNight();
    this.player.health = 100; this.player.position.set(-4.7, this.player.eye, 3.3);
    this.player.ammo = this.player.mag; this.player.reserve = Math.max(this.player.reserve, 30);
    this.puddle.visible = this.world.chores.some(c => c.id === 'mop');
    this.renderChores();
    this.audio.play('shift-start');
    const w = this.world;
    this.hint(`Night ${w.night}. The owner wants ${fmt(w.float + w.cut)} in the drawer at 6 AM. ${w.debt > 0 ? `You owe him ${fmt(w.debt)}, so he left chores (Tab).` : 'Everything over that is yours.'}`, 8);
    if (w.marked > 0) setTimeout(() => this.hint('Word on the block is you fold when robbed. Expect people to try you.', 6), 9000);
  }

  renderChores() {
    const el = $('chores'), w = this.world;
    if (!w.chores.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = '<b>Owner\'s list (Tab)</b>' + w.chores.map(c => `<div class="${c.done ? 'done' : ''}">${c.done ? '✓' : '○'} ${c.text}</div>`).join('');
  }

  endNight(died = false) {
    if (this.nightOver && !died) return;
    this.nightOver = true; this.paused = true;
    this.dialogue.cancel(); this.setCCTV(false);
    this.player.controls.unlock();
    const w = this.world;
    // numbers: did anyone hit?
    const betLines = [];
    for (const b of w.bets) { if (Math.random() < 0.12) { const pay = b.amt * 6; if (w.stash >= pay) { w.stash -= pay; betLines.push(`${b.who} hit the number. You paid out ${fmt(pay)}.`); } else { w.debt += pay; w.addRespect(-10); betLines.push(`${b.who} hit the number and you couldn't pay ${fmt(pay)}. That's on your debt now, and people are talking.`); } } }
    w.bets = [];
    let hosp = null;
    if (died) hosp = w.died();
    const r = w.clockOut();
    this.audio.play('shift-end');
    const el = $('recap');
    const rows = [
      ['Drawer at 6 AM', fmt(r.drawer)], ['Owner\'s float + cut', fmt(r.float + r.cut)],
      ...(r.shortfall ? [['Short', '-' + fmt(r.shortfall)]] : []),
      ...(r.caught ? [['Audit caught your skimming', '-' + fmt(r.caught)]] : r.audit ? [['Audit', 'clean']] : []),
      ...(r.choresMissed ? [['Chores skipped', '-' + fmt(r.choresMissed * 25)]] : []),
      ...(hosp ? [['Hospital bill', '-' + fmt(hosp.bill)], ['Lost from your stash', '-' + fmt(hosp.lost)]] : []),
      ...(r.paidDebt ? [['Paid toward debt', fmt(r.paidDebt)]] : []),
      ['Kept from the drawer', fmt(r.kept)], ['Skimmed', fmt(r.skimmed)], ['Hustles', fmt(r.hustle)], ['Tips', fmt(r.tips)],
      ...(r.robbed ? [['Taken by robbers', '-' + fmt(r.robbed)]] : []),
    ];
    const gossip = this.gossip(r);
    el.querySelector('.title').textContent = died ? 'You got hit. You wake up at Penn the next night.' : `6:00 AM. Night ${r.night} is over.`;
    el.querySelector('.money').innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><b class="${String(b).startsWith('-') ? 'neg' : ''}">${b}</b></div>`).join('') +
      `<div class="total"><span>Your stash</span><b>${fmt(r.stash)}</b></div><div class="total"><span>You owe the owner</span><b class="${r.debt ? 'neg' : ''}">${fmt(r.debt)}</b></div>`;
    el.querySelector('.log').innerHTML = [...betLines, ...gossip].map(t => `<div class="n"></div>`).join('');
    [...el.querySelectorAll('.log .n')].forEach((d, i) => { d.textContent = [...betLines, ...gossip][i]; });
    const pay = el.querySelector('.pay');
    pay.style.display = w.debt > 0 && w.stash > 0 ? '' : 'none';
    pay.textContent = `Pay ${fmt(Math.min(w.stash, w.debt))} of the debt from your stash`;
    pay.onclick = () => { w.payDebtFromStash(); pay.style.display = 'none'; el.querySelector('.money .total:last-child b').textContent = fmt(w.debt); el.querySelectorAll('.money .total b')[0].textContent = fmt(w.stash); };
    el.querySelector('.next').textContent = `Start night ${w.night}`;
    el.classList.add('show');
    $('hud').classList.remove('show');
  }

  gossip(r) {
    const lines = r.log.filter(l => l.kind === 'danger' || Math.random() < 0.75).slice(-9).map(l => `${l.t}  ${l.text}`);
    if (!lines.length) lines.push('A quiet night. Nobody posted about the store.');
    if (this.world.flags.viral) lines.push('The egg speech has 400K views. Strangers keep calling you "the egg guy".');
    return lines;
  }

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
    if (!this.nightOver && w.tick(dt) && !this.director.closing) { this.director.closing = true; this.closeT = 45; this.hint('6:00 AM. Last customers, then clock out.', 5); }
    if (this.director.closing) { this.closeT -= dt; if ((this.director.inside === 0 && !this.dialogue.open) || this.closeT < 0) this.endNight(); }
    this.director.update(dt);
    // encounters that start where the person is standing (shoplifters)
    if (this.pendingHere.length && !this.dialogue.open) { const n = this.pendingHere.shift(); if (n.alive && !n.gone) { n.state = 'talking'; this.startEncounter(n); } }
    for (const n of this.npcs) if (!n.gone) n.update(dt);
    if (this.npcs.length > 30) this.npcs = this.npcs.filter(n => !n.gone);
    this.store.update(dt, t);
    this.player.update(dt);
    this.gore.update(dt);
    this.policeUpdate(dt);
    this._barks(dt);
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
    const w = this.world, p = this.player;
    $('h-clock').textContent = w.clock; $('h-night').textContent = `Night ${w.night}`;
    $('h-drawer').textContent = fmt(w.drawer);
    $('h-cut').textContent = fmt(w.float + w.cut);
    $('h-stash').textContent = fmt(w.stash);
    $('h-debt').textContent = fmt(w.debt); $('h-debt').parentElement.style.display = w.debt > 0 ? '' : 'none';
    $('h-respect').style.width = `${(w.respect + 100) / 2}%`;
    $('h-weed').textContent = w.weed;
    $('ammo').textContent = p.reloadT > 0 ? 'Reloading...' : `${p.ammo} / ${p.reserve}`;
    $('vignette').style.opacity = Math.min(1, p.hurtT * 0.9 + (100 - p.health) / 140);
    $('police').style.display = this.police && !this.police.arrived ? '' : 'none';
    if (this.police && !this.police.arrived) $('police').textContent = `Police: ${Math.max(0, Math.ceil(this.police.t))}s`;
    const it = (!this.dialogue.open && !this.cctv) ? p.lookTarget() : null;
    $('prompt').textContent = it ? `E  ${it.prompt()}` : ''; $('prompt').style.opacity = it ? 1 : 0;
    if (this._choreSig !== JSON.stringify(w.chores)) { this._choreSig = JSON.stringify(w.chores); this.renderChores(); }
    $('crosshair').classList.toggle('gun', p.gunOut);
  }
}
