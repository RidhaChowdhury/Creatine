import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { projectRoot } from './project-env.mjs';

const root = resolve(projectRoot, process.env.DROPS_EXPORT_DIR || 'dist-pitwall');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.ico': 'image/x-icon' };
try { await stat(resolve(root, 'index.html')); }
catch { console.error('Run npm run build:web before npm run preview.'); process.exit(1); }
const server = createServer(async (request, response) => {
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Drops-Preview', 'isolated-export');
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let path = resolve(root, `.${pathname}`);
    if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    for (const candidate of [path, `${path}.html`, resolve(path, 'index.html')]) {
      try {
        if ((await stat(candidate)).isFile()) { path = candidate; break; }
      } catch {}
    }
    const bytes = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found');
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Drops production preview: http://127.0.0.1:${port} (backend configuration is embedded during build)`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
