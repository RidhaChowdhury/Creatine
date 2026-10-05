import { test, expect, onboard, openAdd } from './helpers';
import type { Page } from '@playwright/test';

async function detailed(page: Page, input: { tracker?: string; amount: string; unit?: string; wall: string; note: string }) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Log intake', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Log intake', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Detailed entry', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Detailed entry', exact: true });
  if (input.tracker) await dialog.getByRole('button', { name: input.tracker, exact: true }).click();
  if (input.unit) await dialog.getByRole('button', { name: input.unit, exact: true }).click();
  await dialog.getByLabel('Amount', { exact: true }).fill(input.amount);
  await dialog.getByLabel('Consumption date and time', { exact: true }).fill(input.wall);
  await dialog.getByLabel('Note (optional)', { exact: true }).fill(input.note);
  await dialog.getByRole('button', { name: 'Save intake', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function createTracker(page: Page, name: string) {
  await page.getByRole('button', { name: 'Supps', exact: true }).click();
  await page.getByRole('button', { name: 'Add tracker', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add tracker', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Save tracker', exact: true }).click();
  await expect(page.getByRole('group', { name: `${name} tracker`, exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

test('A01 custom mL preserves precision, converts daily total and survives reload', async ({ page }) => {
  await onboard(page);
  await detailed(page, { amount: '123.4567', unit: 'mL', wall: '2026-10-04T10:15:30', note: 'Precision fixture' });
  // Daily display is intentionally rounded; the saved source quantity is not.
  await expect(page.getByLabel('Water today:', { exact: false })).toHaveAttribute('aria-label', /4\.17 oz/);
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const row = page.getByRole('button', { name: 'Edit Water, 123.4567 mL, 10:15', exact: true });
  await expect(row).toHaveCount(1);
  await page.reload();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('123.4567');
  await expect(page.getByLabel('Consumption date and time', { exact: true })).toHaveValue('2026-10-04T10:15:30');
  await expect(page.getByLabel('Note (optional)', { exact: true })).toHaveValue('Precision fixture');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByLabel('Water today:', { exact: false })).toHaveAttribute('aria-label', /4\.17 oz/);
});

test('A06 atomic water-to-custom-tracker amount/unit/time correction and exact Undo preserve newer intake', async ({ page }) => {
  await onboard(page);
  await createTracker(page, 'Mass fixture');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await detailed(page, { amount: '42.125', unit: 'mL', wall: '2026-10-03T10:15:30', note: 'Original entry context' });
  await openAdd(page); await page.getByRole('button', { name: 'Add 8 oz water', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const original = page.getByRole('button', { name: 'Edit Water, 42.125 mL, 10:15', exact: true });
  await original.click();
  const edit = page.getByRole('dialog', { name: 'Edit intake', exact: true });
  await edit.getByRole('button', { name: 'Mass fixture', exact: true }).click();
  await edit.getByRole('button', { name: 'mg', exact: true }).click();
  await edit.getByLabel('Amount', { exact: true }).fill('2500.125');
  await edit.getByLabel('Consumption date and time', { exact: true }).fill('2026-10-02T08:20:45');
  await edit.getByLabel('Note (optional)', { exact: true }).fill('Corrected atomic context');
  await edit.getByRole('button', { name: 'Save intake', exact: true }).click();
  await expect(edit).toHaveCount(0); await expect(original).toHaveCount(0);
  const corrected = page.getByRole('button', { name: 'Edit Mass fixture, 2500.125 mg, 08:20', exact: true });
  await expect(corrected).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Edit Water, 8 oz/ })).toHaveCount(1);
  await corrected.click();
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('2500.125');
  await expect(page.getByLabel('Consumption date and time', { exact: true })).toHaveValue('2026-10-02T08:20:45');
  await expect(page.getByLabel('Note (optional)', { exact: true })).toHaveValue('Corrected atomic context');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Undo exact change', exact: true }).click();
  await expect(corrected).toHaveCount(0); await expect(original).toHaveCount(1);
  await page.reload(); await expect(original).toBeVisible();
  await expect(page.getByRole('button', { name: /Edit Water, 8 oz/ })).toHaveCount(1);
  await original.click();
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('42.125');
  await expect(page.getByLabel('Consumption date and time', { exact: true })).toHaveValue('2026-10-03T10:15:30');
  await expect(page.getByLabel('Note (optional)', { exact: true })).toHaveValue('Original entry context');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('A07 older custom and archived tracker records obey multi-select filters', async ({ page }) => {
  await onboard(page); await createTracker(page, 'Alpha fixture'); await createTracker(page, 'Beta fixture');
  await detailed(page, { tracker: 'Alpha fixture', amount: '1.25', wall: '2026-08-01T10:15:00', note: 'Older Alpha' });
  await detailed(page, { tracker: 'Beta fixture', amount: '2.5', wall: '2026-08-02T11:20:00', note: 'Older Beta' });
  await detailed(page, { tracker: 'Water', amount: '12', wall: '2026-08-03T12:30:00', note: 'Excluded water' });
  await page.getByRole('button', { name: 'Supps', exact: true }).click();
  await page.getByRole('group', { name: 'Beta fixture tracker', exact: true }).getByRole('button', { name: 'Archive tracker', exact: true }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const alpha = page.getByRole('button', { name: 'Edit Alpha fixture, 1.25 g, 10:15', exact: true });
  const beta = page.getByRole('button', { name: 'Edit Beta fixture, 2.5 g, 11:20', exact: true });
  const water = page.getByRole('button', { name: 'Edit Water, 12 oz, 12:30', exact: true });
  await expect(alpha).toHaveCount(0); await expect(beta).toHaveCount(0);
  await page.getByRole('button', { name: '90 days', exact: true }).click();
  await expect(alpha).toBeVisible(); await expect(beta).toBeVisible(); await expect(water).toBeVisible();
  await page.getByRole('button', { name: 'Filter all trackers', exact: true }).click();
  await page.getByRole('button', { name: 'Alpha fixture', exact: true }).click();
  await page.getByRole('button', { name: 'Beta fixture (archived)', exact: true }).click();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(alpha).toBeVisible(); await expect(beta).toBeVisible(); await expect(water).toHaveCount(0);
  await page.getByRole('button', { name: 'Filter all trackers', exact: true }).click();
  await page.getByRole('button', { name: 'Alpha fixture ✓', exact: true }).click();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(alpha).toHaveCount(0); await expect(beta).toBeVisible(); await expect(water).toHaveCount(0);
  await page.getByRole('button', { name: 'Filter all trackers', exact: true }).click();
  await page.getByRole('button', { name: 'All trackers', exact: true }).click();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(alpha).toBeVisible(); await expect(beta).toBeVisible(); await expect(water).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: '90 days', exact: true }).click();
  await expect(alpha).toBeVisible(); await expect(beta).toBeVisible(); await expect(water).toBeVisible();
});

test('A05 equal 5g four-dose plan accumulates partial intake and Undo restores allocation', async ({ page }) => {
  await onboard(page); await page.getByRole('button', { name: 'Supps', exact: true }).click();
  await page.getByRole('button', { name: 'Add tracker', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add tracker', exact: true });
  await editor.getByLabel('Name', { exact: true }).fill('Four dose fixture');
  await editor.getByLabel('Saved dose (optional)', { exact: true }).fill('5');
  await editor.getByRole('button', { name: 'scheduled', exact: true }).click();
  for (const [index, time] of ['08:00', '12:00', '16:00', '20:00'].entries()) {
    await editor.getByRole('button', { name: 'Multiple doses +', exact: true }).click();
    await editor.getByLabel(`Dose ${index + 1} time`, { exact: true }).fill(time);
    await editor.getByLabel(`Dose ${index + 1} amount`, { exact: true }).fill('5');
  }
  await editor.getByRole('button', { name: 'Save tracker', exact: true }).click();
  const group = page.getByRole('group', { name: 'Four dose fixture tracker', exact: true });
  await expect(group.getByText('0 of 4 complete · 20 g remaining', { exact: true })).toBeVisible();
  await group.getByRole('button', { name: 'Log intake', exact: true }).click();
  await page.getByLabel('Amount', { exact: true }).fill('7.5');
  await page.getByRole('button', { name: 'Save intake', exact: true }).click();
  await expect(group.getByRole('button', { name: 'Dose 1 at 08:00: Complete', exact: true })).toBeVisible();
  await expect(group.getByRole('button', { name: 'Dose 2 at 12:00: 2.5 g remaining', exact: true })).toBeVisible();
  await expect(group.getByRole('button', { name: 'Dose 3 at 16:00: 5 g remaining', exact: true })).toBeVisible();
  await expect(group.getByText('1 of 4 complete · 12.5 g remaining', { exact: true })).toBeVisible();
  await group.getByRole('button', { name: 'Dose 2 at 12:00: 2.5 g remaining', exact: true }).click();
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('2.5');
  await page.getByRole('button', { name: 'Save intake', exact: true }).click();
  await expect(group.getByRole('button', { name: 'Dose 2 at 12:00: Complete', exact: true })).toBeVisible();
  await expect(group.getByText('2 of 4 complete · 10 g remaining', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo exact intake', exact: true }).click();
  await expect(group.getByText('1 of 4 complete · 12.5 g remaining', { exact: true })).toBeVisible();
  await page.reload();
  await expect(group.getByRole('button', { name: 'Dose 2 at 12:00: 2.5 g remaining', exact: true })).toBeVisible();
  await expect(group.getByText('1 of 4 complete · 12.5 g remaining', { exact: true })).toBeVisible();
});
