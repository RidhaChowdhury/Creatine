// Real browser, test accounts and deployed assets. No seeded app state, tracing,
// storageState export, credential logs or credential screenshots.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { guardCloudQa, testConfiguration, testProjectRef } from './cloud-qa.mjs';
export function guardCloudBrowserUrl(value){
  const url=new URL(value);
  if(url.username||url.password||url.search||url.hash)throw new Error('Use a clean immutable test deployment URL.');
  const deployed=url.protocol==='https:' && url.hostname.endsWith('.expo.app');
  const preview=url.protocol==='http:' && url.hostname==='127.0.0.1' && url.port==='4174';
  if(!deployed&&!preview)throw new Error('Cloud browser QA only accepts an immutable .expo.app test deployment or 127.0.0.1:4174.');
  return url.href;
}
export async function runCloudBrowserQa({url,credentialsFile,configuration:providedConfiguration}){
  const base=guardCloudBrowserUrl(url),users=JSON.parse(await readFile(credentialsFile,'utf8'));
  const configuration=providedConfiguration??await testConfiguration();guardCloudQa(configuration.url,users);
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Chicago',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(30000);
  const sanitize=value=>users.reduce((text,user)=>[user.email,user.password,user.id].reduce((result,secret)=>secret?result.split(secret).join('[redacted]'):result,text),String(value)).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted token]');
  const prohibited=[],pageErrors=[],passed=[],scriptAudits=[];let canvasKitLoaded=false;
  await context.route(/https?:\/\/[^/]*supabase\.(co|com)\//,async route=>{
    const requestUrl=new URL(route.request().url());
    if(requestUrl.hostname!==`${testProjectRef}.supabase.co`){prohibited.push(requestUrl.hostname);await route.abort('blockedbyclient');}
    else await route.continue();
  });
  page.on('pageerror',error=>pageErrors.push(sanitize(error.message)));
  page.on('response',response=>{
    if(/canvaskit\.wasm/.test(response.url()) && response.ok())canvasKitLoaded=true;
    if(response.request().resourceType()==='script')scriptAudits.push(response.text().then(text=>{
      if(text.includes('xmkdzdqouxqmayoawztr.supabase.co'))prohibited.push('production URL in executable bundle');
    }).catch(()=>{}));
  });
  async function signIn(user){
    await expect(page.getByLabel('Email',{exact:true})).toBeVisible({timeout:60000});
    await page.getByLabel('Email',{exact:true}).fill(user.email);
    await page.getByLabel('Password',{exact:true}).fill(user.password);
    await page.getByRole('button',{name:'Login',exact:true}).click();
    await expect(page.getByLabel('Name',{exact:true})).toBeVisible({timeout:60000});
    await page.getByLabel('Name',{exact:true}).fill('Disposable browser QA');
    await expect(page.getByLabel('HEIGHT · IN',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible({timeout:60000});
  }
  async function waterTotal(amount){await expect(page.getByLabel('Water today:',{exact:false})).toHaveAttribute('aria-label',new RegExp(`${amount} oz`),{timeout:30000});}
  async function openAdd(){await page.getByRole('button',{name:'Log intake',exact:true}).first().click();await expect(page.getByRole('dialog',{name:'Log intake',exact:true})).toBeVisible();}
  try{
    await page.goto(base,{waitUntil:'domcontentloaded'});await signIn(users[0]);
    passed.push('real UI password login and name-only cloud onboarding');
    await waterTotal(0);await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('canvas').first()).toBeVisible();
    const canvas=page.locator('canvas').first();const bounds=await canvas.boundingBox();assert.ok(bounds.width>200&&bounds.height>400);
    const rendered=await canvas.screenshot();assert.ok(rendered.length>1000,'real rendered canvas has image pixels');
    assert.ok(canvasKitLoaded,'real CanvasKit WASM asset loaded');
    passed.push('real CanvasKit, fonts and visible rendered water canvas');
    await openAdd();await page.getByRole('button',{name:'Add 8 oz water',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Added Water');
    await page.getByRole('button',{name:'Add 16 oz water',exact:true}).click();
    await page.getByRole('button',{name:'Done',exact:true}).click();await waterTotal(24);
    await page.reload();await waterTotal(24);
    passed.push('8 oz and 16 oz cloud saves update totals and survive reload');
    await page.getByRole('button',{name:'History',exact:true}).click();
    await page.getByRole('button',{name:/Edit Water, 8 oz/}).click();
    await page.getByLabel('Amount',{exact:true}).fill('10');
    await page.getByLabel('Note (optional)',{exact:true}).fill('Cloud browser correction');
    await page.getByRole('button',{name:'Save intake',exact:true}).click();
    await expect(page.getByRole('button',{name:/Edit Water, 10 oz/})).toBeVisible();
    await page.getByRole('button',{name:/Edit Water, 16 oz/}).click();
    await page.getByRole('button',{name:'Delete intake',exact:true}).click();
    await page.getByRole('button',{name:'Confirm delete',exact:true}).click();
    await expect(page.getByRole('button',{name:/Edit Water, 16 oz/})).toHaveCount(0);
    await expect(page.getByRole('button',{name:/Edit Water, 10 oz/})).toBeVisible();
    await page.getByRole('button',{name:'Undo exact change',exact:true}).click();
    await expect(page.getByRole('button',{name:/Edit Water, 16 oz/})).toBeVisible();
    await page.getByRole('button',{name:'Home',exact:true}).click();await waterTotal(26);
    await page.reload();await waterTotal(26);
    passed.push('History edit, confirmed delete, exact restore and cloud reload through UI');
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.getByRole('button',{name:'Sign out',exact:true}).click();
    await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
    assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('sb-')&&key.endsWith('-auth-token')).length),0,'sign-out clears persisted auth session');
    await page.reload();await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
    passed.push('sign-out clears session and remains signed out after reload');
    await signIn(users[1]);await waterTotal(0);
    await page.getByRole('button',{name:'History',exact:true}).click();
    await expect(page.getByRole('button',{name:/Edit Water,/})).toHaveCount(0);
    passed.push('second account sees zero own water and no prior account history');
    await page.getByRole('button',{name:'Home',exact:true}).click();
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.getByRole('button',{name:'Sign out',exact:true}).click();
    await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
    await Promise.all(scriptAudits);
    assert.deepEqual(prohibited,[],'no production URLs or non-test Supabase traffic');
    assert.deepEqual(pageErrors,[],'no browser runtime errors');
    passed.push('bundle and network use only Drops Test; no browser runtime errors');
    const evidence={project:testProjectRef,url:base,asOf:new Date().toISOString(),browser:await browser.version(),viewport:'390x844',passed};
    await mkdir(new URL('../artifacts/cloud-qa/',import.meta.url),{recursive:true});
    await writeFile(new URL('../artifacts/cloud-qa/browser.json',import.meta.url),JSON.stringify(evidence,null,2));return evidence;
  }catch(error){
    // Keep failures useful without recording account forms, request bodies or tokens.
    await mkdir(new URL('../artifacts/cloud-qa/',import.meta.url),{recursive:true});
    const safeMessage=sanitize(error.message ?? 'Browser assertion failed');
    await writeFile(new URL('../artifacts/cloud-qa/browser-failure.json',import.meta.url),JSON.stringify({project:testProjectRef,url:base,asOf:new Date().toISOString(),passed,prohibited,pageErrors,visibleText:sanitize(await page.locator('body').innerText()).slice(0,3000),error:safeMessage.slice(0,2000)},null,2));
    throw new Error(safeMessage);
  }finally{await context.close();await browser.close();}
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.env.DROPS_QA_CREDENTIALS_FILE)throw new Error('Set DROPS_QA_CREDENTIALS_FILE to a private temporary fixture credential file.');
  const result=await runCloudBrowserQa({url:process.env.DROPS_QA_BROWSER_URL ?? 'http://127.0.0.1:4174',credentialsFile:process.env.DROPS_QA_CREDENTIALS_FILE});console.log(JSON.stringify(result,null,2));
}
