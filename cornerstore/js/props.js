// Detailed props for the booth: the cash register with a real till, the stash drawer, and the tobacco wall.
// Everything here is built from code so it works before any modelled asset exists; assets.js can swap in a
// modelled GLB for any of them later (see assets/models/manifest.json).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { spots } from './store.js';

// Merge every mesh under `group` (except subtrees in `skip`) into one mesh per material, in the group's own space.
function bakeLocal(group, skip = []) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert(), by = new Map(), gone = [];
  const walk = (o) => {
    if (skip.includes(o)) return;
    if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material)) {
      let g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      const key = o.material.uuid + (o.castShadow ? 'c' : ''); if (!by.has(key)) by.set(key, { mat: o.material, cast: o.castShadow, geos: [] }); by.get(key).geos.push(g); gone.push(o);
    }
    for (const c of [...o.children]) walk(c);
  };
  for (const c of [...group.children]) walk(c);
  for (const o of gone) o.parent?.remove(o);
  for (const { mat, cast, geos } of by.values()) { const m = new THREE.Mesh(mergeGeometries(geos, false), mat); m.castShadow = cast; m.receiveShadow = true; group.add(m); }
}

const canvasTex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
};
const std = (o) => new THREE.MeshStandardMaterial(o);
const mesh = (geo, mat, x = 0, y = 0, z = 0, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent?.add(m); return m; };
const box = (w, h, d, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);

// ------------------------------------------------------------------ bills
function billTex(denom, tint) {
  return canvasTex(256, 110, (g, w, h) => {
    g.fillStyle = tint; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(20,50,30,0.75)'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
    g.lineWidth = 1; g.strokeRect(11, 11, w - 22, h - 22);
    g.fillStyle = 'rgba(25,60,35,0.55)'; g.beginPath(); g.ellipse(w / 2, h / 2, 34, 42, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(210,225,200,0.5)'; g.beginPath(); g.ellipse(w / 2, h / 2 - 6, 14, 17, 0, 0, 7); g.fill();
    g.fillRect(w / 2 - 20, h / 2 + 12, 40, 22);
    g.fillStyle = 'rgba(15,45,25,0.9)'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [x, y] of [[30, 26], [w - 30, 26], [30, h - 24], [w - 30, h - 24]]) g.fillText(denom, x, y);
    g.font = '9px Georgia, serif'; g.fillText('LARCHWOOD RESERVE NOTE', w / 2, 17);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
  });
}

