// 对比“原地转”和“平移”两种运镜的 3D 感：每种 3 秒，12fps，存成帧序列
import fs from 'node:fs';
export default async ({ page, run, wait }) => {
  await page.goto('http://localhost:5191/film.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.film && window.film.ready, { timeout: 180000 });
  const shots = {
    // 星月夜：原地转 vs 从柏树前横移（柏树在左侧约 65°）
    starry_rot: (k) => ['starry', 0, 0, 0, 6, 40 + 50 * k, 62],
    starry_truck: (k) => ['starry', -0.9 + 1.8 * k, -0.15, 0.3, 4, 62, 60],
    // 咖啡馆：原地转 vs 贴着露台桌椅往前推再横移（原画方向 yaw 80）
    cafe_rot: (k) => ['cafe', 0, 0, 0, 2, 80 + 50 * k, 62],
    cafe_truck: (k) => ['cafe', -0.6 * k - 0.2, -0.45, 0.9 - 1.4 * k, -6, 95, 60],
  };
  for (const [name, f] of Object.entries(shots)) {
    const dir = `test/shots/px_${name}`; fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 36; i++) {
      await run((a) => window.film.at(5 + a[7] / 12, ...a.slice(0, 7)), [...f(i / 35), i]);
      await page.evaluate(() => new Promise((r) => { let n = 0; const s = () => (++n >= 4 ? r() : requestAnimationFrame(s)); requestAnimationFrame(s); }));
      await page.screenshot({ path: `${dir}/${String(i).padStart(3, '0')}.png` });
    }
    console.log('done', name);
  }
};
