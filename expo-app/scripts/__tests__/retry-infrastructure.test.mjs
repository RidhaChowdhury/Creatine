import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertInfrastructureCommand,isTemporaryInfrastructureFailure,runInfrastructureCommand} from '../retry-infrastructure.mjs';
test('only explicit transient network failures qualify',()=>{
  for(const message of ['npm ERR! code ECONNRESET','ETIMEDOUT','getaddrinfo EAI_AGAIN','HTTP/1.1 502 Bad Gateway','HTTP status: 503','npm ERR! code E504','requested URL returned error: 503','Download failed: server returned code 502'])assert.equal(isTemporaryInfrastructureFailure(message),true,message);
  for(const message of ['exit 1','ENOTFOUND wrong-host','401 unauthorized ECONNRESET','npm ERR! code ERESOLVE','error TS2307: ETIMEDOUT','FAIL domain.test.ts ECONNRESET','Test Suites: 1 failed ECONNRESET','Invalid JWT ETIMEDOUT','TypeError: ETIMEDOUT','missing required environment configuration HTTP 503','schema failed HTTP 503'])assert.equal(isTemporaryInfrastructureFailure(message),false,message);
});
test('command guard excludes tests, mutable remote actions and secret arguments',()=>{
  assert.doesNotThrow(()=>assertInfrastructureCommand('npm',['ci']));
  assert.doesNotThrow(()=>assertInfrastructureCommand('npm.cmd',['view','expo','version']));
  assert.doesNotThrow(()=>assertInfrastructureCommand('npx',['playwright','install','--with-deps','chromium']));
  for(const [command,args] of [['npm',['test']],['npm',['run','typecheck']],['npx',['supabase','db','push']],['eas',['deploy']],['node',['scripts/cloud-qa.mjs']],['npm',['ci','--token=secret']],['npm',['ci','--registry=https://account:credential@example.invalid']],['npm',['ci','&','eas','deploy']]])assert.throws(()=>assertInfrastructureCommand(command,args));
});
test('retry is bounded at three attempts with 1s and 3s backoff',async()=>{
  let calls=0;const waits=[];
  const result=await runInfrastructureCommand('npm',['ci'],{attempt:async()=>{calls++;return {code:7,output:'ECONNRESET'};},sleep:async wait=>waits.push(wait),notify:()=>{}});
  assert.equal(calls,3);assert.equal(result.code,7);assert.equal(result.attempts,3);assert.deepEqual(waits,[1000,3000]);
});
test('successful retry stops; deterministic or signaled failure never retries',async()=>{
  let calls=0;
  const success=await runInfrastructureCommand('npm',['ci'],{attempt:async()=>({code:++calls===1?1:0,output:'EAI_AGAIN'}),sleep:async()=>{},notify:()=>{}});
  assert.equal(success.attempts,2);assert.equal(success.code,0);
  for(const failure of [{code:1,output:'ERESOLVE ECONNRESET'},{code:1,output:'ETIMEDOUT',signal:'SIGTERM'}]){
    calls=0;const result=await runInfrastructureCommand('npm',['ci'],{attempt:async()=>{calls++;return failure;},sleep:async()=>assert.fail('no backoff expected'),notify:()=>{}});
    assert.equal(calls,1);assert.equal(result.attempts,1);
  }
});