// ------------------------------------------------------------------ cash register
export function buildRegister(store) {
  const reg = new THREE.Group(); reg.userData.dynamic = true;
  reg.position.copy(spots.register); reg.position.y = 1.045; reg.rotation.y = -Math.PI / 2; store.root.add(reg);
  // local axes: +z is toward you (the cashier), +x is to your left as you face the customer window
  const shell = std({ color: 0x3a3c40, roughness: 0.5, metalness: 0.35 });
  const shellLight = std({ color: 0xb9b4a6, roughness: 0.62 });
  const steel = std({ color: 0x9a9da2, roughness: 0.32, metalness: 0.9 });
  const black = std({ color: 0x101012, roughness: 0.55 });
  const W = 0.44, D = 0.44, H = 0.115;
  // drawer housing: open at the front so you can see into the cavity when the drawer is out
  box(W, 0.012, D, shell, 0, H - 0.006, 0, reg); box(W, 0.008, D, shell, 0, 0.004, 0, reg);
  box(0.012, H, D, shell, -W / 2 + 0.006, H / 2, 0, reg); box(0.012, H, D, shell, W / 2 - 0.006, H / 2, 0, reg);
  box(W, H, 0.012, shell, 0, H / 2, -D / 2 + 0.006, reg);
  // upper body: a sloped keypad deck and a raised display pod
  const deck = box(W - 0.02, 0.07, 0.26, shellLight, 0, H + 0.03, 0.07, reg); deck.rotation.x = 0.22;
  box(W - 0.02, 0.15, 0.17, shellLight, 0, H + 0.075, -0.125, reg);
  const keyGeo = new THREE.BoxGeometry(0.026, 0.012, 0.022);
  const keyMats = [std({ color: 0xe6e2d6, roughness: 0.5 }), std({ color: 0x2f3237, roughness: 0.5 }), std({ color: 0xb8402c, roughness: 0.5 }), std({ color: 0x2f7d4a, roughness: 0.5 })];
  const keys = new THREE.Group(); keys.position.set(0, H + 0.068, 0.07); keys.rotation.x = 0.22; reg.add(keys);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 10; c++) {
    if (c === 5) continue;
    const mi = c > 5 ? (r === 5 && c === 9 ? 3 : (r === 0 && c > 7) ? 2 : 0) : (r === 0 ? 1 : (c + r) % 7 === 0 ? 1 : 0);
    const k = new THREE.Mesh(keyGeo, keyMats[mi]); k.position.set(-0.165 + c * 0.0345 + (c > 5 ? 0.008 : 0), 0, -0.09 + r * 0.031); keys.add(k);
  }
  // operator display: a little green LCD that shows the last sale
  const lcd = document.createElement('canvas'); lcd.width = 256; lcd.height = 96;
  const lcdTex = new THREE.CanvasTexture(lcd); lcdTex.colorSpace = THREE.SRGBColorSpace;
  const drawLcd = (top, big) => { const g = lcd.getContext('2d'); g.fillStyle = '#0b1a10'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#58f08a'; g.font = '16px monospace'; g.textAlign = 'left'; g.fillText(top, 12, 26); g.font = 'bold 44px monospace'; g.textAlign = 'right'; g.fillText(big, 244, 78); lcdTex.needsUpdate = true; };
  drawLcd('LARCHWOOD FOOD MKT', '0.00');
  const pod = box(0.2, 0.085, 0.05, shell, -0.09, H + 0.2, -0.13, reg); pod.rotation.x = -0.35;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.175, 0.062), new THREE.MeshBasicMaterial({ map: lcdTex })); screen.position.set(-0.09, H + 0.2, -0.103); screen.rotation.x = -0.35; reg.add(screen);
  // receipt printer with a curl of paper
  box(0.13, 0.05, 0.11, shell, 0.13, H + 0.175, -0.13, reg);
  const paper = mesh(new THREE.PlaneGeometry(0.075, 0.12), std({ color: 0xf4f1e8, roughness: 0.9, side: THREE.DoubleSide }), 0.13, H + 0.24, -0.1, reg); paper.rotation.x = -0.5;
  // customer-facing pole display
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), steel, -0.17, H + 0.25, -0.19, reg);
  box(0.16, 0.05, 0.03, shell, -0.17, H + 0.36, -0.19, reg);
  mesh(new THREE.PlaneGeometry(0.14, 0.036), new THREE.MeshBasicMaterial({ color: 0x39d98a }), -0.17, H + 0.36, -0.2055, reg).rotation.y = Math.PI;

  // the drawer and its till
  const drawer = new THREE.Group(); drawer.position.set(0, 0.012, 0.01); reg.add(drawer);
  const dw = W - 0.03, dd = D - 0.03, dh = H - 0.03;
  box(dw, 0.006, dd, steel, 0, 0.003, 0, drawer);
  box(0.006, dh, dd, steel, -dw / 2 + 0.003, dh / 2, 0, drawer); box(0.006, dh, dd, steel, dw / 2 - 0.003, dh / 2, 0, drawer);
  box(dw, dh, 0.006, steel, 0, dh / 2, -dd / 2 + 0.003, drawer);
  box(W - 0.004, H - 0.006, 0.014, shell, 0, H / 2 - 0.012, dd / 2 + 0.006, drawer);           // drawer face
  mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 12), steel, 0.14, H / 2 - 0.012, dd / 2 + 0.015, drawer).rotation.x = Math.PI / 2;   // lock
  box(0.12, 0.012, 0.012, black, 0, 0.022, dd / 2 + 0.016, drawer);                              // finger pull
  // till insert: bills toward you, coin cups behind them
  const tray = std({ color: 0x18181a, roughness: 0.6 });
  box(dw - 0.014, 0.01, dd - 0.014, tray, 0, 0.011, 0, drawer);
  const cw = (dw - 0.02) / 5;
  for (let i = 0; i <= 5; i++) box(0.004, 0.05, dd - 0.02, tray, -dw / 2 + 0.01 + i * cw, 0.036, 0, drawer);
  box(dw - 0.02, 0.05, 0.004, tray, 0, 0.036, -0.045, drawer);
  const denoms = [['1', '#b9c7a8'], ['5', '#b3c2b0'], ['10', '#c7c4a0'], ['20', '#a9c0a2'], ['50', '#c2b8a8']];
  const stacks = denoms.map(([d, tint], i) => {
    const top = std({ map: billTex(d, tint), roughness: 0.85 }), side = std({ color: 0x9aa890, roughness: 0.9 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(cw - 0.012, 1, 0.155), [side, side, top, side, side, side]);
    m.position.set(dw / 2 - 0.01 - cw / 2 - i * cw, 0.02, 0.07); m.rotation.y = (Math.random() - 0.5) * 0.05; drawer.add(m);
    const clip = box(cw - 0.016, 0.004, 0.012, steel, m.position.x, 0.05, 0.02, drawer);
    return { m, clip };
  });
  const coinMat = [std({ color: 0xb87333, roughness: 0.35, metalness: 0.9 }), std({ color: 0xc9ccd1, roughness: 0.3, metalness: 0.95 }), std({ color: 0xc9ccd1, roughness: 0.3, metalness: 0.95 }), std({ color: 0xd0d2d6, roughness: 0.3, metalness: 0.95 }), std({ color: 0xcdb46a, roughness: 0.3, metalness: 0.9 })];
  const coinR = [0.0095, 0.0105, 0.009, 0.012, 0.013];
  for (let i = 0; i < 5; i++) {
    const cx = dw / 2 - 0.01 - cw / 2 - i * cw;
    for (let k = 0; k < 14; k++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(coinR[i], coinR[i], 0.0018, 10), coinMat[i]);
      c.position.set(cx + (Math.random() - 0.5) * (cw - 0.035), 0.018 + Math.floor(k / 5) * 0.002 + Math.random() * 0.002, -0.125 + (Math.random() - 0.5) * 0.13);
      c.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * 3, (Math.random() - 0.5) * 0.5); drawer.add(c);
    }
  }
  bakeLocal(drawer, stacks.flatMap(s => [s.m, s.clip]));
  bakeLocal(reg, [drawer, screen]);
  const r = {
    group: reg, drawer, drawerZ: drawer.position.z, screen, open: 0, hold: 0,
    // bill stacks grow and shrink with what is in the drawer
    setCash(total) {
      let left = Math.max(0, Math.round(total));
      const share = [0.1, 0.15, 0.2, 0.45, 0.1], val = [1, 5, 10, 20, 50];
      stacks.forEach(({ m, clip }, i) => {
        const n = Math.round(left > 0 ? total * share[i] / val[i] : 0);
        const h = Math.min(0.03, n * 0.0011);
        m.visible = clip.visible = n > 0; m.scale.y = Math.max(0.0012, h); m.position.y = 0.017 + h / 2; clip.position.y = 0.02 + h;
      });
    },
    showSale(label, amount) { drawLcd(label, amount); },
  };
  r.setCash(100);
  return r;
}

