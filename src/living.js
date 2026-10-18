// 让泼溅场景“活”起来：改 PlayCanvas 的工作缓冲着色器
// 1) 每个笔触沿自己的长轴来回滑动（天空幅度大、地面小），整幅画像在流动
// 2) 天空里若干漩涡绕中心旋转，越靠里转得越快
import { ENV_WORK_BUFFER_MODIFIER_GLSL } from '@viggle/splat-engine';

const CENTER_FN = `void modifySplatCenter(inout vec3 center) {
    #ifdef GSPLAT_CENTER_NOPROJ
    vec3 modelCenter = getCenter();
    center = (matrix_model * vec4(modelCenter, 1.0)).xyz;
    #endif
}`;

const LIVING = `
uniform float uTime;
uniform float uFlow;
uniform float uEnvScale;
uniform vec3 uEye;
uniform vec4 uVort0;
uniform vec4 uVort1;
uniform vec4 uVort2;
uniform vec4 uVort3;
uniform vec4 uSpin;
uniform float uWave;

vec3 lvQrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }

vec3 lvSpin(vec3 d, vec4 vt, float w) {
    if (vt.w <= 0.0 || w == 0.0) return d;
    vec3 a = normalize(vt.xyz);
    float th = acos(clamp(dot(normalize(d), a), -1.0, 1.0));
    if (th >= vt.w) return d;
    float f = pow(1.0 - th / vt.w, 1.6);
    float ang = w * uTime * f;
    return d * cos(ang) + cross(a, d) * sin(ang) + a * dot(a, d) * (1.0 - cos(ang));
}

void modifySplatCenter(inout vec3 center) {
    #ifdef GSPLAT_CENTER_NOPROJ
    vec3 modelCenter = getCenter();
    center = (matrix_model * vec4(modelCenter, 1.0)).xyz;
    #endif
    vec3 d = center - uEye;
    float up = smoothstep(-0.05, 0.35, normalize(d).y);
    // 1) 笔触沿长轴流动
    vec4 q = getRotation().yzwx;
    vec3 s = getScale();
    vec3 ax = s.x > s.y ? (s.x > s.z ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0)) : (s.y > s.z ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
    float len = max(s.x, max(s.y, s.z)) * uEnvScale;
    float ph = dot(center, vec3(3.1, 4.7, 2.3));
    center += lvQrot(q, ax) * len * uFlow * (0.3 + 0.7 * up) * sin(uTime * 1.7 + ph);
    // 2) 漩涡旋转
    d = center - uEye;
    d = lvSpin(d, uVort0, uSpin.x);
    d = lvSpin(d, uVort1, uSpin.y);
    d = lvSpin(d, uVort2, uSpin.z);
    d = lvSpin(d, uVort3, uSpin.w);
    center = uEye + d;
    // 3) 风吹过的麦浪：只动离地 0.05–1.6 米的点，成片沿同一方向起伏
    if (uWave > 0.0) {
        float h = smoothstep(0.05, 0.6, center.y) * (1.0 - smoothstep(1.1, 1.7, center.y));
        float w = sin(uTime * 1.9 + center.z * 1.4 + center.x * 0.5) + 0.5 * sin(uTime * 3.1 + center.x * 2.3);
        center.x += uWave * h * w;
        center.z += uWave * 0.4 * h * w;
    }
}`;

export const LIVING_GLSL = ENV_WORK_BUFFER_MODIFIER_GLSL.replace(CENTER_FN, LIVING);
if (LIVING_GLSL === ENV_WORK_BUFFER_MODIFIER_GLSL) console.warn('living: 没找到 modifySplatCenter，着色器未替换');

// 方向：pitch 向上为正、yaw 与相机 setEulerAngles 一致（0 = 朝 -Z 原画方向）
export function dirFrom(pitchDeg, yawDeg) {
  const p = pitchDeg * Math.PI / 180, y = yawDeg * Math.PI / 180;
  return [-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)];
}

export function makeLiving(env, { eye, scale, flow = 0.12, vortices = [], wave = 0 }) {
  const g = env.entity.gsplat;
  g.setWorkBufferModifier({ glsl: LIVING_GLSL });
  g.workBufferUpdate = 2; // WORKBUFFER_UPDATE_ALWAYS：每帧重算
  const set = (n, v) => g.setParameter(n, v);
  set('uEye', [0, eye, 0]);
  set('uEnvScale', scale);
  set('uFlow', flow);
  const spin = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const v = vortices[i];
    if (v) { const a = dirFrom(v.pitch, v.yaw); set(`uVort${i}`, [...a, v.radius * Math.PI / 180]); spin[i] = v.speed; }
    else set(`uVort${i}`, [0, 1, 0, 0]);
  }
  set('uSpin', spin);
  set('uWave', wave);
  set('uTime', 0);
  return { time(t) { set('uTime', t); }, flow(f) { set('uFlow', f); } };
}
