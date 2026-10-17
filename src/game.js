import * as pc from 'playcanvas';
import { Scene, Character, Animation, Environment, Keyboard, WasdController, ThirdPersonCamera } from '@viggle/splat-engine';
import { LEVELS, ENDING } from './levels.js';

const q = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
let EYE = 1.5; // 场景原点就是画家的眼睛；每关按 -ground*scale 重新算

if (q.get('lang')) document.body.classList.add('lang-' + q.get('lang'));
if (q.get('clean')) document.body.classList.add('clean');

// ---------- 引擎与角色 ----------
const canvas = $('#c');
const scene = await Scene.create(canvas, { fov: 55, antialias: true, depth: true, backend: q.get('backend') || 'webgl', maxPixelRatio: Math.min(2, devicePixelRatio) });
scene.start();
const app = scene.app;
const camEntity = scene.cameraEntity;

const character = await Character.load(scene, 'characters/vangogh.vsplat', { position: { x: 0, y: 0, z: 0 } });
await Promise.all(['idle', 'walk', 'run', 'jump', 'wave', 'cheer', 'pickup', 'point'].map((n) => Animation.loadGlb(scene, `motions/${n}.glb`, n)));
character.playAnimation('idle', { loop: true });
character.setActive(false);

const keyboard = new Keyboard();
keyboard.attach(window);
const ctrl = new WasdController({ character, keyboard, idleAnim: 'idle', moveAnim: 'walk', moveSpeed: 1.6 });
const cam = new ThirdPersonCamera({ target: () => character.getPosition(), distance: 1.9, height: 1.45, pitch: 8 });
cam.attach({ canvas, cameraEntity: camEntity });

// 镜头模式：play = 跟随角色；manual = 由过场脚本直接摆相机；cine = 脚本驱动跟随相机的参数
let camMode = 'manual';
let controlsOn = false;

// ---------- 可走区域（从泼溅点云算出来的格子） ----------
let grid = null;
function walkable(x, z) {
  if (!grid) return true;
  const i = Math.floor((z + grid.R) / grid.cell), j = Math.floor((x + grid.R) / grid.cell);
  if (i < 0 || j < 0 || i >= grid.n || j >= grid.n) return false;
  return grid.walk[i][j] === '1';
}

// ---------- 发光物件 ----------
function glowMaterial(color, opacity = 1, additive = true) {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(...color);
  m.useLighting = false;
  if (additive) {
    m.blendType = pc.BLEND_ADDITIVEALPHA;
    m.opacity = opacity;
    m.depthWrite = false;
  }
  m.update();
  return m;
}
function makeOrb(pos, kind) {
  const root = new pc.Entity('item');
  root.setPosition(...pos);
  const warm = kind === 'star' ? [1, 0.86, 0.35] : [1, 0.78, 0.4];
  const core = new pc.Entity();
  core.addComponent('render', { type: 'sphere', material: glowMaterial(warm, 1), castShadows: false });
  core.setLocalScale(0.1, 0.1, 0.1);
  const halo = new pc.Entity();
  halo.addComponent('render', { type: 'sphere', material: glowMaterial(warm, 0.16), castShadows: false });
  halo.setLocalScale(0.36, 0.36, 0.36);
  root.addChild(core);
  root.addChild(halo);
  scene.contentRoot.addChild(root);
  return { root, core, halo, base: pos.slice(), t: Math.random() * 6 };
}

async function loadTexture(url) {
  const img = await createImageBitmap(await (await fetch(url)).blob());
  const tex = new pc.Texture(app.graphicsDevice, { width: img.width, height: img.height, format: pc.PIXELFORMAT_RGBA8, mipmaps: true });
  tex.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
  tex.setSource(img);
  return { tex, aspect: img.width / img.height };
}

