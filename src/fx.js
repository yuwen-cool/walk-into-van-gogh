// 成片用的代码层特效：粒子、接触阴影。位置全部由时间 t 算出，逐帧渲染结果是确定的
import * as pc from 'playcanvas';

function radialTexture(device, inner = 0.0, soft = 1.0) {
  const n = 64, cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(n / 2, n / 2, n * 0.5 * inner, n / 2, n / 2, n / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(soft, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, n, n);
  const tex = new pc.Texture(device, { width: n, height: n, format: pc.PIXELFORMAT_RGBA8, mipmaps: true });
  tex.setSource(cv);
  return tex;
}

function glowMat(device, color) {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(...color);
  m.useLighting = false;
  m.opacityMap = radialTexture(device, 0.05, 1.0);
  m.opacityMapChannel = 'a';
  m.blendType = pc.BLEND_ADDITIVEALPHA;
  m.depthWrite = false;
  m.cull = pc.CULLFACE_NONE;
  m.update();
  return m;
}

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// box: [x0,x1, y0,y1, z0,z1]（世界坐标，米）; vel: [vx,vy,vz]（米/秒）
export function makeParticles(scene, { count, box, vel = [0, 0, 0], jitter = 0.05, size = [0.02, 0.05], stretch = 1, color, twinkle = 1.5, alpha = 1 }) {
  const mat = glowMat(scene.graphicsDevice, color);
  const list = [];
  for (let i = 0; i < count; i++) {
    const e = new pc.Entity(), q = new pc.Entity();
    q.addComponent('render', { type: 'plane', material: mat, castShadows: false });
    q.setLocalEulerAngles(90, 0, 0);
    e.addChild(q);
    e.enabled = false;
    scene.contentRoot.addChild(e);
    list.push({
      e, q,
      p: [lerp(box[0], box[1], rnd()), lerp(box[2], box[3], rnd()), lerp(box[4], box[5], rnd())],
      v: [vel[0] + (rnd() - 0.5) * jitter, vel[1] + (rnd() - 0.5) * jitter, vel[2] + (rnd() - 0.5) * jitter],
      s: lerp(size[0], size[1], rnd()), ph: rnd() * 6.28, fr: twinkle * (0.6 + rnd() * 0.8),
    });
  }
  const span = [box[1] - box[0], box[3] - box[2], box[5] - box[4]];
  const wrap = (x, a, w) => a + ((((x - a) % w) + w) % w);
  return {
    update(on, t, cam) {
      const cp = cam.getPosition();
      for (const k of list) {
        k.e.enabled = on;
        if (!on) continue;
        k.e.setPosition(wrap(k.p[0] + k.v[0] * t, box[0], span[0]), wrap(k.p[1] + k.v[1] * t, box[2], span[1]), wrap(k.p[2] + k.v[2] * t, box[4], span[2]));
        k.e.lookAt(cp.x, cp.y, cp.z);
        const tw = Math.max(0, 0.35 + 0.65 * Math.sin(k.ph + t * k.fr));
        const s = k.s * (0.5 + 0.5 * tw) * alpha;
        k.q.setLocalScale(s * stretch, 1, s);
      }
    },
  };
}

// 脚下的柔和接触阴影
export function makeContactShadow(scene) {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = new pc.Color(0.02, 0.02, 0.05);
  m.useLighting = false;
  m.opacityMap = radialTexture(scene.graphicsDevice, 0.0, 1.0);
  m.opacityMapChannel = 'a';
  m.opacity = 0.55;
  m.blendType = pc.BLEND_NORMAL;
  m.depthWrite = false;
  m.update();
  const e = new pc.Entity();
  e.addComponent('render', { type: 'plane', material: m, castShadows: false });
  e.enabled = false;
  scene.contentRoot.addChild(e);
  return {
    place(on, x, z, r = 0.45) { e.enabled = on; if (on) { e.setPosition(x, 0.015, z); e.setLocalScale(r * 2, 1, r * 1.4); } },
  };
}

function lerp(a, b, k) { return a + (b - a) * k; }
