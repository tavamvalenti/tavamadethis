// The director decides who walks in next and when, so the night breathes:
// calm stretches, weird ones, then a spike. It also runs the counter queue and the idle chatter.
import * as THREE from 'three';
import { spots } from './store.js';
import { ENCOUNTERS, CHATTER, IDLE_BARKS, makeCustomerEncounter, CUSTOMER_KINDS } from '../data/encounters.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Director {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.spawnT = 3; this.dangerCool = 170; this.chaosCool = 40; this.tension = 0;
    this.played = new Set(); this.recent = [];
    this.chatT = 8; this.paused = false; this.closing = false;
    this.elapsed = 0; this.ruckusT = 55;
  }
  resetNight() { this.ruckusT = 45 + Math.random() * 30; this.played.clear(); this.queue = []; this.spawnT = 3; this.dangerCool = 170; this.chaosCool = 40; this.tension = 0; this.closing = false; this.elapsed = 0; }

  get inside() { return this.game.npcs.filter(n => !n.gone && n.alive && n.pos.z < 6.2).length; }

  targetCrowd() {
    const pr = this.game.world.progress;             // 0..1 over the night
    const curve = pr < 0.15 ? 3 : pr < 0.5 ? 4 : pr < 0.75 ? 3 : 2;  // busy after midnight, thinner at 4 AM
    return curve + (this.tension < 0.3 ? 1 : 0);
  }

  update(dt) {
    this.elapsed += dt;
    this.dangerCool -= dt; this.chaosCool -= dt;
    this.tension = Math.max(0, this.tension - dt * 0.006);
    if (!this.paused && !this.closing) {
      this.spawnT -= dt;
      const live = this.game.npcs.filter(n => !n.gone).length;
      if (this.spawnT < 0) {
        if (this.inside < this.targetCrowd() && live < 7) this.spawnNext();
        this.spawnT = 6 + Math.random() * 10 + this.tension * 10;
      }
    }
    // counter queue: first in line steps up
    this.queue = this.queue.filter(n => !n.gone && n.alive && (n.state === 'queue' || n.state === 'atCounter' || n.state === 'talking'));
    this.queue.forEach((n, i) => {
      if (n.state === 'talking') return;
      const spot = i === 0 ? spots.counter : spots.queue[Math.min(i - 1, spots.queue.length - 1)];
      if (!n.route.length && n.pos.distanceTo(spot) > 0.25) n.goTo(spot, () => { if (i === 0 && n.state === 'queue') { n.state = 'atCounter'; n.waitT = 0; } });
      if (i === 0 && n.pos.distanceTo(spots.counter) < 0.3 && n.state === 'queue') { n.state = 'atCounter'; n.waitT = 0; }
    });
    const first = this.queue[0];
    const g = this.game;
    if (first && first.state === 'atCounter' && !g.dialogue.open && !g.busyOverlay) {
      const enc = first.encounter;
      const nearReg = g.player.position.distanceTo(new THREE.Vector3(-3.4, g.player.position.y, 3.3)) < 2.2 || g.player.position.distanceTo(first.pos) < 2.2;
      if (enc?.anywhere || nearReg) g.startEncounter(first);
      else {
        if (first.waitT > 18 && !first.yelled) { first.yelled = true; first.say(pick(['Hello?? Anybody work here?', 'Yo! Customer!', "I'ma just take it then. Playin'.", 'Excuse me!!']), { loud: true }); g.audio.play('scoff', { pos: first.pos }); }
        if (first.waitT > 45) { first.say('This store be trippin.'); g.world.addRespect(-1); first.encounter = null; first.leave(); }
      }
    }
    this.ruckusUpdate(dt);
    // idle chatter between people near each other
    this.chatT -= dt;
    if (this.chatT < 0) {
      this.chatT = 7 + Math.random() * 9;
      const idle = g.npcs.filter(n => !n.gone && n.alive && (n.state === 'browsing' || n.state === 'queue'));
      for (let i = 0; i < idle.length; i++) for (let j = i + 1; j < idle.length; j++) {
        if (idle[i].pos.distanceTo(idle[j].pos) < 3 && Math.random() < 0.6) { this.chatter(idle[i], idle[j]); i = idle.length; break; }
      }
    }
  }

  // ---------------------------------------------------------------- ruckus: people acting up in your store
  startRuckus(n, type) {
    if (!n.alive || n.gone || n.hostile || n.ruckus || n.spec.cop) return;
    const g = this.game;
    type = type || pick(n.kind === 'drunk' ? ['dance', 'knock', 'yell'] : n.kind === 'unhoused' ? ['yell', 'bang', 'loot'] : n.kind === 'yn' ? ['knock', 'loot', 'dance', 'bang'] : ['loot', 'yell', 'knock']);
    if (g.dialogue.open && Object.values(g.dialogue.active.cast).includes(n)) return;
    n.ruckus = { type, t: 55 + Math.random() * 35, stepT: 0.5, n: 0 };
    n.state = 'ruckus'; n.route = []; n.encounter = null; n.wild = Math.max(n.wild, 1); this.leaveQueue(n);
    const what = { knock: 'is knocking things off the shelves', dance: 'is blasting music and dancing in the aisle', yell: 'is screaming at your customers', bang: 'is banging on your glass', loot: 'is stuffing things in their jacket' }[type];
    g.alert(`${n.name} ${what}`, n);
    g.world.note(`${n.name} ${what.replace('is ', 'was ').replace('your', 'the')}`);
    this.tension = Math.max(this.tension, 0.5);
  }
  endRuckus(n, why) {
    if (!n.ruckus) return;
    n.ruckus = null; if (n.state === 'ruckus') { n.state = 'loiter'; n.stateT = 3; } n.body.hold(null);
    this.game.alert(null);
  }
  ruckusUpdate(dt) {
    const g = this.game;
    const active = g.npcs.filter(n => n.ruckus && n.alive && !n.gone);
    if (!active.length) {
      this.ruckusT -= dt;
      if (this.ruckusT < 0 && !this.paused && !this.closing && !g.dialogue.open && !g.npcs.some(n => n.hostile && n.alive && !n.gone)) {
        this.ruckusT = 70 + Math.random() * 80;
        const c = g.npcs.filter(n => n.alive && !n.gone && !n.spec.cop && (n.state === 'browsing' || n.state === 'browse' || n.state === 'loiter') && n.pos.z < 5.8);
        // rowdy kinds first; if nobody fits, a troublemaker walks in
        const rowdy = c.filter(n => ['yn', 'drunk', 'unhoused'].includes(n.kind));
        const who = rowdy.length ? pick(rowdy) : (c.length && Math.random() < 0.4 ? pick(c) : null);
        if (who) this.startRuckus(who);
        else { const k = pick([{ kind: 'drunk', name: 'Loud Mike', drunk: true }, { kind: 'yn', name: 'Reek', swagger: true }, { kind: 'unhoused', name: 'Shoeless Paul', look: { outfit: 'ragged' } }, { kind: 'yn', name: 'Day-Day', swagger: true }, { kind: 'drunk', name: 'Tina', drunk: true }]); const n = g.spawn({ ...k, browse: 1, voice: 0.9 + Math.random() * 0.3 }); n.troublemaker = true; this.ruckusT = 12; }
      }
      return;
    }
    for (const n of active) {
      const r = n.ruckus; r.t -= dt; r.stepT -= dt;
      // other customers get fed up and walk out: every one of them is a lost sale
      if (Math.random() < dt * 0.05) { const v = g.npcs.find(o => o !== n && o.alive && !o.gone && !o.ruckus && !o.spec.cop && (o.state === 'browsing' || o.state === 'queue')); if (v) { v.say(pick(["I'm not dealing with this.", "Y'all need security.", "Nope. I'm out.", 'This store is wild.'])); v.encounter = null; this.leaveQueue(v); v.leave(); g.world.addRespect(-0.5); } }
      if (r.t <= 0) { // they get bored (or get away with it)
        if (r.type === 'loot') { const loss = 15 + Math.round(Math.random() * 30); g.world.debt += loss; g.world.note(`${n.name} walked out with $${loss} of stuff. It came out of your pay.`); g.hint(`${n.name} got away with $${loss} of stock. That's on you.`, 5); }
        const type = r.type; this.endRuckus(n, 'bored'); if (type === 'loot') n.body.hold('bag'); n.leave({ run: type === 'loot' }); continue;
      }
      if (n.route.length || r.stepT > 0) continue;
      const P = g.player.position, S = g.store.shelfSpots;
      switch (r.type) {
        case 'knock':
          if (r.at) { g.knockShelf(n, r.at); r.at = null; r.stepT = 5 + Math.random() * 4; n.say(pick(['OOPS.', "Y'all prices TRASH!", 'Clean up, aisle YOU.', 'What you gon do?', 'Hahaha!']), { loud: true }); r.n++; }
          else { r.at = pick(S).clone(); r.at.x += (Math.random() - 0.5) * 4; n.goTo(r.at); r.stepT = 0.3; }
          break;
        case 'dance': n.poseHold = 0; n.body.setPose('dance'); if (!r.spot) { r.spot = new THREE.Vector3(1 + Math.random() * 2, 0, 3.6 + Math.random()); n.goTo(r.spot); } r.stepT = 4 + Math.random() * 3; if (r.n++ % 2 === 0) n.say(pick(['AYYYYE!', 'This my SONG!', 'Turn it UP!', 'Somebody record me!']), { loud: true }); break;
        case 'yell': { const v = g.npcs.find(o => o !== n && o.alive && !o.gone && !o.spec.cop && o.pos.z < 5.8); if (v && Math.random() < 0.7) { n.goTo(v.pos.clone().add(new THREE.Vector3(0.7, 0, 0.3))); n.faceTarget = v.pos; } n.poseHold = 0; n.body.setPose('angry'); n.say(pick(['WHO TOOK MY SPOT?!', 'I KNOW what you did!', "Don't LOOK at me!", 'This MY store! MINE!', "Y'all some sheep!", "I'll fight everybody in here!"]), { loud: true }); r.stepT = 3.5 + Math.random() * 2; break; }
        case 'bang':
          if (n.pos.distanceTo(spots.counter) > 0.6) { n.goTo(spots.counter); r.stepT = 0.4; }
          else { n.faceTarget = P; n.poseHold = 0; n.body.setPose('bang'); g.audio.play('punch', { pos: n.pos, vol: 0.7 }); r.stepT = 0.55; if (r.n++ % 6 === 0) n.say(pick(['GIMME A LOOSIE! ONE!', 'OPEN UP! I know you hear me!', 'You owe me change from Tuesday!', 'Come out here! COME OUT!']), { loud: true }); }
          break;
        case 'loot':
          if (r.n >= 3) { r.t = 0; break; }
          if (r.at) { r.at = null; r.n++; n.body.hold('bag'); n.poseHold = 0; n.body.setPose('browse'); r.stepT = 2.5; }
          else { r.at = pick(S).clone(); r.at.x += (Math.random() - 0.5) * 4; n.goTo(r.at); r.stepT = 0.3; }
          break;
      }
    }
  }

  chatter(a, b) {
    const opts = CHATTER.filter(c => (!c.a || c.a.includes(a.kind)) && (!c.b || c.b.includes(b.kind)));
    const ex = pick(opts.length ? opts : CHATTER);
    ex.lines.forEach(([who, text], k) => setTimeout(() => { const n = who === 'a' ? a : b; if (!n.gone && n.alive) { n.say(text); n.body.lookAt((who === 'a' ? b : a).body.worldHead); } }, k * 2600));
    if (ex.fight && Math.random() < ex.fight) setTimeout(() => this.game.startFight(a, b), ex.lines.length * 2600);
  }

  idleBark(npc) {
    const list = IDLE_BARKS[npc.kind] || IDLE_BARKS.regular;
    return pick(list);
  }

  joinQueue(n) { if (!this.queue.includes(n)) this.queue.push(n); }
  leaveQueue(n) { this.queue = this.queue.filter(q => q !== n); }

  pickById(id) { return ENCOUNTERS.find(e => e.id === id); }

  makeCustomer(npc) { return makeCustomerEncounter(npc, this.game.world); }

  pickEncounter() {
    const w = this.game.world, g = this.game;
    const ctx = { world: w, game: g, night: w.night };
    const danger = this.dangerCool < 0 && this.elapsed > 120;
    const list = ENCOUNTERS.filter(e => {
      if (this.played.has(e.id) && !e.repeat) return false;
      if (e.minNight && w.night < e.minNight) return false;
      if (e.cond && !e.cond(ctx)) return false;
      if (e.cat === 'danger' && !danger) return false;
      if (e.cat === 'chaos' && this.chaosCool > 0) return false;
      if (this.recent.includes(e.id)) return false;
      return true;
    });
    if (!list.length) return null;
    const weight = (e) => {
      let k = e.weight ?? 1;
      if (e.cat === 'danger') k *= 0.55 + (w.marked > 0 ? 0.6 : 0) + Math.min(0.6, w.stash / 1500) + (this.tension < 0.2 ? 0.3 : 0);
      if (e.cat === 'chaos') k *= 0.8;
      if (e.cat === 'hustle') k *= 0.9;
      return k;
    };
    let total = list.reduce((s, e) => s + weight(e), 0), r = Math.random() * total;
    for (const e of list) { r -= weight(e); if (r <= 0) return e; }
    return list[0];
  }

  spawnNext() {
    const g = this.game;
    // about 45% plain customers (with their own small stories), the rest scripted encounters
    const enc = Math.random() < 0.55 ? this.pickEncounter() : null;
    if (!enc) {
      const kind = pick(CUSTOMER_KINDS);
      g.spawn({ kind: kind.kind, name: kind.name(), look: kind.look?.(), voice: kind.voice, height: kind.height?.(), drunk: kind.drunk && Math.random() < 0.6 });
      return;
    }
    this.played.add(enc.id); this.recent.push(enc.id); if (this.recent.length > 6) this.recent.shift();
    if (enc.cat === 'danger') { this.dangerCool = 160 + Math.random() * 120; this.tension = 1; }
    if (enc.cat === 'chaos') { this.chaosCool = 50 + Math.random() * 40; this.tension = Math.max(this.tension, 0.6); }
    g.spawnEncounter(enc);
  }
}
