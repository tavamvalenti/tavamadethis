// The store: a greybox-but-lit Philly corner store, plus the street outside the glass.
// Room: x -7..7, z -5 (back wall) .. 6 (front wall with door and windows). Ceiling 3.2 m.
// The plexiglass booth with the register is in the front-left corner.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import * as T from './textures.js';

export const ROOM = { x0: -7, x1: 7, z0: -5, z1: 6, h: 3.2 };
export const BOOTH = { x0: -7, x1: -3, z0: 1.8, z1: 6 };
export const DOOR = { x0: 3.4, x1: 4.6 };

export const spots = {
  outside: new THREE.Vector3(4, 0, 8.2),
  doorIn: new THREE.Vector3(4, 0, 5.1),
  counter: new THREE.Vector3(-2.45, 0, 3.3),     // where a customer stands to talk
  queue: [new THREE.Vector3(-2.2, 0, 4.5), new THREE.Vector3(-1.4, 0, 5.2), new THREE.Vector3(-0.6, 0, 5.5)],
  register: new THREE.Vector3(-3.4, 1.05, 3.3),
  playerStart: new THREE.Vector3(-4.7, 0, 3.3),
  boothOut: new THREE.Vector3(-3.9, 0, 1.15),
  boothIn: new THREE.Vector3(-3.9, 0, 2.5),
  turntable: new THREE.Vector3(-3.0, 1.06, 3.3),
};

// browse points: where people stand + what they look at
export const browsePoints = [];
for (const z of [-1.6, 0.35]) for (const x of [-0.4, 1.0, 2.4, 3.6]) {
  browsePoints.push({ p: new THREE.Vector3(x, 0, z), look: new THREE.Vector3(x, 1.2, z + (Math.random() < 0.5 ? -0.6 : 0.6)), kind: 'shelf' });
}
for (const x of [-4.5, -2.5, -0.5, 1.5, 3.5, 5.0]) browsePoints.push({ p: new THREE.Vector3(x, 0, -3.75), look: new THREE.Vector3(x, 1.2, -5), kind: 'fridge' });
for (const z of [-2.2, -0.6, 0.8]) browsePoints.push({ p: new THREE.Vector3(5.55, 0, z), look: new THREE.Vector3(7, 1.1, z), kind: 'deli' });
browsePoints.push({ p: new THREE.Vector3(-1.9, 0, 5.3), look: new THREE.Vector3(-2.6, 1.2, 5.4), kind: 'lotto' });

// navigation graph so people walk around the shelves
const N = (x, z) => new THREE.Vector3(x, 0, z);
export const nav = {
  nodes: {
    doorIn: N(4, 5.1), frontMid: N(1.4, 3.4), counter: N(-2.45, 3.3), westFront: N(-2.1, 2.5), eastFront: N(5.0, 2.6),
    W0: N(-2.1, 0.35), W1: N(-2.1, -1.6), W2: N(-2.1, -3.75), E0: N(5.0, 0.35), E1: N(5.0, -1.6), E2: N(5.0, -3.75),
    boothOut: N(-3.9, 1.15), boothIn: N(-3.9, 2.5), behind: N(-3.7, 3.3), farW: N(-5.5, -3.75),
  },
  edges: [['doorIn', 'frontMid'], ['doorIn', 'eastFront'], ['frontMid', 'counter'], ['frontMid', 'westFront'], ['frontMid', 'eastFront'],
    ['westFront', 'counter'], ['westFront', 'W0'], ['W0', 'W1'], ['W1', 'W2'], ['eastFront', 'E0'], ['E0', 'E1'], ['E1', 'E2'],
    ['W0', 'E0'], ['W1', 'E1'], ['W2', 'E2'], ['W2', 'farW'], ['boothOut', 'W0'], ['boothOut', 'farW'], ['boothOut', 'boothIn'], ['boothIn', 'behind']],
};

export class Store {
  constructor(scene, renderer) {
    this.scene = scene;
    this.colliders = [];      // {x0,x1,z0,z1, tag}
    this.interactables = [];  // {id, pos, r, prompt(), use()}
    this.surfaces = [];       // meshes blood can land on
    this.flicker = [];
    this.boothDoorOpen = false;
    this.cameras = [];
    this.root = new THREE.Group();
    scene.add(this.root);
    RectAreaLightUniformsLib.init();
    this._mats();
    this._room();
    this._booth();
    this._shelves();
    this._fridges();
    this._deli();
    this._props();
    this._lights();
    this._outside();
    this._cctv();
  }

