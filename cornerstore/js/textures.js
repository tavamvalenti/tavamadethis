// Canvas-made textures for the greybox store. Each one is drawn once and cached.
// These stand in until the Higgsfield textures arrive (Phase 2).
import * as THREE from 'three';

const cache = new Map();
const rnd = (a, b) => a + Math.random() * (b - a);

function canvasTex(key, w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const k = key + repeat.join('x');
  if (cache.has(k)) return cache.get(k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(k, t);
  return t;
}

function grime(g, w, h, n, alpha) {
  for (let i = 0; i < n; i++) {
    const x = rnd(0, w), y = rnd(0, h), r = rnd(4, 40);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(30,24,16,${alpha * rnd(0.3, 1)})`);
    gr.addColorStop(1, 'rgba(30,24,16,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// checkered vinyl tile, scuffed and dirty
export const floorTile = (repeat) => canvasTex('floor', 512, 512, (g, w, h) => {
  const n = 4, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const light = (i + j) % 2 === 0;
    const v = light ? rnd(196, 212) : rnd(58, 70);
    g.fillStyle = light ? `rgb(${v},${v - 1},${v - 5})` : `rgb(${v - 3},${v - 2},${v})`;
    g.fillRect(i * s, j * s, s, s);
  }
  g.strokeStyle = 'rgba(20,18,14,0.5)'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  grime(g, w, h, 90, 0.25);
  for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(0,0,0,${rnd(0.05, 0.2)})`; g.lineWidth = rnd(0.5, 2); g.beginPath(); const x = rnd(0, w), y = rnd(0, h); g.moveTo(x, y); g.lineTo(x + rnd(-40, 40), y + rnd(-8, 8)); g.stroke(); }
}, { repeat });

export const wallPaint = (repeat, base = [188, 186, 178]) => canvasTex('wall' + base, 256, 256, (g, w, h) => {
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { const v = rnd(-14, 14); g.fillStyle = `rgba(${base[0] + v},${base[1] + v},${base[2] + v},0.5)`; g.fillRect(rnd(0, w), rnd(0, h), 2, 2); }
  grime(g, w, h, 30, 0.18);
  const gr = g.createLinearGradient(0, h, 0, h * 0.6); gr.addColorStop(0, 'rgba(40,30,20,0.35)'); gr.addColorStop(1, 'rgba(40,30,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, { repeat });

export const ceilingTile = (repeat) => canvasTex('ceil', 256, 256, (g, w, h) => {
  g.fillStyle = '#d3d2cc'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(90,85,70,${rnd(0.05, 0.25)})`; g.fillRect(rnd(0, w), rnd(0, h), 1.5, 1.5); }
  g.strokeStyle = '#8d8a7e'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  if (Math.random() < 1) { const gr = g.createRadialGradient(170, 90, 0, 170, 90, 60); gr.addColorStop(0, 'rgba(120,90,40,0.35)'); gr.addColorStop(1, 'rgba(120,90,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
}, { repeat });

export const brick = (repeat) => canvasTex('brick', 512, 512, (g, w, h) => {
  g.fillStyle = '#3a2a24'; g.fillRect(0, 0, w, h);
  const bh = 32, bw = 96;
  for (let y = 0; y < h; y += bh) for (let x = -((y / bh) % 2) * bw / 2; x < w; x += bw) {
    const r = rnd(95, 135), gg = rnd(45, 60), b = rnd(35, 48);
    g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
  }
  grime(g, w, h, 60, 0.35);
}, { repeat });

export const asphalt = (repeat) => canvasTex('asphalt', 256, 256, (g, w, h) => {
  g.fillStyle = '#1c1c1e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i++) { const v = rnd(20, 60); g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(rnd(0, w), rnd(0, h), 1.5, 1.5); }
}, { repeat });

export const sidewalk = (repeat) => canvasTex('sidewalk', 256, 256, (g, w, h) => {
  g.fillStyle = '#5d5a55'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { const v = rnd(60, 110); g.fillStyle = `rgba(${v},${v},${v - 4},0.6)`; g.fillRect(rnd(0, w), rnd(0, h), 2, 2); }
  g.strokeStyle = '#3b3936'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  grime(g, w, h, 20, 0.4);
}, { repeat });

// product box faces: a bright label band and a fake brand mark
const BRANDS = ['KRISPO', 'BIG DIP', 'HOTZ', 'MAMA K', 'NITE OWL', 'SUNNYS', 'TWIST', 'GOLDEN', 'BLAZE', 'CRUNCHA', 'PHILLY PUFF', 'ZING'];
export function productLabel(i) {
  return canvasTex('prod' + i, 128, 128, (g, w, h) => {
    const hue = (i * 47) % 360;
    g.fillStyle = `hsl(${hue},70%,45%)`; g.fillRect(0, 0, w, h);
    g.fillStyle = `hsl(${(hue + 40) % 360},85%,60%)`; g.fillRect(0, h * 0.35, w, h * 0.32);
    g.fillStyle = i % 3 ? '#fff' : '#111'; g.font = 'bold 22px Arial Black, Arial'; g.textAlign = 'center';
    g.fillText(BRANDS[i % BRANDS.length], w / 2, h * 0.58);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(w * 0.78, h * 0.18, 12, 0, 7); g.fill();
  });
}

export function signTex(text, { bg = '#111', fg = '#fff', w = 512, h = 128, font = 'bold 64px Arial Black, Arial', glow = null } = {}) {
  return canvasTex('sign' + text + bg + fg, w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (glow) { g.shadowColor = glow; g.shadowBlur = 24; }
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((l, k) => g.fillText(l, w / 2, h / 2 + (k - (lines.length - 1) / 2) * (h / lines.length) * 0.9));
  }, { repeat: [1, 1] });
}

// handwritten paper sign
export function paperSign(text) {
  return canvasTex('paper' + text, 256, 192, (g, w, h) => {
    g.fillStyle = '#f2efe4'; g.fillRect(0, 0, w, h);
    grime(g, w, h, 8, 0.15);
    g.fillStyle = '#c21d1d'; g.font = 'bold 40px "Marker Felt", "Comic Sans MS", cursive'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((l, k) => g.fillText(l, w / 2 + rnd(-4, 4), h / 2 + (k - (lines.length - 1) / 2) * 48));
    g.fillStyle = 'rgba(200,200,190,0.8)'; g.fillRect(w / 2 - 30, 0, 60, 14);
  });
}

// soft irregular blood splat (alpha in red channel area); used for decals
export function bloodSplat(seed) {
  return canvasTex('blood' + seed, 128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    g.fillStyle = 'rgba(255,255,255,1)';
    g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 10) {
      const r = rnd(22, 40);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.fill();
    for (let i = 0; i < 14; i++) {
      const a = rnd(0, 7), d = rnd(36, 60), r = rnd(2, 7);
      g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, 0, 7); g.fill();
    }
  }, { srgb: false });
}

export function screenNoise() {
  return canvasTex('noise', 128, 128, (g, w, h) => {
    const d = g.createImageData(w, h);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }, { srgb: false });
}
