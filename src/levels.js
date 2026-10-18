// 四幅画四关。ground / scale 由 tools/prep-scene.py 测出：场景原点是画家的眼睛，地面 y=0，单位米。
// yaw0：原画构图所在的方向（度，0 = 朝 -Z）；转身 180° 就是画家身后、原画里没有的那一半。
// 场景都是带美术方向描述 + 高画质参数重新生成的（Viggle JST 2 / PINOC MCP）。
export const LEVELS = [
  {
    id: 'starry',
    scene: 'scenes/starryart.compressed.ply',
    grid: 'levels/starryart.grid.json',
    ground: -0.338,
    scale: 4.43,
    yaw0: 0,
    introYaw: 28, // 原画构图很广，柏树在左侧约 65°：开场先偏左、用广角把它框进来
    introFov: 92,
    painting: 'paintings/starry.jpg',
    title: { en: 'The Starry Night', place: 'Saint-Rémy-de-Provence, June 1889' },
    quote: { en: 'He painted only what lay outside his window.', zh: '他只画了窗外的这一半。', src: '' },
    living: {
      flow: 0.5,
      vortices: [
        { pitch: 34.3, yaw: -5.4, radius: 16, speed: 0.32 },
        { pitch: 5.8, yaw: 31.5, radius: 9, speed: 0.55 },
        { pitch: 40.5, yaw: -58.6, radius: 8, speed: 0.5 },
        { pitch: 10.1, yaw: -47.4, radius: 10, speed: 0.4 },
      ],
    },
    particles: { count: 70, box: [-3, 3, 0.6, 3.2, -3.5, 3], vel: [0.03, 0.05, 0], jitter: 0.06, size: [0.02, 0.045], color: [1, 0.92, 0.7], twinkle: 2.2 },
    next: 'cafe',
  },
  {
    id: 'cafe',
    scene: 'scenes/cafeart.compressed.ply',
    grid: 'levels/cafeart.grid.json',
    ground: -0.364,
    scale: 4.12,
    yaw0: 80,
    push: 0.4,
    painting: 'paintings/cafe.jpg',
    title: { en: 'Café Terrace at Night', place: 'Arles, September 1888' },
    quote: {
      en: '“Now there’s a painting of night without black.”',
      zh: '“这是一幅没有黑色的夜景。”',
      src: 'Vincent to Willemien · September 1888',
    },
    living: { flow: 0.25 },
    particles: { count: 50, box: [-2.5, 2.5, 0.8, 3.0, -4, 2], vel: [0, 0.08, 0], jitter: 0.1, size: [0.015, 0.035], color: [1, 0.75, 0.35], twinkle: 3 },
    next: 'rhone',
  },
  {
    id: 'rhone',
    scene: 'scenes/rhone.compressed.ply',
    grid: 'levels/rhone.grid.json',
    ground: -0.836,
    scale: 1.79,
    yaw0: 0,
    push: 0.2,
    firstPerson: true, // 画家正对着河，第三人称会把人和镜头放到水面上；这一关用画家自己的眼睛看
    painting: 'paintings/rhone.jpg',
    title: { en: 'Starry Night Over the Rhône', place: 'Arles, September 1888' },
    quote: {
      en: '“The sight of the stars always makes me dream.”',
      zh: '“看着星星，我总会做梦。”',
      src: 'Vincent to Theo · July 1888',
    },
    living: { flow: 0.35 },
    particles: { count: 120, box: [-5, 5, 0.02, 0.05, -7, -1.2], vel: [0.05, 0, 0], jitter: 0.04, size: [0.05, 0.11], stretch: 4, color: [1, 0.82, 0.4], twinkle: 4 },
    next: 'wheat',
  },
  {
    id: 'wheat',
    scene: 'scenes/wheatart.compressed.ply',
    grid: 'levels/wheatart.grid.json',
    ground: -0.42,
    scale: 3.57,
    yaw0: 0,
    push: 0.6,
    painting: 'paintings/wheat.jpg',
    title: { en: 'Wheatfield with Crows', place: 'Auvers-sur-Oise, July 1890' },
    quote: {
      en: '“They’re immense stretches of wheatfields under turbulent skies.”',
      zh: '“那是一望无际的麦田，在动荡的天空下。”',
      src: 'Vincent to Theo and Jo · about 10 July 1890',
    },
    living: { flow: 0.3, wave: 0.05 },
    particles: { count: 60, box: [-3, 3, 0.3, 2.2, -5, 0], vel: [0.35, 0.04, 0.08], jitter: 0.15, size: [0.012, 0.03], color: [1, 0.88, 0.55], twinkle: 1.5 },
    horizon: 2.9, // 沿原画方向走到离原点这么远就进入结尾
    next: null,
  },
];

export const TURN_GOAL = { en: 'Turn around. See the half he never painted.', zh: '转过身，看看他没画的那一半' };
export const REVEAL = { en: 'He never painted this side.', zh: '这一面，他从没画过。' };
export const NEXT_GOAL = { en: 'Step into the next painting', zh: '走进下一幅画' };
export const HORIZON_GOAL = { en: 'Walk toward the horizon', zh: '朝地平线走去' };

export const ENDING = {
  en: '“I’d almost believe that these canvases will tell you what I can’t say in words.”',
  zh: '“我几乎相信，这些画会替我说出那些我说不出口的话。”',
  src: 'Vincent to Theo and Jo · about 10 July 1890 · less than three weeks before he died',
};
