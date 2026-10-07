import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium, webkit, devices, expect } from '@playwright/test';
import pngjs from 'pngjs';

export function guardPhonePreview(value) {
  const url = new URL(value);
  if (value.trim() !== value || url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !/^drops-ridha--[a-z0-9]{6,64}\.expo\.app$/.test(url.hostname) || /^drops-ridha--(?:production|preview|latest|phone)\./.test(url.hostname)) throw new Error('Use only the explicit immutable Drops HTTPS preview origin.');
  return url;
}
export function guardPhoneRequest(value, origin, resourceType) {
  const deployment = guardPhonePreview(origin);
  const url = new URL(value);
  if (url.username || url.password) throw new Error('Credential-bearing request refused.');
  if (url.protocol === 'https:' && url.origin === deployment.origin) return true;
  if (url.protocol === 'blob:' && url.origin === deployment.origin) return true;
  if (url.protocol === 'data:' && ['image', 'font', 'media'].includes(resourceType)) return true;
  throw new Error('Request outside the static phone preview refused.');
}
export function assessPhoneCapabilities(browser, capabilities) {
  for (const key of ['secureContext', 'isolated', 'opfs']) assert.equal(capabilities[key], true, `Required ${key} capability`);
  if (capabilities.sharedArrayBuffer) return { status: 'passed' };
  assert.equal(browser, 'webkit', 'Chromium must expose SharedArrayBuffer');
  return { status: 'unsupported', missing: ['SharedArrayBuffer'], limitation: 'Playwright WebKit port lacks SAB; physical Safari capability remains unverified', reference: 'https://github.com/microsoft/playwright/issues/28513' };
}

