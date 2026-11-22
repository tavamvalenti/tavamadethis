// Boot: renderer, post-processing, start screen, settings and the frame loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Game } from './game.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const settings = (() => { try { return { gore: 'full', quality: 'high', sens: 1, volume: 0.8, ...JSON.parse(localStorage.getItem('cornerstore.settings') || '{}') }; } catch (e) { return { gore: 'full', quality: 'high', sens: 1, volume: 0.8 }; } })();
const saveSettings = () => { try { localStorage.setItem('cornerstore.settings', JSON.stringify(settings)); } catch (e) { } };

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, settings.quality === 'low' ? 1 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = settings.quality !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
scene.fog = new THREE.Fog(0x07080d, 18, 48);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.22;

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 120);
const audio = new Audio();
const game = new Game({ renderer, scene, camera, audio });
game.gore.level = settings.gore;
window.__game = game; // handy for debugging in the console

// post: bloom for neon, then a grade pass (grain, vignette, a cold-warm split, damage tint)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.6, 0.82);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, hurt: { value: 0 }, cctv: { value: 0 }, res: { value: new THREE.Vector2(innerWidth, innerHeight) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, hurt, cctv; uniform vec2 res; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time*7.0) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 d = uv - 0.5;
      float ca = 0.0012 + hurt * 0.006;
      vec3 c = vec3(texture2D(tDiffuse, uv + d*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d*ca).b);
      float l = dot(c, vec3(0.299,0.587,0.114));
      // split tone: cool shadows, warm highlights
      c = mix(c, c * vec3(0.86, 0.95, 1.12), smoothstep(0.35, 0.0, l) * 0.5);
      c = mix(c, c * vec3(1.08, 1.0, 0.9), smoothstep(0.5, 1.0, l) * 0.35);
      c = mix(vec3(l), c, 0.9);
      c += (rnd(uv * res) - 0.5) * 0.045;
      float v = smoothstep(0.85, 0.25, length(d * vec2(1.0, 0.85)));
      c *= mix(0.55, 1.0, v);
      c = mix(c, c * vec3(1.4, 0.35, 0.3), hurt * (1.0 - v) * 0.9);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); grade.uniforms.res.value.set(innerWidth, innerHeight);
});

// ------------------------------------------------------------------ start screen + settings
const start = $('start');
const segs = { gore: ['full', 'reduced', 'off'], quality: ['high', 'low'] };
for (const [key, vals] of Object.entries(segs)) {
  const el = start.querySelector(`[data-set="${key}"]`);
  el.innerHTML = vals.map(v => `<button data-v="${v}" class="${settings[key] === v ? 'on' : ''}">${v}</button>`).join('');
  el.onclick = (e) => { const v = e.target.dataset.v; if (!v) return; settings[key] = v; saveSettings(); el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); if (key === 'gore') game.gore.level = v; if (key === 'quality') location.reload(); };
}
const w = game.world;
$('continue').textContent = w.night > 1 ? `Continue: night ${w.night}` : 'Start your shift';
$('newgame').style.display = w.night > 1 ? '' : 'none';
$('newgame').onclick = () => { if (confirmReset()) { w.reset(); location.reload(); } };
function confirmReset() { const b = $('newgame'); if (b.dataset.sure) return true; b.dataset.sure = 1; b.textContent = 'Click again to wipe your save'; return false; }

let started = false;
$('continue').onclick = async () => {
  await audio.start();
  start.classList.remove('show'); $('hud').classList.add('show');
  renderer.domElement.requestPointerLock?.();
  if (!started) { started = true; game.startNight(); }
  else game.paused = false;
};
$('recap').querySelector('.next').onclick = () => game.nextNight();
// clicking the canvas re-locks the mouse; Esc frees it and pauses
renderer.domElement.addEventListener('click', () => { if (started && !game.paused && !game.player.controls.isLocked && !game.dialogue.open) renderer.domElement.requestPointerLock?.(); });
game.player.controls.addEventListener('unlock', () => {
  if (!started || game.nightOver || game.dead) return;
  if (game.dialogue.open || game.cctv) return;   // you can click replies with the mouse
  game.paused = true; start.classList.add('show'); $('continue').textContent = 'Back to the counter';
  $('hud').classList.remove('show');
});
game.player.controls.addEventListener('lock', () => { game.paused = false; });
game.player.controls.pointerSpeed = settings.sens;

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let t = 0, frames = 0, acc = 0, cctvFrame = 0;
const camMonitor = new THREE.WebGLRenderTarget(320, 240);
game.store.monitorScreen.material = new THREE.MeshBasicMaterial({ map: camMonitor.texture });
let monitorCam = 0, monitorT = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()); t += dt;
  game.update(dt, t);
  grade.uniforms.time.value = t;
  grade.uniforms.hurt.value = Math.min(1, game.player.hurtT + (100 - game.player.health) / 200);
  // the little monitor on the counter cycles through the cameras
  monitorT -= dt; if (monitorT < 0) { monitorT = 5; monitorCam = (monitorCam + 1) % game.store.cameras.length; }
  if (++cctvFrame % 4 === 0 && !game.cctv) {
    const vm = game.player.vm.visible; game.player.vm.visible = false; game.store.monitorScreen.visible = false;
    renderer.setRenderTarget(camMonitor); renderer.render(scene, game.store.cameras[monitorCam]); renderer.setRenderTarget(null);
    game.player.vm.visible = vm; game.store.monitorScreen.visible = true;
  }
  if (game.cctv) {
    // full screen: four feeds in a grid
    const W = innerWidth, H = innerHeight;
    renderer.setScissorTest(true);
    game.store.cameras.forEach((cam, i) => {
      const x = (i % 2) * W / 2, y = (1 - Math.floor(i / 2)) * H / 2;
      cam.aspect = (W / 2) / (H / 2); cam.updateProjectionMatrix();
      renderer.setViewport(x, y, W / 2, H / 2); renderer.setScissor(x, y, W / 2, H / 2);
      renderer.render(scene, cam);
    });
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
  } else {
    composer.render(dt);
  }
  // auto quality: drop resolution if the frame rate sinks
  acc += dt; frames++;
  if (acc > 3) {
    const fps = frames / acc; acc = 0; frames = 0;
    const pr = renderer.getPixelRatio();
    if (fps < 40 && pr > 0.75) { renderer.setPixelRatio(pr - 0.25); composer.setPixelRatio?.(pr - 0.25); }
    $('fps').textContent = Math.round(fps) + ' fps';
  }
}
frame();
