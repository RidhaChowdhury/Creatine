import { defineConfig } from '@playwright/test';
const baseURL = process.env.DROPS_E2E_URL ?? 'http://localhost:8082';
const url = new URL(baseURL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !['8082', '4173'].includes(url.port))
    throw new Error('Local E2E permits only the isolated SQLite server8082 or verified local export4173.');
export default defineConfig({ testDir: './e2e', fullyParallel: false, workers: 1, retries: 0, timeout: 120000, expect: { timeout: 20000 }, reporter: [['list'], ['html', { outputFolder: 'artifacts/e2e-report', open: 'never' }]], outputDir: 'artifacts/e2e-results', use: { baseURL, headless: true, browserName: 'chromium', viewport: { width: 390, height: 844 }, timezoneId: 'America/Chicago', trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'off', launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] } }, });



