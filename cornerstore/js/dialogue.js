// Runs an encounter: shows the NPC's caption and 2 to 5 replies, each with a tone, and applies what you pick.
// Encounters are data (see data/encounters.js); this file only knows the shape:
//   nodes: { id: { who, say, pose, sfx, timer, timeout, options: [{ tone, text, if, do, next, end }] } }
const TONES = {
  friendly: '#5fd38d', passive: '#9aa4b2', sarcastic: '#f2b84b', weird: '#c38bff', aggressive: '#ff5a5a',
  clever: '#55c7ff', dismissive: '#c9a27a', stall: '#e8e8e8', hustle: '#7dffb0', shady: '#7dffb0', scared: '#9aa4b2',
};

export class Dialogue {
  constructor(game) {
    this.game = game; this.active = null;
    this.el = document.getElementById('dialogue');
    this.nameEl = this.el.querySelector('.who');
    this.textEl = this.el.querySelector('.line');
    this.optsEl = this.el.querySelector('.opts');
    this.timerEl = this.el.querySelector('.timer');
    addEventListener('keydown', (e) => {
      if (!this.active || this.locked) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= this.options.length) { e.preventDefault(); this.choose(n - 1); }
    });
  }

  get open() { return !!this.active; }

  start(enc, cast, ctx) {
    this.active = { enc, cast, ctx };
    ctx.end = (how) => this.end(how);
    ctx.goto = (id) => this.show(id);
    this.game.onDialogue(true, enc);
    enc.onStart?.(ctx);
    this.show(enc.start || 'start');
  }

  show(id) {
    const a = this.active; if (!a) return;
    const node = a.enc.nodes[id];
    if (!node) return this.end();
    a.node = node; a.nodeId = id;
    const c = a.ctx, who = a.cast[node.who || 'main'] || a.cast.main;
    c.speaker = who;
    for (const n of Object.values(a.cast)) if (n && n.alive) n.state = 'talking';
    node.enter?.(c);
    if (!this.active) return;     // enter() may have ended it
    const say = typeof node.say === 'function' ? node.say(c) : node.say;
    if (who?.alive) { who.body.setPose(node.pose || 'talk'); if (node.hold !== undefined) who.body.hold(node.hold); }
    if (node.sfx) this.game.audio.play(node.sfx, { pos: who?.pos, rate: who?.spec.voice || 1 });
    else this.game.audio.play('mumble', { pos: who?.pos, rate: who?.spec.voice || 1, vol: 0.7 });
    this.nameEl.textContent = (who?.name || '') + (node.tag ? `  ·  ${node.tag}` : '');
    this._type(say || '');
    this.options = (node.options || []).filter(o => !o.if || o.if(c)).slice(0, 5);
    if (this.options.length < 2 && node.options?.length >= 2) this.options = node.options.slice(0, 2);
    this.optsEl.innerHTML = '';
    this.options.forEach((o, i) => {
      const b = document.createElement('button');
      const tone = o.tone || 'passive';
      b.innerHTML = `<span class="k">${i + 1}</span><span class="tone" style="color:${TONES[tone] || '#ccc'}">${tone}</span><span class="t"></span>`;
      b.querySelector('.t').textContent = typeof o.text === 'function' ? o.text(c) : o.text;
      b.onclick = () => this.choose(i);
      b.onmouseenter = () => this.game.audio.play('ui-hover');
      this.optsEl.appendChild(b);
    });
    this.el.classList.add('show');
    this.locked = true; setTimeout(() => { this.locked = false; }, 350);
    clearTimeout(this.timer); this.timerEl.style.transition = 'none'; this.timerEl.style.width = '0';
    if (node.timer) {
      requestAnimationFrame(() => { this.timerEl.style.transition = `width ${node.timer}s linear`; this.timerEl.style.width = '100%'; });
      this.timer = setTimeout(() => { if (this.active?.node === node) { if (node.timeout) this.show(node.timeout); else this.choose(0); } }, node.timer * 1000);
    }
  }

  _type(text) {
    clearInterval(this.typeT);
    let i = 0; this.textEl.textContent = '';
    this.typeT = setInterval(() => { i += 2; this.textEl.textContent = text.slice(0, i); if (i >= text.length) clearInterval(this.typeT); }, 16);
  }

  choose(i) {
    const a = this.active; if (!a || this.locked) return;
    const o = this.options[i]; if (!o) return;
    clearTimeout(this.timer);
    this.game.audio.play('ui-select');
    const c = a.ctx;
    const node = a.node;
    o.do?.(c);
    if (!this.active || this.active.node !== node) return; // do() moved things on
    const next = typeof o.next === 'function' ? o.next(c) : o.next;
    if (next) this.show(next); else this.end(o.end || node.end);
  }

  end(how = 'leave') {
    const a = this.active; if (!a) return;
    clearTimeout(this.timer); clearInterval(this.typeT);
    this.active = null;
    this.el.classList.remove('show');
    a.ctx.lastEnd = how;
    a.enc.onEnd?.(a.ctx);
    this.game.endEncounter(a, how);
  }

  cancel() { if (this.active) this.end('leave'); }
}
