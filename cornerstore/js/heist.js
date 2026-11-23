// The job. You are the one walking in with the gun: hold up the clerk, empty the register, crack the safe, grab what
// you can carry, kill the cameras, and get back to your car before the police box you in.
import * as THREE from 'three';
import { spots, ROOM, DOOR } from './store.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
const fmt = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const $ = (id) => document.getElementById(id);
const CAR = new THREE.Vector3(9, 0, 12.1), START = new THREE.Vector3(8.2, 0, 9.9), CLERK = new THREE.Vector3(-3.75, 0, 3.3);

// the same store on different nights, until more locations are built
export const JOBS = [
  { title: 'The night kid', brief: 'A nervous kid is alone behind the glass. He knows the safe code.', clerk: { name: 'Sami', nerve: 0.15, knows: true }, reg: [220, 380], safe: [700, 1000], crowd: 2 },
  { title: 'The owner\'s shift', brief: 'The owner is working. He keeps a shotgun under the counter, and he will not give up the code.', clerk: { name: 'Mr. Haddad', nerve: 0.7, armed: true, knows: false, look: { outfit: 'clerk' }, height: 1.72 }, reg: [350, 560], safe: [1200, 1700], crowd: 3 },
  { title: 'Payroll night', brief: 'Check-cashing cash is in the safe. There is an armed guard by the door.', clerk: { name: 'Dee', nerve: 0.45, knows: true, look: { outfit: 'clerk' } }, reg: [400, 650], safe: [2200, 3200], crowd: 4, guard: true },
];

export const GEAR = {
  mask: { price: 80, label: 'Ski mask', tip: 'Cameras can\'t identify you.' },
  scanner: { price: 200, label: 'Police scanner', tip: 'Shows when police are called and how far out they are.' },
  duffel: { price: 250, label: 'Duffel bag', tip: 'Carry 12 items instead of 6.' },
  vest: { price: 350, label: 'Vest', tip: 'Take 40% less damage.' },
  crowbar: { price: 300, label: 'Crowbar', tip: 'Pry open the ATM.' },
  drill: { price: 400, label: 'Safe drill', tip: 'Open a safe without the code. Slow and loud.' },
  shotgun: { price: 450, label: 'Pump shotgun', tip: 'Press G twice. Everybody listens to a shotgun.' },
};

export class Heist {
  constructor(game) {
    this.g = game; const st = game.store;
    // you come and go through the front door now
    st.colliders = st.colliders.filter(c => c.tag !== 'doorway');
    st.colliders.push({ x0: -15, x1: 17, z0: 11.0, z1: 11.6 }, { x0: -15.6, x1: -15, z0: 6, z1: 11.6 }, { x0: 17, x1: 17.6, z0: 6, z1: 11.6 });
    const bd = st.interactables.find(i => i.id === 'boothdoor'); if (bd) bd.enabled = () => game.player.inBooth || st.boothDoorOpen;
    this._props(); this._interactables();
    this.take = 0; this.items = []; this.wanted = 0; this.police = null; this.over = true;
  }

  get w() { return this.g.world; }
  get gear() { return this.w.gear; }
  get cap() { return this.gear.duffel ? 12 : 6; }
  get job() { return JOBS[(this.w.jobs || 0) % JOBS.length]; }
  get round() { return Math.floor((this.w.jobs || 0) / JOBS.length); }
  get bagValue() { return this.items.reduce((s, i) => s + i.v, 0); }

