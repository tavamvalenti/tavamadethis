// Focus on someone and talk to them, the way open-world games do it: hold the focus button while looking at a
// person, and a short list of things you can say appears. What happens depends on who they are (nerve, mood,
// whether they are causing trouble), how the block sees you (respect) and whether your gun is out.
import * as THREE from 'three';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const YOU = {
  greet: ['Yo, what\'s good?', 'How you doing tonight?', 'What\'s up, you need anything?', 'Evening. You good?', 'Aight, what\'s the word?'],
  greetAgain: ['Still good over there?', 'Take your time.', 'Holler if you need something.'],
  antagonize: ['You gonna buy something or just breathe my air?', 'Fuck is you looking at?', 'You smell like you been outside all week.', 'Ain\'t nobody want you in here, for real.', 'Hurry your slow ass up.', 'You look broke. You broke?'],
  kick: ['Buy something or get out.', 'Aight, time to go. Out.', 'Store\'s closed for you. Bounce.', 'Take that outside. Now.'],
  kickGun: ['OUT. I\'m not saying it twice.', 'Walk out or get carried out.', 'Door\'s right there. Use it.'],
  threaten: ['I will lay you out in aisle two. Try me.', 'Keep playing and see what\'s under this counter.', 'Last warning. I\'m not the one.'],
  threatenGun: ['Hands where I can see \'em. NOW.', 'Move wrong and I\'m squeezing.', 'You picked the wrong store, bro.'],
  calm: ['Hey. Hey! Breathe. What\'s going on?', 'Yo, chill. Talk to me.', 'Easy, easy. Nobody\'s against you in here.'],
  lower: ['My bad. We good. Relax.', 'I\'m putting it down. We cool.'],
  putBack: ['Aye! I see you. Put it back.', 'Run them pockets. I watched you on camera.'],
  loot: ['(go through their pockets)'],
};
const THEM = {
  greet: {
    good: ['Wassup, boss.', 'Chillin, chillin. You?', 'Long night, huh?', 'Hey now. You always here, man.', 'I\'m blessed, I can\'t complain.', 'What\'s good! Y\'all got them honey buns?'],
    mid: ['Mm.', 'I\'m good.', 'Just looking.', 'Yeah, yeah.', 'Sup.'],
    bad: ['Don\'t talk to me.', 'Mind your register.', 'Man, what.', 'Not today.'],
    church: ['Good evening, baby. God is good.', 'Well hello. You staying out of trouble?'],
    tourist: ['Oh! Hi! This place is so authentic!', 'Hello! Is this a real bodega? We call them that back home.'],
    cop: ['Evening. Keep that door locked.', 'Quiet night?'],
    drunk: ['HEYYYY. My guy!!', 'You... you a real one. I mean that.'],
    unhoused: ['You got a dollar? Nah? Aight. God bless.', 'They\'re watching the store, you know. From the pole.'],
    yn: ['Wassup OG.', 'Aye, lemme get a loosie on credit.', 'You the one that got robbed? Nah I\'m playing. Unless.'],
  },
  antagonized: {
    timid: ['Wow. Okay. I\'ll shop somewhere else.', 'That was... really uncalled for.', 'I\'m leaving a review.', 'Sorry. Sorry! I\'m going.'],
    mid: ['Who you think you talking to?!', 'Say that again from OUTSIDE the glass.', 'Man, fuck this store!', 'You real tough behind that plexi, huh.', 'I spend money here every day and THIS what I get?'],
    hard: ['Come out the booth then. Come on.', 'Oh you wanna die tonight.', 'I\'ll wait for you at six. I know when you clock out.', 'Bet. BET. Say less.'],
  },
  kickOk: ['Aight, aight, I\'m going. Damn.', 'This store trash anyway.', 'Whatever, man.', 'I was leaving.', 'Don\'t gotta tell me twice.', 'Y\'all prices too high anyway!'],
  kickNo: ['Make me.', 'I ain\'t going nowhere.', 'Or what?', 'Call somebody then.', 'You don\'t own this store. I know the owner.', 'Nah. I\'m good right here.'],
  threatOk: ['Okay okay okay!', 'Chill! I\'m going!', 'It ain\'t that deep!', 'Don\'t shoot, man, DAMN.', 'I got kids!'],
  threatNo: ['You not gonna do nothing.', 'Pull it then.', 'I been shot before. Next.', 'That\'s cute.'],
  calmOk: ['...my bad. My bad. Long day.', 'Aight. Aight. I\'m cool.', 'You right. You right. Sorry, boss.'],
  calmNo: ['DON\'T TELL ME TO CALM DOWN!', 'Nah, FUCK that!', 'You don\'t know what I been through TODAY!'],
  caught: ['...aight, you got me. Here.', 'I was gonna pay for it! Damn!', 'It\'s two dollars, bro, relax.'],
  caughtRun: ['You ain\'t see nothing!', 'CATCH ME THEN!', 'Charge it to the game!'],
  lowered: ['...you scared the hell out of me.', 'Man. Don\'t do that.', 'We cool. We cool.'],
};

