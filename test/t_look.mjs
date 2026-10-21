// 任意机位截图：LOOKS='[[id,x,y,z,pitch,yaw,fov,name],...]'，可带角色 CHARS
export default async ({ page, shot, run }) => {
  await page.goto('http://localhost:5191/film.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.film && window.film.ready, { timeout: 180000 });
  const settle = () => page.evaluate(() => new Promise((r) => { let n = 0; const s = () => (++n >= 4 ? r() : requestAnimationFrame(s)); requestAnimationFrame(s); }));
  for (const [id, x, y, z, p, yw, fov, name, ch] of JSON.parse(process.env.LOOKS)) {
    await run((a) => { window.film.at(30, ...a.slice(0, 7)); if (a[8]) window.film.char(...a[8]); }, [id, x, y, z, p, yw, fov, name, ch]);
    await settle(); await shot('look_' + name);
  }
};
