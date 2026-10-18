// 逐帧离线渲染样片：node test/render-film.mjs [fps] [宽] [高]  → recordings/film.mp4
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const fps = Number(process.argv[2] || 30), W = Number(process.argv[3] || 1920), H = Number(process.argv[4] || 1080);
const SS = Number(process.env.SS || 1); // 超采样倍数：按 W*SS x H*SS 渲染，再缩回 W x H
const dir = 'recordings/film_frames';
// RESUME=1：保留已渲染的帧，从下一帧接着渲染
if (!process.env.RESUME) fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const startAt = process.env.RESUME ? fs.readdirSync(dir).filter((f) => f.endsWith('.png')).length : 0;
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  defaultViewport: { width: W * SS, height: H * SS },
  protocolTimeout: 600000,
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(process.env.URL || 'http://localhost:5191/film.html' + (process.env.QS || ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.film && window.film.ready, { timeout: 180000 });
await page.evaluate(() => document.fonts.ready);
const STILL = process.env.STILL ? JSON.parse(process.env.STILL) : null;
const dur = process.env.DUR ? Number(process.env.DUR) : await page.evaluate(() => window.film.duration);
const n = Math.round(dur * fps);
const settle = () => page.evaluate(() => new Promise((r) => { let k = 0; const f = () => (++k >= 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
// 先预热：让泼溅排序和着色器都就绪
for (const t of [0, dur * 0.5, 0]) { await page.evaluate((t, still) => still ? window.film.still(t, ...still) : window.film.frame(t), t, STILL); await settle(); }
const t0 = Date.now();
const CHUNK = Number(process.env.CHUNK || 1e9); // 每次最多渲染多少帧，之后退出，由外层循环重开浏览器
let rendered = 0;
for (let i = Math.max(0, startAt - 1); i < n && rendered < CHUNK; i++, rendered++) {
  await page.evaluate((t, still) => still ? window.film.still(t, ...still) : window.film.frame(t), i / fps, STILL);
  await settle();
  await page.screenshot({ path: `${dir}/${String(i).padStart(5, '0')}.png` });
  if (i % 60 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
if (fs.readdirSync(dir).filter((f) => f.endsWith('.png')).length < n) { console.log('chunk done'); process.exit(0); }
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', `${dir}/%05d.png`, '-vf', `scale=${W}:${H}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', process.env.OUT || 'recordings/film.mp4']);
console.log('done recordings/film.mp4', n, 'frames');
