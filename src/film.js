// 60 秒成片：按时间 t 摆镜头、角色、乌鸦和字幕；test/render-film.mjs 逐帧截图合成视频
import * as pc from 'playcanvas';
import { Scene, Environment, Character, Animation, PointLight } from '@viggle/splat-engine';
import { makeLiving } from './living.js';
import { paintCharacter } from './paint.js';
import { makeParticles, makeContactShadow } from './fx.js';

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const seg = (t, a, b) => ease(clamp01((t - a) / (b - a)));
const lin = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const fade = (t, a, b, f = 0.5) => clamp01(Math.min((t - a) / f, (b - t) / f));

const SCENES = {
  starry: {
    file: q.get('starry') || 'scenes/starryart.compressed.ply', ground: Number(q.get('sg') ?? -0.338), scale: Number(q.get('ss') ?? 4.43), painting: 'paintings/starry.jpg', flow: 0.5,
    // 漩涡中心（美术方向版场景，从仰视 30° 的画面里量出来再换算成方向）
    vortices: [
      { pitch: 34.3, yaw: -5.4, radius: 16, speed: 0.32 },
      { pitch: 5.8, yaw: 31.5, radius: 9, speed: 0.55 },
      { pitch: 40.5, yaw: -58.6, radius: 8, speed: 0.5 },
      { pitch: 10.1, yaw: -47.4, radius: 10, speed: 0.4 },
    ],
  },
  // 美术方向版：原画构图在左侧约 80°（yaw0 偏移），转身约 260° 是带尖顶的星空街道
  cafe: { file: q.get('cafe') || 'scenes/cafeart.compressed.ply', ground: Number(q.get('cg') ?? -0.364), scale: Number(q.get('cs') ?? 4.12), yaw0: Number(q.get('cy') ?? 80), painting: 'paintings/cafe.jpg', flow: 0.25 },
  rhone: { file: 'scenes/rhone.compressed.ply', ground: -0.836, scale: 1.79, painting: 'paintings/rhone.jpg', flow: 0.35 },
  wheat: {
    file: q.get('wheat') || 'scenes/wheatart.compressed.ply', ground: Number(q.get('wg') ?? -0.42), scale: Number(q.get('ws') ?? 3.57),
    painting: 'paintings/wheat.jpg', flow: 0.3, wave: 0.05,
  },
};

// ---------- 引擎与后期 ----------
const canvas = $('#c');
const scene = await Scene.create(canvas, { fov: 60, antialias: true, depth: true, backend: 'webgl', maxPixelRatio: 1, preserveDrawingBuffer: true });
scene.start();
const app = scene.app;
const cam = scene.cameraEntity;
const cf = scene.getOrCreateCameraFrame();
cf.rendering.sharpness = 0.8;
cf.grading.enabled = true;
cf.grading.contrast = 1.18;
cf.grading.saturation = 0.9;
cf.colorEnhance.enabled = true;
cf.colorEnhance.dehaze = 0.25;
cf.colorEnhance.shadows = -0.15;
cf.colorEnhance.highlights = 0.2;
cf.bloom.intensity = 0.045;
cf.bloom.blurLevel = 14;
cf.vignette.intensity = 0.55;
cf.vignette.inner = 0.42;
cf.vignette.outer = 1.1;
cf.vignette.curvature = 0.6;
cf.update();

// ---------- 四个世界 ----------
const envs = {};
for (const [id, s] of Object.entries(SCENES)) {
  envs[id] = await Environment.load(scene, s.file, { position: { x: 0, y: -s.ground * s.scale, z: 0 }, scale: s.scale });
  envs[id].entity.enabled = false;
  s.eye = -s.ground * s.scale;
  s.living = makeLiving(envs[id], { eye: s.eye, scale: s.scale, flow: s.flow, vortices: s.vortices || [], wave: s.wave || 0 });
}
let current = null;
function use(id) {
  if (current === id) return;
  for (const k in envs) envs[k].entity.enabled = k === id;
  current = id;
}