  // ------------------------------------------------------------------ props built for the job
  _props() {
    const s = this.g.scene, steel = new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.45, metalness: 0.7 });
    const box = (w, h, d, m, x, y, z, parent = s) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };
    // floor safe in the booth, against the front wall
    const safe = this.safe = { pos: new THREE.Vector3(-4.3, 0.36, 5.55), open: 0, opened: false, drill: 0 };
    box(0.62, 0.72, 0.5, steel, -4.3, 0.36, 5.68);
    const hinge = new THREE.Group(); hinge.position.set(-4.61, 0, 5.42); s.add(hinge); safe.hinge = hinge;
    box(0.6, 0.68, 0.05, new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.35, metalness: 0.8 }), 0.3, 0.36, 0, hinge);
    box(0.12, 0.16, 0.02, new THREE.MeshBasicMaterial({ color: 0x0c1410 }), 0.42, 0.44, -0.035, hinge);     // keypad
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.25 })); dial.rotation.x = Math.PI / 2; dial.position.set(0.2, 0.4, -0.04); hinge.add(dial);
    const cashM = new THREE.MeshStandardMaterial({ color: 0x5f8f5a, roughness: 0.8 });
    safe.cash = new THREE.Group(); s.add(safe.cash);
    for (let i = 0; i < 8; i++) box(0.16, 0.05, 0.08, cashM, -4.48 + (i % 3) * 0.18, 0.12 + Math.floor(i / 3) * 0.055, 5.62, safe.cash);
    // bag of register cash the clerk pushes through
    this.bag = box(0.3, 0.2, 0.22, new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 }), spots.turntable.x + 0.05, 1.17, spots.turntable.z); this.bag.visible = false;
    // the sticky note with the safe code
    this.note = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffe14a, side: THREE.DoubleSide })); s.add(this.note);
    // getaway car
    const car = this.car = new THREE.Group(); car.position.copy(CAR); s.add(car);
    const paint = new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.3, metalness: 0.7 });
    box(4.4, 0.75, 1.8, paint, 0, 0.68, 0, car); box(2.3, 0.55, 1.66, new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.1, metalness: 0.8 }), -0.2, 1.3, 0, car);
    for (const [x, z] of [[-1.4, 0.9], [1.4, 0.9], [-1.4, -0.9], [1.4, -0.9]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 })); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.34, z); car.add(wh); }
    for (const z of [-0.6, 0.6]) { box(0.04, 0.14, 0.3, new THREE.MeshBasicMaterial({ color: 0xff2020 }), 2.21, 0.8, z, car); box(0.04, 0.14, 0.3, new THREE.MeshBasicMaterial({ color: 0xfff4d0 }), -2.21, 0.8, z, car); }
    // broken-camera markers
    this.camDead = this.g.store.cameras.map((c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0x050505 })); m.position.copy(c.position); m.visible = false; s.add(m); return m; });
  }

  _interactables() {
    const g = this.g, st = g.store, I = st.interactables, on = () => !this.over;
    const loot = (id, pos, r, reach, name, v, n) => I.push({ id, pos, r, reach, enabled: () => on() && (this.left[id] ?? n) > 0, prompt: () => this.items.length >= this.cap ? 'Bag is full' : `Grab ${name} (${fmt(v)})`, use: () => { if (this.items.length >= this.cap) return g.hint('Your bag is full. Get to the car.', 3); this.left[id] = (this.left[id] ?? n) - 1; this.items.push({ name, v }); g.audio.play('drawer-close', { vol: 0.6 }); this.go('grabbing stock'); } });
    this.lootDefs = { cartons: 4, scratch: 2, beer: 2, liquor: 3 };
    loot('cartons', new THREE.Vector3(-6.5, 1.4, 3.9), 1.3, 2.6, 'a carton of cigarettes', 90, 4);
    loot('liquor', new THREE.Vector3(-6.6, 2.2, 4.6), 0.9, 2.8, 'a box of nips', 60, 3);
    loot('scratch', new THREE.Vector3(-2.55, 1.0, 5.55), 0.6, 2.3, 'a roll of scratch-offs', 70, 2);
    loot('beer', new THREE.Vector3(0, 1.2, -4.25), 2.6, 2.4, 'a case of beer', 25, 2);
    I.push({ id: 'register', pos: spots.register.clone().add(new THREE.Vector3(0, 0.15, 0)), r: 0.4, reach: 2.2, enabled: () => on() && this.regCash > 0, prompt: () => this.busy ? 'Emptying the register...' : 'Empty the register', use: () => { if (!this.busy) { this.busy = { t: 2.4, at: g.player.position.clone(), done: () => { this.cash(this.regCash, 'register'); this.regCash = 0; } }; st.register.hold = 4; g.audio.play('drawer-open'); this.go('in the register'); } } });
    I.push({ id: 'bag', pos: spots.turntable.clone().add(new THREE.Vector3(0.1, 0.15, 0)), r: 0.45, reach: 2.4, enabled: () => on() && this.bag.visible, prompt: () => 'Grab the cash', use: () => { this.bag.visible = false; this.cash(this.bagCash, 'register'); } });
    I.push({ id: 'stash', pos: new THREE.Vector3(-3.45, 0.8, 2.45), r: 0.35, reach: 1.8, enabled: () => on() && this.weed > 0, prompt: () => `Take the weed from under the counter (${fmt(this.weed * 35)})`, use: () => { st.stash.out = true; this.items.push({ name: 'the store\'s weed', v: this.weed * 35 }); this.weed = 0; st.stash.setWeed(0); g.audio.play('drawer-open', { vol: 0.6 }); } });
    I.push({ id: 'dvr', pos: st.monitorPos, r: 0.4, reach: 2.2, enabled: () => on() && !this.tape, prompt: () => 'Rip out the camera recorder', use: () => { this.tape = true; g.audio.play('glass-break', { vol: 0.5 }); g.hint('Recorder is yours. No footage of you leaves this store.', 4); } });
    I.push({ id: 'note', pos: new THREE.Vector3(), r: 0.3, reach: 2.2, enabled: () => on() && !this.code, prompt: () => 'Read the sticky note', use: () => { this.code = true; g.audio.play('ui-select'); g.hint(`The note says: SAFE ${this.codeTxt}. You know the code now.`, 6); } });
    this.noteIt = I[I.length - 1];
    I.push({ id: 'safe', pos: this.safe.pos.clone().setY(0.5), r: 0.5, reach: 2.2, enabled: () => on() && (!this.safe.opened || this.safeCash > 0), prompt: () => this.safe.opened ? `Take the stacks (${fmt(this.safeCash)})` : this.code ? `Open the safe (${this.codeTxt})` : this.gear.drill ? (this.safe.drill > 0 ? `Drilling... ${Math.ceil(this.safe.drill)}s` : 'Drill the safe (20 seconds, loud)') : 'Safe is locked. You need the code.', use: () => this.useSafe() });
    I.push({ id: 'atm', pos: new THREE.Vector3(6.4, 1.0, 4.9), r: 0.6, reach: 2.2, enabled: () => on() && this.atm > 0, prompt: () => this.gear.crowbar ? (this.busy ? 'Prying...' : `Pry open the ATM (${fmt(this.atm)})`) : 'ATM. You need a crowbar.', use: () => { if (!this.gear.crowbar || this.busy) return; this.busy = { t: 7, at: g.player.position.clone(), done: () => { this.cash(this.atm, 'ATM'); this.atm = 0; } }; g.audio.play('punch'); this.noise('prying the ATM'); } });
    I.push({ id: 'car', pos: CAR.clone().add(new THREE.Vector3(0, 1, -0.9)), r: 1.8, reach: 3.2, enabled: on, prompt: () => this.take + this.bagValue > 0 ? `Drive off with ${fmt(this.take + this.bagValue)}` : 'Drive off with nothing', use: () => this.finish('escaped') });
  }

  // ------------------------------------------------------------------ a job starts
  start() {
    const g = this.g, st = g.store, j = this.job, k = 1 + this.round * 0.35, p = g.player;
    this.over = false; this.hot = false; this.take = 0; this.items = []; this.left = {}; this.wanted = 0; this.police = null; this.callT = 0; this.waveT = 0;
    this.kills = 0; this.copKills = 0; this.tape = false; this.busy = null; this.intim = 0; this.lockHP = 2; this.seenByCam = false; this.shotsHeard = false; this.t = 0;
    this.regCash = rnd(j.reg[0] * k, j.reg[1] * k); this.safeCash = rnd(j.safe[0] * k, j.safe[1] * k); this.atm = rnd(500, 800); this.weed = rnd(3, 8); this.bagCash = 0;
    this.code = false; this.codeTxt = String(rnd(1000, 9999));
    this.cams = st.cameras.map((c, i) => { this._camModel(i, true); return true; });
    this.safe.opened = false; this.safe.drill = 0; this.safe.cash.visible = true; this.bag.visible = false;
    st.setBoothDoor(false); st.stash.out = false; st.stash.setWeed(this.weed); st.register.setCash(this.regCash);
    // where the note with the code is tonight
    const np = pick([[st.phonePos.x + 0.02, 1.25, st.phonePos.z + 0.25, Math.PI / 2], [st.monitorPos.x, st.monitorPos.y - 0.28, st.monitorPos.z + 0.02, 0], [6.4, 0.905, 2.9, null], [-2.55, 1.32, 5.34, Math.PI]]);
    this.note.position.set(np[0], np[1], np[2]); this.note.rotation.set(np[3] === null ? -Math.PI / 2 : 0, np[3] || 0, 0); this.noteIt.pos.copy(this.note.position);
    p.position.set(START.x, p.eye, START.z); g.camera.rotation.set(0, 0.75, 0); p.health = 100; p.holster(); p.frozen = false;
    p.ammo = p.mag; p.reserve = Math.max(p.reserve, 45); p.hasShotgun = !!this.gear.shotgun; if (p.hasShotgun) { p.shells = p.shellMag; p.shellReserve = Math.max(p.shellReserve, 12); }
    // the clerk
    const c = j.clerk;
    this.clerk = g.spawn({ kind: 'clerk', name: c.name, look: c.look || { outfit: 'clerk' }, height: c.height, nerve: c.nerve, at: CLERK, armed: !!c.armed, browse: 0 });
    this.clerk.state = 'clerk'; this.cs = { away: 0, down: 0, busy: 0, asked: {} };
    this.guard = j.guard ? g.spawn({ kind: 'guard', name: 'Guard', look: { outfit: 'cop', top: 0x2a2a2e }, height: 1.86, build: 1.2, nerve: 0.9, at: new THREE.Vector3(2.6, 0, 4.7), armed: true, health: 140, browse: 0 }) : null;
    if (this.guard) this.guard.state = 'guard';
    g.director.crowd = j.crowd;
    $('jobcard').innerHTML = `<b>Job ${(this.w.jobs || 0) + 1}: Larchwood Food Market</b><i>${j.title}</i><span>${j.brief}</span>`;
    $('jobcard').classList.add('show'); setTimeout(() => $('jobcard').classList.remove('show'), 9000);
    g.hint('Walk in, pull your gun (G) and focus on the clerk (hold Space or right mouse). Your car is behind you.', 9);
  }

  // ------------------------------------------------------------------ helpers
  // a shot-out camera hangs broken (the modelled camera if it has loaded, otherwise a dark marker)
  _camModel(i, alive) { const m = this.g.store.cameras[i].userData.model; if (m) { m.rotation.z = alive ? 0 : 0.9; m.position.y += alive ? (m.userData.dropped ? 0.12 : 0) : -0.12; m.userData.dropped = !alive; } else this.camDead[i].visible = !alive; }
  say(t) { this.g.subtitle('You', t, { color: '#8fd0ff', dur: 2.4 }); }
  cash(n, from) { this.take += n; this.g.audio.play('coins'); this.g.hint(`+${fmt(n)} from the ${from}.`, 3); }
  addWanted(n, why) { const b = Math.floor(this.wanted); this.wanted = Math.min(5, this.wanted + n); if (Math.floor(this.wanted) > b) this.g.audio.play('scoff', { vol: 0.5 }); }
  // the robbery is on: everybody in the store has seen it
  go(why) {
    if (this.hot || this.over) return; this.hot = true;
    const g = this.g; g.director.tension = 1;
    for (const n of g.npcs) if (n.alive && !n.gone && n.pos.z < 6.2) n.saw = true;
    const c = this.clerk;
    if (c?.alive && !c.hostile) { c.say(pick(['Okay! Okay! Don\'t shoot!', 'Whoa. Easy. Take what you want.', 'Oh God. Please.']), { loud: true }); }
    if (this.guard?.alive && !this.guard.hostile) setTimeout(() => { const gd = this.guard; if (gd.alive && !gd.gone && !gd.hostile) { gd.say('DROP IT!', { loud: true }); g.makeHostile(gd, 'gun'); gd.stateT = 1e9; } }, 900);
    // someone carrying might play hero
    for (const n of g.npcs) if (n.alive && !n.gone && n.armed && n !== c && n !== this.guard && n.nerve > 0.6 && Math.random() < 0.5) setTimeout(() => { if (n.alive && !n.gone) { n.say('Not today.', { loud: true }); g.makeHostile(n, 'gun'); } }, 1500 + Math.random() * 2500);
  }
  // a loud thing happened: somebody nearby will call it in
  noise(why) { this.go(why); if (!this.police && !this.callT) this.callT = 14 + Math.random() * 8; }
  alarm(why) {
    if (this.police || this.over) return;
    const eta = Math.max(18, 48 - this.w.heatLvl * 5 - this.wanted * 3 + Math.random() * 8);
    this.police = { t: eta, arrived: false, why }; this.addWanted(1);
    if (this.gear.scanner) { this.g.subtitle('SCANNER', `Robbery in progress, Larchwood Food Market. Units ${Math.round(eta)} seconds out.`, { color: '#ffb347', dur: 5 }); this.g.audio.play('scanner-beep'); }
  }

  // ------------------------------------------------------------------ what you can say when you focus on someone
  options(n) {
    const g = this.g, p = g.player, armed = p.weapon !== 'none', o = [];
    if (!n.alive) { if (!n.looted) o.push(['E', 'Check pockets', 'shady', () => this.loot(n)]); return o; }
    if (n.hostile) { o.push(['Q', 'Drop it!', 'aggressive', () => this.dropIt(n)]); return o; }
    if (n.spec.cop) return o;
    if (n === this.clerk) {
      if (!armed) { o.push(['E', 'Just looking', 'friendly', () => { this.say(pick(['Just looking.', 'How late y\'all open?'])); g.social.reply(n, pick(['Twenty-four hours.', 'Let me know.', 'Mm-hm.'])); }]); return o; }
      if (this.regCash > 0 && !this.cs.busy) o.push(['E', 'Empty the register', 'aggressive', () => this.order(n, 'register')]);
      if (!this.code && !this.safe.opened) o.push(['Q', 'Safe code. Now.', 'aggressive', () => this.order(n, 'code')]);
      if (!g.store.boothDoorOpen) o.push(['F', 'Open the booth door', 'aggressive', () => this.order(n, 'door')]);
      o.push(['X', 'On the floor!', 'dismissive', () => this.order(n, 'floor')]);
      return o;
    }
    if (!armed) { o.push(['E', 'Nod', 'friendly', () => { this.say('Sup.'); g.social.reply(n, pick(['Sup.', 'Hey.', 'Mm.'])); }]); return o; }
    o.push(['E', 'On the ground!', 'aggressive', () => this.down(n)]);
    if (!n.robbed) o.push(['Q', 'Wallet. Now.', 'shady', () => this.wallet(n)]);
    o.push(['F', 'Get out!', 'dismissive', () => { this.say('Out! Go!'); n.saw = true; g.social.sendOut(n, true); }]);
    return o;
  }

  order(n, what) {
    const g = this.g, c = this.cs, j = this.job.clerk, sg = g.player.weapon === 'shotgun', bat = g.player.weapon === 'bat';
    this.go('threat'); c.away = 0;
    this.say({ register: pick(['Empty the register. All of it.', 'The money. In a bag. Now.', 'Open the drawer!']), code: pick(['The safe. What\'s the code?', 'Give me the safe code. NOW.']), door: pick(['Open that door.', 'Buzz me in. Now!']), floor: pick(['On the floor! Face down!', 'Get down and stay down!']) }[what]);
    g.social.face(n);
    const tries = c.asked[what] = (c.asked[what] || 0) + 1;
    const p = 0.95 - n.nerve * 0.75 + this.intim + (sg ? 0.2 : 0) - (bat ? 0.3 : 0) + (tries - 1) * 0.2 + this.kills * 0.15;
    const ok = Math.random() < p;
    if (what === 'floor') { c.down = 25 + (1 - n.nerve) * 20; n.body.setPose('cower'); g.social.reply(n, pick(['Okay! I\'m down!', 'Please don\'t.']), 500); return; }
    if (what === 'code') {
      if (!j.knows) return g.social.reply(n, pick(['I don\'t have it written in my head for you.', 'You\'d have to shoot me. And then you still won\'t have it.', 'Find it yourself.']), 700);
      if (ok) { this.code = true; g.social.reply(n, `${this.codeTxt.split('').join(' ')}! That's it! I swear!`, 700, { loud: true }); g.hint(`You have the safe code: ${this.codeTxt}. The safe is on the floor inside the booth.`, 6); }
      else g.social.reply(n, pick(['I... I don\'t know it! Only the owner!', 'It\'s on a note somewhere! I can\'t remember!', 'I can\'t think with that in my face!']), 700);
      return;
    }
    if (!ok) { g.social.reply(n, n.nerve > 0.5 ? pick(['No.', 'You won\'t shoot. Cameras everywhere.', 'Get out of my store.']) : pick(['I- I can\'t, it\'s on a timer!', 'Wait, wait, wait...', 'My hands are shaking, hold on!']), 700); return; }
    if (what === 'door') { g.social.reply(n, 'It\'s open! It\'s open!', 500); setTimeout(() => g.store.setBoothDoor(true), 900); }
    if (what === 'register') {
      c.busy = 3.4; g.store.register.hold = 3.4; g.audio.play('drawer-open', { pos: n.pos });
      g.social.reply(n, pick(['Okay. Okay. Bagging it.', 'Taking it out now. See? Slow.']), 500);
      setTimeout(() => { if (this.over || this.regCash <= 0) return; this.bagCash = this.regCash; this.regCash = 0; this.bag.visible = true; g.store.register.setCash(0); g.turntable(); if (n.alive) n.say('That\'s all of it! Take it!'); g.hint('The cash is in the tray at the counter. Grab it with E.', 5); }, 3400);
    }
  }

  dropIt(n) {
    const g = this.g; this.say(pick(['Drop it!', 'Put it DOWN!']));
    if (n.spec.cop || n === this.guard || Math.random() > 0.3 + this.intim) return g.social.reply(n, pick(['You first.', 'Not happening.']), 400, { loud: true });
    n.hostile = false; n.body.hold(null); n.body.setPose('handsUp'); n.say('Okay! It\'s down!', { loud: true }); setTimeout(() => n.alive && n.leave({ run: true }), 800);
  }
  down(n) { this.go('threat'); this.say(pick(['On the ground!', 'Down! Now!', 'Nobody move!'])); n.saw = true; n.route = []; n.state = 'cower'; n.stateT = 40 + Math.random() * 20; this.g.director.leaveQueue(n); this.g.social.reply(n, pick(['Okay okay okay!', 'Please, I got kids!', 'I ain\'t see nothing!']), 400); }
  wallet(n) {
    const g = this.g; this.go('threat'); this.say(pick(['Wallet. Now.', 'Run your pockets.'])); n.robbed = true; n.saw = true;
    if (n.armed && n.nerve > 0.55 && Math.random() < 0.5) { n.say('You picked the wrong one.', { loud: true }); return g.makeHostile(n, 'gun'); }
    const v = rnd(12, 70); setTimeout(() => { if (n.alive && !n.gone) { this.take += v; g.audio.play('coins', { vol: 0.5 }); n.say(pick(['Take it! Just take it!', 'That\'s all I got, man.'])); g.hint(`+${fmt(v)} from ${n.name}.`, 2.5); } }, 900);
  }
  loot(n) { const g = this.g; n.looted = true; const v = n === this.clerk ? rnd(20, 60) : n.spec.cop ? rnd(10, 40) : rnd(8, 80); this.take += v; g.audio.play('coins', { vol: 0.5 }); g.hint(`+${fmt(v)} off ${n.name}.`, 2.5); if (n.armed || n.spec.cop || n === this.guard) { g.player.reserve += 10; } }

  useSafe() {
    const g = this.g, s = this.safe;
    if (s.opened) { if (this.safeCash > 0) { this.cash(this.safeCash, 'safe'); this.safeCash = 0; s.cash.visible = false; } return; }
    if (this.code) { s.opened = true; g.audio.play('booth-lock'); g.audio.play('drawer-open'); return; }
    if (this.gear.drill && s.drill <= 0) { s.drill = 20; this.noise('drilling'); g.hint('Drilling. Stay close for 20 seconds. The whole block can hear it.', 5); return; }
    g.hint('Locked. Get the code from the clerk, or find the note. A drill would work too.', 4);
  }

  // called after every trigger pull, with whatever the bullet hit
  onShot(point, npc) {
    const g = this.g; this.noise('shots'); this.intim = Math.min(0.5, this.intim + 0.25);
    if (!this.shotsHeard) { this.shotsHeard = true; this.addWanted(0.5); }
    if (!point || npc) return;
    this.cams.forEach((alive, i) => { if (alive && g.store.cameras[i].position.distanceTo(point) < 0.6) { this.cams[i] = false; this._camModel(i, false); g.audio.play('glass-break', { pos: point }); g.hint(`Camera ${i + 1} is dead. ${this.cams.filter(Boolean).length} left.`, 3); } });
    if (!g.store.boothDoorOpen && Math.abs(point.z - 1.8) < 0.25 && Math.abs(point.x + 3.9) < 0.6 && point.y < 2.3 && --this.lockHP <= 0) { g.store.setBoothDoor(true); g.hint('You shot the lock off the booth door.', 3); }
  }
  onHit(npc, killed) {
    this.go('shots');
    if (!killed) return;
    if (npc.spec.cop) { this.copKills++; this.addWanted(1); } else if (npc.hostile || npc === this.guard) this.addWanted(0.5); else { this.kills++; this.addWanted(1); }
    if (this.police?.arrived) this.waveT = Math.min(this.waveT, 6);
  }
  onExit(n) { if (n.saw && n.alive && !this.over && !this.police && !this.callT) this.callT = 8 + Math.random() * 8; }

  // a shove with your hands or a swing of the bat
  strike(kind) {
    const g = this.g, cam = g.camera, f = cam.getWorldDirection(new THREE.Vector3()), bat = kind === 'bat';
    let best = null, bd = bat ? 2.1 : 1.7;
    for (const n of g.npcs) { if (!n.alive || n.gone) continue; const to = n.pos.clone().sub(cam.position).setY(0), d = to.length(); if (d < bd && to.normalize().dot(new THREE.Vector3(f.x, 0, f.z).normalize()) > 0.6) { bd = d; best = n; } }
    if (!best) return;
    const n = best, dir = n.pos.clone().sub(cam.position).setY(0).normalize();
    g.audio.play('punch', { pos: n.pos, vol: bat ? 1.2 : 0.8 }); n.knock(dir, bat ? 1.2 : 0.8); n.saw = true; this.go('violence');
    if (bat) {
      // a guard who never saw it coming goes straight down
      if (n === this.guard && !n.hostile) { n.health = 0; n.kill(dir); g.hint('Guard is out cold.', 3); return; }
      const dmg = Math.min(30, n.health - 8); if (dmg > 0) n.hurt(dmg, 'torso', dir);
      if (n.hostile && n.health < 60) { n.hostile = false; n.body.hold(null); n.leave({ run: true }); }
    } else if (!n.hostile && n !== this.clerk) { n.route = []; n.state = 'cower'; n.stateT = 20; }
  }

  // ------------------------------------------------------------------ the end of a job
  finish(how) {
    if (this.over) return; this.over = true;
    const g = this.g, w = this.w, el = $('recap');
    g.paused = true; g.nightOver = true; g.dialogue.cancel(); g.player.controls.unlock(); g.alert(null);
    const items = this.bagValue, camSeen = this.cams.some(Boolean) && !this.tape && !this.gear.mask;
    const rows = []; let title, heat = this.wanted * 0.4 + (camSeen ? 0.8 : 0);
    if (how === 'escaped') {
      const total = this.take + items; w.stash += total; w.jobs = (w.jobs || 0) + 1; w.stats.earned += total;
      title = total > 0 ? `You got away with ${fmt(total)}.` : 'You drove off with nothing.';
      rows.push(['Cash', fmt(this.take)], ['Fenced goods', fmt(items)]);
      if (this.kills) rows.push(['Bystanders killed', String(this.kills)]); if (this.copKills) rows.push(['Police killed', String(this.copKills)]);
      rows.push(['Cameras', camSeen ? 'They have your face' : this.gear.mask ? 'Masked' : 'No footage']);
      g.audio.play('shift-end');
    } else {
      const bill = Math.min(Math.round(w.stash), 250 + this.round * 100); w.stash -= bill; w.stats.deaths++; heat = Math.max(0, heat - 1);
      title = 'You went down. The take is gone.'; rows.push(['Lost', '-' + fmt(this.take + items)], ['Hospital and a lawyer', '-' + fmt(bill)]);
    }
    w.heatLvl = Math.max(0, Math.min(5, w.heatLvl - 0.6 + heat)); w.save();
    rows.push(['Heat on you', '●'.repeat(Math.round(w.heatLvl)) + '○'.repeat(5 - Math.round(w.heatLvl))]);
    el.querySelector('.title').textContent = title;
    const money = el.querySelector('.money');
    const draw = () => {
      money.innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><b class="${String(b).startsWith('-') ? 'neg' : ''}">${b}</b></div>`).join('') + `<div class="total"><span>Your money</span><b>${fmt(w.stash)}</b></div>`;
      el.querySelector('.log').innerHTML = '<div class="shop">' + Object.entries(GEAR).map(([id, it]) => `<button data-id="${id}" ${w.gear[id] ? 'disabled' : ''} class="${w.stash < it.price && !w.gear[id] ? 'poor' : ''}"><b>${it.label}</b><i>${w.gear[id] ? 'owned' : fmt(it.price)}</i><span>${it.tip}</span></button>`).join('') + '</div>';
      el.querySelectorAll('.shop button').forEach(b => { b.onclick = () => { const id = b.dataset.id, it = GEAR[id]; if (w.gear[id] || w.stash < it.price) return; w.stash -= it.price; w.gear[id] = true; w.save(); g.audio.play('coins'); draw(); }; });
    };
    draw();
    el.querySelector('.pay').style.display = 'none';
    const nj = JOBS[(w.jobs || 0) % JOBS.length];
    el.querySelector('.next').textContent = how === 'escaped' ? `Next job: ${nj.title}` : 'Try it again';
    el.classList.add('show'); $('hud').classList.remove('show');
  }

  // ------------------------------------------------------------------ every frame
  update(dt) {
    if (this.over) return;
    const g = this.g, p = g.player, P = p.position, st = g.store; this.t += dt;
    if (Math.abs(P.x - 4) < 1.4 && Math.abs(P.z - ROOM.z1) < 1.5) st.doorNudge();
    const inside = P.z < ROOM.z1;
    if (!this.hot && inside && p.weapon !== 'none') this.go('weapon out');
    // timed actions cancel if you walk away
    if (this.busy) { const b = this.busy; b.t -= dt; if (P.distanceTo(b.at) > 1.2) { this.busy = null; g.hint('You moved. Start again.', 2); } else if (b.t <= 0) { this.busy = null; b.done(); } }
    const s = this.safe;
    if (s.drill > 0) { if (P.distanceTo(s.pos) > 3) { s.drill = 0; g.hint('The drill stopped. Stay next to the safe.', 3); } else { s.drill -= dt; if (Math.random() < dt * 6) g.audio.play('dry-fire', { pos: s.pos, vol: 0.8 }); if (s.drill <= 0) { s.opened = true; g.audio.play('drawer-open'); } } }
    s.open += ((s.opened ? 1 : 0) - s.open) * Math.min(1, dt * 5); s.hinge.rotation.y = s.open * 1.9;
    // cameras see your face
    if (inside && !this.seenByCam && this.cams.some(Boolean)) this.seenByCam = true;
    this._clerk(dt);
    // someone calls it in
    if (this.callT > 0) { this.callT -= dt; if (this.callT <= 0) { this.callT = 0; this.alarm('a 911 call'); } }
    this._police(dt);
    if (p.health <= 0) return;
    this._hud();
  }

  _clerk(dt) {
    const g = this.g, n = this.clerk, c = this.cs, p = g.player;
    if (!n || !n.alive || n.gone || n.hostile) return;
    n.faceTarget = p.position; n.route = [];
    if (!this.hot) { n.body.lookAt(p.position.z < 6 ? p.position : null); return; }
    n.body.lookAt(p.position);
    if (c.down > 0) { c.down -= dt; n.poseHold = 0; n.body.setPose('cower'); return; }
    if (c.busy > 0) { c.busy -= dt; n.poseHold = 0; n.body.setPose('browse'); c.away = 0; return; }
    n.poseHold = 0; n.body.setPose('handsUp');
    // is your weapon on him?
    const to = n.body.worldHead.clone().sub(g.camera.position), d = to.length(), aimed = p.weapon !== 'none' && d < 14 && to.normalize().dot(g.camera.getWorldDirection(new THREE.Vector3())) > 0.9;
    c.away = aimed ? 0 : c.away + dt;
    if (c.away > 6.5 - n.nerve * 4) {
      c.away = 0;
      if (n.armed && !c.pulled) { c.pulled = true; n.say(pick(['Wrong store.', 'Not tonight!']), { loud: true }); n.spec.hold = 'gun'; g.makeHostile(n, 'gun'); n.stateT = 1e9; n.health = 130; return; }
      if (!c.alarmed) { c.alarmed = true; n.body.setPose('browse'); n.poseHold = 0.8; this.alarm('the silent alarm'); if (!this.w.flags.alarmTip) { this.w.flags.alarmTip = true; g.hint('The clerk just reached under the counter. Keep your gun on him, or put him on the floor.', 6); } }
    }
  }

  _police(dt) {
    const g = this.g, po = this.police; if (!po) return;
    const cop = (i, inside) => g.spawn({ kind: 'cop', name: pick(['Officer Kowalski', 'Officer Reyes', 'Officer Brooks', 'Officer Nguyen', 'Officer Daniels', 'Officer McBride']), look: { outfit: 'cop' }, cop: true, hunter: true, direct: true, voice: 0.9, speed: 2.6, nerve: 1, health: 120, at: inside ? null : new THREE.Vector3(-1 + i * 2.6 + Math.random(), 0, 9.6 + Math.random() * 1.2) });
    if (!po.arrived) {
      po.t -= dt;
      if (po.t < 7 && !po.siren) { po.siren = true; g.audio.play('siren', { pos: new THREE.Vector3(8, 0, 14) }); if (!this.gear.scanner) g.hint('Sirens. Police are almost here. Get to your car.', 5); }
      if (po.t <= 0) {
        po.arrived = true; this.waveT = 22;
        const k = 2 + Math.floor(this.wanted / 2);
        for (let i = 0; i < k; i++) setTimeout(() => { if (!this.over) { const c = cop(i, i < 2 && g.player.position.z < 6); if (i === 0) c.say('POLICE! DROP THE WEAPON!', { loud: true }); } }, i * 700);
      }
      return;
    }
    // more keep coming the longer you stay and the more bodies there are
    this.waveT -= dt;
    if (this.waveT < 0) { this.waveT = Math.max(9, 26 - this.wanted * 3); const live = g.npcs.filter(n => n.spec.cop && n.alive && !n.gone).length; if (live < 2 + Math.floor(this.wanted)) cop(Math.floor(Math.random() * 4), false); }
  }

  _hud() {
    const g = this.g, w = this.w, p = g.player, po = this.police;
    $('h-take').textContent = fmt(this.take); $('h-bag').textContent = `${this.items.length}/${this.cap}  ${fmt(this.bagValue)}`;
    $('h-stash').textContent = fmt(w.stash);
    const wl = Math.ceil(this.wanted - 0.01); if (this._wl !== wl) { this._wl = wl; $('h-wanted').textContent = '★'.repeat(wl) + '☆'.repeat(5 - wl); $('h-wanted').classList.toggle('on', wl > 0); }
    const show = po && (po.arrived || this.gear.scanner);
    $('police').style.display = show ? '' : 'none';
    if (show) $('police').textContent = po.arrived ? 'POLICE ON SCENE' : `Police: ${Math.max(0, Math.ceil(po.t))}s`;
    const txt = p.reloadT > 0 ? 'Reloading...' : p.weapon === 'pistol' ? `${p.ammo} / ${p.reserve}` : p.weapon === 'shotgun' ? `${p.shells} / ${p.shellReserve}` : p.weapon === 'bat' ? 'swing' : 'shove';
    const sig = p.weapon + txt; if (this._ws !== sig) { this._ws = sig; $('ammo').textContent = txt; $('weapon').querySelector('.wn').textContent = { none: 'Hands', bat: 'Bat', pistol: '9mm', shotgun: 'Shotgun' }[p.weapon]; $('weapon').classList.toggle('out', p.weapon !== 'none'); }
  }
}
