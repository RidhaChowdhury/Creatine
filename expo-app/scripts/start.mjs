import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { loadEnvironment, projectRoot } from './project-env.mjs';

const require = createRequire(import.meta.url);
const [mode = 'cloud', ...arguments_] = process.argv.slice(2);
try {
  const environment = loadEnvironment(mode);
  const port = mode === 'local' ? '8082' : mode === 'test' ? '8083' : '8081';
  console.log(`Drops: ${mode === 'local' ? 'isolated local SQLite' : mode === 'test' ? 'separate Supabase test project' : 'connected Supabase'} · port ${port}`);
  const cli = join(dirname(require.resolve('expo/package.json')), 'bin', 'cli');
  const child = spawn(process.execPath, [cli, 'start', '--localhost', '--port', port, '--max-workers', '2', ...arguments_], {
    cwd: projectRoot, env: environment, stdio: 'inherit'
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 0 : 1); });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
