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
import { loadAssets } from './assets.js';

const $ = (id) => document.getElementById(id);
const settings = (() => { try { return { gore: 'full', quality: 'high', sens: 1, volume: 0.8, ...JSON.parse(localStorage.getItem('cornerstore.settings') || '{}') }; } catch (e) { return { gore: 'full', quality: 'high', sens: 1, volume: 0.8 }; } })();
const saveSettings = () => { try { localStorage.setItem('cornerstore.settings', JSON.stringify(settings)); } catch (e) { } };

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
// resolution is dynamic: it starts modest and is tuned every second to hold 60 fps (see the loop)
const PR_MAX = Math.min(devicePixelRatio, settings.quality === 'low' ? 1 : 1.5), PR_MIN = 0.6;
let pr = Math.min(PR_MAX, 1.1);
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = settings.quality !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;   // true-to-life colour, no filmic crush
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
scene.fog = new THREE.Fog(0x0a0c12, 30, 70);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 120);
const audio = new Audio();
const game = new Game({ renderer, scene, camera, audio });
game.gore.level = settings.gore;
window.__game = game; // handy for debugging in the console
// modelled people + props load behind the start screen; Continue stays disabled until they are in, so the click
// that starts the game can still take the pointer lock (a lock requested after an await loses the user gesture)
{
  const b = $('continue'), was = b.textContent;
  b.disabled = true; b.textContent = 'Loading people…';
  loadAssets(game).finally(() => { b.disabled = false; if (b.textContent === 'Loading people…') b.textContent = was; });
}

// post: bloom for neon, then a grade pass (grain, vignette, a cold-warm split, damage tint)
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: settings.quality === 'low' ? 0 : 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.22, 0.5, 0.95);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, hurt: { value: 0 }, cctv: { value: 0 }, res: { value: new THREE.Vector2(innerWidth, innerHeight) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, hurt, cctv; uniform vec2 res; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time*7.0) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 d = uv - 0.5;
      vec3 c;
      if (hurt > 0.01) { float ca = hurt * 0.006; c = vec3(texture2D(tDiffuse, uv + d*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d*ca).b); }
      else c = texture2D(tDiffuse, uv).rgb;
      // a clean, natural grade: a touch of contrast and saturation, nothing stylised
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = mix(vec3(l), c, 1.06);
      c = mix(c, c*c*(3.0-2.0*c), 0.12);
      c += (rnd(uv * res) - 0.5) * 0.008;               // just enough dither to stop banding
      float v = smoothstep(1.0, 0.35, length(d * vec2(1.0, 0.9)));
      c *= mix(0.86, 1.0, v);
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
// compile every shader up front so nothing hitches the first time it appears on screen
renderer.compile(scene, camera);

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
renderer.domElement.addEventListener('mousedown', () => { if (started && !game.paused && !game.player.controls.isLocked) renderer.domElement.requestPointerLock?.(); });
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
game.player.controls.addEventListener('unlock', () => {
  if (!started || game.nightOver || game.dead || game.cctv) return;
  game.paused = true; start.classList.add('show'); $('continue').textContent = 'Back to the job';
  $('hud').classList.remove('show');
});
game.player.controls.addEventListener('lock', () => { game.paused = false; });
game.player.controls.pointerSpeed = settings.sens;

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let t = 0, frames = 0, acc = 0, cctvFrame = 0, tick = 0;
const camMonitor = new THREE.WebGLRenderTarget(320, 240);
game.store.monitorScreen.material = new THREE.MeshBasicMaterial({ map: camMonitor.texture });
let monitorCam = 0, monitorT = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()); t += dt;
  camera.fov += (game.fovTarget - camera.fov) * Math.min(1, dt * 9); camera.updateProjectionMatrix();
  game.update(dt, t);
  grade.uniforms.time.value = t;
  grade.uniforms.hurt.value = Math.min(1, game.player.hurtT + (100 - game.player.health) / 200);
  // the little monitor on the counter cycles through the cameras
  monitorT -= dt; if (monitorT < 0) { monitorT = 5; monitorCam = (monitorCam + 1) % game.store.cameras.length; }
  if (++cctvFrame % 12 === 0 && !game.cctv && !game.paused) {
    const vm = game.player.vm.visible; game.player.vm.visible = false; game.store.monitorScreen.visible = false;
    renderer.shadowMap.autoUpdate = false; renderer.setRenderTarget(camMonitor); renderer.render(scene, game.store.cameras[monitorCam]); renderer.setRenderTarget(null); renderer.shadowMap.autoUpdate = true;
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
  // dynamic resolution: hold 60 fps by trading a little sharpness, and take it back when there is headroom
  acc += dt; frames++;
  if (acc > 1) {
    const fps = frames / acc; acc = 0; frames = 0; tick++;
    let next = pr;
    if (fps < 50) next = pr - 0.15; else if (fps < 57) next = pr - 0.05; else if (fps > 59 && tick % 5 === 0) next = pr + 0.05;
    next = Math.max(PR_MIN, Math.min(PR_MAX, next));
    if (Math.abs(next - pr) > 0.001 && !game.paused) { pr = next; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); }
    $('fps').textContent = Math.round(fps) + ' fps';
  }
}
frame();
