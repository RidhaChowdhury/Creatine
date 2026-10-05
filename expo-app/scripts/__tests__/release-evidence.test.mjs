import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {guardDeploymentUrl,verifyDeployment} from '../verify-deployment.mjs';
import {createReleaseManifest} from '../release-manifest.mjs';
const target='https://drops--abc12345.expo.app/';
function server(overrides={}) {return async url=> {
  const p=new URL(url).pathname;if(overrides[p])return overrides[p]();
  const headers={'x-content-type-options':'nosniff'};
  if(p.endsWith('.js'))return new Response('const font="/assets/example.ttf";const privateData="not-for-evidence";',{headers:{...headers,'content-type':'application/javascript'}});
  if(p.endsWith('.ttf'))return new Response(Buffer.from([0,1,0,0,1,2]),{headers:{...headers,'content-type':'font/ttf'}});
  if(p.endsWith('.wasm'))return new Response(Buffer.from([0,97,115,109,1,0,0,0]),{headers:{...headers,'content-type':'application/wasm'}});
  return new Response('<html><script src="/bundle.js"></script></html>',{headers:{...headers,'content-type':'text/html','cross-origin-opener-policy':'same-origin','cross-origin-embedder-policy':'require-corp'}});
};}
test('deployment guard rejects arbitrary hosts, credentials, alias origin and unapproved loopback',()=>{
  assert.equal(guardDeploymentUrl(target,{DROPS_DEPLOY_ID:'abc12345'}).href,target);
  assert.equal(guardDeploymentUrl('http://127.0.0.1:4174',{DROPS_ALLOW_LOOPBACK_VERIFICATION:'1'}).port,'4174');
  for(const value of ['https://drops.expo.app/','https://drops--abc12345.expo.app.evil/','https://private:secret@drops--abc12345.expo.app/','https://drops--abc12345.expo.app/?token=secret','https://drops--abc12345.expo.app/history','http://127.0.0.1:4174','http://drops--abc12345.expo.app/'])assert.throws(()=>guardDeploymentUrl(value));
  assert.throws(()=>guardDeploymentUrl(target,{DROPS_DEPLOY_ID:'different'}));
});
test('probe checks all routes plus actual script,font,WASM bytes and stores no bodies',async()=>{
  const result=await verifyDeployment({target,env:{},fetchImpl:server()});assert.equal(result.status,'passed');
  for(const route of ['/history','/supps','/metrics','/settings','/reset-password'])assert(result.checks.some(check=>check.requestedPath===route));
  assert.deepEqual([...new Set(result.checks.map(x=>x.kind))],['html','script','font','wasm']);assert(result.checks.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
  assert(!JSON.stringify(result).includes('not-for-evidence'));
});
test('external redirect is rejected before external fetch',async()=>{
  const visited=[];const result=await verifyDeployment({target,env:{},fetchImpl:async url=>{visited.push(url.href);return new Response(null,{status:302,headers:{location:'https://evil.example/?secret=private'}});}});
  assert.equal(result.failureCode,'cross-origin-redirect');assert.equal(visited.length,1);assert(!JSON.stringify(result).includes('private'));
});
test('HTML fallback masquerading as WASM or font fails despite HTTP200',async()=>{
  for(const file of ['/canvaskit.wasm','/assets/example.ttf']){
    const result=await verifyDeployment({target,env:{},fetchImpl:server({[file]:()=>new Response('<html>fallback</html>',{headers:{'content-type':file.endsWith('wasm')?'application/wasm':'font/ttf','x-content-type-options':'nosniff'}})})});assert.equal(result.status,'failed');assert.match(result.failureCode,/body/);
  }
});
test('missing nosniff or isolation is an explicit failed evidence outcome',async()=>{
  const result=await verifyDeployment({target,env:{},fetchImpl:async()=>new Response('<html></html>',{headers:{'content-type':'text/html'}})});assert.equal(result.failureCode,'nosniff-html-missing');
});
test('manifest preserves workflow IDs/hashes and treats ledger/rollback as unknown/unrun by default',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'drops-evidence-'));
  try{
    await mkdir(path.join(root,'supabase/migrations'),{recursive:true});await mkdir(path.join(root,'artifacts/export-manifests'),{recursive:true});
    await writeFile(path.join(root,'supabase/migrations/202610050001_example.sql'),'select 1;');await writeFile(path.join(root,'package-lock.json'),'{}');
    await writeFile(path.join(root,'artifacts/export-manifests/dist_cloud.json'),JSON.stringify({commit:'a'.repeat(40),dirty:false,platform:'web',mode:'test',createdAt:'2026-10-05T00:00:00Z',password:'must-not-copy'}));
    await writeFile(path.join(root,'artifacts/production-backend-verification.json'),JSON.stringify({status:'passed',projectRef:'xmkdzdqouxqmayoawztr',asOf:'2026-10-05T00:00:00Z',key:'must-not-copy'}));
    const env={DROPS_ENV:'preview',DROPS_IOS_BUILD_ID:'ios-id',DROPS_ANDROID_BUILD_ID:'android-id',DROPS_IOS_FINGERPRINT:'aaa',DROPS_ANDROID_FINGERPRINT:'bbb',DROPS_DEPLOY_ID:'abc12345',DROPS_DEPLOY_URL:target,DROPS_PREVIOUS_DEPLOYMENT_ID:'previous123',DROPS_PREVIOUS_UPDATE_ID:'older-update',EXPO_PUBLIC_SECRET:'must-not-copy'};
    const result=await createReleaseManifest({root,env,git:{commit:'a'.repeat(40),dirty:false}});
    assert.equal(result.androidBuildId,'android-id');assert.equal(result.iosFingerprint,'aaa');assert.equal(result.deploymentId,'abc12345');assert.equal(result.rollback.previousUpdateId,'older-update');assert.equal(result.rollback.result,'unrun');assert.equal(result.migrations[0].applied,'unknown');assert.equal(result.migrationLedger.source,'unknown');
    assert.equal(result.verification.backend.projectRef,'xmkdzdqouxqmayoawztr');assert.match(result.verification.backend.sha256,/^[a-f0-9]{64}$/);
    assert.match(result.lockfileSha256,/^[a-f0-9]{64}$/);assert.match(result.exportManifests[0].sha256,/^[a-f0-9]{64}$/);assert(!JSON.stringify(result).includes('must-not-copy'));
    await assert.rejects(createReleaseManifest({root,env:{...env,DROPS_APPLIED_MIGRATIONS:'["202610050001_example.sql"]'},git:{commit:'a'.repeat(40),dirty:false}}),/validated/);
    const verified=await createReleaseManifest({root,env:{...env,DROPS_APPLIED_MIGRATIONS:'["202610050001_example.sql"]',DROPS_MIGRATIONS_VALIDATED_AT:'2026-10-05T00:00:00Z',DROPS_ROLLBACK_RESULT:'passed'},git:{commit:'a'.repeat(40),dirty:false}});assert.equal(verified.migrations[0].applied,true);assert.equal(verified.rollback.result,'passed');
  }finally{await rm(root,{recursive:true,force:true});}
});