// 画框传送门：金色画框里放着下一幅画
async function makePortal(cfg, nextLevel) {
  const { tex, aspect } = await loadTexture(nextLevel.painting);
  const h = 1.15, w = h * aspect;
  const root = new pc.Entity('portal');
  root.setPosition(cfg.pos[0], 0, cfg.pos[2]);
  root.setEulerAngles(0, cfg.yaw, 0);
  const pm = new pc.StandardMaterial();
  pm.diffuse = new pc.Color(0, 0, 0);
  pm.emissive = new pc.Color(1, 1, 1);
  pm.emissiveMap = tex;
  pm.useLighting = false;
  pm.cull = pc.CULLFACE_NONE;
  pm.update();
  const plane = new pc.Entity();
  plane.addComponent('render', { type: 'plane', material: pm, castShadows: false });
  plane.setLocalPosition(0, 0.35 + h / 2, 0);
  plane.setLocalEulerAngles(90, 0, 0);
  plane.setLocalScale(w, 1, h);
  root.addChild(plane);
  const gold = glowMaterial([0.42, 0.29, 0.09], 1, false);
  const bar = (x, y, sx, sy) => {
    const b = new pc.Entity();
    b.addComponent('render', { type: 'box', material: gold, castShadows: false });
    b.setLocalPosition(x, 0.35 + h / 2 + y, 0);
    b.setLocalScale(sx, sy, 0.06);
    root.addChild(b);
  };
  const t = 0.07;
  bar(0, h / 2 + t / 2, w + 2 * t, t);
  bar(0, -h / 2 - t / 2, w + 2 * t, t);
  bar(-w / 2 - t / 2, 0, t, h + 2 * t);
  bar(w / 2 + t / 2, 0, t, h + 2 * t);
  const halo = new pc.Entity();
  halo.addComponent('render', { type: 'plane', material: glowMaterial([1, 0.75, 0.35], 0.05), castShadows: false });
  halo.setLocalPosition(0, 0.35 + h / 2, -0.02);
  halo.setLocalEulerAngles(90, 0, 0);
  halo.setLocalScale(w + 0.6, 1, h + 0.6);
  root.addChild(halo);
  root.setLocalScale(0.001, 0.001, 0.001);
  scene.contentRoot.addChild(root);
  return { root, pos: cfg.pos, appear: 0 };
}

// ---------- 乌鸦（结尾飞起）：梵高画里的乌鸦就是几笔深色的“M”形笔触 ----------
let crowMat = null;
async function crowMaterial() {
  if (crowMat) return crowMat;
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  g.strokeStyle = '#141a33';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 15;
  g.beginPath();
  g.moveTo(18, 84);
  g.quadraticCurveTo(70, 26, 128, 76);
  g.quadraticCurveTo(186, 26, 238, 84);
  g.stroke();
  const tex = new pc.Texture(app.graphicsDevice, { width: 256, height: 128, format: pc.PIXELFORMAT_RGBA8, mipmaps: true });
  tex.setSource(await createImageBitmap(cv));
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(0.08, 0.1, 0.2);
  m.useLighting = false;
  m.opacityMap = tex;
  m.opacityMapChannel = 'a';
  m.blendType = pc.BLEND_NORMAL;
  m.depthWrite = false;
  m.cull = pc.CULLFACE_NONE;
  m.update();
  return (crowMat = m);
}
async function spawnCrows(center) {
  const mat = await crowMaterial();
  const list = [];
  for (let k = 0; k < 22; k++) {
    const e = new pc.Entity();
    const wing = new pc.Entity();
    wing.addComponent('render', { type: 'plane', material: mat, castShadows: false });
    wing.setLocalEulerAngles(90, 0, 0);
    e.addChild(wing);
    const size = 0.35 + Math.random() * 0.25;
    e.setPosition(center[0] + (Math.random() - 0.5) * 3.5, 0.4 + Math.random() * 0.5, center[2] + (Math.random() - 0.5) * 1.6);
    scene.contentRoot.addChild(e);
    list.push({ e, wing, size, v: new pc.Vec3((Math.random() - 0.5) * 1.0, 0.3 + Math.random() * 0.35, -0.7 - Math.random() * 0.7), ph: Math.random() * 6 });
  }
  return list;
}

