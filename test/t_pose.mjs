// 截动作库各动作的关键姿势
export default async ({ page, shot, run }) => {
  await page.goto('http://localhost:5191/film.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.film && window.film.ready, { timeout: 180000 });
  const settle = () => page.evaluate(() => new Promise((r) => { let n = 0; const s = () => (++n >= 4 ? r() : requestAnimationFrame(s)); requestAnimationFrame(s); }));
  const list = JSON.parse(process.env.POSES);
  for (const [anim, t] of list) {
    const d = await run((anim, t) => { window.film.at(50, 'wheat', 0, -0.4, 0, -2, 0, 40); return window.film.char(anim, t, 0, 0, -2.6, 0 + 180, 0); }, anim, t);
    await settle(); await shot(`pose_${anim}_${t}`); console.log(anim, t, 'dur', d);
  }
};
