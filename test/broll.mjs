// 录 B-roll：浏览器里用 MediaRecorder 录 canvas，存到 recordings/
export default async ({ page, run, wait }) => {
  const P = (u) => page.goto(u, { waitUntil: 'load' });
  const start = () => run(() => rec.start());
  const stop = (n) => run((n) => rec.stop(n), n);
  for (const lv of ['bedroom', 'cafe', 'wheat']) {
    // 1) 开场：原画 → 空间 → 梵高登场（画布里不含 HTML 字幕，后期再加）
    await P(`http://localhost:5188/?level=${lv}&clean=1`);
    await wait(2500); await start(); await wait(11000); console.log(lv, 'intro', await stop(`${lv}_intro`));
    // 2) 原地转身：从画家的视点转到身后
    await run(() => { __game.character.setActive(false); cine.props(false); });
    await start(); await run((lv) => cine.reveal(6500, 180, lv === 'bedroom' ? 14 : 4), lv); await wait(800); console.log(lv, 'reveal', await stop(`${lv}_reveal`));
    // 3) 绕梵高转一圈
    await run((lv) => { cine.reveal(10, 0); __game.character.setActive(true); __game.character.setPosition(0, 0, lv === 'bedroom' ? -0.8 : -1.6); cine.play(); }, lv);
    await wait(1200);
    if (lv === 'bedroom') await run(() => { __game.cam.distance = 1.3; });
    await start(); await run(() => cine.orbit(9000, 360)); await wait(300); console.log(lv, 'orbit', await stop(`${lv}_orbit`));
  }
};
