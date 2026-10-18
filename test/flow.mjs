// 四关完整流程：每关模拟“转身”→ 画框出现 → 走进画框；最后一关朝地平线走到结尾
// 用法：先 npm run dev，再 npm run test:flow（截图在 test/shots/）
export default async ({ page, shot, run, wait }) => {
  const base = process.env.URL || 'http://localhost:5188/';
  await page.goto(base, { waitUntil: 'load' });
  await wait(14000);
  const st = () => run(() => { const g = __game, p = g.character.getPosition(); return JSON.stringify({ level: g.level.id, turned: g.turned, x: +p.x.toFixed(2), z: +p.z.toFixed(2), goal: document.querySelector('#goal .en').textContent }); });
  for (const id of ['starry', 'cafe', 'rhone']) {
    console.log('arrive', await st()); await shot('n_' + id + '_front');
    await run(() => { const g = __game, y = (g.level.yaw0 || 0) + 180; if (g.level.firstPerson) g.fp.yaw = y; else g.cam.yaw = y; });
    await wait(2500); await shot('n_' + id + '_back');
    console.log('turned', await st());
    const pp = await run(() => { const r = __game.scene.contentRoot.findByName('portal'); const p = r.getPosition(); return [p.x, p.z]; });
    await run((x, z) => { const g = __game; if (g.level.firstPerson) { g.fp.x = x; g.fp.z = z; } else g.character.setPosition(x, 0, z); }, pp[0], pp[1]);
    await wait(15000);
  }
  console.log('arrive', await st()); await shot('n_wheat_front');
  await run(() => __game.character.setPosition(0.1, 0, -3.1)); await wait(5000); await shot('n_wheat_crows');
  await wait(6000); await shot('n_end');
  const ended = await run(() => getComputedStyle(document.querySelector('#end')).opacity);
  console.log(ended === '1' ? 'PASS 走完四关并看到结尾' : 'FAIL 没有到达结尾');
};