// ---------- 梵高：动画由片子时间驱动 ----------
const vincent = await Character.load(scene, 'characters/vangogh.vsplat', { position: { x: 0, y: 0, z: 0 } });
// 动作都来自 PINOC 免费动作库：站立、走路、指向远方、挥手、蹲下
await Promise.all(['idle', 'walk', 'point', 'wave', 'crouch'].map((n) => Animation.loadGlb(scene, `motions/${n}.glb`, n)));
let clip = null;
// 只在状态变化时才调用引擎接口：每帧反复开关角色、改着色会让渲染进程越跑越慢
let vOn = null, vTint = null;
function showVincent(on) { if (vOn !== on) { vincent.setActive(on); vOn = on; } }
function tintVincent(k, c) { const key = k + ',' + c.r; if (vTint !== key) { vincent.setTint(k, c); vTint = key; } }
// 引擎的 animationTime 按帧算：秒 × 帧率 × 播放速度，循环动作按时长取余
function pose(name, sec, rate = 1) {
  if (clip !== name) { vincent.playAnimation(name, { loop: true }); clip = name; }
  const a = vincent.armature, f = sec * (a.frameRate || 30) * rate, d = a.animationDuration - 1;
  a.paused = true;
  a.animationTime = d > 0 ? ((f % d) + d) % d : 0;
}
// 走路动作原速每秒前进 1.5 米（量脚着地时的后滑速度），按播放速度同比推进就不滑步
const WALK_SPEED = 1.5;
const paint = q.get('paint') === '0' ? null : paintCharacter(vincent);
window.__paint = paint;
window.__v = vincent;
showVincent(false);

// ---------- 乌鸦：笔触画的“M”，位置完全由时间决定 ----------
function crowMaterial() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  g.strokeStyle = '#121833'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 26;
  g.beginPath(); g.moveTo(18, 84); g.quadraticCurveTo(70, 26, 128, 76); g.quadraticCurveTo(186, 26, 238, 84); g.stroke();
  const tex = new pc.Texture(app.graphicsDevice, { width: 256, height: 128, format: pc.PIXELFORMAT_RGBA8, mipmaps: true });
  tex.setSource(cv);
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0); m.emissive = new pc.Color(0.07, 0.09, 0.18); m.useLighting = false;
  m.opacityMap = tex; m.opacityMapChannel = 'a'; m.blendType = pc.BLEND_NORMAL; m.depthWrite = false; m.cull = pc.CULLFACE_NONE;
  m.update();
  return m;
}
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const crowMat = crowMaterial();
const crows = [];
for (let k = 0; k < 30; k++) {
  const e = new pc.Entity(), wing = new pc.Entity();
  wing.addComponent('render', { type: 'plane', material: crowMat, castShadows: false });
  wing.setLocalEulerAngles(90, 0, 0);
  e.addChild(wing);
  e.enabled = false;
  scene.contentRoot.addChild(e);
  crows.push({ e, wing, size: 0.5 + rnd() * 0.4, p0: [(rnd() - 0.5) * 5, 1.3 + rnd() * 0.9, -4.0 - rnd() * 1.5], v: [(rnd() - 0.5) * 1.0, 0.25 + rnd() * 0.3, -0.3 - rnd() * 0.5], delay: rnd() * 0.9, ph: rnd() * 6 });
}
function placeCrows(on, tl) {
  const cp = cam.getPosition();
  for (const c of crows) {
    const tt = tl - c.delay;
    c.e.enabled = on && tt > 0;
    if (!c.e.enabled) continue;
    c.e.setPosition(c.p0[0] + c.v[0] * tt, c.p0[1] + c.v[1] * tt, c.p0[2] + c.v[2] * tt);
    c.e.lookAt(cp.x, cp.y, cp.z);
    const flap = 0.55 + 0.45 * Math.abs(Math.sin(c.ph + tt * 9));
    c.wing.setLocalScale(c.size, 1, c.size * 0.5 * flap);
  }
}

