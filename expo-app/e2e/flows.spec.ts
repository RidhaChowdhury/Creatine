import { test, expect, onboard, openAdd, assertNoOverflow } from './helpers';
test('local onboarding renders real CanvasKit and persistent navigation', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await onboard(page);
    await assertNoOverflow(page);
    for (const name of ['Supps', 'Insights', 'History', 'Home']) {
        await page.getByRole('button', { name, exact: true }).first().click();
        await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    }
    await expect(page.locator('canvas')).toBeVisible();
    expect(errors).toEqual([]);
});
test('saved water survives reload; central sheet preserves History; exact Undo retains newer intake', async ({ page }) => {
    await onboard(page);
    await openAdd(page);
    await page.getByRole('button', { name: 'Add 8 oz water', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Added Water');
    await page.getByRole('button', { name: 'Add 16 oz water', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByLabel('Water today:', { exact: false })).toHaveAttribute('aria-label', /24 oz/);
    await page.reload();
    await expect(page.getByLabel('Water today:', { exact: false })).toHaveAttribute('aria-label', /24 oz/);
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.getByRole('button', { name: /Edit Water, 8 oz/ })).toBeVisible();
    const path = new URL(page.url()).pathname;
    await openAdd(page);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    expect(new URL(page.url()).pathname).toBe(path);
    await page.getByRole('button', { name: /Edit Water, 8 oz/ }).click();
    await page.getByRole('button', { name: 'Delete intake', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
    await expect(page.getByRole('button', { name: /Edit Water, 8 oz/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Edit Water, 16 oz/ })).toBeVisible();
    await page.getByRole('button', { name: 'Undo exact change', exact: true }).click();
    await expect(page.getByRole('button', { name: /Edit Water, 8 oz/ })).toBeVisible();
});
test('historical dates and custom range include retained records beyond30days; cancel keeps original',async({page})=>{
 await onboard(page);await openAdd(page);await page.getByRole('button',{name:'Detailed entry',exact:true}).click();await page.getByLabel('Amount',{exact:true}).fill('12');await page.getByLabel('Consumption date and time',{exact:true}).fill('2026-08-01T10:15:00');await page.getByLabel('Note (optional)',{exact:true}).fill('Historical local fixture');await page.getByRole('button',{name:'Save intake',exact:true}).click();
 await page.getByRole('button',{name:'History',exact:true}).click();await expect(page.getByRole('button',{name:/Edit Water, 12 oz/})).toHaveCount(0);await page.getByRole('button',{name:'90 days',exact:true}).click();await expect(page.getByRole('button',{name:/Edit Water, 12 oz/})).toBeVisible();
 await page.getByRole('button',{name:/Edit Water, 12 oz/}).click();await page.getByLabel('Amount',{exact:true}).fill('99');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('button',{name:/Edit Water, 12 oz/})).toBeVisible();
 await page.getByRole('button',{name:'Custom dates',exact:true}).click();await page.getByLabel('From date',{exact:true}).fill('2026-08-01');await page.getByLabel('To date',{exact:true}).fill('2026-08-01');await page.getByRole('button',{name:'Apply date range',exact:true}).click();await expect(page.getByRole('button',{name:/Edit Water, 12 oz/})).toBeVisible();await page.reload();await page.getByRole('button',{name:'History',exact:true}).click();await page.getByRole('button',{name:'90 days',exact:true}).click();await expect(page.getByRole('button',{name:/Edit Water, 12 oz/})).toBeVisible();
});
test('central sheet traps keyboard and returns focus without route changes',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:'History',exact:true}).click();const route=new URL(page.url()).pathname;const add=page.getByRole('button',{name:'Log intake',exact:true});await add.click();await expect(page.getByRole('button',{name:'Close Log intake',exact:true})).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.getByRole('button',{name:'Done',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Log intake',exact:true})).toHaveCount(0);await expect(add).toBeFocused();expect(new URL(page.url()).pathname).toBe(route);
 const targets=await page.getByRole('button').evaluateAll(buttons=>buttons.map(b=>({name:b.getAttribute('aria-label'),rect:b.getBoundingClientRect()})).filter(b=>b.rect.width>0&&b.rect.height>0).filter(b=>b.rect.width<44||b.rect.height<44).map(b=>b.name));expect(targets).toEqual([]);
});