// ------------------------------------------------------------------ the stash drawer (the side hustle)
export function buildStash(store) {
  const root = new THREE.Group(); root.userData.dynamic = true; root.position.set(-3.38, 0.66, 2.45); store.root.add(root);
  const wood = std({ color: 0x3a2c22, roughness: 0.75 }), ply = std({ color: 0x6f5a44, roughness: 0.85 });
  const drawer = new THREE.Group(); root.add(drawer);
  const W = 0.46, D = 0.44, H = 0.17;   // W along x (slides toward -x, toward you), D along z
  box(W, 0.012, D, ply, 0, 0.006, 0, drawer);
  box(W, H, 0.012, ply, 0, H / 2, -D / 2 + 0.006, drawer); box(W, H, 0.012, ply, 0, H / 2, D / 2 - 0.006, drawer);
  box(0.012, H, D, ply, W / 2 - 0.006, H / 2, 0, drawer);
  box(0.018, H + 0.03, D + 0.03, wood, -W / 2 - 0.004, H / 2, 0, drawer);                                  // drawer front
  box(0.012, 0.014, 0.12, std({ color: 0x8c9096, roughness: 0.3, metalness: 0.9 }), -W / 2 - 0.02, H / 2 + 0.02, 0, drawer);   // pull
  // mason jars of bud
  const glass = std({ color: 0xdff1ee, transparent: true, opacity: 0.22, roughness: 0.03, metalness: 0.1, depthWrite: false });
  const lid = std({ color: 0xb49a4a, roughness: 0.35, metalness: 0.85 });
  const budMats = [std({ color: 0x4f7a2c, roughness: 0.95 }), std({ color: 0x6a8f35, roughness: 0.95 }), std({ color: 0x3d5f2a, roughness: 0.95 }), std({ color: 0x8a5a9a, roughness: 0.9 }), std({ color: 0xc27a2a, roughness: 0.9 })];
  const budGeo = new THREE.IcosahedronGeometry(1, 0);
  const bud = (parent, x, y, z, s) => {
    const m = new THREE.Mesh(budGeo, budMats[Math.random() < 0.8 ? Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 2)]);
    m.position.set(x, y, z); m.scale.set(s * (0.8 + Math.random() * 0.5), s * (0.9 + Math.random() * 0.7), s * (0.8 + Math.random() * 0.5)); m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); parent.add(m); return m;
  };
  const jars = [];
  for (let i = 0; i < 3; i++) {
    const j = new THREE.Group(); j.position.set(0.12, 0.012, -0.14 + i * 0.14); drawer.add(j);
    mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.12, 14, 1, true), glass, 0, 0.06, 0, j).castShadow = false;
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.016, 14), lid, 0, 0.128, 0, j);
    const label = mesh(new THREE.PlaneGeometry(0.06, 0.035), std({ map: canvasTex(128, 76, (g) => { g.fillStyle = '#f1ead6'; g.fillRect(0, 0, 128, 76); g.fillStyle = '#222'; g.font = 'bold 22px "Comic Sans MS", cursive'; g.textAlign = 'center'; g.fillText(['GELATO', 'RUNTZ', 'SOUR D'][i], 64, 34); g.font = '15px monospace'; g.fillText(['$20 a dub', '$25', '$20'][i], 64, 60); }), roughness: 0.9 }), -0.0485, 0.06, 0, j);
    label.rotation.y = -Math.PI / 2;
    const fill = new THREE.Group(); j.add(fill);
    for (let k = 0; k < 16; k++) { const a = Math.random() * 7, r = Math.random() * 0.03; bud(fill, Math.cos(a) * r, 0.014 + k * 0.0062, Math.sin(a) * r, 0.013); }
    bakeLocal(fill); jars.push(fill);
  }
  // dime bags lined up at the front, a pocket scale, rolling papers and the night's roll of cash
  const bagMat = std({ color: 0xe8f4f0, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false });
  const bags = [];
  for (let i = 0; i < 8; i++) {
    const b = new THREE.Group(); b.position.set(-0.06 - (i % 2) * 0.075, 0.016 + Math.floor(i / 4) * 0.006, -0.16 + Math.floor(i / 2) * 0.062); b.rotation.y = (Math.random() - 0.5) * 0.6; drawer.add(b);
    mesh(new THREE.BoxGeometry(0.058, 0.012, 0.05), bagMat, 0, 0.006, 0, b).castShadow = false;
    box(0.058, 0.003, 0.006, std({ color: 0x2f6fd0, roughness: 0.5 }), 0, 0.012, -0.022, b);
    for (let k = 0; k < 4; k++) bud(b, (Math.random() - 0.5) * 0.03, 0.007, (Math.random() - 0.5) * 0.02, 0.008);
    bakeLocal(b); bags.push(b);
  }
  const scale = new THREE.Group(); scale.position.set(-0.1, 0.012, 0.13); scale.rotation.y = 0.2; drawer.add(scale);
  box(0.09, 0.014, 0.12, std({ color: 0x1b1c1f, roughness: 0.4 }), 0, 0.007, 0, scale);
  box(0.08, 0.003, 0.07, std({ color: 0xb9bcc0, roughness: 0.25, metalness: 0.9 }), 0, 0.016, -0.02, scale);
  mesh(new THREE.PlaneGeometry(0.045, 0.018), new THREE.MeshBasicMaterial({ map: canvasTex(96, 40, (g) => { g.fillStyle = '#12301e'; g.fillRect(0, 0, 96, 40); g.fillStyle = '#7dffb0'; g.font = 'bold 26px monospace'; g.textAlign = 'right'; g.fillText('3.5g', 90, 30); }) }), 0, 0.0146, 0.042, scale).rotation.x = -Math.PI / 2;
  const roll = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.066, 14), std({ map: billTex('20', '#a9c0a2'), roughness: 0.85 }), 0.02, 0.034, 0.17, drawer); roll.rotation.z = Math.PI / 2; roll.rotation.y = 0.4;
  mesh(new THREE.TorusGeometry(0.0225, 0.003, 6, 14), std({ color: 0xc23b2a, roughness: 0.6 }), 0.02, 0.034, 0.17, drawer).rotation.y = Math.PI / 2 + 0.4;
  box(0.07, 0.008, 0.035, std({ color: 0xd9632a, roughness: 0.7 }), 0.0, 0.016, 0.1, drawer).rotation.y = -0.3;   // papers
  bakeLocal(drawer, [...bags, ...jars]);
  const s = {
    root, drawer, out: false, open: 0,
    setWeed(n) {
      bags.forEach((b, i) => { b.visible = i < Math.min(8, n); });
      jars.forEach((fill, j) => { const f = Math.max(0, Math.min(1, (n - j * 3) / 9 + 0.3)); fill.visible = n > 0; fill.scale.y = Math.max(0.15, f); });
    },
  };
  s.setWeed(6);
  return s;
}

