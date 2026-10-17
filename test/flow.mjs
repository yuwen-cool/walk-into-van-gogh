// 三关完整流程：把角色送到每个目标点，检查收集、传送门、转场和结尾
// 用法：先 npm run dev，再 npm run test:flow（截图在 test/shots/）
export default async ({ page, shot, run, wait }) => {
  const base = process.env.URL || 'http://localhost:5188/';
  await page.goto(base, { waitUntil: 'load' });
  await wait(13000);
  const st = () => run(() => { const p = __game.character.getPosition(); return JSON.stringify({ level: __game.level.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2), goal: document.querySelector('#goal .en').textContent }); });
  const to = async (x, z, ms) => { await run((x, z) => __game.character.setPosition(x, 0, z), x, z); await wait(ms); };
  console.log('start ', await st()); await shot('01_bedroom');
  await to(-0.6, 1.45, 3000); console.log('hat   ', await st());
  await to(1.0, 0.0, 14000); console.log('cafe  ', await st()); await shot('02_cafe');
  await to(2.5, 1.2, 2400); await to(-3.5, 3.4, 2400); await to(0.6, 3.2, 2400); console.log('stars ', await st());
  await to(0.2, -3.2, 15000); console.log('wheat ', await st()); await shot('03_wheat');
  await to(0.3, -3.0, 5000); await shot('04_crows');
  await wait(6000); await shot('05_end');
  const ended = await run(() => getComputedStyle(document.querySelector('#end')).opacity);
  console.log(ended === '1' ? 'PASS 走完三关并看到结尾' : 'FAIL 没有到达结尾');
};
