import { test, expect, onboard, openAdd, assertNoOverflow } from './helpers';
import type { Locator, Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const widths = [320, 390, 1024, 1366];
const precisionNote = 'Synthetic geometry check: a longer water note must wrap without displacing the amount or time.';
const transparent = (color: string) => color === 'transparent' || color === 'rgba(0, 0, 0, 0)';

async function navigationGeometry(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  await expect(nav).toBeVisible();
  await expect(nav).toHaveCSS('background-color', 'rgb(12, 12, 12)');
  const buttons = nav.getByRole('button');
  await expect(buttons).toHaveCount(5);
  for (const button of await buttons.all()) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    const check = async () => {
      const rendered = await button.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const painted = Array.from(element.querySelectorAll<HTMLElement>('*')).filter(child => {
          const color = getComputedStyle(child).backgroundColor;
          return color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)';
        }).map(child => {
          const rect = child.getBoundingClientRect();
          return { width: rect.width, height: rect.height, inside: rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1 };
        });
        const label = Array.from(element.querySelectorAll<HTMLElement>('*')).find(child => child.children.length === 0 && child.textContent?.trim() === element.getAttribute('aria-label'));
        let labelOpacity = 1;
        for (let node = label; node && node !== element; node = node.parentElement ?? undefined) labelOpacity *= Number(getComputedStyle(node).opacity);
        return { background: getComputedStyle(element).backgroundColor, painted, labelOpacity };
      });
      expect(transparent(rendered.background)).toBe(true);
      expect(rendered.labelOpacity).toBeGreaterThanOrEqual(0.7);
      for (const area of rendered.painted) {
        expect(area.inside).toBe(true);
        expect(area.width).toBeLessThanOrEqual(56);
        expect(area.height).toBeLessThanOrEqual(56);
        expect(area.width * area.height).toBeLessThan(box!.width * box!.height);
      }
    };
    await button.hover();
    await expect(async () => { await check(); }).toPass();
    await page.mouse.down();
    try { await expect(async () => { await check(); }).toPass(); }
    finally {
      // Release outside the hit area so a style check does not navigate or open Add.
      await page.mouse.move(1, 1);
      await page.mouse.up();
    }
    await expect(nav).toHaveCSS('background-color', 'rgb(12, 12, 12)');
  }
}

