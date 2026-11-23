// Focus on someone, the way open-world games do it: hold the focus button while looking at a person and a short
// list of things you can say appears. What the options are and what they do is decided by the job (heist.js).
import * as THREE from 'three';

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
    if (n === this.game.heist.clerk) return 'the clerk';
    if (n === this.game.heist.guard) return 'armed guard';
    if (n.spec.cop) return 'police';
    if (n.state === 'cower' || n.state === 'flee') return 'scared';
    if (n.state === 'escorted') return 'in cuffs';
    return n.mood <= -3 ? 'furious' : n.mood < 0 ? 'annoyed' : n.mood >= 3 ? 'likes you' : n.mood > 0 ? 'friendly' : 'neutral';
  }

  options(n) { return this.game.heist.options(n); }

  key(code) {
    if (!this.active || this.cool > 0 || this.game.paused) return;
    const k = code.replace('Key', '');
    const o = this.options(this.target).find(x => x[0] === k); if (!o) return;
    this.cool = 0.9; this.game.audio.play('ui-select');
    o[3]();
    this._sig = null;
  }

  reply(n, line, delay = 900, opts) { setTimeout(() => { if (n.alive && !n.gone) n.say(line, opts); }, delay); }
  face(n, pose) { if (!n.route.length) { n.faceTarget = this.game.player.position; } n.body.lookAt(this.game.player.position); if (pose) { n.body.setPose(pose); n.poseHold = 1.6; } }

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
