// Real browser, test accounts and deployed assets. No seeded app state, tracing,
// storageState export, credential logs or credential screenshots.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { guardCloudQa, testConfiguration, testProjectRef } from './cloud-qa.mjs';
import { guardCloudBrowserUrl,assertCloudBrowserRequest } from './cloud-browser-target.mjs';
export { guardCloudBrowserUrl } from './cloud-browser-target.mjs';
export async function runCloudBrowserQa({url,credentialsFile,configuration:providedConfiguration}){
  const base=guardCloudBrowserUrl(url),users=JSON.parse(await readFile(credentialsFile,'utf8'));
  const configuration=providedConfiguration??await testConfiguration();guardCloudQa(configuration.url,users);
  const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Chicago',reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(30000);
  const sanitize=value=>users.reduce((text,user)=>[user.email,user.password,user.id].reduce((result,secret)=>secret?result.split(secret).join('[redacted]'):result,text),String(value)).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted token]');
  const prohibited=[],pageErrors=[],passed=[],scriptAudits=[];let canvasKitLoaded=false;
  const allow=request=>assertCloudBrowserRequest(request.url(),{deploymentUrl:base,resourceType:request.resourceType()});
  const refused=value=>{let destination='unrecognized scheme';try{const url=new URL(value);destination=url.protocol==='data:'||url.protocol==='blob:'?url.protocol:`${url.protocol}//${url.hostname}`;}catch{}prohibited.push(sanitize(destination));};
  await context.route('**/*',async route=>{
    try{allow(route.request());}catch{refused(route.request().url());await route.abort('blockedbyclient');return;}
    if(!/^https?:/.test(route.request().url())){await route.continue();return;}
    // Routing does not intercept every redirect hop. Refuse redirects instead of
    // allowing a permitted origin to forward credentials or requests elsewhere.
    try{
      const response=await route.fetch({maxRedirects:0});
      if(response.status()>=300&&response.status()<400){prohibited.push('HTTP redirect refused');await route.abort('blockedbyclient');return;}
      await route.fulfill({response});
    }catch{pageErrors.push('Allowed browser request failed before response');await route.abort('failed').catch(()=>{});}
  });
  await context.routeWebSocket(/.*/,async socket=>{
    try{assertCloudBrowserRequest(socket.url(),{deploymentUrl:base,resourceType:'websocket'});}catch{refused(socket.url());await socket.close({code:1008,reason:'Destination outside QA allowlist'});return;}
    socket.connectToServer();
  });
  page.on('pageerror',error=>pageErrors.push(sanitize(error.message)));
  page.on('response',response=>{
    if(/canvaskit\.wasm/.test(response.url()) && response.ok())canvasKitLoaded=true;
    if(response.request().resourceType()==='script')scriptAudits.push(response.text().then(text=>{
      if(text.includes('xmkdzdqouxqmayoawztr.supabase.co'))prohibited.push('production URL in executable bundle');
    }).catch(()=>{}));
  });
  async function signIn(user){
    assert.equal(new URL(page.url()).origin,new URL(base).origin,'credentials stay on the guarded immutable origin');
    await expect(page.getByLabel('Email',{exact:true})).toBeVisible({timeout:60000});
    assert.deepEqual(prohibited,[],'unexpected browser traffic prevents credential entry');
    await page.getByLabel('Email',{exact:true}).fill(user.email);
    await page.getByLabel('Password',{exact:true}).fill(user.password);
    await expect(page.getByLabel('Email',{exact:true})).toHaveValue(user.email);
    await expect(page.getByLabel('Password',{exact:true})).toHaveValue(user.password);
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
