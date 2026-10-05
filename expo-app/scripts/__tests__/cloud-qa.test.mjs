import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guardCloudQa,testProjectRef} from '../cloud-qa.mjs';
import {guardCloudBrowserUrl} from '../cloud-browser-qa.mjs';
import {runCloudCiQa} from '../cloud-qa-ci.mjs';
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
  assert.doesNotThrow(()=>guardCloudBrowserUrl('https://immutable-test.expo.app'));
  assert.doesNotThrow(()=>guardCloudBrowserUrl('http://127.0.0.1:4174'));
  for(const url of ['http://127.0.0.1:8081','https://production.example','https://expo.app.evil.example','https://name:password@test.expo.app'])assert.throws(()=>guardCloudBrowserUrl(url));
});
test('per-run CI refuses production and missing private credentials before provisioning',async()=>{
  await assert.rejects(runCloudCiQa({url:'https://xmkdzdqouxqmayoawztr.supabase.co',browserUrl:'https://immutable-test.expo.app',privateKey:'placeholder'}),/refuses/);
  await assert.rejects(runCloudCiQa({url:`https://${testProjectRef}.supabase.co`,browserUrl:'https://immutable-test.expo.app'}),/private CI environment secret/);
});