export class Social {
  constructor(game) {
    this.game = game; this.target = null; this.held = false; this.cool = 0;
    this.el = document.getElementById('focus');
    this.nameEl = this.el.querySelector('.tgt b'); this.moodEl = this.el.querySelector('.tgt span'); this.actsEl = this.el.querySelector('.acts');
    this.tipEl = document.getElementById('focustip');
    addEventListener('mousedown', (e) => { if (e.button === 2) this.held = true; });
    addEventListener('mouseup', (e) => { if (e.button === 2) this.held = false; });
    addEventListener('keydown', (e) => { if (e.code === 'Space') { this.held = true; e.preventDefault(); } else if (!e.repeat) this.key(e.code); });
    addEventListener('keyup', (e) => { if (e.code === 'Space') this.held = false; });
    addEventListener('blur', () => { this.held = false; });
    this._f = new THREE.Vector3(); this._to = new THREE.Vector3();
  }

  get active() { return !!(this.held && this.target); }

  // the person closest to the middle of your view
  _find(maxAngle, maxDist) {
    const g = this.game, cam = g.camera, f = cam.getWorldDirection(this._f);
    let best = null, bs = Infinity;
    for (const n of g.npcs) {
      if (n.gone) continue;
      const head = n.alive ? n.body.worldHead : n.pos;
      this._to.set(head.x - cam.position.x, (n.alive ? head.y - 0.25 : 0.2) - cam.position.y, head.z - cam.position.z);
      const d = this._to.length(); if (d > maxDist || d < 0.2) continue;
      const ang = Math.acos(Math.min(1, this._to.dot(f) / d)); if (ang > maxAngle) continue;
      const s = ang + d * 0.012; if (s < bs) { bs = s; best = n; }
    }
    return best;
  }

  mood(n) {
    if (!n.alive) return 'dead';
    if (n.hostile) return 'hostile';
    if (n.ruckus) return 'causing trouble';
    if (n.state === 'cower' || n.state === 'flee') return 'scared';
    if (n.state === 'escorted') return 'in cuffs';
    return n.mood <= -3 ? 'furious' : n.mood < 0 ? 'annoyed' : n.mood >= 3 ? 'likes you' : n.mood > 0 ? 'friendly' : 'neutral';
  }

  options(n) {
    const g = this.game, gun = g.player.gunOut, o = [];
    if (!n.alive) { if (!n.looted) o.push(['E', 'Check pockets', 'shady', () => this.loot(n)]); return o; }
    if (n.spec.cop) { o.push(['E', 'Greet', 'friendly', () => this.greet(n)]); return o; }
    if (n.state === 'escorted') return o;
    if (n.hostile) { o.push(['Q', gun ? 'Drop it!' : 'Back off!', 'aggressive', () => this.threaten(n)]); return o; }
    if (n.ruckus) {
      o.push(['E', 'Calm down', 'friendly', () => this.calm(n)]);
      if (n.ruckus.type === 'loot') o.push(['X', 'Put it back', 'clever', () => this.putBack(n)]);
    } else if (n.encounter && (n.state === 'atCounter' || n.state === 'queue' || n.state === 'waitHere') && !g.dialogue.open) o.push(['E', 'Help them', 'friendly', () => g.startEncounter(n)]);
    else if (gun) o.push(['E', 'Lower the gun', 'friendly', () => this.lower(n)]);
    else o.push(['E', 'Greet', 'friendly', () => this.greet(n)]);
    o.push(['Q', gun ? 'Threaten' : 'Antagonize', 'aggressive', () => gun ? this.threaten(n) : this.antagonize(n)]);
    o.push(['F', 'Kick out', 'dismissive', () => this.kick(n)]);
    if (!gun && (n.ruckus || n.pushed > 0 || n.mood < 0)) o.push(['X', 'Threaten', 'aggressive', () => this.threaten(n)]);
    return o;
  }

  key(code) {
    if (!this.active || this.cool > 0 || this.game.paused) return;
    const k = code.replace('Key', '');
    const o = this.options(this.target).find(x => x[0] === k); if (!o) return;
    this.cool = 0.9; this.game.audio.play('ui-select');
    o[3]();
    this._sig = null;
  }

  you(pool) { this.game.subtitle('You', pick(YOU[pool]), { color: '#8fd0ff', dur: 2.6 }); }
  reply(n, line, delay = 900, opts) { setTimeout(() => { if (n.alive && !n.gone) n.say(line, opts); }, delay); }
  face(n, pose) { if (!n.route.length) { n.faceTarget = this.game.player.position; } n.body.lookAt(this.game.player.position); if (pose) { n.body.setPose(pose); n.poseHold = 1.6; } }

