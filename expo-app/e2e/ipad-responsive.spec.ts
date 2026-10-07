import { test, expect, onboard, openAdd, assertNoOverflow } from './helpers';
import type { Page } from '@playwright/test';

const windows = [
  { width: 1024, height: 1366 },
  { width: 1366, height: 1024 },
  { width: 507, height: 980 },
];

async function resize(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize(size);
  await assertNoOverflow(page);
}

for (const initial of windows) {
  test(`responsive browser retains draft, History filters and chart point ${initial.width}x${initial.height}`, async ({ page }, testInfo) => {
    await resize(page, initial);
    await onboard(page);
    const remaining = [...windows.filter(size => size !== initial), initial];

    await page.getByRole('button', { name: 'Supps', exact: true }).click();
    await page.getByRole('button', { name: 'Add tracker', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Retained tablet draft');
    await page.getByLabel('Saved dose (optional)', { exact: true }).fill('1.25');
    await page.getByLabel('Quantity target (optional)', { exact: true }).fill('3.75');
    await page.getByRole('button', { name: 'scheduled', exact: true }).click();
    await page.getByRole('button', { name: 'Multiple doses +', exact: true }).click();
    await page.getByLabel('Dose 1 time', { exact: true }).fill('08:30');
    for (const size of remaining) {
      await resize(page, size);
      await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Retained tablet draft');
      await expect(page.getByLabel('Saved dose (optional)', { exact: true })).toHaveValue('1.25');
      await expect(page.getByLabel('Quantity target (optional)', { exact: true })).toHaveValue('3.75');
      await expect(page.getByLabel('Dose 1 time', { exact: true })).toHaveValue('08:30');
      await expect(page.getByLabel('Dose 1 amount', { exact: true })).toHaveValue('');
      await expect(page.getByRole('button', { name: 'Save tracker', exact: true })).toBeEnabled();
    }
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    await openAdd(page);
    await page.getByRole('button', { name: 'Detailed entry', exact: true }).click();
    await page.getByLabel('Amount', { exact: true }).fill('24');
    await page.getByLabel('Consumption date and time', { exact: true }).fill('2026-10-03T10:15:00');
    await page.getByRole('button', { name: 'Save intake', exact: true }).click();
    await openAdd(page);
    await page.getByRole('button', { name: 'Add 8 oz water', exact: true }).click();
    await page.getByRole('button', { name: 'Log 5 g Creatine', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();

    await page.getByRole('button', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Custom dates', exact: true }).click();
    await page.getByLabel('From date', { exact: true }).fill('2026-10-01');
    await page.getByLabel('To date', { exact: true }).fill('2026-10-04');
    await page.getByRole('button', { name: 'Apply date range', exact: true }).click();
    await page.getByRole('button', { name: 'Water', exact: true }).click();
    for (const size of remaining) {
      await resize(page, size);
      await expect(page.getByRole('button', { name: /Edit Water, 24 oz, 10:15/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Edit Water, 8 oz/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Edit Creatine, 5 g/ })).toHaveCount(0);
      await expect(page.getByText('2026-10-01 — 2026-10-04 · 2 entries', { exact: true })).toBeVisible();
      expect(new URL(page.url()).pathname).toBe('/history');
    }
    await page.getByRole('button', { name: 'Filter all trackers', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Water ✓', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();

    await page.getByRole('button', { name: 'Insights', exact: true }).click();
    await page.getByRole('button', { name: '30 days', exact: true }).click();
    await page.getByRole('button', { name: 'Previous', exact: true }).first().click();
    const selected = page.getByText(/^2026-10-03 · 24 oz · Recorded/);
    for (const size of remaining) {
      await resize(page, size);
      await expect(selected).toBeVisible();
      await expect(page.getByText('2/30', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next', exact: true }).first()).toBeEnabled();
      expect(new URL(page.url()).pathname).toBe('/metrics');
    }
    await page.getByRole('button', { name: 'Next', exact: true }).first().click();
    await expect(page.getByText(/^2026-10-04 · 8 oz · Recorded/)).toBeVisible();
    await testInfo.attach(`responsive Insights ${initial.width}x${initial.height}`, {
      body: await page.screenshot(), contentType: 'image/png',
    });
  });
}
