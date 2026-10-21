// 每秒截一帧，检查新运镜有没有露出空洞
export default async ({ page, shot, run, wait }) => {
  await page.goto('http://localhost:5191/film.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.film && window.film.ready, { timeout: 180000 });
  const ts = (process.env.TS || '').split(',').filter(Boolean).map(Number);
  for (const t of ts) { await run((t) => window.film.frame(t), t); await page.evaluate(() => new Promise((r) => { let n = 0; const s = () => (++n >= 4 ? r() : requestAnimationFrame(s)); requestAnimationFrame(s); })); await shot('sh_' + t); }
};