  _mats() {
    this.m = {
      floor: new THREE.MeshStandardMaterial({ map: T.floorTile([7, 5.5]), roughness: 0.32, metalness: 0 }),
      wall: new THREE.MeshStandardMaterial({ map: T.wallPaint([4, 1.5]), roughness: 0.9 }),
      ceil: new THREE.MeshStandardMaterial({ map: T.ceilingTile([14, 11]), roughness: 0.95 }),
      shelf: new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.45, metalness: 0.55 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.6, metalness: 0.3 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.7 }),
      counter: new THREE.MeshStandardMaterial({ color: 0x8a1c1c, roughness: 0.55 }),
      counterTop: new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: 0.25, metalness: 0.2 }),
      plexi: new THREE.MeshStandardMaterial({ color: 0xbfd8dc, transparent: true, opacity: 0.12, roughness: 0.04, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
      glass: new THREE.MeshStandardMaterial({ color: 0x9fb3b8, transparent: true, opacity: 0.1, roughness: 0.02, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }),
      metal: new THREE.MeshStandardMaterial({ color: 0x8c9096, roughness: 0.35, metalness: 0.85 }),
      tube: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeef6ff, emissiveIntensity: 3.2 }),
    };
  }

  box(w, h, d, mat, x, y, z, { collide = false, tag = '', surface = true, cast = true, receive = true, parent = this.root } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast; m.receiveShadow = receive;
    parent.add(m);
    if (collide) this.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, tag });
    if (surface) this.surfaces.push(m);
    return m;
  }

  _room() {
    const { x0, x1, z0, z1, h } = ROOM, W = x1 - x0, D = z1 - z0;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.m.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (z0 + z1) / 2); floor.receiveShadow = true;
    this.root.add(floor); this.surfaces.push(floor); this.floor = floor;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.m.ceil);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, h, (z0 + z1) / 2); this.root.add(ceil);
    // back + side walls
    this.box(W, h, 0.2, this.m.wall, 0, h / 2, z0 - 0.1, { collide: true });
    this.box(0.2, h, D, this.m.wall, x0 - 0.1, h / 2, (z0 + z1) / 2, { collide: true });
    this.box(0.2, h, D, this.m.wall, x1 + 0.1, h / 2, (z0 + z1) / 2, { collide: true });
    // front wall: low brick kneewall, glass above, header, with the door gap
    const brickM = new THREE.MeshStandardMaterial({ map: T.brick([3, 0.5]), roughness: 0.9 });
    const seg = (a, b) => {
      const w = b - a, cx = (a + b) / 2;
      this.box(w, 0.85, 0.25, brickM, cx, 0.425, z1 + 0.12, { collide: true });
      this.box(w, 0.6, 0.25, brickM, cx, h - 0.3, z1 + 0.12);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w, h - 1.45), this.m.glass);
      g.position.set(cx, 0.85 + (h - 1.45) / 2, z1 + 0.12); this.root.add(g);
      // window frame mullions
      for (let x = a; x <= b + 0.01; x += w / Math.max(1, Math.round(w / 2.2))) this.box(0.06, h - 1.45, 0.08, this.m.dark, x, 0.85 + (h - 1.45) / 2, z1 + 0.12, { surface: false });
      // roll-down security gate housing
      this.box(w, 0.25, 0.3, this.m.metal, cx, h - 0.05, z1 + 0.35, { surface: false });
    };
    seg(x0, DOOR.x0); seg(DOOR.x1, x1);
    // door frame + door (glass, opens on a hinge when someone passes)
    this.box(0.08, h, 0.25, this.m.dark, DOOR.x0, h / 2, z1 + 0.12, { surface: false });
    this.box(0.08, h, 0.25, this.m.dark, DOOR.x1, h / 2, z1 + 0.12, { surface: false });
    this.box(DOOR.x1 - DOOR.x0, 0.5, 0.25, brickM, (DOOR.x0 + DOOR.x1) / 2, h - 0.25, z1 + 0.12);
    const hinge = new THREE.Group(); hinge.position.set(DOOR.x0 + 0.04, 0, z1 + 0.12); this.root.add(hinge);
    const dw = DOOR.x1 - DOOR.x0 - 0.08;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(dw, 2.4), this.m.glass); pane.position.set(dw / 2, 1.25, 0); hinge.add(pane);
    for (const [w2, h2, x, y] of [[dw, 0.08, dw / 2, 0.05], [dw, 0.08, dw / 2, 2.45], [0.06, 2.45, 0.03, 1.25], [0.06, 2.45, dw - 0.03, 1.25], [0.5, 0.04, dw - 0.35, 1.05]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, 0.05), this.m.metal); f.position.set(x, y, 0); hinge.add(f);
    }
    const hours = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ map: T.paperSign('OPEN\n24 HRS') }));
    hours.position.set(dw / 2, 1.6, -0.01); hours.rotation.y = Math.PI; hinge.add(hours);
    this.door = { hinge, open: 0, target: 0 };
    // you never leave the store: an invisible wall in the doorway (only the player collides with it)
    this.colliders.push({ x0: DOOR.x0, x1: DOOR.x1, z0: z1 - 0.05, z1: z1 + 0.3, tag: 'doorway' });
    // paper signs on the walls
    const sign = (txt, x, y, z, ry) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.41), new THREE.MeshStandardMaterial({ map: T.paperSign(txt), roughness: 0.9 })); s.position.set(x, y, z); s.rotation.y = ry; this.root.add(s); };
    sign('NO\nLOITERING', 6.88, 2.2, 3.5, -Math.PI / 2);
    sign('NO CREDIT', -1.5, 2.5, -4.98, 0);
    sign('$5 MIN\nCARD', -2.98, 2.4, 4.6, Math.PI / 2);
    sign('NO\nREFUNDS', 2, 2.5, -4.98, 0);
  }

  _booth() {
    const { x0, x1, z0, z1 } = BOOTH;
    // counter along the customer side (x = -3)
    this.box(0.6, 1.0, z1 - z0 - 0.1, this.m.counter, x1 - 0.3, 0.5, (z0 + z1) / 2 + 0.05, { collide: true, tag: 'counter' });
    this.box(0.75, 0.05, z1 - z0 - 0.1, this.m.counterTop, x1 - 0.32, 1.02, (z0 + z1) / 2 + 0.05);
    // plexiglass wall on top of the counter, with the turntable slot
    const plexi = (w, hh, x, y, z, ry = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), this.m.plexi); p.position.set(x, y, z); p.rotation.y = ry; this.root.add(p); this.plexiPanes.push(p); return p; };
    this.plexiPanes = [];
    const slotZ0 = 3.0, slotZ1 = 3.6, top = ROOM.h - 0.05;
    plexi(slotZ0 - z0, top - 1.05, x1, (1.05 + top) / 2, (z0 + slotZ0) / 2, Math.PI / 2);
    plexi(z1 - slotZ1, top - 1.05, x1, (1.05 + top) / 2, (slotZ1 + z1) / 2, Math.PI / 2);
    plexi(slotZ1 - slotZ0, top - 1.4, x1, (1.4 + top) / 2, (slotZ0 + slotZ1) / 2, Math.PI / 2);
    // frame posts
    for (const z of [z0, slotZ0, slotZ1, z1 - 0.02]) this.box(0.06, top - 1.05, 0.06, this.m.metal, x1, (1.05 + top) / 2, z, { surface: false });
    // turntable (lazy susan) in the slot
    const tt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 24), this.m.metal);
    tt.position.set(x1, 1.065, (slotZ0 + slotZ1) / 2); this.root.add(tt);
    const ttWall = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.55), this.m.plexi); ttWall.position.set(0, 0.16, 0); tt.add(ttWall);
    this.turntable = { mesh: tt, spin: 0 };
    // side wall of the booth (z = z0): lower panel + plexi, with the booth door
    const dx0 = -4.4, dx1 = -3.4;
    this.box(dx0 - x0, 1.0, 0.1, this.m.counter, (x0 + dx0) / 2, 0.5, z0, { collide: true, tag: 'boothwall' });
    this.box(x1 - dx1, 1.0, 0.1, this.m.counter, (dx1 + x1) / 2, 0.5, z0, { collide: true, tag: 'boothwall' });
    plexi(dx0 - x0, top - 1.0, (x0 + dx0) / 2, (1.0 + top) / 2, z0);
    plexi(x1 - dx1, top - 1.0, (dx1 + x1) / 2, (1.0 + top) / 2, z0);
    this.box(0.06, top, 0.08, this.m.metal, dx0, top / 2, z0, { surface: false });
    this.box(0.06, top, 0.08, this.m.metal, dx1, top / 2, z0, { surface: false });
    this.box(dx1 - dx0, top - 2.25, 0.08, this.m.metal, (dx0 + dx1) / 2, (2.25 + top) / 2, z0, { surface: false });
    const hinge = new THREE.Group(); hinge.position.set(dx1 - 0.03, 0, z0); this.root.add(hinge);
    const dw = dx1 - dx0 - 0.06;
    const dPanel = new THREE.Mesh(new THREE.BoxGeometry(dw, 1.0, 0.06), this.m.counter); dPanel.position.set(-dw / 2, 0.5, 0); dPanel.castShadow = true; hinge.add(dPanel);
    const dGlass = new THREE.Mesh(new THREE.PlaneGeometry(dw, 1.2), this.m.plexi); dGlass.position.set(-dw / 2, 1.65, 0); hinge.add(dGlass);
    const dTop = new THREE.Mesh(new THREE.BoxGeometry(dw, 0.05, 0.07), this.m.metal); dTop.position.set(-dw / 2, 2.25, 0); hinge.add(dTop);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.1), this.m.metal); lock.position.set(-dw + 0.08, 1.0, 0); hinge.add(lock);
    this.boothDoor = { hinge, angle: 0, collider: { x0: dx0, x1: dx1, z0: z0 - 0.05, z1: z0 + 0.05, tag: 'boothdoor' } };
    this.colliders.push(this.boothDoor.collider);
    this.interactables.push({
      id: 'boothdoor', pos: new THREE.Vector3((dx0 + dx1) / 2, 1.1, z0), r: 0.7,
      prompt: () => this.boothDoorOpen ? 'Close and lock the booth door' : 'Unlock and open the booth door',
      use: () => this.setBoothDoor(!this.boothDoorOpen),
    });
    // booth inside: back shelves with cigarettes, liquor nips, the stash drawer
    this.box(0.4, 2.2, 3.8, this.m.wood, x0 + 0.2, 1.1, 3.9, { collide: true });
    const cigM = [0xb3202a, 0xe8e2d0, 0x1d5a9e, 0x2a7d3a, 0xd9a52a, 0x111111].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    const pack = new THREE.BoxGeometry(0.03, 0.09, 0.055);
    for (let row = 0; row < 7; row++) for (let i = 0; i < 52; i++) {
      const m = new THREE.Mesh(pack, cigM[(i * 7 + row * 3) % cigM.length]);
      m.position.set(x0 + 0.43, 0.95 + row * 0.17, 2.15 + i * 0.068); this.root.add(m);
    }
    for (let row = 0; row < 7; row++) this.box(0.05, 0.015, 3.7, this.m.metal, x0 + 0.42, 0.9 + row * 0.17, 3.9, { surface: false, cast: false });
    // nip bottles on top shelf
    const nipM = new THREE.MeshStandardMaterial({ color: 0x8a5a1a, roughness: 0.15, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 30; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.12, 8), nipM); b.position.set(x0 + 0.3, 2.27, 2.2 + i * 0.12); this.root.add(b); }
    // register
    const reg = new THREE.Group(); reg.position.copy(spots.register); reg.rotation.y = -Math.PI / 2; this.root.add(reg);
    const rBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), this.m.dark); rBase.position.y = 0.06; reg.add(rBase);
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.38), this.m.metal); drawer.position.set(0, 0.04, 0.02); reg.add(drawer);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.03), this.m.dark); screen.position.set(0, 0.28, -0.08); screen.rotation.x = -0.3; reg.add(screen);
    const scrFace = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.17), new THREE.MeshBasicMaterial({ color: 0x3fd17a })); scrFace.position.set(0, 0.28, -0.064); scrFace.rotation.x = -0.3; reg.add(scrFace);
    this.register = { group: reg, drawer, screen: scrFace, open: 0 };
    // card reader + scanner
    this.box(0.08, 0.12, 0.12, this.m.dark, -3.15, 1.1, 3.8, { surface: false });
    // stash drawer under the counter (the side hustle lives here)
    const stash = this.box(0.5, 0.18, 0.4, this.m.wood, -3.55, 0.75, 2.45, { surface: false });
    this.stash = { mesh: stash, out: false, baseX: -3.55 };
    // phone on the booth wall
    const phone = this.box(0.12, 0.22, 0.06, this.m.dark, x0 + 0.42, 1.5, 2.1, { surface: false });
    phone.rotation.y = Math.PI / 2;
    this.phonePos = new THREE.Vector3(x0 + 0.45, 1.5, 2.1);
    // booth fan + stool + space heater for character
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), this.m.dark); stool.position.set(-5.2, 0.7, 4.6); this.root.add(stool);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), this.m.metal); leg.position.set(-5.2, 0.35, 4.6); this.root.add(leg);
    // bulletproof sign + lotto display on the counter (customer side)
    const lotto = this.box(0.5, 1.3, 0.4, this.m.dark, -2.55, 0.65, 5.55, { collide: true, surface: true });
    const lottoScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ map: T.signTex('LOTTO\nPLAY HERE', { bg: '#0a3d8f', fg: '#ffd21f', w: 256, h: 192, font: 'bold 44px Arial Black, Arial' }) }));
    lottoScreen.position.set(-2.55, 1.05, 5.34); lottoScreen.rotation.y = Math.PI; this.root.add(lottoScreen);
    // candy rack hanging under the plexi on the customer side
    for (let i = 0; i < 18; i++) this.box(0.04, 0.14, 0.09, new THREE.MeshStandardMaterial({ map: T.productLabel(i + 3), roughness: 0.6 }), x1 + 0.05, 0.86, 2.0 + i * 0.2, { surface: false, cast: false });
  }

  setBoothDoor(open) {
    this.boothDoorOpen = open;
    const c = this.boothDoor.collider;
    if (open) { c.x0 = c.x1 = 999; } else { c.x0 = -4.4; c.x1 = -3.4; }
    this.onSound?.(open ? 'boothUnlock' : 'boothLock');
  }

  _shelves() {
    const len = 5.4, cx = 1.5, depth = 0.9;
    this.shelfSpots = [];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mats = Array.from({ length: 14 }, (_, i) => new THREE.MeshStandardMaterial({ map: T.productLabel(i), roughness: 0.55 }));
    const dummy = new THREE.Object3D();
    for (const z of [-2.6, -0.6, 1.3]) {
      this.box(len, 0.12, depth, this.m.dark, cx, 0.06, z, { collide: true, tag: 'shelf' });
      this.box(len, 1.55, 0.05, this.m.shelf, cx, 0.85, z, { surface: true });
      for (const y of [0.15, 0.55, 0.95, 1.35]) for (const s of [-1, 1]) this.box(len, 0.025, depth / 2 - 0.03, this.m.shelf, cx, y, z + s * (depth / 4 + 0.01), { surface: false, cast: false });
      for (const x of [cx - len / 2, cx + len / 2]) this.box(0.04, 1.6, depth, this.m.shelf, x, 0.8, z);
      // end-cap sign
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshStandardMaterial({ map: T.signTex(z < -1 ? 'CHIPS • CANDY' : z < 1 ? 'HOUSEHOLD • BABY' : 'CANNED • RAMEN', { bg: '#c2141c', fg: '#fff', w: 512, h: 160, font: 'bold 56px Arial Black, Arial' }), emissive: 0x220000, roughness: 0.6 }));
      cap.position.set(cx + len / 2 + 0.03, 1.75, z); cap.rotation.y = Math.PI / 2; this.root.add(cap);
      // products: instanced boxes per label
      const perMat = new Map();
      for (const y of [0.17, 0.57, 0.97, 1.37]) for (const s of [-1, 1]) for (let x = cx - len / 2 + 0.12; x < cx + len / 2 - 0.1; x += 0.16 + Math.random() * 0.05) {
        if (Math.random() < 0.08) continue; // gaps on the shelf
        const mi = Math.floor(Math.random() * mats.length);
        const h = 0.14 + Math.random() * 0.16, w = 0.1 + Math.random() * 0.06;
        if (!perMat.has(mi)) perMat.set(mi, []);
        perMat.get(mi).push([x, y + h / 2, z + s * (depth / 4 + 0.02), w, h, 0.15 + Math.random() * 0.12]);
      }
      for (const [mi, list] of perMat) {
        const im = new THREE.InstancedMesh(geo, mats[mi], list.length);
        list.forEach(([x, y, zz, w, h, d], k) => { dummy.position.set(x, y, zz); dummy.scale.set(w, h, d); dummy.rotation.y = (Math.random() - 0.5) * 0.15; dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); });
        im.castShadow = false; im.receiveShadow = true; this.root.add(im);
      }
      for (const s of [-1, 1]) this.shelfSpots.push(new THREE.Vector3(cx, 0, z + s * 0.95));
    }
  }

  _fridges() {
    const z = ROOM.z0, x0 = -6.2, x1 = 6.2, d = 0.7;
    this.box(x1 - x0, 2.5, d, this.m.dark, (x0 + x1) / 2, 1.25, z + d / 2, { collide: true, tag: 'fridge', surface: false });
    this.box(x1 - x0, 0.6, d + 0.05, new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.5 }), (x0 + x1) / 2, 2.8, z + d / 2);
    const header = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.4), new THREE.MeshBasicMaterial({ map: T.signTex('COLD BEER • SODA • JUICE', { bg: '#081b33', fg: '#7fd8ff', w: 1024, h: 100, font: 'bold 64px Arial Black, Arial', glow: '#7fd8ff' }) }));
    header.position.set(0, 2.8, z + d + 0.03); this.root.add(header);
    // interior glow + bottles behind glass doors
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.2, 2.2), new THREE.MeshStandardMaterial({ color: 0xdfefff, emissive: 0xbfdcff, emissiveIntensity: 0.9 }));
    inner.position.set(0, 1.3, z + 0.05); this.root.add(inner);
    const bottleGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.24, 8);
    const canGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10);
    const cols = [0xd11a2a, 0x1a7d2f, 0xf2a20c, 0x2953c7, 0x7b1fa2, 0xffffff, 0x1a1a1a, 0xff6f00, 0x00a5b8];
    const dummy = new THREE.Object3D();
    cols.forEach((c, ci) => {
      const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: ci % 2 ? 0.6 : 0.1, transparent: ci % 3 === 0, opacity: 0.85 });
      const list = [];
      for (let row = 0; row < 5; row++) for (let x = x0 + 0.15 + ci * 0.012; x < x1 - 0.15; x += 0.085 * cols.length / 3) {
        if (Math.random() < 0.5) continue;
        list.push([x + Math.random() * 0.05, 0.32 + row * 0.42, z + 0.22 + Math.random() * 0.25, row % 2]);
      }
      const im = new THREE.InstancedMesh(ci % 2 ? canGeo : bottleGeo, mat, list.length);
      list.forEach(([x, y, zz], k) => { dummy.position.set(x, y + (ci % 2 ? 0.06 : 0.12), zz); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); });
      this.root.add(im);
    });
    for (let row = 0; row < 5; row++) this.box(x1 - x0, 0.02, d - 0.1, this.m.metal, 0, 0.3 + row * 0.42, z + 0.35, { surface: false, cast: false });
    // doors: glass panes with frames
    this.fridgeDoors = [];
    const n = 10, dw = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const x = x0 + dw * i + dw / 2;
      const hinge = new THREE.Group(); hinge.position.set(x - dw / 2, 0, z + d); this.root.add(hinge);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(dw - 0.06, 2.3), this.m.glass); g.position.set(dw / 2, 1.3, 0.01); hinge.add(g);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(dw, 0.06, 0.04), this.m.metal); fr.position.set(dw / 2, 0.15, 0.01); hinge.add(fr);
      const fr2 = fr.clone(); fr2.position.y = 2.45; hinge.add(fr2);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.35, 0.05), this.m.metal); post.position.set(0.02, 1.3, 0.01); hinge.add(post);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.05), this.m.metal); handle.position.set(dw - 0.08, 1.3, 0.05); hinge.add(handle);
      this.fridgeDoors.push({ hinge, open: 0, target: 0, x });
    }
  }

  _deli() {
    const x = ROOM.x1, z0 = -3, z1 = 1.6;
    this.box(0.9, 1.0, z1 - z0, new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: 0.7, roughness: 0.3 }), x - 0.45, 0.5, (z0 + z1) / 2, { collide: true, tag: 'deli' });
    const caseGlass = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, 0.5), this.m.glass);
    caseGlass.position.set(x - 0.9, 1.25, (z0 + z1) / 2); caseGlass.rotation.y = -Math.PI / 2; caseGlass.rotation.x = -0.2; this.root.add(caseGlass);
    const meatCols = [0xc7604f, 0xe8c9a2, 0xd9a35a, 0xf1e3b8, 0x9e3b2f];
    for (let i = 0; i < 10; i++) this.box(0.35, 0.08, 0.35, new THREE.MeshStandardMaterial({ color: meatCols[i % 5], roughness: 0.6 }), x - 0.5, 1.05, z0 + 0.3 + i * 0.44, { surface: false });
    // heat lamp + chicken + menu board
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 1.2), new THREE.MeshStandardMaterial({ color: 0x222, emissive: 0xff5a1a, emissiveIntensity: 0.6 }));
    lamp.position.set(x - 0.4, 1.7, 0.9); this.root.add(lamp);
    const lampLight = new THREE.PointLight(0xff6a2a, 1.2, 2.5, 2); lampLight.position.set(x - 0.4, 1.55, 0.9); this.root.add(lampLight);
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0xa8641f, roughness: 0.4 })); c.scale.set(1.3, 0.8, 1); c.position.set(x - 0.4 + (i % 2) * 0.15, 1.08, 0.5 + Math.floor(i / 2) * 0.25); this.root.add(c); }
    const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.0), new THREE.MeshStandardMaterial({ map: T.signTex('HOAGIES $8\nCHEESESTEAK $11\nCHICKEN 3PC $6', { bg: '#111', fg: '#ffe9a8', w: 1024, h: 480, font: 'bold 86px Arial Black, Arial' }), emissive: 0x111111, roughness: 0.5 }));
    menu.position.set(x - 0.02, 2.4, -0.7); menu.rotation.y = -Math.PI / 2; this.root.add(menu);
    // closed sign on the grill (it is after midnight)
    const closed = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.34), new THREE.MeshStandardMaterial({ map: T.paperSign('GRILL\nCLOSED'), roughness: 0.9 }));
    closed.position.set(x - 0.91, 1.25, -1.8); closed.rotation.y = -Math.PI / 2; this.root.add(closed);
  }

  _props() {
    // ATM by the door
    this.box(0.6, 1.5, 0.5, new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.5, roughness: 0.4 }), 6.4, 0.75, 4.9, { collide: true });
    const atmScr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), new THREE.MeshBasicMaterial({ color: 0x2e7dd1 })); atmScr.position.set(6.4, 1.2, 4.64); atmScr.rotation.y = Math.PI; this.root.add(atmScr);
    // chip rack + newspaper stack near the counter
    this.box(0.5, 1.3, 0.5, this.m.shelf, 0.2, 0.65, 4.8, { collide: true });
    for (let i = 0; i < 12; i++) this.box(0.2, 0.25, 0.08, new THREE.MeshStandardMaterial({ map: T.productLabel(i + 1), roughness: 0.7 }), 0.2 + ((i % 2) - 0.5) * 0.24, 0.3 + Math.floor(i / 2) * 0.2, 4.53, { surface: false, cast: false });
    // ice chest
    this.box(1.0, 0.9, 0.7, new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: 0.4 }), 6.4, 0.45, 2.9, { collide: true });
    // store cat (a loaf) on the ice chest
    const cat = new THREE.Group(); cat.position.set(6.4, 0.9, 2.9); this.root.add(cat);
    const catM = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), catM); body.scale.set(1.4, 0.75, 0.9); body.position.y = 0.1; cat.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), catM); head.position.set(0.2, 0.17, 0); cat.add(head);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), catM); ear.position.set(0.22, 0.26, s * 0.04); cat.add(ear); }
    this.cat = { group: cat, head };
    // trash can + mop bucket
    const trash = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.75, 14), new THREE.MeshStandardMaterial({ color: 0x2b4a2b, roughness: 0.7 })); trash.position.set(2.9, 0.375, 5.5); trash.castShadow = true; this.root.add(trash);
    this.colliders.push({ x0: 2.65, x1: 3.15, z0: 5.25, z1: 5.75 });
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0xe7c21b, roughness: 0.6 })); bucket.position.set(-6.3, 0.18, 1.1); this.root.add(bucket);
  }

  _lights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x8fa0b8, 0x3a3226, 0.35));
    // fluorescent fixtures: emissive tubes + rect area lights (no shadows) + 2 soft shadow spots for characters
    const fixtures = [[0.3, -2.6, 5.4, 1, 0.9], [0.3, -0.6, 5.4, 1, 1], [0.3, 1.3, 5.4, 1, 0.95], [1.8, 3.9, 4, 1, 0.9], [-5, 3.9, 3, 1, 1.0], [-4.5, -3.8, 4, 1, 0.8], [5.6, -0.7, 2.5, 1, 0.8]];
    fixtures.forEach(([x, z, w, , k], i) => {
      const fx = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.3), this.m.dark); fx.position.set(x, ROOM.h - 0.04, z); this.root.add(fx);
      const tubeMat = i === 1 ? this.m.tube.clone() : this.m.tube;
      for (const dz of [-0.07, 0.07]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, w - 0.1, 8), tubeMat); t.rotation.z = Math.PI / 2; t.position.set(x, ROOM.h - 0.1, z + dz); this.root.add(t); }
      const rl = new THREE.RectAreaLight(i === 4 ? 0xfff3dc : 0xe9f2ff, 3.6 * k, w, 0.3);
      rl.position.set(x, ROOM.h - 0.12, z); rl.lookAt(x, 0, z); this.scene.add(rl);
      if (i === 1) this.flicker.push({ light: rl, mat: tubeMat, base: rl.intensity, t: 0 });
    });
    const spot = (x, z, tx, tz, intensity) => {
      const l = new THREE.SpotLight(0xeef3ff, intensity, 12, Math.PI / 2.6, 0.9, 1.6);
      l.position.set(x, ROOM.h - 0.15, z); l.target.position.set(tx, 0, tz);
      l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02; l.shadow.radius = 4;
      this.scene.add(l, l.target); return l;
    };
    this.shadowLights = [spot(1.2, 0.2, 1.4, 0.2, 14), spot(-1.8, 3.6, -1.8, 3.4, 10)];
    // cold glow off the fridge wall
    const fl = new THREE.RectAreaLight(0xcfe6ff, 2.2, 12, 2.2); fl.position.set(0, 1.3, ROOM.z0 + 0.72); fl.lookAt(0, 1.3, 3); this.scene.add(fl);
    // the booth's CCTV glow + a desk lamp feel
    const bl = new THREE.PointLight(0x5aa0ff, 0.6, 2.5, 2); bl.position.set(-3.6, 1.35, 4.9); this.scene.add(bl);
  }

  _outside() {
    const s = this.root;
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(60, 4), new THREE.MeshStandardMaterial({ map: T.sidewalk([30, 2]), roughness: 0.85 }));
    sw.rotation.x = -Math.PI / 2; sw.position.set(0, 0.02, 8.3); sw.receiveShadow = true; s.add(sw);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(60, 0.15, 0.3), new THREE.MeshStandardMaterial({ color: 0x7a7670, roughness: 0.8 })); curb.position.set(0, 0.04, 10.3); s.add(curb);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 10), new THREE.MeshStandardMaterial({ map: T.asphalt([40, 5]), roughness: 0.55, metalness: 0.1 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, -0.05, 15.4); s.add(road);
    for (let x = -40; x < 40; x += 4) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.12), new THREE.MeshBasicMaterial({ color: 0xb59a3a })); ln.rotation.x = -Math.PI / 2; ln.position.set(x, -0.04, 15.4); s.add(ln); }
    const sw2 = sw.clone(); sw2.position.z = 22.4; s.add(sw2);
    // the store's own facade above the windows, with its sign
    const facade = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.5), new THREE.MeshStandardMaterial({ map: T.brick([5, 1.2]), roughness: 0.9 }));
    facade.position.set(0, ROOM.h + 1.75, ROOM.z1 + 0.25); facade.rotation.y = Math.PI; s.add(facade);
    // rowhouses across the street
    const winOn = new THREE.MeshStandardMaterial({ color: 0x221a10, emissive: 0xffc070, emissiveIntensity: 1.1 });
    const winBlue = new THREE.MeshStandardMaterial({ color: 0x101420, emissive: 0x6f8cff, emissiveIntensity: 0.7 });
    const winOff = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.2, metalness: 0.4 });
    const brickM = new THREE.MeshStandardMaterial({ map: T.brick([2, 2]), roughness: 0.9 });
    for (let i = -6; i <= 6; i++) {
      const x = i * 5.2, h = 9 + (i % 3) * 0.6;
      const house = new THREE.Mesh(new THREE.BoxGeometry(5.1, h, 8), brickM); house.position.set(x, h / 2, 28.5); s.add(house);
      const cornice = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x2a2a2a })); cornice.position.set(x, h - 0.2, 24.4); s.add(cornice);
      for (let f = 0; f < 3; f++) for (let w = 0; w < 2; w++) {
        const r = Math.random(); const m = r < 0.35 ? winOn : r < 0.45 ? winBlue : winOff;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6), m); win.position.set(x - 1.2 + w * 2.4, 1.5 + f * 2.9, 24.49); win.rotation.y = Math.PI; s.add(win);
      }
      const steps = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.2), new THREE.MeshStandardMaterial({ color: 0x6d6a66 })); steps.position.set(x + 1.3, 0.3, 23.9); s.add(steps);
    }
    // takeout spot across the street, bright sign
    const take = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.9), new THREE.MeshBasicMaterial({ map: T.signTex('GOLDEN DRAGON • WINGS • FRIES', { bg: '#a50e0e', fg: '#ffe066', w: 1024, h: 180, font: 'bold 70px Arial Black, Arial', glow: '#ff0' }) }));
    take.position.set(5.2, 3.5, 24.45); take.rotation.y = Math.PI; s.add(take);
    // streetlight (sodium) + bus stop
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 8), this.m.dark); pole.position.set(-1, 3, 10.0); s.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.6), this.m.dark); arm.position.set(-1, 6, 10.7); s.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.6), new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0xffa64d, emissiveIntensity: 3 })); head.position.set(-1, 5.92, 11.4); s.add(head);
    const sodium = new THREE.PointLight(0xff9a40, 260, 28, 1.7); sodium.position.set(-1, 5.7, 11.2); this.scene.add(sodium);
    this.streetLight = { light: sodium, base: 260 };
    const sodium2 = new THREE.PointLight(0xff9a40, 160, 26, 1.7); sodium2.position.set(14, 5.7, 11.2); this.scene.add(sodium2);
    const stop = new THREE.Group(); stop.position.set(-4.5, 0, 9.6); s.add(stop);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 8), this.m.metal); sp.position.y = 1.4; stop.add(sp);
    const sb = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), new THREE.MeshBasicMaterial({ map: T.signTex('BUS\n52', { bg: '#1446a0', fg: '#fff', w: 128, h: 160, font: 'bold 52px Arial Black, Arial' }), side: THREE.DoubleSide })); sb.position.set(0.26, 2.4, 0); stop.add(sb);
    // neon in the windows and over the door
    const neon = (text, color, x, y, z, w, h) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: T.signTex(text, { bg: '#000', fg: color, w: 512, h: Math.round(512 * h / w), font: `bold ${Math.round(300 * h / w)}px Arial Black, Arial`, glow: color }), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.rotation.y = Math.PI; s.add(m); return m;
    };
    this.neons = [
      neon('OPEN', '#ff2d6f', 1.6, 2.2, ROOM.z1 + 0.05, 1.2, 0.5),
      neon('COLD BEER', '#3fd4ff', -5.2, 2.15, ROOM.z1 + 0.05, 1.6, 0.45),
      neon('ATM', '#4dff7a', 6.0, 2.2, ROOM.z1 + 0.05, 0.8, 0.4),
      neon('LOTTO', '#ffd21f', -1.2, 1.3, ROOM.z1 + 0.05, 1.0, 0.36),
    ];
    const big = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 1.1), new THREE.MeshBasicMaterial({ map: T.signTex('LARCHWOOD FOOD MARKET', { bg: '#0b1a12', fg: '#e8fff2', w: 1024, h: 170, font: 'bold 88px Arial Black, Arial', glow: '#6fffb0' }) }));
    big.position.set(0, ROOM.h + 0.9, ROOM.z1 + 0.42); big.rotation.y = Math.PI; s.add(big);
    const neonLight = new THREE.PointLight(0xff3a7a, 3.5, 6, 2); neonLight.position.set(1.6, 2.2, ROOM.z1 - 0.3); this.scene.add(neonLight);
    const neonLight2 = new THREE.PointLight(0x3fc8ff, 2.5, 5, 2); neonLight2.position.set(-5.2, 2.1, ROOM.z1 - 0.3); this.scene.add(neonLight2);
    this.neonLights = [neonLight, neonLight2];
    // traffic: cars and the bus slide past on the street
    this.vehicles = [];
    const mkVehicle = (len, h, color, bus) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(len, h, bus ? 2.6 : 1.8), new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 }));
      body.position.y = h / 2 + 0.3; g.add(body);
      if (bus) {
        for (let i = 0; i < 8; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9), new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0xd8e4ff, emissiveIntensity: 0.6 })); w.position.set(-len / 2 + 1 + i * 1.3, h * 0.7 + 0.3, -1.31); w.rotation.y = Math.PI; g.add(w); }
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map: T.signTex('52 52ND-PARKSIDE', { bg: '#000', fg: '#ffae00', w: 512, h: 96, font: 'bold 48px monospace' }) })); sign.position.set(-len / 2 + 1.2, h + 0.05, -1.31); sign.rotation.y = Math.PI; g.add(sign);
      } else {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(len * 0.5, 0.5, 1.7), new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.1, metalness: 0.8 })); cab.position.set(-0.1, h + 0.55, 0); g.add(cab);
      }
      const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(len / 2 + 0.01, 0.8, -0.6); hl.rotation.y = Math.PI / 2; g.add(hl);
      const hl2 = hl.clone(); hl2.position.z = 0.6; g.add(hl2);
      const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ color: 0xff1010 })); tl.position.set(-len / 2 - 0.01, 0.8, -0.6); tl.rotation.y = -Math.PI / 2; g.add(tl);
      const tl2 = tl.clone(); tl2.position.z = 0.6; g.add(tl2);
      const beam = new THREE.SpotLight(0xfff2d8, 40, 18, 0.5, 0.6, 1.5); beam.position.set(len / 2, 0.8, 0); beam.target.position.set(len / 2 + 6, 0, 0); g.add(beam, beam.target);
      g.visible = false; s.add(g);
      return { g, len, bus, active: false, x: 0, dir: 1, speed: 0, stopT: 0 };
    };
    for (const c of [0x6b0f14, 0x1c2a4a, 0xd9d9d9, 0x101010]) this.vehicles.push(mkVehicle(4.4, 0.8, c, false));
    this.bus = mkVehicle(12, 2.6, 0xe8e8e8, true); this.vehicles.push(this.bus);
    this.trafficT = 2;
  }

  _cctv() {
    // the monitor on the counter shows two security camera feeds
    const mon = new THREE.Group(); mon.position.set(-3.55, 1.05, 5.0); mon.rotation.y = Math.PI / 2 + 0.5; this.root.add(mon);
    const caseM = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.3), this.m.dark); caseM.position.y = 0.2; mon.add(caseM);
    this.monitorScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.3), new THREE.MeshBasicMaterial({ color: 0x223344 }));
    this.monitorScreen.position.set(0, 0.2, 0.151); mon.add(this.monitorScreen);
    this.monitorPos = new THREE.Vector3(-3.55, 1.25, 5.0);
    // camera domes in the corners (positions match the feeds)
    const camDefs = [[6.7, 3.0, 5.7, -1, -1.2], [-6.7, 3.0, -4.7, 1.2, 1], [6.7, 3.0, -4.7, -1.2, 1.4], [-2.8, 3.0, 5.7, 0.6, -1.4]];
    for (const [x, y, z, lx, lz] of camDefs) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x111, roughness: 0.1, metalness: 0.5 }));
      dome.position.set(x, y, z); dome.rotation.x = Math.PI; this.root.add(dome);
      const cam = new THREE.PerspectiveCamera(85, 4 / 3, 0.1, 40); cam.position.set(x, y - 0.15, z);
      cam.lookAt(x + lx * 3, 0.6, z + lz * 3);
      this.cameras.push(cam);
    }
  }

  inBooth(x, z) { return x > BOOTH.x0 && x < BOOTH.x1 && z > BOOTH.z0 && z < BOOTH.z1; }

  // push a circle (x,z,r) out of every collider; returns corrected position
  collide(p, r, { ignoreBoothDoor = false } = {}) {
    for (const c of this.colliders) {
      if (ignoreBoothDoor && c.tag === 'boothdoor') continue;
      const cx = Math.max(c.x0, Math.min(p.x, c.x1)), cz = Math.max(c.z0, Math.min(p.z, c.z1));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
        else { // centre inside the box: push out along the shortest axis
          const opts = [[c.x0 - r - p.x, 0], [c.x1 + r - p.x, 0], [0, c.z0 - r - p.z], [0, c.z1 + r - p.z]];
          opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
          p.x += opts[0][0]; p.z += opts[0][1];
        }
      }
    }
    // the plexi line between booth and floor (x = -3 above the counter is the counter collider already)
    return p;
  }

  doorNudge() { this.door.target = 1; this.door.hold = 1.2; }

  update(dt, t) {
    // front door swings open when someone passes, then closes
    const d = this.door;
    if (d.hold > 0) d.hold -= dt; else d.target = 0;
    d.open += (d.target - d.open) * Math.min(1, dt * 6);
    d.hinge.rotation.y = -d.open * 1.4;
    // booth door
    const bd = this.boothDoor, ta = this.boothDoorOpen ? -1.5 : 0;
    bd.angle += (ta - bd.angle) * Math.min(1, dt * 7); bd.hinge.rotation.y = bd.angle;
    // fridge doors
    for (const f of this.fridgeDoors) { if (f.hold > 0) f.hold -= dt; else f.target = 0; f.open += (f.target - f.open) * Math.min(1, dt * 4); f.hinge.rotation.y = f.open * 1.1; }
    // turntable spin
    const tt = this.turntable; if (tt.spin > 0) { const s = Math.min(tt.spin, dt * 3); tt.mesh.rotation.y += s; tt.spin -= s; }
    // register drawer
    const r = this.register; r.open += ((r.hold > 0 ? 1 : 0) - r.open) * Math.min(1, dt * 10); if (r.hold > 0) r.hold -= dt;
    r.drawer.position.z = 0.02 + r.open * 0.3;
    // stash drawer
    this.stash.mesh.position.x = this.stash.baseX - (this.stash.out ? 0.3 : 0);
    // flickering tube
    for (const f of this.flicker) {
      f.t -= dt;
      if (f.t < 0) { f.on = Math.random() > 0.25; f.t = f.on ? 0.05 + Math.random() * (Math.random() < 0.1 ? 4 : 0.4) : 0.03 + Math.random() * 0.12; }
      const k = f.on ? 1 : 0.12;
      f.light.intensity = f.base * k; f.mat.emissiveIntensity = 3.2 * k;
    }
    // neon hum
    for (let i = 0; i < this.neonLights.length; i++) this.neonLights[i].intensity = (i ? 2.5 : 3.5) * (0.85 + 0.15 * Math.sin(t * 50 + i * 3) * Math.sin(t * 1.3 + i));
    // cat breathes and looks around
    this.cat.group.scale.y = 1 + Math.sin(t * 2) * 0.03; this.cat.head.rotation.y = Math.sin(t * 0.3) * 0.8;
    // traffic
    this.trafficT -= dt;
    if (this.trafficT < 0) {
      const idle = this.vehicles.filter(v => !v.active && (v.bus ? Math.random() < 0.35 : true));
      if (idle.length) {
        const v = idle[Math.floor(Math.random() * idle.length)];
        v.active = true; v.dir = v.bus ? 1 : (Math.random() < 0.5 ? 1 : -1); v.x = -v.dir * 45; v.speed = v.bus ? 9 : 10 + Math.random() * 8;
        v.stopT = v.bus ? 7 : 0; v.stopped = false; v.g.visible = true;
        v.g.position.set(v.x, 0, v.dir > 0 ? 13.6 : 17.2); v.g.rotation.y = v.dir > 0 ? 0 : Math.PI;
        this.onVehicle?.(v);
      }
      this.trafficT = 3 + Math.random() * 9;
    }
    for (const v of this.vehicles) {
      if (!v.active) continue;
      let sp = v.speed;
      if (v.bus && !v.stopped && v.x > -9 && v.x < -4.5) { sp = Math.max(0.0, (-4.5 - v.x) * 1.6); if (sp < 0.15) { v.stopped = true; this.onBusStop?.(v); } }
      if (v.bus && v.stopped && v.stopT > 0) { v.stopT -= dt; sp = 0; if (v.stopT <= 0) this.onBusGo?.(v); }
      v.x += v.dir * sp * dt; v.g.position.x = v.x;
      if (Math.abs(v.x) > 46) { v.active = false; v.g.visible = false; }
    }
  }
}
