import {test,expect,onboard,assertNoOverflow,openAdd,waterTarget} from './helpers';
import {waterScreenshot} from './water-pixels';
for(const size of [{width:320,height:568},{width:390,height:844},{width:797,height:884},{width:1440,height:900}])test(`@visual actual zero-intake CanvasKit ${size.width}x${size.height}`,async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize(size);await onboard(page);await assertNoOverflow(page);
 const canvas=page.locator('canvas');const bounds=await canvas.evaluate((node:HTMLCanvasElement)=>({width:node.width,height:node.height}));expect(bounds.width).toBeGreaterThan(0);expect(bounds.height).toBeGreaterThan(0);
 await page.mouse.move(1,1);const capture=await waterScreenshot(page,false,true);expect(capture).toMatchSnapshot(`home-zero-${size.width}.png`,{maxDiffPixelRatio:0.002});
});
for(const target of ['80','8'])test(`@visual recorded water8oz target${target} actual mask`,async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await onboard(page);await waterTarget(page,target);await openAdd(page);await page.getByRole('button',{name:'Add 8 oz water',exact:true}).click();await page.getByRole('button',{name:'Done',exact:true}).click();await expect(page.getByLabel('Water today:',{exact:false})).toHaveAttribute('aria-label',/^Water today: 8 oz\./);await page.getByRole('button',{name:'Dismiss receipt',exact:true}).click();await expect(page.locator('canvas')).toBeVisible();
 await page.mouse.move(1,1);const capture=await waterScreenshot(page,target==='8');expect(capture).toMatchSnapshot(`home-water8-goal${target}.png`,{maxDiffPixelRatio:0.002});
});




