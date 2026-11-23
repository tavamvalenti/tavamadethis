// Modelled assets. Anything listed in assets/models/manifest.json is loaded as a GLB and takes the place of the
// code-built stand-in with the same name. The game runs fine with an empty manifest.
//
// manifest.json:
// { "props": { "register": { "file": "register.glb", "scale": 1, "rotY": 0, "y": 0 } } }
//
// A prop is fitted automatically: it is scaled so its largest side matches the stand-in's, centred on it and sat
// on the same surface. "scale", "rotY" (degrees) and "y" (metres) fine-tune that. Keep each GLB under ~3 MB and
// ~30k triangles; export from Blender with Draco off and textures at 1024 px.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = './assets/models/';

export async function loadAssets(game) {
  let manifest;
  try { manifest = await (await fetch(BASE + 'manifest.json', { cache: 'no-cache' })).json(); } catch (e) { return; }
  const loader = new GLTFLoader();
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