// ------------------------------------------------------------------ the tobacco wall behind you
const BRANDS = [
  ['NORTHSTAR', 'FULL FLAVOR', '#b3202a', '#ffffff', '#f4e9d2'], ['NORTHSTAR', 'GOLD', '#f0ebe0', '#b08a2e', '#3a2c12'], ['BROAD ST', 'MENTHOL', '#0f6b4f', '#e9fff4', '#e9fff4'],
  ['BROAD ST', 'MENTHOL 100s', '#12523f', '#9ff0c8', '#e9fff4'], ['KEYSTONE', 'REDS', '#8f1620', '#f5d27a', '#f5d27a'], ['KEYSTONE', 'BLUES', '#1c3f8a', '#dfe9ff', '#dfe9ff'],
  ['SILVER LINE', 'ULTRA', '#d7dade', '#2a3b6b', '#2a3b6b'], ['BLACKWOOD', 'UNFILTERED', '#151515', '#c9a24a', '#c9a24a'], ['GOLD LEAF', 'KINGS', '#c9972b', '#3b1d08', '#3b1d08'],
  ['PARKSIDE', 'ORIGINAL', '#e7dcc0', '#7a1f1f', '#7a1f1f'], ['215', 'MENTHOL ICE', '#18a6a0', '#ffffff', '#ffffff'], ['SCHUYLKILL', 'SMOOTH', '#3d2c5e', '#e9d9ff', '#e9d9ff'],
];
const WRAPS = [['DUTCHY', 'SWEET', '#d83a8a'], ['DUTCHY', 'GRAPE', '#6a2fa8'], ['BACKYARD', 'HONEY', '#d8962a'], ['BACKYARD', 'RUSSIAN CREAM', '#e8dcc8'], ['GAME DAY', 'GREEN', '#2e9a48'], ['GAME DAY', 'WHITE GRAPE', '#b9c44a'], ['WHITE CAT', 'TIPS', '#e9e9e9'], ['SWISHY', 'MANGO', '#f07f2a']];

