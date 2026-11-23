// Sound. Every effect has a synthesized placeholder so the game is never silent; when a real file with the
// same name is dropped into assets/audio/ (e.g. assets/audio/door-chime.m4a) it is used instead.
// The list of names lives in assets/audio/README.md.
const FILES = ['door-chime', 'scanner-beep', 'drawer-open', 'drawer-close', 'coins', 'turntable', 'booth-lock', 'gunshot', 'gunshot-distant',
  'casing', 'dry-fire', 'reload', 'glass-break', 'punch', 'body-fall', 'blood-splat', 'knife-out', 'siren', 'bus-brakes', 'bus-hiss', 'car-pass',
  'footstep', 'grunt', 'laugh', 'sigh', 'scream', 'scoff', 'hmm', 'gasp', 'mumble', 'ui-select', 'ui-hover', 'caption', 'phone-dial', 'cuffs',
  'fridge-open', 'shift-start', 'shift-end', 'ringing'];
const LOOPS = ['amb-traffic', 'amb-fluorescent', 'amb-fridge'];

export class Audio {
  constructor() {
    this.ctx = null; this.buffers = {}; this.loops = {};
    this.volume = 0.8;
  }
  async start() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 0.55; this.amb.connect(this.master);
    this.duck = 1;
    // a short room reverb for gunshots and shouts
    this.verb = ctx.createConvolver(); this.verb.buffer = this._impulse(1.6, 2.5);
    const vg = ctx.createGain(); vg.gain.value = 0.35; this.verb.connect(vg); vg.connect(this.master);
    this.noiseBuf = this._noise(2);
    this._startAmbience();
    // real files listed in assets/audio/manifest.json load in the background: { "door-chime": "door-chime.m4a", ... }
    try {
      const r = await fetch('assets/audio/manifest.json', { cache: 'no-cache' });
      if (r.ok) { const m = await r.json(); for (const [name, file] of Object.entries(m)) if (FILES.includes(name) || LOOPS.includes(name)) this._load(name, file); }
    } catch (e) { /* no manifest: placeholders only */ }
  }
  async _load(name, file) {
    try {
      const r = await fetch(`assets/audio/${file}`);
      if (!r.ok) return;
      const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
      this.buffers[name] = buf;
      if (LOOPS.includes(name)) this._swapLoop(name, buf);
    } catch (e) { console.warn('audio', name, e); }
  }
  _noise(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  _impulse(sec, decay) {
    const sr = this.ctx.sampleRate, b = this.ctx.createBuffer(2, sr * sec, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay); }
    return b;
  }
  _startAmbience() {
    const ctx = this.ctx;
    // traffic: low filtered noise that swells
    const mk = (name, build) => { const g = ctx.createGain(); g.connect(this.amb); const nodes = build(g); this.loops[name] = { g, nodes }; };
    mk('amb-traffic', (g) => {
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.12; lfo.connect(lg); lg.connect(g.gain);
      g.gain.value = 0.22; n.connect(f); f.connect(g); n.start(); lfo.start(); return [n, lfo];
    });
    mk('amb-fluorescent', (g) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 120;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 240; f.Q.value = 8;
      g.gain.value = 0.018; o.connect(f); f.connect(g); o.start(); return [o];
    });
    mk('amb-fridge', (g) => {
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; n.playbackRate.value = 0.5;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
      const o = ctx.createOscillator(); o.frequency.value = 58; const og = ctx.createGain(); og.gain.value = 0.25; o.connect(og); og.connect(g);
      g.gain.value = 0.12; n.connect(f); f.connect(g); n.start(); o.start(); return [n, o];
    });
  }
  _swapLoop(name, buf) {
    const l = this.loops[name]; if (!l) return;
    l.nodes.forEach(n => { try { n.stop(); } catch (e) { } });
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(l.g); src.start();
    l.g.gain.value = 0.6; l.nodes = [src];
  }
  setDuck(k) { if (this.amb) this.amb.gain.setTargetAtTime(0.55 * k, this.ctx.currentTime, 0.4); }

  // pan/attenuate a sound by its position relative to the listener
  _spatial(pos) {
    if (!pos || !this.listener) return this.sfx;
    const p = this.ctx.createStereoPanner(), g = this.ctx.createGain();
    const dx = pos.x - this.listener.pos.x, dz = pos.z - this.listener.pos.z, d = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz) - this.listener.yaw;
    p.pan.value = Math.max(-1, Math.min(1, -Math.sin(ang) * 0.8));
    g.gain.value = 1 / (1 + d * 0.25);
    p.connect(g); g.connect(this.sfx); return p;
  }

  play(name, { pos = null, vol = 1, rate = 1, verb = false } = {}) {
    if (!this.ctx) return;
    const out = this._spatial(pos);
    const buf = this.buffers[name];
    if (buf) {
      const s = this.ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
      const g = this.ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(out); if (verb) g.connect(this.verb); s.start();
      return;
    }
    this._synth(name, out, vol, rate, verb);
  }

  _synth(name, out, vol, rate, verb) {
    const ctx = this.ctx, t = ctx.currentTime;
    const env = (g, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const tone = (freq, type, a, d, peak, at = 0, glide = null) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t + at);
      if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + at + a + d);
      g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(peak * vol, t + at + a); g.gain.exponentialRampToValueAtTime(0.0001, t + at + a + d);
      o.connect(g); g.connect(out); if (verb) g.connect(this.verb); o.start(t + at); o.stop(t + at + a + d + 0.05);
    };
    const noise = (fType, freq, a, d, peak, at = 0, q = 1) => {
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.playbackRate.value = rate;
      const f = ctx.createBiquadFilter(); f.type = fType; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(peak * vol, t + at + a); g.gain.exponentialRampToValueAtTime(0.0001, t + at + a + d);
      n.connect(f); f.connect(g); g.connect(out); if (verb) g.connect(this.verb); n.start(t + at, Math.random()); n.stop(t + at + a + d + 0.05);
    };
    const voice = (f0, f1, dur, peak, vowel = 700, at = 0) => { // a crude vocal grunt: buzzy source through a vowel filter
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = vowel; f.Q.value = 3;
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = vowel * 2.6; f2.Q.value = 5;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(peak * vol, t + at + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(f); o.connect(f2); f.connect(g); f2.connect(g); g.connect(out); o.start(t + at); o.stop(t + at + dur + 0.05);
    };
    const pitch = rate;
    switch (name) {
      case 'door-chime': tone(1318, 'sine', 0.005, 0.9, 0.25); tone(1046, 'sine', 0.005, 1.2, 0.22, 0.28); break;
      case 'scanner-beep': tone(2800, 'square', 0.002, 0.09, 0.06); break;
      case 'drawer-open': noise('bandpass', 1800, 0.01, 0.12, 0.25, 0, 2); tone(900, 'triangle', 0.002, 0.15, 0.12, 0.08); tone(2200, 'sine', 0.002, 0.25, 0.1, 0.1); break;
      case 'drawer-close': noise('lowpass', 900, 0.005, 0.15, 0.4); break;
      case 'coins': for (let i = 0; i < 6; i++) tone(3000 + Math.random() * 2500, 'sine', 0.001, 0.08, 0.05, i * 0.04 + Math.random() * 0.02); break;
      case 'turntable': noise('bandpass', 400, 0.05, 0.5, 0.15, 0, 3); break;
      case 'booth-lock': noise('highpass', 3000, 0.002, 0.04, 0.3); noise('bandpass', 1200, 0.002, 0.06, 0.25, 0.05, 4); break;
      case 'gunshot': noise('lowpass', 5000, 0.001, 0.25, 1.0); noise('lowpass', 200, 0.001, 0.4, 1.0); tone(90, 'sine', 0.001, 0.3, 0.8, 0, 40); this._verbHit(); break;
      case 'gunshot-distant': noise('lowpass', 700, 0.002, 0.5, 0.35); break;
      case 'casing': for (let i = 0; i < 3; i++) tone(5200 + i * 400, 'sine', 0.001, 0.06, 0.04, 0.35 + i * 0.09); break;
      case 'dry-fire': noise('highpass', 4000, 0.001, 0.03, 0.3); break;
      case 'reload': noise('bandpass', 2500, 0.002, 0.05, 0.3); noise('bandpass', 1800, 0.002, 0.08, 0.35, 0.35); break;
      case 'glass-break': for (let i = 0; i < 9; i++) tone(2500 + Math.random() * 5000, 'triangle', 0.001, 0.25 + Math.random() * 0.4, 0.06, Math.random() * 0.25); noise('highpass', 3000, 0.002, 0.5, 0.5); break;
      case 'punch': noise('lowpass', 500, 0.002, 0.12, 0.8); tone(110, 'sine', 0.002, 0.12, 0.4); break;
      case 'body-fall': noise('lowpass', 250, 0.01, 0.35, 0.9); tone(60, 'sine', 0.005, 0.3, 0.5); break;
      case 'blood-splat': noise('lowpass', 900, 0.005, 0.12, 0.3); break;
      case 'knife-out': noise('highpass', 5000, 0.05, 0.25, 0.15); tone(6000, 'sine', 0.05, 0.3, 0.02); break;
      case 'siren': for (let i = 0; i < 6; i++) { tone(700, 'sawtooth', 0.3, 0.3, 0.04, i * 0.6, 1300); } break;
      case 'bus-brakes': noise('bandpass', 3500, 0.3, 1.2, 0.18, 0, 6); tone(1800, 'sine', 0.3, 0.8, 0.02); break;
      case 'bus-hiss': noise('highpass', 2500, 0.05, 1.6, 0.25); break;
      case 'car-pass': noise('lowpass', 600, 1.2, 1.6, 0.3); break;
      case 'footstep': noise('bandpass', 300 + Math.random() * 300, 0.002, 0.07, 0.12, 0, 1.2); noise('highpass', 3500, 0.001, 0.02, 0.04); break;
      case 'grunt': voice(140 * pitch, 95 * pitch, 0.3, 0.25, 500); break;
      case 'hmm': voice(150 * pitch, 175 * pitch, 0.45, 0.12, 300); break;
      case 'sigh': noise('bandpass', 900, 0.15, 0.7, 0.12, 0, 1); break;
      case 'scoff': noise('bandpass', 1500, 0.01, 0.14, 0.2, 0, 2); voice(160 * pitch, 120 * pitch, 0.12, 0.08, 600, 0.02); break;
      case 'gasp': noise('bandpass', 1400, 0.05, 0.25, 0.18, 0, 1.5); break;
      case 'laugh': for (let i = 0; i < 5; i++) voice(230 * pitch, 190 * pitch, 0.12, 0.18, 800, i * 0.15); break;
      case 'scream': voice(520 * pitch, 650 * pitch, 0.9, 0.3, 1100); break;
      case 'mumble': for (let i = 0; i < 4; i++) voice((130 + Math.random() * 40) * pitch, (110 + Math.random() * 30) * pitch, 0.14, 0.08, 400 + Math.random() * 300, i * 0.16); break;
      case 'ui-select': tone(660, 'triangle', 0.002, 0.08, 0.08); tone(990, 'triangle', 0.002, 0.1, 0.06, 0.05); break;
      case 'ui-hover': tone(880, 'sine', 0.002, 0.03, 0.03); break;
      case 'caption': tone(440, 'sine', 0.002, 0.04, 0.025); break;
      case 'phone-dial': for (let i = 0; i < 3; i++) { tone(697, 'sine', 0.002, 0.1, 0.06, i * 0.18); tone(1209, 'sine', 0.002, 0.1, 0.06, i * 0.18); } tone(440, 'sine', 0.01, 0.9, 0.05, 0.8); break;
      case 'cuffs': for (let i = 0; i < 5; i++) noise('highpass', 4000, 0.001, 0.02, 0.25, i * 0.035); break;
      case 'fridge-open': noise('lowpass', 300, 0.01, 0.2, 0.2); tone(60, 'sine', 0.1, 0.6, 0.06); break;
      case 'shift-start': tone(330, 'triangle', 0.01, 0.4, 0.08); tone(440, 'triangle', 0.01, 0.5, 0.08, 0.15); tone(660, 'triangle', 0.01, 0.8, 0.08, 0.3); break;
      case 'shift-end': tone(660, 'triangle', 0.01, 0.4, 0.08); tone(440, 'triangle', 0.01, 0.5, 0.08, 0.15); tone(330, 'triangle', 0.01, 0.9, 0.08, 0.3); break;
      case 'ringing': tone(4200, 'sine', 0.05, 3.5, 0.05); break;
    }
  }
  _verbHit() { /* the convolver is connected per-sound via verb flag */ }
}
