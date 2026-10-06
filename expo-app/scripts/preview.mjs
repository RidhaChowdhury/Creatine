import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { projectRoot } from './project-env.mjs';

const root = resolve(projectRoot, process.env.DROPS_EXPORT_DIR || 'dist-pitwall');
const port = Number(process.env.PORT || 4173);
const host = process.env.DROPS_PREVIEW_HOST || '127.0.0.1';
const certPath = process.env.DROPS_PREVIEW_TLS_CERT;
const keyPath = process.env.DROPS_PREVIEW_TLS_KEY;
if (Boolean(certPath) !== Boolean(keyPath)) {
  throw new Error('Set both DROPS_PREVIEW_TLS_CERT and DROPS_PREVIEW_TLS_KEY for HTTPS.');
}
if (!certPath && !['127.0.0.1', '::1', 'localhost'].includes(host)) {
  throw new Error('LAN previews require HTTPS for SQLite. Set a phone-trusted TLS certificate and key.');
}
const tls = certPath ? { cert: await readFile(certPath), key: await readFile(keyPath), minVersion: 'TLSv1.2' } : null;
const protocol = tls ? 'https' : 'http';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.ico': 'image/x-icon' };
try { await stat(resolve(root, 'index.html')); }
catch { console.error('Run npm run build:web before npm run preview.'); process.exit(1); }
const handleRequest = async (request, response) => {
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Drops-Preview', 'isolated-export');
  if (process.env.DROPS_PREVIEW_RUN_ID) response.setHeader('X-Drops-Preview-Run', process.env.DROPS_PREVIEW_RUN_ID);
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
};
const server = tls ? createHttpsServer(tls, handleRequest) : createHttpServer(handleRequest);
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, host, () => console.log(`Drops production preview: ${protocol}://${host.includes(':') ? `[${host}]` : host}:${port} (backend configuration is embedded during build)`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