function packTex([name, sub, bg, fg, ink]) {
  return canvasTex(128, 200, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, w, 0); grad.addColorStop(0, 'rgba(0,0,0,0.18)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.08)'); grad.addColorStop(1, 'rgba(0,0,0,0.22)'); g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.beginPath(); g.moveTo(0, 46); g.lineTo(w / 2, 82); g.lineTo(w, 46); g.lineTo(w, 60); g.lineTo(w / 2, 96); g.lineTo(0, 60); g.fill();
    g.beginPath(); g.arc(w / 2, 34, 15, 0, 7); g.fill(); g.fillStyle = bg; g.beginPath(); g.arc(w / 2, 34, 10, 0, 7); g.fill();
    g.fillStyle = ink; g.textAlign = 'center'; g.font = `bold ${name.length > 8 ? 17 : 22}px Georgia, serif`; g.fillText(name, w / 2, 122);
    g.font = '10px Arial'; g.fillText(sub, w / 2, 138); g.fillText('20 CLASS A CIGARETTES', w / 2, 150);
    g.fillStyle = '#fff'; g.fillRect(8, 158, w - 16, 36); g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeRect(8, 158, w - 16, 36);
    g.fillStyle = '#000'; g.font = 'bold 7.5px Arial'; g.fillText('WARNING: Smoking', w / 2, 170); g.fillText('causes lung cancer,', w / 2, 179); g.fillText('heart disease.', w / 2, 188);
  });
}
function wrapTex([name, sub, bg]) {
  return canvasTex(128, 180, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.22)'; for (let i = -h; i < w; i += 22) { g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.lineTo(i + h + 9, 0); g.lineTo(i + 9, h); g.fill(); }
    g.fillStyle = '#111'; g.fillRect(0, 60, w, 54); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `bold ${name.length > 7 ? 19 : 24}px Impact, Arial Black, sans-serif`; g.fillText(name, w / 2, 88); g.font = 'bold 11px Arial'; g.fillStyle = bg; g.fillText(sub, w / 2, 105);
    g.fillStyle = '#ffe14a'; g.beginPath(); g.arc(w - 24, 26, 18, 0, 7); g.fill(); g.fillStyle = '#b00'; g.font = 'bold 12px Arial'; g.fillText('2 FOR', w - 24, 24); g.fillText('99¢', w - 24, 36);
    g.fillStyle = '#fff'; g.fillRect(6, 146, w - 12, 28); g.fillStyle = '#000'; g.font = 'bold 7px Arial'; g.fillText('WARNING: Cigar smoking can', w / 2, 158); g.fillText('cause cancers of the mouth.', w / 2, 167);
  });
}