// ---------- 代码层：粒子、灯光、接触阴影 ----------
const noFx = q.get('fx') === '0';
const FX = {
  starry: makeParticles(scene, { count: 70, box: [-3, 3, 0.6, 3.2, -3.5, 3], vel: [0.03, 0.05, 0], jitter: 0.06, size: [0.02, 0.045], color: [1, 0.92, 0.7], twinkle: 2.2 }),
  cafe: makeParticles(scene, { count: 50, box: [-2.5, 2.5, 0.8, 3.0, -4, 2], vel: [0, 0.08, 0], jitter: 0.1, size: [0.015, 0.035], color: [1, 0.75, 0.35], twinkle: 3 }),
  rhone: makeParticles(scene, { count: 120, box: [-5, 5, 0.02, 0.05, -7, -1.2], vel: [0.05, 0, 0], jitter: 0.04, size: [0.05, 0.11], stretch: 4, color: [1, 0.82, 0.4], twinkle: 4 }),
  wheat: makeParticles(scene, { count: 60, box: [-3, 3, 0.3, 2.2, -5, 0], vel: [0.35, 0.04, 0.08], jitter: 0.15, size: [0.012, 0.03], color: [1, 0.88, 0.55], twinkle: 1.5 }),
};
const shadow = makeContactShadow(scene);
const LAMP = (q.get('lamp') || '-2.8,2.3,-0.75').split(',').map(Number);
const lights = {
  wheatRim: PointLight.create(scene, { position: { x: 0.6, y: 2.3, z: -4.2 }, color: '#ffd9a0', intensity: 0.5, range: 2.6, enabled: false }),
  cafeLamp: PointLight.create(scene, { position: { x: LAMP[0], y: LAMP[1], z: LAMP[2] }, color: '#ffc46b', intensity: 0.8, range: 3.0, enabled: false }),
};
let fxScene = null;

// ---------- 画面层 ----------
function caption(zh, en, op, small = false) {
  $('#cap .zh').textContent = zh; $('#cap .en').textContent = en;
  $('#cap').classList.toggle('small', small); $('#cap').style.opacity = op;
}
function card(id, op) { $(id).style.opacity = op; }
function inset(src, op, aspect = 1.263) {
  const p = $('#inset');
  if (src && p.dataset.src !== src) { const im = p.querySelector('.img'); im.style.backgroundImage = `url(${src})`; im.style.width = `${11 * aspect}vw`; p.dataset.src = src; }
  p.style.opacity = op;
}
function painting(src, op, scale) {
  const p = $('#painting');
  if (src) p.style.backgroundImage = `url(${src})`;
  p.style.opacity = op; p.style.transform = `scale(${scale})`;
}
function shotCam(s, x, y, z, pitch, yaw, fov) {
  cam.setPosition(x, s.eye + y, z);
  cam.setEulerAngles(pitch, yaw, 0);
  cam.camera.fov = fov;
}

