import fs from 'node:fs';

// 开发时的 /__save：浏览器里 MediaRecorder 录下的画面存到 recordings/（test/broll.mjs 用）
const saveRecording = {
  name: 'save-recording',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__save', (req, res) => {
      const name = (new URL(req.url, 'http://x').searchParams.get('name') || `rec-${Date.now()}`).replace(/[^\w.-]/g, '_');
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        fs.mkdirSync('recordings', { recursive: true });
        fs.writeFileSync(`recordings/${name}.webm`, Buffer.concat(chunks));
        res.end('ok');
      });
    });
  },
};

// base './'：打包后的站点可以放在任意子路径下（比如 GitHub Pages 的 /仓库名/）
// FILM=1 时把成片页 film.html 也打包（只在本地渲染用，不进线上部署）
const input = process.env.FILM ? { main: 'index.html', film: 'film.html' } : { main: 'index.html' };
export default { base: './', server: { port: 5188 }, build: { target: 'es2022', outDir: process.env.FILM ? 'dist-film' : 'dist', rollupOptions: { input } }, plugins: [saveRecording] };