  greet(n) {
    const g = this.game;
    this.you(n.greeted ? 'greetAgain' : 'greet'); this.face(n, 'talk');
    const pool = THEM.greet[n.kind] && Math.random() < 0.7 ? THEM.greet[n.kind] : n.mood < 0 ? THEM.greet.bad : n.mood > 0 || g.world.respect > 20 ? THEM.greet.good : Math.random() < 0.5 ? THEM.greet.good : THEM.greet.mid;
    this.reply(n, pick(pool));
    if (!n.greeted) { n.greeted = true; if (n.mood >= 0) { n.mood += 1; g.world.addRespect(0.5); } }
  }

  antagonize(n) {
    const g = this.game;
    this.you('antagonize'); this.face(n, 'angry'); n.mood -= 2; n.pushed++;
    const nerve = n.nerve + n.pushed * 0.08;
    if (nerve < 0.35) { this.reply(n, pick(THEM.antagonized.timid)); setTimeout(() => this.sendOut(n), 1700); g.world.addRespect(-1.5); g.world.note(`You ran ${n.name} out of the store for no reason`); }
    else if (nerve < 0.7) {
      this.reply(n, pick(THEM.antagonized.mid), 900, { loud: true });
      if (n.pushed >= 2) setTimeout(() => { if (Math.random() < 0.5) g.director.startRuckus(n, 'knock'); else this.sendOut(n); }, 2200);
      g.world.addRespect(-0.5);
    } else {
      this.reply(n, pick(THEM.antagonized.hard), 800, { loud: true });
      setTimeout(() => this.squareUp(n), 1800);
    }
  }

  // someone with nerve comes for you: through the door if it is open, otherwise they take it out on the store
  squareUp(n) {
    const g = this.game; if (!n.alive || n.gone || n.hostile) return;
    if (n.armed && Math.random() < 0.5) { n.say('Aight. Since you tough.', { loud: true }); g.makeHostile(n, 'gun'); return; }
    if (!g.player.inBooth || g.store.boothDoorOpen) g.makeHostile(n, 'fist');
    else g.director.startRuckus(n, Math.random() < 0.5 ? 'bang' : 'knock');
  }

  kick(n) {
    const g = this.game, gun = g.player.gunOut;
    this.you(gun ? 'kickGun' : 'kick'); this.face(n);
    const p = 0.42 + g.world.respect / 150 + (gun ? 0.4 : 0) + n.pushed * 0.16 - n.nerve * 0.5 + (n.ruckus ? -0.05 : 0.1);
    n.pushed++;
    if (Math.random() < p) {
      this.reply(n, pick(THEM.kickOk));
      if (n.ruckus) { g.world.addRespect(3); g.world.note(`You threw ${n.name} out`); } else if (n.mood >= 0 && !n.wild) g.world.addRespect(-0.5);
      setTimeout(() => this.sendOut(n), 1500);
    } else {
      this.reply(n, pick(THEM.kickNo), 900, { loud: n.nerve > 0.6 }); n.body.setPose('angry'); n.poseHold = 2; n.mood -= 1; n.wild = Math.max(n.wild, 1);
      if (n.pushed >= 3 && n.nerve > 0.6) setTimeout(() => this.squareUp(n), 2200);
    }
  }

  threaten(n) {
    const g = this.game, gun = g.player.gunOut;
    this.you(gun ? 'threatenGun' : 'threaten'); this.face(n);
    n.pushed++; n.mood -= 3;
    const dangerous = n.hostile || n.wild >= 2 || n.ruckus;
    if (n.hostile) {
      // an armed attacker: a drawn gun sometimes ends it
      const p = gun ? (n.hostile === 'gun' ? 0.35 : 0.7) : 0.12;
      if (Math.random() < p) { this.reply(n, pick(THEM.threatOk), 500, { loud: true }); n.hostile = false; n.body.hold(null); n.body.setPose('handsUp'); setTimeout(() => n.alive && n.leave({ run: true }), 900); g.world.addRespect(5); g.world.note(`${n.name} backed down when you ${gun ? 'drew on them' : 'stood up to them'}`); }
      else this.reply(n, pick(THEM.threatNo), 500, { loud: true });
      return;
    }
    const p = (gun ? 0.9 : 0.35 + g.world.respect / 120) - n.nerve * (gun ? 0.3 : 0.5) + n.pushed * 0.08;
    if (Math.random() < p) {
      this.reply(n, pick(THEM.threatOk), 500, { loud: true });
      n.body.setPose(gun ? 'handsUp' : 'cower'); n.poseHold = 1.2; n.ruckus = null;
      setTimeout(() => this.sendOut(n, true), 1100);
      if (dangerous) { g.world.addRespect(3); g.world.note(`You ran ${n.name} out${gun ? ' at gunpoint' : ''}`); }
      else { g.world.addRespect(gun ? -4 : -2); g.world.note(`You ${gun ? 'pulled a gun on' : 'threatened'} ${n.name}, who was just shopping`); if (gun && Math.random() < 0.35 && !g.police && !g.autoCallT) g.autoCallT = 25; }
    } else {
      this.reply(n, pick(THEM.threatNo), 600, { loud: true });
      setTimeout(() => this.squareUp(n), 1700);
    }
  }