// ---------- 关键帧运镜：位置走 Catmull-Rom 曲线，朝向可以给角度，也可以给注视点 ----------
// key: { t, p: [x, y, z]（相对画家眼睛，米）, ypr: [pitch, yaw] 或 look: [x, y, z]（世界坐标）, fov }
const crm = (p0, p1, p2, p3, u) => 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
function anglesOf(s, k) {
  if (k.ypr) return k.ypr;
  const dx = k.look[0] - k.p[0], dy = k.look[1] - (s.eye + k.p[1]), dz = k.look[2] - k.p[2];
  return [Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI, Math.atan2(-dx, -dz) * 180 / Math.PI];
}
function path(s, t, keys) {
  const n = keys.length;
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1];
  const k0 = keys[Math.max(0, i - 1)], k3 = keys[Math.min(n - 1, i + 2)];
  const uu = clamp01((t - a.t) / (b.t - a.t));
  const w = lerp(uu, ease(uu), 0.35); // 段内轻微缓动，曲线保证段间连续
  const pos = [0, 1, 2].map((j) => crm(k0.p[j], a.p[j], b.p[j], k3.p[j], w));
  const A = [k0, a, b, k3].map((k) => anglesOf(s, k));
  // yaw 展开，避免 179 → -179 绕远路
  for (let j = 1; j < 4; j++) { while (A[j][1] - A[j - 1][1] > 180) A[j][1] -= 360; while (A[j][1] - A[j - 1][1] < -180) A[j][1] += 360; }
  const pitch = crm(A[0][0], A[1][0], A[2][0], A[3][0], w), yaw = crm(A[0][1], A[1][1], A[2][1], A[3][1], w);
  const fov = lerp(a.fov ?? 60, b.fov ?? 60, w);
  shotCam(s, pos[0], pos[1], pos[2], pitch, yaw, fov);
}

// ---------- 时间线（秒） ----------
const T = { starryEnd: 15.5, title: 18.0, cafeEnd: 26.5, rhoneEnd: 34.0, howEnd: 44.0, wheatEnd: 55.5, end: 63.0 };

