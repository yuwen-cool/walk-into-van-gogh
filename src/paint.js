// 给泼溅角色加“油画”效果：只改这个角色自己的工作缓冲着色器
// 形状：每个泼溅沿最长轴拉长、整体放大一点，像一笔笔油彩
// 颜色：按点的原始坐标做稳定的色彩扰动（梵高式的碎色），再提一点饱和度
import { WORK_BUFFER_MODIFIER_GLSL } from '@viggle/splat-engine';

const UNIFORMS = 'uniform float uPaintScale;\nuniform float uPaintStretch;\nuniform float uPaintJitter;\n';
const SCALE_HOOK = '    // (default) scale left alone';
const COLOR_HOOK = '    color.rgb *= computeLitFactor(center);';

const PAINT_GLSL = UNIFORMS + WORK_BUFFER_MODIFIER_GLSL
  .replace(SCALE_HOOK, `    scale *= uPaintScale;
    if (scale.x >= scale.y && scale.x >= scale.z) scale.x *= uPaintStretch;
    else if (scale.y >= scale.z) scale.y *= uPaintStretch;
    else scale.z *= uPaintStretch;
${SCALE_HOOK}`)
  .replace(COLOR_HOOK, `${COLOR_HOOK}
    vec3 hc = getCenter();
    vec3 jit = fract(sin(vec3(dot(hc, vec3(12.99, 78.23, 37.72)), dot(hc, vec3(39.35, 11.13, 83.15)), dot(hc, vec3(73.16, 52.27, 9.61)))) * 43758.5453) - 0.5;
    color.rgb *= 1.0 + jit * uPaintJitter;`);

export function paintCharacter(character, { scale = 1.12, stretch = 1.9, jitter = 0.24, contrast = 1.08, saturation = 1.22 } = {}) {
  const splat = character.splat;
  const g = splat.entity.gsplat;
  let defines = '';
  if (splat.splatWeights) defines += '#define USE_BONE_BLENDING\n';
  if (splat._variantMaskEnabled) defines += '#define USE_VARIANT_MASK\n';
  if (splat._nonRigidCov) defines += '#define USE_NONRIGID_COV\n';
  g.setWorkBufferModifier({ glsl: defines + PAINT_GLSL });
  g.setParameter('uPaintScale', scale);
  g.setParameter('uPaintStretch', stretch);
  g.setParameter('uPaintJitter', jitter);
  splat.setGrade(contrast, saturation);
  return {
    set({ scale: s = scale, stretch: st = stretch, jitter: j = jitter } = {}) {
      g.setParameter('uPaintScale', s); g.setParameter('uPaintStretch', st); g.setParameter('uPaintJitter', j);
    },
  };
}