  calm(n) {
    const g = this.game;
    this.you('calm'); this.face(n);
    const p = 0.4 + g.world.respect / 160 - n.nerve * 0.35 + (n.calmTries || 0) * 0.15; n.calmTries = (n.calmTries || 0) + 1;
    if (Math.random() < p) { this.reply(n, pick(THEM.calmOk)); g.director.endRuckus(n, 'calmed'); n.mood += 2; g.world.addRespect(2); g.world.note(`You talked ${n.name} down`); setTimeout(() => { if (n.alive && !n.gone && !n.ruckus) { if (Math.random() < 0.5) n.toCounter(); else n.leave(); } }, 2500); }
    else this.reply(n, pick(THEM.calmNo), 800, { loud: true });
  }

  putBack(n) {
    const g = this.game;
    this.you('putBack'); this.face(n);
    if (Math.random() < 0.55 - n.nerve * 0.3 + g.world.respect / 200) { this.reply(n, pick(THEM.caught)); g.director.endRuckus(n, 'caught'); n.body.hold(null); g.world.addRespect(2); g.world.note(`You caught ${n.name} stealing`); setTimeout(() => this.sendOut(n), 1600); }
    else { this.reply(n, pick(THEM.caughtRun), 500, { loud: true }); n.ruckus.t = 0; }
  }

  lower(n) {
    const g = this.game;
    if (g.player.gunOut) { g.player.toggleGun(); g.onGunToggle(false); }
    this.you('lower'); this.reply(n, pick(THEM.lowered)); n.mood += 1;
  }

  loot(n) {
    const g = this.game; n.looted = true;
    const cash = Math.round(5 + Math.random() * (n.wild >= 3 ? 220 : 60));
    g.world.pocket(cash, 'loot'); g.audio.play('coins', { vol: 0.5 });
    g.subtitle('You', `(you take $${cash} off ${n.name})`, { color: '#8fd0ff' });
    if (n.wild < 3) g.world.addRespect(-2);
    if (n.armed || n.spec.hold === 'gun') { g.player.reserve += 8; g.hint('You took their ammo too.', 3); }
  }

  sendOut(n, run = false) {
    if (!n.alive || n.gone || n.hostile) return;
    const g = this.game;
    if (g.dialogue.open && Object.values(g.dialogue.active.cast).includes(n)) { g.dialogue.end(run ? 'flee' : 'leave'); return; }
    g.director.endRuckus(n, 'out'); n.encounter = null; g.director.leaveQueue(n);
    n.leave({ run });
  }

  update(dt) {
    const g = this.game; this.cool -= dt;
    const can = !g.paused && !g.cctv && !g.dead;
    if (this.held && can) { const t = this._find(this.target ? 0.42 : 0.2, 14); if (t) this.target = t; else if (!this.target || this.target.gone) this.target = null; }
    else this.target = null;
    if (this.target?.gone) this.target = null;
    const on = this.active;
    g.fovTarget = on ? 58 : 72;
    this.el.classList.toggle('show', on);
    // a gentle nudge when you are looking at someone but not focusing
    const near = !on && can && !g.dialogue.open ? this._find(0.1, 6) : null;
    this.tipEl.style.opacity = near ? 1 : 0; if (near && this._tip !== near.name) { this._tip = near.name; this.tipEl.querySelector('b').textContent = near.name; }
    if (!on) { this._sig = null; return; }
    const n = this.target, opts = this.options(n);
    const sig = n.id + '|' + opts.map(o => o[0] + o[1]).join() + '|' + this.mood(n);
    if (sig !== this._sig) {
      this._sig = sig;
      this.nameEl.textContent = n.name; this.moodEl.textContent = this.mood(n);
      this.actsEl.innerHTML = opts.map(([k, label, tone]) => `<div class="a ${tone}"><kbd>${k}</kbd><span>${label}</span></div>`).join('');
    }
    // the person you are locked on to notices
    if (n.alive && !n.route.length && !n.hostile && n.state !== 'talking') n.body.lookAt(g.player.position);
  }
}