async function historyRowGeometry(row: Locator) {
  const label = await row.getAttribute('aria-label');
  const match = label?.match(/^Edit (.+), ([\d.]+) (\S+), (\d{2}:\d{2})$/);
  expect(match, label ?? 'History row label').not.toBeNull();
  const [, name, amount, unit, time] = match!;
  const rect = await row.boundingBox();
  const textBounds = (element: Element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  // Measure rendered text, not stretched wrappers: centered text in equal-width
  // wrappers would otherwise falsely appear to have matching left edges.
  const nameRect = await row.getByText(name, { exact: true }).evaluate(textBounds);
  const timeRect = await row.getByText(time, { exact: true }).evaluate(textBounds);
  const amountRect = await row.getByText(amount, { exact: true }).boundingBox();
  const unitRect = await row.getByText(unit, { exact: true }).boundingBox();
  expect([rect, nameRect, timeRect, amountRect, unitRect].every(Boolean)).toBe(true);
  expect(Math.abs(nameRect!.x - timeRect!.x)).toBeLessThanOrEqual(1.5);
  expect(timeRect!.y).toBeGreaterThanOrEqual(nameRect!.y + nameRect!.height);
  expect(amountRect!.x).toBeGreaterThan(nameRect!.x);
  expect(Math.abs(amountRect!.y + amountRect!.height / 2 - (rect!.y + rect!.height / 2))).toBeLessThanOrEqual(2);
  for (const text of [nameRect!, timeRect!, amountRect!, unitRect!]) {
    expect(text.x).toBeGreaterThanOrEqual(rect!.x - 1);
    expect(text.x + text.width).toBeLessThanOrEqual(rect!.x + rect!.width + 1);
  }
  expect(await row.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  const notes = row.getByText(/^(Sample data — not actual intake\.|Synthetic geometry check:)/);
  for (const note of await notes.all()) {
    const noteRect = await note.boundingBox();
    expect(noteRect!.x).toBeGreaterThanOrEqual(rect!.x - 1);
    expect(noteRect!.x + noteRect!.width).toBeLessThanOrEqual(amountRect!.x - 1);
  }
}

test('sample History retry and narrow rows retain aligned content and transparent navigation hit areas', async ({ page }) => {
  test.setTimeout(240000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await onboard(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const action = page.getByRole('button', { name: 'Add 30 days of sample history', exact: true });
  await action.click();
  const finished = page.getByText(/^\d+ sample entries added · \d+ already present ·/);
  await expect(finished).toBeVisible({ timeout: 120000 });
  const firstCount = Number((await finished.innerText()).match(/^(\d+) sample entries added/)![1]);
  expect(firstCount).toBeGreaterThan(0);
  await expect(action).toBeEnabled();
  await action.click();
  await expect(finished).toHaveText(new RegExp(`^0 sample entries added · ${firstCount} already present ·`), { timeout: 120000 });
  await expect(action).toBeEnabled();

  await openAdd(page);
  await page.getByRole('button', { name: 'Detailed entry', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Detailed entry', exact: true });
  await editor.getByRole('button', { name: 'mL', exact: true }).click();
  await editor.getByLabel('Amount', { exact: true }).fill('236.588');
  await editor.getByLabel('Consumption date and time', { exact: true }).fill('2026-10-04T10:15:00');
  await editor.getByLabel('Note (optional)', { exact: true }).fill(precisionNote);
  await editor.getByRole('button', { name: 'Save intake', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole('button', { name: 'Dismiss receipt', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: '30 days', exact: true }).click();
  const rows = page.getByRole('button', { name: /^Edit / });
  const precision = page.getByRole('button', { name: 'Edit Water, 236.588 mL, 10:15', exact: true });
  await expect(precision).toBeVisible();
  await expect(precision.getByText(precisionNote, { exact: true })).toBeVisible();
  await expect(page.getByText('Sample data — not actual intake.', { exact: true }).first()).toBeVisible();
  const thirtyCount = await rows.count();
  // The heading wraps an empty nested Text for ordinary dates, leaving a
  // trailing space. Keep date-only matching while allowing rendered whitespace.
  const dateHeadings = page.getByText(/^\s*\d{4}-\d{2}-\d{2}\s*$/);
  const thirtyDates = await dateHeadings.count();
  expect(thirtyDates).toBeGreaterThanOrEqual(27);
  await page.getByRole('button', { name: '90 days', exact: true }).click();
  await expect(rows).toHaveCount(firstCount + 1);
  expect(await rows.count()).toBeGreaterThan(thirtyCount);
  expect(await dateHeadings.count()).toBeGreaterThan(thirtyDates);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await assertNoOverflow(page);
    await navigationGeometry(page);
    await historyRowGeometry(precision);
    // Include every available sample tracker, not only the long precision row.
    for (const name of ['Water', 'Creatine', 'Fiber', 'Caffeine']) {
      const sample = rows.filter({ hasText: 'Sample data — not actual intake.' }).filter({ has: page.getByText(name, { exact: true }) }).first();
      await expect(sample).toBeAttached();
      await historyRowGeometry(sample);
    }
    if (width === 390 || width === 1024) {
      await precision.scrollIntoViewIfNeeded();
      await expect(precision).toBeVisible();
      const directory = path.resolve('artifacts/ui-backfill');
      await mkdir(directory, { recursive: true });
      const screenshot = path.join(directory, `history-${width}.png`);
      await page.screenshot({ path: screenshot });
      await test.info().attach(`History backfill ${width}`, { path: screenshot, contentType: 'image/png' });
    }
  }
  await page.reload();
  await expect(precision).toBeAttached();
  await page.getByRole('button', { name: '90 days', exact: true }).click();
  await expect(rows).toHaveCount(firstCount + 1);
});