function frame(t) {
  for (const k in SCENES) { SCENES[k].living.time(t); SCENES[k].living.flat(0); }
  inset(null, 0);
  let black = 0;
  card('#title', 0); card('#end', 0); card('#how', 0);
  painting(null, 0, 1);
  placeCrows(false, 0);
  let vincentVisible = false;
  fxScene = null;
  shadow.place(false);
  lights.wheatRim.enabled = false;
  lights.cafeLamp.enabled = false;

  if (t < T.starryEnd) {
    // A. 星月夜：原画 → 换成压平在画布上的 3D 场景 → 画“鼓”成立体 → 仰望旋转的漩涡 → 转身，梵高站在他没画过的那一半里
    const s = SCENES.starry; use('starry');
    const dis = seg(t, 2.2, 3.0), inflate = seg(t, 3.4, 5.8), turn = seg(t, 8.8, 13.6);
    painting(s.painting, 1 - dis, lerp(1, 1.08, lin(t, 0, 2.2)));
    // 原画是很广的构图，柏树在左侧约 65°：衔接时用 92° 广角、略向左偏。场景先压平成一张画布，松开后近处先鼓出来
    s.living.flat(1 - inflate, 28, 10);
    // 之后每一段都带平移：推进带漂移 → 从柏树前横移（柏树滑过漩涡）→ 升高仰望漩涡 → 侧移着转身 → 绕梵高剪影小幅环绕
    const V = [-0.25, 1.15, 1.9];
    path(s, t, [
      { t: 0.0, p: [0, 0, 0], ypr: [0, 28], fov: 92 },
      { t: 3.3, p: [0, 0, 0], ypr: [0, 28], fov: 92 },
      { t: 5.6, p: [0.05, -0.05, 0.0], ypr: [8, 52], fov: 64 }, // 往左移会露出柏树背后的空洞，只往右、往前
      { t: 7.2, p: [0.38, 0.05, -0.32], ypr: [16, 56], fov: 60 },
      { t: 8.8, p: [0.2, 0.3, -0.3], ypr: [33, 2], fov: 60 },
      { t: 11.2, p: [0.3, 0.12, -0.1], ypr: [14, -95], fov: 60 },
      { t: 13.4, p: [0.35, 0.0, 0.05], look: V, fov: 58 },
      { t: 15.5, p: [-0.6, 0.05, 0.15], look: V, fov: 56 },
    ]);
    if (turn > 0) {
      // 剪影侧身指向远处的山谷：侧面才看得出伸出去的手臂
      vincentVisible = true;
      vincent.setPosition(-0.25, 0, 1.9);
      vincent.setRotation(0, 120, 0);
      tintVincent(0.82, { r: 0.04, g: 0.05, b: 0.12 });
      pose('point', t);
    }
    fxScene = dis > 0.3 ? 'starry' : null;
    black = clamp01((t - 15.0) / 0.5);
    // 转身看到原画之外的部分时，角落放原画小图对照：输入只有这一张
    inset(s.painting, fade(t, 10.6, 14.9, 0.5));
    if (t < 5.0) caption('1889 · 圣雷米', 'Saint-Rémy-de-Provence, June 1889', fade(t, 0.3, 4.4, 0.6), true);
    else if (t < 9.4) caption('他只画了窗外的这一半', 'He painted only what lay outside his window', fade(t, 5.9, 9.2, 0.6));
    else caption('转过身，是他从没画过的另一半', 'Turn around. The half he never painted.', fade(t, 10.4, 14.6, 0.6));
  } else if (t < T.title) {
    // B. 片名
    black = 1; caption('', '', 0);
    card('#title', fade(t, T.starryEnd + 0.2, T.title - 0.1, 0.6));
  } else if (t < T.cafeEnd) {
    // C. 夜间咖啡馆：原画 → 推进露台 → 转身看身后半条街
    const s = SCENES.cafe; use('cafe');
    const t0 = T.title, dis = seg(t, t0 + 1.4, t0 + 2.8), push = seg(t, t0 + 2.8, t0 + 4.8), turn = seg(t, t0 + 4.8, t0 + 8.0);
    painting(s.painting, 1 - dis, lerp(lerp(1, 1.06, lin(t, t0, t0 + 1.4)), 1.25, dis));
    // 原画方向 yaw0=80。压低机位从露台桌椅之间横移穿过，再边走边转向身后的星空街道
    const y0 = s.yaw0 || 0;
    path(s, t, [
      { t: t0, p: [0, 0, 0], ypr: [0, y0], fov: 70 },
      { t: t0 + 1.4, p: [0, 0, 0], ypr: [0, y0], fov: 70 },
      { t: t0 + 3.0, p: [-0.1, -0.25, 0.55], ypr: [-3, y0 + 10], fov: 62 },
      { t: t0 + 4.9, p: [-0.45, -0.42, 0.15], ypr: [-6, y0 + 16], fov: 60 },
      { t: t0 + 6.4, p: [-0.3, -0.2, 0.3], ypr: [0, y0 + 120], fov: 60 },
      { t: t0 + 7.6, p: [0.0, -0.08, 0.5], ypr: [3, y0 + 176], fov: 60 },
      { t: T.cafeEnd, p: [0.15, -0.05, 0.6], ypr: [3, y0 + 180], fov: 58 },
    ]);
    // 转到身后的星空街道：梵高站在街上，朝镜头挥手（动作库 Wave Hello）
    if (t > t0 + 5.0) {
      vincentVisible = true;
      vincent.setPosition(3.96, 0, 1.38);
      vincent.setRotation(0, 78, 0);
      tintVincent(0.32, { r: 0.2, g: 0.13, b: 0.06 });
      const w0 = t0 + 6.9;
      if (t > w0 && t < w0 + 1.67) pose('wave', t - w0); else pose('idle', t);
      shadow.place(!noFx, 3.96, 1.38);
    }
    inset(s.painting, fade(t, t0 + 5.4, T.cafeEnd - 0.2, 0.5), 1275 / 1600);
    black = clamp01(1 - (t - t0) / 0.5) + clamp01((t - (T.cafeEnd - 0.4)) / 0.4);
    fxScene = dis > 0.3 ? 'cafe' : null;
    lights.cafeLamp.enabled = !noFx;
    lights.cafeLamp.intensity = 0.75 + 0.12 * Math.sin(t * 13.1) + 0.08 * Math.sin(t * 7.3 + 1.2);
    if (t < t0 + 2.8) caption('一年前 · 阿尔勒 1888', 'A year earlier. Arles, 1888', fade(t, t0 + 0.2, t0 + 2.8, 0.5), true);
    else caption('“这是一幅没有黑色的夜景。”', 'Now there’s a painting of night without black. — to his sister, 1888', fade(t, t0 + 3.2, T.cafeEnd - 0.3, 0.6));
  } else if (t < T.rhoneEnd) {
    // D. 罗纳河：贴着水面往前滑，再抬头看星星
    const s = SCENES.rhone; use('rhone');
    const t0 = T.cafeEnd, glide = seg(t, t0, t0 + 4.5), up = seg(t, t0 + 3.8, T.rhoneEnd);
    // 贴着水面斜着滑过去（前进 + 横移），再边滑边转身：梵高蹲在岸边看水里的星光（动作库 Crouching Idle）
    const VR = [0.5, 0.55, 2.5];
    path(s, t, [
      { t: t0, p: [-0.55, -0.6, 0.2], ypr: [-3, 10], fov: 58 },
      { t: t0 + 3.0, p: [0.3, -0.5, -0.7], ypr: [1, -4], fov: 58 },
      { t: t0 + 4.7, p: [0.8, -0.45, -0.6], ypr: [-4, -110], fov: 58 },
      { t: t0 + 5.9, p: [0.8, -0.42, -0.4], look: VR, fov: 56 },
      { t: T.rhoneEnd, p: [0.65, -0.38, -0.1], look: VR, fov: 54 },
    ]);
    if (t > t0 + 3.8) {
      vincentVisible = true;
      vincent.setPosition(0.5, 0, 2.5);
      vincent.setRotation(0, 0, 0);
      tintVincent(0.5, { r: 0.03, g: 0.07, b: 0.2 });
      pose('crouch', t);
      shadow.place(!noFx, 0.5, 2.5);
    }
    black = clamp01(1 - (t - t0) / 0.4) + clamp01((t - (T.rhoneEnd - 0.4)) / 0.4);
    fxScene = 'rhone';
    caption('“看着星星，我总会做梦。”', 'The sight of the stars always makes me dream. — to Theo, 1888', fade(t, t0 + 1.0, T.rhoneEnd - 0.4, 0.6));
  } else if (t < T.howEnd) {
    // E. 怎么做的：每幅画一闪 → 一次调用后它是一个能走进去的世界
    const t0 = T.rhoneEnd, order = ['starry', 'cafe', 'rhone', 'wheat'];
    const k = Math.min(3, Math.floor((t - t0 - 0.6) / 2.2));
    card('#how', fade(t, t0 + 0.1, T.howEnd - 0.2, 0.4));
    caption('', '', 0);
    if (k < 0) black = 1;
    else {
      const id = order[k], s = SCENES[id], ts = t0 + 0.6 + k * 2.2, flip = lin(t, ts + 0.7, ts + 1.0);
      use(id);
      painting(s.painting, 1 - flip, 1);
      // 每个世界一段短横移，看得出前后景错开
      const y0 = s.yaw0 || 0, r = [Math.cos(y0 * Math.PI / 180), -Math.sin(y0 * Math.PI / 180)];
      const k2 = seg(t, ts + 0.7, ts + 2.2), off = lerp(-0.35, 0.35, k2);
      shotCam(s, r[0] * off, -0.1, r[1] * off, 4, y0 + lerp(-6, 6, k2), 64);
    }
  } else if (t < T.wheatEnd) {
    // F. 麦田群鸦：他沿小路走远，乌鸦飞起，镜头抬向动荡的天空
    const s = SCENES.wheat; use('wheat');
    const t0 = T.howEnd, dis = seg(t, t0 + 1.4, t0 + 2.8);
    // 走路放慢到 0.45 倍，位置按同样的速度推进，脚踩实不打滑
    const RATE = 0.45, walkZ = (tt) => -2.3 - WALK_SPEED * RATE * Math.max(0, tt - (t0 + 2.6)), z = walkZ(t);
    painting(s.painting, 1 - dis, lerp(lerp(1, 1.06, lin(t, t0, t0 + 1.4)), 1.25, dis));
    if (dis > 0.6) {
      vincentVisible = true;
      tintVincent(0, { r: 0, g: 0, b: 0 });
      vincent.setRotation(0, 0, 0);
      vincent.setPosition(0.05, 0, z);
      pose('walk', t - (t0 + 2.6), RATE);
      shadow.place(!noFx, 0.05, z + 0.05);
      lights.wheatRim.enabled = !noFx;
      lights.wheatRim.position.set(0.6, 2.3, z - 1.4);
    }
    fxScene = dis > 0.3 ? 'wheat' : null;
    // 侧后方弧线跟拍：从右后方绕到正后方，最后升起来看乌鸦和天空
    if (dis < 1) shotCam(s, 0, 0, -0.4 * dis, -2, 0, lerp(70, 60, dis));
    else path(s, t, [
      { t: t0 + 2.8, p: [0, 0, -0.4], ypr: [-2, 0], fov: 60 },
      { t: t0 + 5.5, p: [0.7, -0.2, -1.3], look: [0.05, 1.1, walkZ(t0 + 5.5) - 1.0], fov: 58 },
      { t: t0 + 8.4, p: [0.25, -0.1, -2.4], look: [0.05, 1.4, walkZ(t0 + 8.4) - 2.0], fov: 58 },
      { t: T.wheatEnd, p: [-0.15, 0.25, -2.8], ypr: [22, 2], fov: 58 },
    ]);
    placeCrows(t > t0 + 5.6, t - (t0 + 5.6));
    black = clamp01((t - (T.wheatEnd - 0.5)) / 0.5);
    if (t < t0 + 3.0) caption('1890 年 7 月 · 奥维尔', 'Auvers-sur-Oise, July 1890', fade(t, t0 + 0.2, t0 + 3.0, 0.5), true);
    else caption('“那是一望无际的麦田，在动荡的天空下。”', 'Immense stretches of wheatfields under turbulent skies.', fade(t, t0 + 3.4, t0 + 8.4, 0.6));
  } else {
    // G. 结尾
    black = 1; caption('', '', 0);
    card('#end', fade(t, T.wheatEnd + 0.3, T.end + 1, 0.8));
    $('#end .l2').style.opacity = clamp01((t - (T.wheatEnd + 4.6)) / 0.8);
  }
  showVincent(vincentVisible);
  if (vincentVisible && current === 'starry') shadow.place(!noFx, -0.25, 1.9);
  for (const k in FX) FX[k].update(!noFx && fxScene === k, t, cam);
  $('#black').style.opacity = clamp01(black);
}

window.film = {
  duration: T.end, frame, ready: true,
  // 调试：把梵高摆到任意位置、播任意动作的任意时刻
  char(anim, time, x, y, z, ry = 0, tk = 0) { showVincent(true); vincent.setPosition(x, y, z); vincent.setRotation(0, ry, 0); tintVincent(tk, { r: 0.04, g: 0.05, b: 0.12 }); pose(anim, time); return vincent.armature.animationDuration; },
  // 调试：把相机放到任意位置（相对画家眼睛，米）
  at(t, id, x, y, z, pitch, yaw, fov = 60) { for (const k in SCENES) SCENES[k].living.time(t); use(id); painting(null, 0, 1); $('#black').style.opacity = 0; $('#cap').style.opacity = 0; showVincent(false); shotCam(SCENES[id], x, y, z, pitch, yaw, fov); },
  still(t, pitch, yaw, id = 'starry', fov = 70) { for (const k in SCENES) SCENES[k].living.time(t); use(id); painting(null, 0, 1); $('#black').style.opacity = 0; $('#cap').style.opacity = 0; shotCam(SCENES[id], 0, 0, 0, pitch, yaw, fov); },
};
frame(0);
