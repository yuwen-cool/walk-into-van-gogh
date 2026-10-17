// 三幅画三关。ground / scale 由 tools/prep-scene.py 测出：
// 场景原点是画家的视点，地面平移到 y=0，单位换算成米。
// 坐标约定：从原点朝 -Z 看就是原画的构图，+Z 是画家身后、原画里没有的那一半。
export const LEVELS = [
  {
    id: 'bedroom',
    scene: 'scenes/bedroom.compressed.ply',
    grid: 'levels/bedroom.grid.json',
    ground: -0.49,
    scale: 2.5, // 按“原点离地 1.5 米”算出来是 3.25，房间偏大，草帽挂到 3 米高；收到 2.5
    painting: 'paintings/bedroom.jpg',
    title: { en: 'The Bedroom', place: 'Arles, 1888' },
    quote: {
      en: '“Looking at the painting should rest the mind, or rather, the imagination.”',
      zh: '“看这幅画，应该让头脑，或者说让想象力，休息一下。”',
      src: 'Vincent to Theo · 16 October 1888',
    },
    goal: { en: 'Find Vincent’s straw hat', zh: '找到文森特的草帽' },
    // 草帽挂在画家身后那面墙上（原画里看不到的一侧）
    items: [{ pos: [-0.77, 2.3, 1.73], reach: 0.9, kind: 'hat' }],
    portal: { pos: [1.2, 0, 0.0], yaw: -90, next: 'cafe' },
    push: 0.4, // 房间小，开场只往前推 0.4 米
  },
  {
    id: 'cafe',
    scene: 'scenes/cafe.compressed.ply',
    grid: 'levels/cafe.grid.json',
    ground: -0.2983,
    scale: 5.05,
    painting: 'paintings/cafe.jpg',
    title: { en: 'Café Terrace at Night', place: 'Arles, 1888' },
    quote: {
      en: '“Now there’s a painting of night without black.”',
      zh: '“这是一幅没有黑色的夜景。”',
      src: 'Vincent to Willemien · September 1888',
    },
    goal: { en: 'Gather the three fallen stars', zh: '收集三颗掉落的星星' },
    // 星星都散落在画家身后那半条街上
    items: [
      { pos: [2.5, 0.25, 1.2], reach: 0.8, kind: 'star' },
      { pos: [-3.5, 0.25, 3.4], reach: 0.8, kind: 'star' },
      { pos: [0.6, 0.25, 3.2], reach: 0.8, kind: 'star' },
    ],
    portal: { pos: [0.2, 0, -3.4], yaw: 0, next: 'wheat' },
  },
  {
    id: 'wheat',
    scene: 'scenes/wheat.compressed.ply',
    grid: 'levels/wheat.grid.json',
    ground: -0.702,
    scale: 2.14,
    painting: 'paintings/wheat.jpg',
    title: { en: 'Wheatfield with Crows', place: 'Auvers-sur-Oise, July 1890' },
    quote: {
      en: '“They’re immense stretches of wheatfields under turbulent skies.”',
      zh: '“那是一望无际的麦田，在动荡的天空下。”',
      src: 'Vincent to Theo and Jo · about 10 July 1890',
    },
    goal: { en: 'Walk toward the horizon', zh: '朝地平线走去' },
    items: [{ pos: [0.3, 1.2, -3.4], reach: 0.9, kind: 'horizon' }],
    push: 0.6,
    portal: null,
  },
];

export const ENDING = {
  en: '“I’d almost believe that these canvases will tell you what I can’t say in words.”',
  zh: '“我几乎相信，这些画会替我说出那些我说不出口的话。”',
  src: 'Vincent to Theo and Jo · about 10 July 1890 · less than three weeks before he died',
};