async function runEngine(engine, name, base, directory) {
  const record = { browser: name, status: 'failed', phase: 'launch', passed: [], prohibitedRequests: 0, pageErrors: 0, assetFailures: 0, screenshots: [], limitations: ['Emulated mobile browser; no physical iPhone acceptance'] };
  let browser, context, page;
  const audits = [];
  try {
    browser = await engine.launch({ headless: true, ...(name === 'chromium' ? { args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] } : {}) });
    const { defaultBrowserType, ...phone } = devices['iPhone 13'];
    context = await browser.newContext({ ...phone, timezoneId: 'America/Chicago', reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.tracing.start({ screenshots: true, snapshots: true });
    await context.route('**/*', async route => {
      try { guardPhoneRequest(route.request().url(), base.href, route.request().resourceType()); }
      catch { record.prohibitedRequests++; await route.abort('blockedbyclient'); return; }
      if (!route.request().url().startsWith('https:')) { await route.continue(); return; }
      try {
        const response = await route.fetch({ maxRedirects: 0 });
        // Never allow an approved static origin to redirect around the guard.
        if (response.status() >= 300 && response.status() < 400) { record.prohibitedRequests++; await route.abort('blockedbyclient'); return; }
        await route.fulfill({ response });
      } catch { record.assetFailures++; await route.abort('failed').catch(() => {}); }
    });
    await context.routeWebSocket(/.*/, async socket => { record.prohibitedRequests++; await socket.close({ code: 1008, reason: 'Static preview does not use sockets' }); });
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', () => record.pageErrors++);
    page.on('requestfailed', request => { if (request.resourceType() !== 'other') record.assetFailures++; });
    let wasmLoaded = false;
    page.on('response', response => {
      if (!response.ok()) record.assetFailures++;
      if (response.url().endsWith('/canvaskit.wasm') && response.ok()) wasmLoaded = true;
      if (response.request().resourceType() === 'script') audits.push(response.text().then(body => {
        if (/https:\/\/[^\s"']+\.supabase\.(?:co|com)/i.test(body)) record.prohibitedRequests++;
      }).catch(() => { record.assetFailures++; }));
    });
    const nav = () => page.getByRole('navigation', { name: 'Main navigation', exact: true });
    const tab = label => nav().getByRole('button', { name: label, exact: true }).click();
    const openAdd = async () => { await tab('Log intake'); await expect(page.getByRole('dialog', { name: 'Log intake', exact: true })).toBeVisible(); };
    const screenshot = async label => {
      const filename = `${name}-${label}.png`;
      await page.screenshot({ path: path.join(directory, filename) }); record.screenshots.push(filename);
    };
    record.phase = 'onboarding';
    await page.goto(base.href, { waitUntil: 'domcontentloaded' });
    record.phase = 'secure-storage-capabilities';
    record.capabilities = await page.evaluate(() => ({ secureContext: isSecureContext, isolated: crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer === 'function', opfs: typeof navigator.storage?.getDirectory === 'function' }));
    record.capabilityAssessment = assessPhoneCapabilities(name, record.capabilities);
    record.passed.push('secure context, isolation and OPFS capabilities');
    record.phase = 'onboarding';
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible({ timeout: 60000 });
    await page.getByLabel('Name', { exact: true }).fill('Synthetic Phone QA');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(nav()).toBeVisible({ timeout: 60000 });
    record.passed.push('name-only onboarding');
    record.phase = 'water-target';
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Targets', exact: true }).click();
    await page.getByRole('button', { name: 'Water', exact: true }).click();
    await page.getByLabel('Optional target · oz', { exact: true }).fill('80');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    record.phase = 'sample-backfill';
    const backfill = page.getByRole('button', { name: 'Add 30 days of sample history', exact: true });
    await expect(backfill).toBeVisible(); await backfill.click();
    const finished = page.getByText(/^\d+ sample entries added · \d+ already present ·/);
    await expect(finished).toBeVisible({ timeout: 120000 });
    const sampleCount = Number((await finished.innerText()).match(/^(\d+) sample entries added/)?.[1]);
    assert.ok(sampleCount > 0); await expect(backfill).toBeEnabled();
    record.sampleEntries = sampleCount; record.passed.push('30-day sample backfill');
    await tab('Home');
    record.phase = 'save-water';
    await openAdd();
    await page.getByRole('button', { name: 'Add 8 oz water', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByLabel('Water today:', { exact: false })).toHaveAttribute('aria-label', /8 oz/);
    await page.getByRole('button', { name: 'Dismiss receipt', exact: true }).click();
    record.passed.push('save 8 oz water');
    record.phase = 'canvas';
    await page.evaluate(() => document.fonts.ready);
    const canvas = page.locator('canvas'); await expect(canvas).toBeVisible();
    await expect.poll(() => wasmLoaded).toBe(true);
    const pixels = pngjs.PNG.sync.read(await canvas.screenshot());
    let colored = 0;
    for (let i = 0; i < pixels.data.length; i += 4) if (pixels.data[i + 3] > 0 && Math.max(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]) - Math.min(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]) > 15) colored++;
    assert.ok(colored > 100, 'Water canvas must have visible colored pixels');
    record.canvas = { width: pixels.width, height: pixels.height, coloredPixels: colored };
    await screenshot('water'); record.passed.push('CanvasKit asset and nonzero canvas rendering');
    record.phase = 'history-reload';
    await tab('History');
    const water = page.getByRole('button', { name: /^Edit Water, 8 oz, / });
    await expect(water).toBeVisible();
    await page.getByRole('button', { name: '90 days', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(sampleCount + 1);
    await expect(page.getByText('Sample data — not actual intake.', { exact: true }).first()).toBeVisible();
    await page.reload(); await expect(water).toBeVisible({ timeout: 60000 });
    await page.getByRole('button', { name: '90 days', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(sampleCount + 1);
    record.passed.push('History and reload persistence');
    record.phase = 'edit-undo';
    await water.click();
    await page.getByLabel('Amount', { exact: true }).fill('9');
    await page.getByRole('button', { name: 'Save intake', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Edit Water, 9 oz, / })).toBeVisible();
    await page.getByRole('button', { name: 'Undo exact change', exact: true }).click();
    await expect(water).toBeVisible();
    await expect(page.getByRole('button', { name: /^Edit Water, 9 oz, / })).toHaveCount(0);
    record.passed.push('History edit and exact Undo');
    record.phase = 'sheet-rotation';
    const route = new URL(page.url()).pathname;
    await openAdd();
    await page.getByRole('button', { name: 'Detailed entry', exact: true }).click();
    await page.getByLabel('Amount', { exact: true }).fill('7.25');
    await page.getByLabel('Note (optional)', { exact: true }).fill('Synthetic rotation draft');
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('7.25');
    await expect(page.getByLabel('Note (optional)', { exact: true })).toHaveValue('Synthetic rotation draft');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, route);
    await expect(water).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    record.passed.push('draft survives rotation; cancellation preserves History');
    record.phase = 'navigation';
    for (const label of ['Supps', 'Insights', 'History', 'Home']) { await tab(label); await expect(nav()).toBeVisible(); }
    await page.reload();
    await expect(page.getByLabel('Water today:', { exact: false })).toHaveAttribute('aria-label', /8 oz/);
    await screenshot('final-home');
    await Promise.all(audits);
    assert.equal(record.prohibitedRequests, 0); assert.equal(record.pageErrors, 0); assert.equal(record.assetFailures, 0);
    record.passed.push('navigation, final persistence and no prohibited traffic/runtime/asset errors');
    record.status = 'passed'; record.phase = 'complete';
  } catch (error) {
    record.failureCode = 'assertion-or-browser-step-failed';
    // This harness never enters accounts or private records. Keep bounded
    // diagnostics for its synthetic selectors, but strip any URL query/token.
    record.error = {
      name: String(error?.name ?? 'Error').slice(0, 100),
      message: String(error?.message ?? 'Unknown step failure').replace(/([?&](?:token|password|secret|key|code)=)[^\s&"']+/gi, '$1[redacted]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted token]').slice(0, 2000),
    };
    if (page) try { await page.screenshot({ path: path.join(directory, `${name}-failure.png`) }); record.screenshots.push(`${name}-failure.png`); } catch {}
  } finally {
    if (context) await context.tracing.stop(record.status === 'failed' ? { path: path.join(directory, `${name}-failure-trace.zip`) } : {}).catch(() => {});
    await browser?.close();
  }
  return record;
}

export async function runPhonePreview(target) {
  const base = guardPhonePreview(target);
  const directory = path.resolve('artifacts/phone-preview'); await fs.mkdir(directory, { recursive: true });
  const evidence = { target: base.href, asOf: new Date().toISOString(), status: 'failed', browsers: [] };
  evidence.browsers.push(await runEngine(chromium, 'chromium', base, directory));
  if (existsSync(webkit.executablePath())) evidence.browsers.push(await runEngine(webkit, 'webkit', base, directory));
  else evidence.browsers.push({ browser: 'webkit', status: 'unrun', reason: 'Installed package has no downloaded WebKit executable; no installation performed' });
  evidence.status = evidence.browsers.filter(item => item.status !== 'unrun').every(item => item.status === 'passed') ? 'passed' : 'failed';
  await fs.writeFile(path.join(directory, 'summary.json'), JSON.stringify(evidence, null, 2));
  return evidence;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runPhonePreview(process.argv[2]);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'passed') process.exitCode = 1;
}