// ---------- 界面 ----------
function setText(sel, obj) {
  const el = $(sel);
  for (const k of ['en', 'zh', 'src']) {
    const c = el.querySelector('.' + k);
    if (c) c.textContent = obj[k] ?? '';
  }
}
const show = (sel, on) => { $(sel).style.opacity = on ? 1 : 0; };

// ---------- 关卡流程 ----------
let level = null, env = null, items = [], portal = null, birds = [], busy = false, collected = 0;

async function loadLevel(cfg) {
  if (env) env.destroy();
  for (const it of items) it.root.destroy();
  if (portal) portal.root.destroy();
  for (const b of birds) b.e.destroy();
  items = []; portal = null; birds = []; collected = 0;
  level = cfg;
  EYE = -cfg.ground * cfg.scale;
  grid = await (await fetch(cfg.grid)).json();
  env = await Environment.load(scene, cfg.scene, {
    position: { x: 0, y: -cfg.ground * cfg.scale, z: 0 },
    scale: cfg.scale,
  });
  items = cfg.items.filter((it) => it.kind !== 'horizon').map((it) => Object.assign(makeOrb(it.pos, it.kind), { cfg: it }));
  if (cfg.portal) {
    const next = LEVELS.find((l) => l.id === cfg.portal.next);
    portal = await makePortal(cfg.portal, next);
  }
}

// 画 → 空间 → 角色登场
async function intro(cfg) {
  camMode = 'manual';
  controlsOn = false;
  character.setActive(false);
  const fov0 = cfg.introFov ?? 85;
  camEntity.camera.fov = fov0;
  camEntity.setPosition(0, EYE, 0);
  camEntity.setEulerAngles(0, 0, 0);
  const paint = $('#painting');
  paint.style.backgroundImage = `url(${cfg.painting})`;
  paint.style.transition = 'none';
  paint.style.opacity = 1;
  paint.style.transform = 'scale(1)';
  await wait(50);
  paint.style.transition = '';
  $('#fade').style.opacity = 0;
  $('#loading').textContent = '';
  await wait(1700);
  paint.style.opacity = 0; // 画慢慢化开，露出同一个视角下的 3D 空间
  paint.style.transform = 'scale(1.12)';
  await wait(1500);
  $('#title h1').textContent = cfg.title.en;
  $('#title p').textContent = cfg.title.place;
  show('#title', true);
  const push = cfg.push ?? 1.0;
  await tween(2600, (t) => {
    const k = ease(t);
    camEntity.setPosition(0, EYE + 0.05 * k, -push * k);
    camEntity.camera.fov = lerp(fov0, 55, k);
  });
  show('#title', false);
  // 镜头从画家眼睛的位置往后拉，梵高出现在画里
  character.setPosition(0, 0, -push - 1.0);
  character.setRotation(0, 0, 0);
  character.setActive(true);
  character.playAnimation('idle', { loop: true });
  cam.yaw = 0; cam.pitch = 2; cam.height = 1.55; cam.distance = 1.0;
  camMode = 'cine';
  await tween(1800, (t) => {
    const k = ease(t);
    cam.distance = lerp(1.0, 1.9, k);
    cam.height = lerp(1.55, 1.45, k);
    cam.pitch = lerp(2, 8, k);
  });
  camMode = 'play';
  camDist = CAM_DIST;
  controlsOn = true;
  setText('#quote', cfg.quote);
  show('#quote', true);
  setText('#goal', cfg.goal);
  show('#goal', true);
  setTimeout(() => show('#quote', false), 7000);
}

