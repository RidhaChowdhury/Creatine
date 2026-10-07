import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guardCloudQa,testProjectRef} from '../cloud-qa.mjs';
import {guardCloudBrowserUrl} from '../cloud-browser-qa.mjs';
import {runCloudCiQa} from '../cloud-qa-ci.mjs';
import {assertCloudBrowserRequest} from '../cloud-browser-target.mjs';
const users=[{email:'drops-qa-1234@example.invalid',password:'test-only'},{email:'drops-qa-5678@example.invalid',password:'test-only'}];
test('cloud QA refuses production and arbitrary other hosts before authentication',()=>{
  assert.throws(()=>guardCloudQa('https://xmkdzdqouxqmayoawztr.supabase.co',users),/refuses/);
  assert.throws(()=>guardCloudQa('https://unreviewed-test.supabase.co',users),/refuses/);
  assert.throws(()=>guardCloudQa(`https://${testProjectRef}.supabase.co.evil.example`,users),/refuses/);
  assert.throws(()=>guardCloudQa(`http://${testProjectRef}.supabase.co`,users),/refuses/);
});
test('cloud QA accepts only explicitly disposable test accounts',()=>{
  assert.doesNotThrow(()=>guardCloudQa(`https://${testProjectRef}.supabase.co`,users));
  assert.throws(()=>guardCloudQa(`https://${testProjectRef}.supabase.co`,[{email:'real@company.com',password:'no'},users[1]]),/disposable/);
  assert.throws(()=>guardCloudQa(`https://${testProjectRef}.supabase.co`,[]),/disposable/);
});
test('cloud browser QA accepts only test deploy or dedicated preview URL',()=>{
  assert.doesNotThrow(()=>guardCloudBrowserUrl('https://drops-ridha--nugssbhcot.expo.app'));
  assert.doesNotThrow(()=>guardCloudBrowserUrl('http://127.0.0.1:4174'));
  for(const url of ['http://127.0.0.1:8081','https://production.example','https://expo.app.evil.example','https://name:password@test--abc12345.expo.app','https://monohydrated.expo.app','https://unrelated--abc12345.expo.app','https://drops-ridha--production.expo.app','https://drops-ridha--preview.expo.app','https://test--production.expo.app','https://test--preview.expo.app','https://test--latest.expo.app','https://test--short.expo.app','https://test--abc12345.expo.app:444','https://test--abc12345.expo.app/history'])assert.throws(()=>guardCloudBrowserUrl(url));
  assert.throws(()=>guardCloudBrowserUrl('http://127.0.0.1:4174',{allowPreview:false}));
});
test('per-run CI refuses production and missing private credentials before provisioning',async()=>{
  await assert.rejects(runCloudCiQa({url:'https://xmkdzdqouxqmayoawztr.supabase.co',browserUrl:'https://drops-ridha--nugssbhcot.expo.app',privateKey:'placeholder'}),/refuses/);
  await assert.rejects(runCloudCiQa({url:`https://${testProjectRef}.supabase.co`,browserUrl:'https://drops-ridha--nugssbhcot.expo.app'}),/private CI environment secret/);
});
test('browser outbound allowlist permits exact app/test API and required local asset schemes only',()=>{
  const deploymentUrl='https://drops-ridha--nugssbhcot.expo.app';
  const allow=(value,resourceType='other')=>assertCloudBrowserRequest(value,{deploymentUrl,resourceType});
  for(const value of [deploymentUrl+'/assets/app.js',`https://${testProjectRef}.supabase.co/auth/v1/token`,`wss://${testProjectRef}.supabase.co/realtime/v1/websocket`])assert.doesNotThrow(()=>allow(value));
  assert.doesNotThrow(()=>allow('data:image/png;base64,AA','image'));
  assert.doesNotThrow(()=>allow('blob:'+deploymentUrl+'/asset-id','script'));
  for(const value of ['https://attacker.example/collect','https://different--abc12345.expo.app/assets/app.js','https://xmkdzdqouxqmayoawztr.supabase.co/auth/v1/token',`http://${testProjectRef}.supabase.co/auth/v1/token`,`wss://${testProjectRef}.supabase.co.evil.example/socket`,'https://drops-ridha--nugssbhcot.expo.app.evil.example','blob:https://attacker.example/asset','blob:null/asset','data:text/javascript,alert(1)','file:///credentials.json'])assert.throws(()=>allow(value));
  assert.throws(()=>allow(`https://user:password@${testProjectRef}.supabase.co/auth/v1/token`));
  assert.throws(()=>allow('data:text/html,unsafe','document'));
});
