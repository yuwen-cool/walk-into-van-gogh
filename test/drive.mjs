// 无头 Chrome 驱动游戏：node test/drive.mjs <脚本.mjs>
// 脚本导出 default async ({ page, shot, run, wait, hold }) => {...}
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const script = path.resolve(process.argv[2]);
const outDir = path.resolve('test/shots');
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1280, height: 720 },
  protocolTimeout: 600000,
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { const f = path.join(outDir, name + '.jpg'); await page.screenshot({ path: f, type: 'jpeg', quality: 80 }); console.log('shot', f); };
const run = (code, ...args) => page.evaluate(code, ...args);
const hold = async (key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };

try {
  const mod = await import(script);
  await mod.default({ page, shot, run, wait, hold });
} catch (e) {
  console.error('FAILED', e.message);
} finally {
  if (logs.length) console.log('--- console ---\n' + logs.slice(-15).join('\n'));
  await browser.close();
}