export function buildTobaccoWall(store, x, z0) {
  const root = store.root, dummy = new THREE.Object3D();
  const ROWS = 6, LEN = 3.55, rowH = 0.185, y0 = 1.02;
  const rail = std({ color: 0x1c1d20, roughness: 0.5, metalness: 0.4 });
  // back board and the header sign
  box(0.02, ROWS * rowH + 0.1, LEN + 0.1, std({ color: 0x24262b, roughness: 0.8 }), x - 0.045, y0 + ROWS * rowH / 2 - 0.02, z0 + LEN / 2, root);
  const header = canvasTex(1024, 96, (g, w, h) => { g.fillStyle = '#0d0e11'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd21f'; g.font = 'bold 50px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TOBACCO  •  WE CARD  •  UNDER 21 NO SALE', w / 2, h / 2 + 2); });
  const hd = mesh(new THREE.PlaneGeometry(LEN, 0.22), new THREE.MeshBasicMaterial({ map: header }), x - 0.41, 2.62, z0 + LEN / 2, root); hd.rotation.y = Math.PI / 2;
  // shelf rails with a price strip on each
  const strip = canvasTex(1024, 32, (g, w, h) => { g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 20px Arial'; for (let i = 0; i < 16; i++) { g.fillText('$' + (10 + Math.floor(Math.random() * 4)) + '.' + ['49', '99', '29', '75'][i % 4], 12 + i * 64, 23); g.fillStyle = '#c0161c'; g.fillRect(i * 64 + 58, 4, 2, 24); g.fillStyle = '#111'; } });
  for (let r = 0; r < ROWS; r++) {
    box(0.07, 0.012, LEN, rail, x - 0.005, y0 + r * rowH - 0.006, z0 + LEN / 2, root);
    const st = mesh(new THREE.PlaneGeometry(LEN, 0.028), std({ map: strip, roughness: 0.8 }), x + 0.031, y0 + r * rowH - 0.014, z0 + LEN / 2, root); st.rotation.y = Math.PI / 2; st.castShadow = false;
  }
  // packs: each brand gets a block of facings, a few deep, like a real rack
  const side = std({ color: 0xe9e6dc, roughness: 0.7 });
  const packGeo = new THREE.BoxGeometry(0.022, 0.088, 0.055);
  const slots = BRANDS.map(() => []);
  for (let r = 0; r < ROWS - 1; r++) {
    let z = z0 + 0.04, b = (r * 5) % BRANDS.length;
    while (z < z0 + LEN - 0.05) {
      const facings = 3 + Math.floor(Math.random() * 3);
      for (let f = 0; f < facings && z < z0 + LEN - 0.05; f++, z += 0.059) {
        if (Math.random() < 0.06) continue;                       // an empty facing
        const deep = 1 + Math.floor(Math.random() * 2);
        for (let d = 0; d < deep; d++) slots[b].push([x + 0.012 - d * 0.023, y0 + r * rowH + 0.046, z, (Math.random() - 0.5) * 0.04]);
      }
      b = (b + 1) % BRANDS.length; z += 0.012;
    }
  }
  BRANDS.forEach((br, i) => {
    if (!slots[i].length) return;
    const front = std({ map: packTex(br), roughness: 0.42 });
    const im = new THREE.InstancedMesh(packGeo, [front, side, side, side, side, side], slots[i].length);
    slots[i].forEach(([px, py, pz, ry], k) => { dummy.position.set(px, py, pz); dummy.rotation.set(0, ry, -0.06); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); });
    im.receiveShadow = true; root.add(im);
  });
  // top row: blunt wraps and cigarillo pouches
  const pouchGeo = new THREE.BoxGeometry(0.008, 0.13, 0.085);
  const top = y0 + (ROWS - 1) * rowH;
  WRAPS.forEach((wr, i) => {
    const front = std({ map: wrapTex(wr), roughness: 0.3, metalness: 0.15 });
    const n = 5, im = new THREE.InstancedMesh(pouchGeo, [front, side, side, side, side, side], n);
    for (let k = 0; k < n; k++) { dummy.position.set(x + 0.01 - (k % 2) * 0.01, top + 0.068, z0 + 0.07 + i * 0.44 + Math.floor(k / 2) * 0.092 + (k % 2) * 0.03); dummy.rotation.set(0, (Math.random() - 0.5) * 0.08, -0.1); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); }
    root.add(im);
  });
  // lighter tray on the counter-height ledge below
  const ledge = box(0.14, 0.02, 0.5, rail, x + 0.03, y0 - 0.1, z0 + 0.4, root);
  const cols = [0xd8312a, 0x2a6fd8, 0x2ea84a, 0xf2c21f, 0x8a3fd0, 0xf07f2a, 0x18b0b0];
  const lm = cols.map(c => std({ color: c, roughness: 0.25 })), cap = std({ color: 0xc9ccd1, metalness: 0.9, roughness: 0.3 });
  for (let i = 0; i < 28; i++) { const l = mesh(new THREE.BoxGeometry(0.012, 0.075, 0.024), lm[i % 7], x + 0.01 + (i % 2) * 0.03, y0 - 0.052, z0 + 0.2 + Math.floor(i / 2) * 0.03, root); l.rotation.z = -0.15; mesh(new THREE.BoxGeometry(0.012, 0.012, 0.022), cap, 0, 0.043, 0, l); }
  return { ledge };
}
