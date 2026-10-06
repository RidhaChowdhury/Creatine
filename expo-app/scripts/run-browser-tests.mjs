import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
const runId = randomUUID();
const serverEnv = { ...process.env, PORT: '4173', DROPS_EXPORT_DIR: 'dist-pitwall', DROPS_PREVIEW_RUN_ID: runId, DROPS_PREVIEW_HOST: '127.0.0.1' };
// The test runner owns a loopback HTTP server, even from a LAN preview shell.
delete serverEnv.DROPS_PREVIEW_TLS_CERT;
delete serverEnv.DROPS_PREVIEW_TLS_KEY;
const server = spawn(process.execPath, ['scripts/preview.mjs'], { stdio: 'inherit', env: serverEnv });
try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (server.exitCode !== null) throw new Error('Preview server exited before browser checks.');
    try { const response = await fetch('http://127.0.0.1:4173'); ready = response.ok && response.headers.get('x-drops-preview-run') === runId; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Preview server did not become ready.');
  const runner = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', process.argv.includes('--visual') ? '--grep' : '--grep-invert', '@visual'], {
    stdio: 'inherit', env: { ...process.env, DROPS_E2E_URL: 'http://127.0.0.1:4173' }
  });
  const [code] = await once(runner, 'exit');
  process.exitCode = code ?? 1;
} finally { server.kill(); }
