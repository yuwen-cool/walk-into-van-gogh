// 量走路动作的步幅：脚着地时相对身体往后滑的速度 = 角色该往前走的速度
export default async ({ page, run }) => {
  await page.goto('http://localhost:5191/film.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.film && window.film.ready, { timeout: 180000 });
  const names = await run(() => { window.film.at(50, 'wheat', 0, 0, 0, 0, 0, 60); window.film.char('walk', 0, 0, 0, 0, 0); const a = window.__v.armature; return a.rigBoneNames.filter((n) => /foot|ball|toe|pelvis|root/i.test(n)); });
  console.log(names.join(','));
  const rows = [];
  for (let f = 0; f < 307; f += 1) {
    const r = await page.evaluate(async (f) => {
      window.film.char('walk', f, 0, 0, 0, 0);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const a = window.__v.armature, nm = a.rigBoneNames;
      const get = (n) => { const m = a.getBoneWorldMatrix(nm.indexOf(n)); if (!m) return null; const p = m.getTranslation(); return [p.x, p.y, p.z]; };
      return { l: get('ball_l'), r: get('ball_r'), p: get('pelvis') };
    }, f);
    rows.push([f, r]);
  }
  console.log(JSON.stringify(rows));
};
