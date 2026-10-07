import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resetNativeFixture,nativeFixtureTables,nativeTestOrigin} from '../native-fixture.mjs';
const owner='11111111-1111-4111-8111-111111111111';
const fixture={email:'drops-qa-ab12@example.invalid',password:'private-password',expectedId:owner};
function server({user={},remaining=false,failDelete=false,failLogout=false}={}) {
  const calls=[];
  const fetchImpl=async (value,options={})=>{
    const url=new URL(value);calls.push({url,options});assert.equal(url.origin,nativeTestOrigin);assert.equal(options.redirect,'error');
    if(url.pathname==='/auth/v1/token')return Response.json({access_token:'private-token',user:{id:'not-authoritative'}});
    if(url.pathname==='/auth/v1/user')return Response.json({id:owner,email:fixture.email,role:'authenticated',aud:'authenticated',user_metadata:{test_fixture:'drops-isolated-qa'},...user});
    if(url.pathname==='/auth/v1/logout')return new Response(null,{status:failLogout?500:204});
    if(options.method==='DELETE')return new Response(null,{status:failDelete?500:204});
    return Response.json(remaining?[{user_id:owner}]:[]);
  };return {calls,fetchImpl};
}
test('unapproved account and invalid expected owner cause zero requests',async()=>{
  for(const patch of [{email:'real@example.com'},{email:'drops-qa-ab12@example.invalid\n'},{password:''},{expectedId:'arbitrary-id'}]) {
    const s=server();await assert.rejects(resetNativeFixture({...fixture,...patch,fetchImpl:s.fetchImpl}),/guard/);assert.equal(s.calls.length,0);
  }
});
test('server-verified owner/email/metadata/role mismatches cause zero data writes and local logout',async()=>{
  for(const user of [{id:'22222222-2222-4222-8222-222222222222'},{email:'other@example.invalid'},{user_metadata:{}},{role:'anon'},{aud:'other'}]) {
    const s=server({user});await assert.rejects(resetNativeFixture({...fixture,fetchImpl:s.fetchImpl}),/verify-owner/);
    assert(!s.calls.some(x=>x.url.pathname.startsWith('/rest/')));assert.equal(s.calls.at(-1).url.searchParams.get('scope'),'local');
  }
});
test('resets exactly eight allowlisted owner tables and verifies empty after every deletion',async()=>{
  const s=server();const result=await resetNativeFixture({...fixture,fetchImpl:s.fetchImpl});assert.equal(result.tablesVerifiedEmpty,8);
  const data=s.calls.filter(x=>x.url.pathname.startsWith('/rest/'));assert.equal(data.length,16);
  assert.deepEqual(data.filter(x=>x.options.method==='DELETE').map(x=>x.url.pathname.split('/').at(-1)),nativeFixtureTables);
  for(const call of data)assert.equal(call.url.searchParams.get('user_id'),`eq.${owner}`);
  for(let i=0;i<data.length;i+=2){assert.equal(data[i].options.method,'DELETE');assert.equal(data[i+1].url.searchParams.get('limit'),'1');}
  assert(!JSON.stringify(result).includes('private'));assert.equal(s.calls.at(-1).url.pathname,'/auth/v1/logout');
});
test('delete failure or retained rows stop further writes and suppress private error text',async()=>{
  for(const options of [{failDelete:true},{remaining:true}]) {
    const s=server(options);await assert.rejects(resetNativeFixture({...fixture,fetchImpl:s.fetchImpl}),e=>!e.message.includes(fixture.password)&&/Private details suppressed/.test(e.message));
    assert.equal(s.calls.filter(x=>x.options.method==='DELETE').length,1);assert.equal(s.calls.at(-1).url.pathname,'/auth/v1/logout');
  }
});
test('session cleanup failure is surfaced after successful owner reset',async()=>{
  const s=server({failLogout:true});await assert.rejects(resetNativeFixture({...fixture,fetchImpl:s.fetchImpl}),/session-cleanup/);
});
test('raw network failures never expose credentials and request host cannot be overridden',async()=>{
  let calls=0;
  await assert.rejects(resetNativeFixture({...fixture,url:'https://production.example',fetchImpl:async(value,options)=>{
    calls++;assert.equal(new URL(value).origin,nativeTestOrigin);assert.equal(options.redirect,'error');
    throw new Error(`private transport ${fixture.email} ${fixture.password}`);
  }}),error=>/authenticate/.test(error.message)&&!error.message.includes(fixture.email)&&!error.message.includes(fixture.password));
  assert.equal(calls,1);
});
