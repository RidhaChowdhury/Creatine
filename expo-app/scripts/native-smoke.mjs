import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resetNativeFixture } from './native-fixture.mjs';

export function validateApkUrl(value) {
  if (typeof value !== 'string' || value.trim() !== value || !/^https:\/\/expo\.dev\/artifacts\/eas\/[A-Za-z0-9_-]+\.apk$/.test(value)) throw new Error('APK URL must be an existing https://expo.dev/artifacts/eas/*.apk URL without query, credentials or fragment.');
  return value;
}
export const safeScreenshots = new Set(['history-after-water8.png', 'history-after-relaunch.png', 'home-after-relaunch.png']);
export function isSafeScreenshot(file) { return safeScreenshots.has(path.basename(file)); }
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function run() {
  const safeDir = path.join(appRoot, 'artifacts/native-smoke-safe');
  await fs.mkdir(safeDir, { recursive: true });
  // Only this owned directory is cleared; previous success images must not accompany a failed run.
  for (const item of await fs.readdir(safeDir)) await fs.rm(path.join(safeDir, item), { recursive: true, force: true });
  let phase = 'fixture'; let status = 'failed'; let workspace;
  let resetStarted=false, resetStatus='unrun', cleanupStatus='unrun';
  const copied = [];
  try {
    if (!process.env.MAESTRO_EMAIL || !process.env.MAESTRO_PASSWORD) throw new Error('Missing isolated fixture secrets');
    if (!process.env.RUNNER_TEMP || !process.env.GITHUB_ACTIONS) throw new Error('Hosted GitHub runner required');
    phase='fixture-reset'; resetStarted=true; resetStatus='failed';
    await resetNativeFixture({email:process.env.MAESTRO_EMAIL,password:process.env.MAESTRO_PASSWORD});
    resetStatus='passed';
    workspace = await fs.mkdtemp(path.join(process.env.RUNNER_TEMP, 'drops-native-smoke-'));
    await fs.copyFile(path.join(appRoot, '.maestro/native-smoke.yml'), path.join(workspace, 'flow.yml'));
    phase = 'install';
    const install = spawnSync('adb', ['install', '-r', path.join(process.env.RUNNER_TEMP, 'drops.apk')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (install.error || install.status !== 0) throw new Error('APK install failed');
    phase = 'flow';
    // Never emit raw stdout/stderr: resolved input parameters and debug failures may contain secrets.
    const result = spawnSync('maestro', ['test', '--debug-output', path.join(workspace, 'raw-debug'), '--test-output-dir', path.join(workspace, 'raw-results'), path.join(workspace, 'flow.yml')], { cwd: workspace, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20 * 60_000, maxBuffer: 32 * 1024 * 1024, env: process.env });
    const visit = async dir => {
      for (const item of await fs.readdir(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name);
        if (item.isDirectory()) await visit(file);
        else if (item.isFile() && isSafeScreenshot(file)) { await fs.copyFile(file, path.join(safeDir, item.name)); copied.push(item.name); }
      }
    };
    await visit(workspace);
    if (result.error || result.status !== 0) throw new Error('Smoke flow did not pass');
    if (safeScreenshots.size !== new Set(copied).size) throw new Error('Missing named persistence screenshots');
    status = 'passed'; phase = 'complete';
  } catch { process.exitCode = 1; }
  finally {
    if(resetStarted) {
      try {await resetNativeFixture({email:process.env.MAESTRO_EMAIL,password:process.env.MAESTRO_PASSWORD});cleanupStatus='passed';}
      catch {cleanupStatus='failed';status='failed';phase='fixture-cleanup';process.exitCode=1;}
    }
    const summary = { status, phase, fixtureReset:resetStatus, fixtureCleanup:cleanupStatus, revision: process.env.GITHUB_SHA ?? null, runId: process.env.GITHUB_RUN_ID ?? null, platform: 'Android emulator API35', maestro: '2.11.0', screenshots: [...new Set(copied)].sort(), at: new Date().toISOString(), limitations: ['No physical-device, notification delivery, or iOS acceptance'] };
    await fs.writeFile(path.join(safeDir, 'summary.json'), JSON.stringify(summary, null, 2));
    if (workspace) await fs.rm(workspace, { recursive: true, force: true });
    console.log(`Native smoke ${status}; phase ${phase}. Only safe summary and named post-login images retained.`);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'validate-url') { validateApkUrl(process.env.DROPS_APK_URL); console.log('APK URL accepted.'); }
  else if (process.argv[2] === 'run') await run();
  else throw new Error('Use validate-url or run');
}
