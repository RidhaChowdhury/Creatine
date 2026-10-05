import {test as base,expect,type Page} from '@playwright/test';
export const test=base.extend({page:async({page,context},use)=>{
 // A fresh incognito context owns synthetic local records. Never reach cloud.
 await context.route(/https?:\/\/[^/]*supabase\.(co|com)\//,route=>route.abort('blockedbyclient'));
 await page.clock.install({time:new Date('2026-10-04T17:00:00Z')});
 await use(page);
}});
export {expect};
export async function onboard(page:Page){
 await page.goto('/');
 await expect(page.getByLabel('Name',{exact:true})).toBeVisible({timeout:60000});
 await page.getByLabel('Name',{exact:true}).fill('Local QA');
 await expect(page.getByLabel('HEIGHT · IN',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
 await expect(page.getByLabel('Water today:',{exact:false})).toBeAttached();
 await page.evaluate(()=>document.fonts.ready);
 await expect(page.locator('canvas')).toBeVisible();
}
export async function openAdd(page:Page){await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Log intake',exact:true}).click();await expect(page.getByRole('dialog',{name:'Log intake',exact:true})).toBeVisible();}
export async function assertNoOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);}
export async function waterTarget(page:Page,value:string){
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Targets',exact:true}).click();
 await page.getByRole('button',{name:'Water',exact:true}).click();
 await page.getByLabel('Optional target · oz',{exact:true}).fill(value);
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Home',exact:true}).click();
}


