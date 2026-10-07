import{test,expect,onboard,openAdd,waterTarget}from './helpers';
import{waterScreenshot}from './water-pixels';
test('full water stays painted through resizing and headless tab exposure',async({page,context},testInfo)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await onboard(page);await waterTarget(page,'8');await openAdd(page);await page.getByRole('button',{name:'Add 8 oz water',exact:true}).click();await page.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('button',{name:'Dismiss receipt',exact:true}).click();await expect(page.getByLabel('Water today:',{exact:false})).toHaveAttribute('aria-label',/^Water today: 8 oz\. \/ 8 oz\./);
 for(const viewport of[{width:797,height:884},{width:884,height:797},{width:390,height:844}]){await page.setViewportSize(viewport);await waterScreenshot(page,true);}
 const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();await page.bringToFront();await other.close();const capture=await waterScreenshot(page,true);await testInfo.attach('full water after resize and exposure',{body:capture,contentType:'image/png'});
});
