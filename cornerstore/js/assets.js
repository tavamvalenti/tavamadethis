// Modelled assets. Anything listed in assets/models/manifest.json is loaded as a GLB and takes the place of the
// code-built stand-in with the same name. The game runs fine with an empty manifest.
//
// manifest.json:
// { "props": { "register": { "file": "register.glb", "scale": 1, "rotY": 0, "y": 0 } } }
//
// A prop is fitted automatically: it is scaled so its largest side matches the stand-in's, centred on it and sat
// on the same surface. "scale", "rotY" (degrees) and "y" (metres) fine-tune that. Keep each GLB under ~3 MB and
// ~30k triangles; export from Blender with Draco off and textures at 1024 px.
//
// "models": { "cash": { "file": "props/cash.glb", "size": 0.16 } } loads a model library instead of replacing anything.
// Get a copy anywhere with game.spawnModel('cash', { pos, rotY, size }): it is scaled so its longest side is `size`
// metres, centred on pos in x/z and sat on pos.y. Copies share geometry and textures, so dozens cost little.
// "cctv": "cctv" puts that model under every store camera, aimed where the camera looks.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadCharacters } from './characters.js';

const BASE = './assets/models/';

export async function loadAssets(game) {
  let manifest;
  try { manifest = await (await fetch(BASE + 'manifest.json', { cache: 'no-cache' })).json(); } catch (e) { game.assetsReady = true; return; }
  // characters first: people who walk in after this point get a modelled body
  if (manifest.characters) { try { await loadCharacters(manifest); } catch (e) { console.warn('[assets] characters failed', e); } }
  game.assetsReady = true;
  const loader = new GLTFLoader();
  game.models = new Map();
  game.spawnModel = (name, o = {}) => spawnModel(game, name, o);
  await Promise.all(Object.entries(manifest.models || {}).map(async ([name, def]) => {
    try {
      const g = (await loader.loadAsync(BASE + def.file)).scene;
      g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.material.map) m.material.map.anisotropy = 4; } });
      const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
      game.models.set(name, { scene: g, def, longest: Math.max(size.x, size.y, size.z) });
    } catch (e) { console.warn('[assets] could not load model', name, e); }
  }));
  if (manifest.cctv && game.models.has(manifest.cctv)) {
    for (const cam of game.store.cameras || []) {
      const dir = cam.getWorldDirection(new THREE.Vector3());
      const m = spawnModel(game, manifest.cctv, { pos: cam.position.clone().add(new THREE.Vector3(0, 0.02, 0)), size: 0.34 });
      m.position.y = cam.position.y + 0.17 - m.userData.height;   // hang it from the ceiling mount
      m.rotation.y = Math.atan2(dir.x, dir.z);                    // lens (+z on the model) where the camera looks
      cam.userData.model = m;
    }
  }
  for (const [name, def] of Object.entries(manifest.props || {})) {
    const slot = game.store.slots?.[name]; if (!slot) { console.warn('[assets] no slot called', name); continue; }
    try {
      const gltf = await loader.loadAsync(BASE + def.file);
      const model = gltf.scene;
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      // fit to the stand-in's bounding box
      const want = new THREE.Box3().setFromObject(slot.standIn), have = new THREE.Box3().setFromObject(model);
      const ws = want.getSize(new THREE.Vector3()), hs = have.getSize(new THREE.Vector3());
      const k = Math.max(ws.x, ws.y, ws.z) / Math.max(hs.x, hs.y, hs.z) * (def.scale || 1);
      model.scale.setScalar(k); model.rotation.y = (def.rotY || 0) * Math.PI / 180;
      const fitted = new THREE.Box3().setFromObject(model), c = fitted.getCenter(new THREE.Vector3()), wc = want.getCenter(new THREE.Vector3());
      model.position.set(wc.x - c.x, want.min.y - fitted.min.y + (def.y || 0), wc.z - c.z);
      slot.standIn.parent.worldToLocal(model.position);   // stand-ins sit directly under the store root, so this is a no-op today
      slot.standIn.visible = false; game.scene.add(model); slot.model = model;
    } catch (e) { console.warn('[assets] could not load', def.file, e); }
  }
}

function spawnModel(game, name, { pos = new THREE.Vector3(), rotY = 0, size, parent } = {}) {
  const lib = game.models?.get(name); if (!lib) return null;
  const m = lib.scene.clone(true);
  const k = (size ?? lib.def.size ?? lib.longest) / lib.longest;
  m.scale.setScalar(k); m.rotation.y = rotY;
  const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3());
  const holder = new THREE.Group(); holder.add(m); m.position.set(-c.x, -b.min.y, -c.z);
  holder.position.copy(pos); holder.userData.height = b.max.y - b.min.y; holder.userData.model = name;
  (parent || game.scene).add(holder);
  return holder;
}