function tween(ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ms);
      fn(t);
      if (t < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

async function playAction(name, ms) {
  controlsOn = false;
  character.crossfadeTo(name, { duration: 0.2, loop: false });
  await wait(ms);
  character.crossfadeTo('idle', { duration: 0.3, loop: true });
  ctrl._currentAnim = 'idle';
  controlsOn = true;
}

async function onCollect(it) {
  busy = true;
  const kind = it.cfg.kind;
  tween(500, (t) => {
    const s = 1 + 2.5 * t;
    it.halo.setLocalScale(0.36 * s, 0.36 * s, 0.36 * s);
    it.core.setLocalScale(0.1 * (1 - t), 0.1 * (1 - t), 0.1 * (1 - t));
  }).then(() => it.root.destroy());
  items = items.filter((x) => x !== it);
  collected++;
  await playAction(kind === 'star' ? 'pickup' : 'point', kind === 'star' ? 1500 : 1600);
  if (items.length === 0 && portal) {
    setText('#goal', { en: 'Step into the next painting', zh: '走进下一幅画' });
    tween(1400, (t) => { const s = Math.max(0.001, ease(t)); portal.root.setLocalScale(s, s, s); });
    portal.appear = 1;
  } else if (kind === 'star') {
    setText('#goal', { en: `Gather the three fallen stars · ${collected}/3`, zh: `收集三颗掉落的星星 · ${collected}/3` });
  }
  busy = false;
}

async function goNext() {
  busy = true;
  controlsOn = false;
  show('#goal', false);
  show('#quote', false);
  $('#fade').classList.remove('dark');
  $('#fade').style.opacity = 1;
  await wait(1300);
  const next = LEVELS.find((l) => l.id === level.portal.next);
  await loadLevel(next);
  await intro(next);
  busy = false;
}

async function ending() {
  busy = true;
  controlsOn = false;
  show('#goal', false);
  show('#quote', false);
  const p = character.getPosition();
  birds = await spawnCrows([p.x, 0, p.z - 1.6]);
  character.crossfadeTo('idle', { duration: 0.3, loop: true });
  camMode = 'cine';
  const y0 = cam.yaw, h0 = cam.height, d0 = cam.distance, p0 = cam.pitch;
  await tween(7000, (t) => {
    const k = ease(t);
    cam.yaw = lerp(y0, 0, k);
    cam.height = lerp(h0, 1.25, k);
    cam.distance = lerp(d0, 2.4, k);
    cam.pitch = lerp(p0, -6, k);
  });
  setText('#end', ENDING);
  $('#end').style.opacity = 1;
}

// ---------- 镜头不穿墙：沿“角色→镜头”方向找最远的可走点 ----------
const CAM_DIST = 1.9;
let camDist = CAM_DIST;
function clampCamera(dt) {
  cam.distance = CAM_DIST;
  cam.update(0);
  const t = character.getPosition(), c = camEntity.getPosition();
  const dx = c.x - t.x, dz = c.z - t.z, len = Math.hypot(dx, dz) || 1;
  let ok = 1;
  for (let f = 0.1; f <= 1.0001; f += 0.05) {
    // 往外多看 0.25 米，镜头不贴墙
    const ff = f + 0.25 / len;
    if (!walkable(t.x + dx * ff, t.z + dz * ff)) { ok = Math.max(0.4, f - 0.05); break; }
  }
  const target = CAM_DIST * ok;
  camDist = target < camDist ? target : camDist + (target - camDist) * Math.min(1, dt * 2.5);
  // 离得近时抬高镜头、往下看，变成越肩俯视，不会怼在身上
  const close = Math.max(0, (CAM_DIST - camDist) / CAM_DIST);
  cam.distance = camDist;
  cam.height = 1.45 + 0.75 * close;
  cam.pitch = 8 + 30 * close;
  cam.update(0);
}

// ---------- 每帧 ----------
let last = { x: 0, z: 0 };
app.on('update', (dt) => {
  if (controlsOn && !busy) {
    const before = character.getPosition();
    last = { x: before.x, z: before.z };
    ctrl.update(dt, cam.yaw);
    const p = character.getPosition();
    if (!walkable(p.x, p.z)) {
      // 贴着障碍滑动：先试只动 x，再试只动 z
      if (walkable(p.x, last.z)) character.setPosition(p.x, p.y, last.z);
      else if (walkable(last.x, p.z)) character.setPosition(last.x, p.y, p.z);
      else character.setPosition(last.x, p.y, last.z);
    }
  }
  if (camMode === 'play' || camMode === 'cine') cam.update(dt);
  if (camMode === 'play') clampCamera(dt);

  const pos = character.getPosition();
  for (const it of items) {
    it.t += dt;
    it.root.setPosition(it.base[0], it.base[1] + Math.sin(it.t * 2) * 0.06, it.base[2]);
    const s = 0.36 * (1 + 0.15 * Math.sin(it.t * 3));
    if (!busy) it.halo.setLocalScale(s, s, s);
    if (!busy && controlsOn && Math.hypot(pos.x - it.base[0], pos.z - it.base[2]) < it.cfg.reach) onCollect(it);
  }
  if (portal && portal.appear && !busy && controlsOn && Math.hypot(pos.x - portal.pos[0], pos.z - portal.pos[2]) < 0.9) goNext();
  if (level && !busy && controlsOn) {
    const hz = level.items.find((it) => it.kind === 'horizon');
    if (hz && Math.hypot(pos.x - hz.pos[0], pos.z - hz.pos[2]) < hz.reach) ending();
  }
  const cp = camEntity.getPosition();
  for (const b of birds) {
    b.ph += dt * 9;
    const e = b.e, p = e.getPosition();
    e.setPosition(p.x + b.v.x * dt, p.y + b.v.y * dt, p.z + b.v.z * dt);
    e.lookAt(cp.x, cp.y, cp.z);
    const flap = 0.55 + 0.45 * Math.abs(Math.sin(b.ph));
    b.wing.setLocalScale(b.size, 1, b.size * 0.5 * flap);
  }
});

// ---------- 录制与镜头工具（给录 B-roll 用） ----------
window.cine = {
  // 在画家的视点原地转身：先看原画构图，再转到画家身后
  async reveal(ms = 5000, to = 180, pitchEnd = 0) {
    camMode = 'manual'; controlsOn = false;
    camEntity.setPosition(0, EYE, 0);
    await tween(ms, (t) => camEntity.setEulerAngles(pitchEnd * ease(t), to * ease(t), 0));
  },
  props(on) { for (const it of items) it.root.enabled = on; if (portal) portal.root.enabled = on; },
  // 绕角色转一圈
  async orbit(ms = 9000, deg = 360) {
    camMode = 'cine'; controlsOn = false;
    const y0 = cam.yaw;
    await tween(ms, (t) => { cam.yaw = y0 + deg * ease(t); });
    camMode = 'play'; controlsOn = true;
  },
  play() { camMode = 'play'; controlsOn = true; },
  hud(on) { document.body.classList.toggle('clean', !on); },
  async goto(id) { const l = LEVELS.find((x) => x.id === id); await loadLevel(l); await intro(l); },
};
let recorder = null, chunks = [];
window.rec = {
  start() {
    chunks = [];
    recorder = new MediaRecorder(canvas.captureStream(60), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 16e6 });
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.start(250);
  },
  stop(name = 'clip') {
    return new Promise((resolve) => {
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        await fetch('__save?name=' + encodeURIComponent(name), { method: 'POST', body: blob });
        resolve(blob.size);
      };
      recorder.stop();
    });
  },
};
window.__game = { scene, character, cam, ctrl, get env() { return env; }, get level() { return level; }, walkable, makeOrb, pc };

// ---------- 开始 ----------
const startId = q.get('level') || 'bedroom';
const first = LEVELS.find((l) => l.id === startId) || LEVELS[0];
$('#loading').textContent = 'Walk Into Van Gogh';
await loadLevel(first);
await intro(first);
