// Opt-in authenticated QA. Only disposable accounts in the isolated test project.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { validateBackend } from './project-env.mjs';
export const testProjectRef='snabmkbeoshxxxhtwkyi';
export function guardCloudQa(url,users,expectedUsers=2){
  const endpoint=new URL(url);
  if(endpoint.protocol!=='https:'||endpoint.hostname!==`${testProjectRef}.supabase.co`||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!['','/'].includes(endpoint.pathname)) throw new Error('Cloud QA refuses every project except the isolated Drops Test HTTPS endpoint.');
  if(!Array.isArray(users)||users.length!==expectedUsers||users.some(u=>!/^drops-qa-[a-f0-9-]+@example\.invalid$/.test(u.email)||!u.password)) throw new Error('Provide disposable Drops QA accounts, never a production account.');
}
async function checked(promise){const response=await promise;if(response.error)throw new Error(`Cloud QA request failed (${response.error.code ?? response.error.status ?? 'unknown'}): ${response.error.message}`);return response.data;}
export async function testConfiguration(){
  const text=await readFile(new URL('../.env.test.local',import.meta.url),'utf8');
  const env=Object.fromEntries(text.split(/\r?\n/).filter(line=>line && !line.trim().startsWith('#')).map(line=>{const index=line.indexOf('=');return [line.slice(0,index).trim(),line.slice(index+1).trim().replace(/^['"]|['"]$/g,'')];}));
  return {url:env.EXPO_PUBLIC_SUPABASE_URL,key:env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY};
}
/** Supported CI path: private admin key stays in the Node process, never Expo. */
export async function provisionQaAccounts({url,privateKey}){
  guardCloudQa(url,[],0);
  if(!privateKey) throw new Error('Provide DROPS_TEST_SERVICE_ROLE_KEY privately for automatic fixture provisioning, or an ephemeral QA credentials file.');
  const admin=createClient(url,privateKey,{auth:{persistSession:false,autoRefreshToken:false}}),users=[];
  try{
    for(let i=0;i<2;i++){
      const email=`drops-qa-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
      const created=await checked(admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{test_fixture:'drops-isolated-qa'}}));
      users.push({id:created.user.id,email,password});
    }
  }catch(error){for(const user of users)await admin.auth.admin.deleteUser(user.id);throw error;}
  return {users,cleanup:async()=>{
    const failures=[];
    for(const user of users){
      const result=await admin.auth.admin.deleteUser(user.id);
      if(result.error && result.error.status!==404 && result.error.code!=='user_not_found')failures.push(result.error);
    }
    if(failures.length)throw new Error(`QA fixture cleanup failed for ${failures.length} disposable owners; inspect isolated test Auth records.`);
  }};
}
/** Reset only the two approved disposable owners before repeating fresh onboarding. */
export async function resetQaAccountState({url,key,users}){
  guardCloudQa(url,users);
  validateBackend({EXPO_PUBLIC_SUPABASE_URL:url,EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key},'test');
  for(const user of users){
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    try{
      const login=await checked(client.auth.signInWithPassword({email:user.email,password:user.password}));
      assert.equal(login.user.id,user.id);
      for(const table of ['drops_operations','tracker_entries','intake_log','drops_profiles','tracker_preferences','tracked_items','drops_preferences','user_settings']){
        await checked(client.from(table).delete().eq('user_id',login.user.id));
        assert.equal((await checked(client.from(table).select('user_id').eq('user_id',login.user.id))).length,0,`${table} fixture reset`);
      }
    }finally{await client.auth.signOut();}
  }
  return {project:testProjectRef,resetOwners:users.length};
}
export async function runCloudQa({url,key,users}){
  guardCloudQa(url,users);
  validateBackend({EXPO_PUBLIC_SUPABASE_URL:url,EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key},'test');
  const clients=users.map(()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
  const receipts=[]; const passed=[];
  try{
    for(let i=0;i<2;i++){
      const auth=await checked(clients[i].auth.signInWithPassword({email:users[i].email,password:users[i].password}));
      assert.equal(auth.user.id,users[i].id); users[i].session=auth.session;
    }
    passed.push('authenticated sign-in for two disposable owners');
    const a=clients[0],b=clients[1],owner=users[0].id;
    await checked(a.from('user_settings').insert({user_id:owner,name:'Drops QA fixture',height:0,weight:0,sex:'unspecified'}));
    await checked(a.rpc('drops_initialize_preferences',{initial:{timezone:'America/Chicago',remindersEnabled:false,waterPresets:[{id:'water-8',amount:8,unit:'oz'},{id:'water-16',amount:16,unit:'oz'}],prominentPresetIds:['water-8','water-16']}}));
    await checked(a.rpc('drops_patch_preferences',{changes:{priorUse:{creatine:'unknown',caffeine:'unknown'}}})); // Real onboarding trigger regression.
    const tracker={id:randomUUID(),name:'QA medication',category:'medication',metricType:'other',unit:'tablet',savedDose:1,archived:false,plans:[]};
    await checked(a.rpc('drops_save_profile',{profile:tracker}));
    const at=new Date(Date.now()-3600000).toISOString();
    const entry={id:randomUUID(),storageKind:'intake',trackerId:'builtin:water',name:'Water',amount:8.123456789,unit:'oz',consumedAt:at,consumedAtUtc:at,legacyLocal:null,day:'2026-01-01',note:'QA precision and exact identity',version:1};
    const request={kind:'add',input:{trackerId:entry.trackerId,amount:entry.amount,unit:entry.unit,consumedAt:entry.consumedAt,note:entry.note}};
    const add={operationId:randomUUID(),kind:'add',before:null,after:entry};
    const call=(client,mutation,payload)=>checked(client.rpc('drops_mutate_entry',{mutation,request_payload:payload}));
    const saved=await call(a,add,request);receipts.push(saved);
    const retries=await Promise.all([call(a,add,request),call(a,add,request)]);assert.deepEqual(retries,[saved,saved]);
    const different=await a.rpc('drops_mutate_entry',{mutation:add,request_payload:{...request,input:{...request.input,amount:9}}});assert.ok(different.error);
    let rows=await checked(a.from('intake_log').select('*').eq('id',entry.id));assert.equal(rows.length,1);assert.equal(rows[0].amount,entry.amount);
    passed.push('save, precision, reload, concurrent idempotent retries and conflicting operation rejection');
    const next={...entry,storageKind:'tracker',trackerId:tracker.id,name:tracker.name,amount:2.75,unit:'tablet',note:'Edited across storage kinds',version:2};
    const edit={operationId:randomUUID(),kind:'edit',before:entry,after:next};
    await call(a,edit,{kind:'edit',before:entry,input:next});receipts.push(edit);
    assert.equal((await checked(a.from('intake_log').select('id').eq('id',entry.id))).length,0);
    rows=await checked(a.from('tracker_entries').select('*').eq('id',entry.id));assert.equal(rows.length,1);assert.equal(rows[0].note,next.note);assert.equal(rows[0].amount,2.75);
    const stale=await a.rpc('drops_mutate_entry',{mutation:{...edit,operationId:randomUUID()},request_payload:{kind:'edit'}});assert.ok(stale.error);
    passed.push('atomic cross-kind edit, reload and stale source rejection');
    const deleted={operationId:randomUUID(),kind:'delete',before:next,after:null};await call(a,deleted,{kind:'delete',before:next});receipts.push(deleted);
    assert.equal((await checked(a.from('tracker_entries').select('id').eq('id',entry.id))).length,0);
    const restore={operationId:randomUUID(),kind:'restore',before:null,after:{...next,version:3}};await call(a,restore,{kind:'undo',receipt:deleted});receipts.push(restore);
    rows=await checked(a.from('tracker_entries').select('*').eq('id',entry.id));assert.equal(rows[0].amount,next.amount);assert.equal(rows[0].note,next.note);assert.equal(rows[0].mutation_version,3);
    assert.equal(Date.parse(rows[0].consumed_at_utc),Date.parse(at));
    const reusedUndo=await a.rpc('drops_mutate_entry',{mutation:{...restore,operationId:randomUUID()},request_payload:{kind:'undo',receipt:deleted}});assert.ok(reusedUndo.error);
    passed.push('delete, exact restore, UTC preservation and consumed Undo receipt rejection');
    for(const table of ['intake_log','tracker_entries','tracked_items','drops_profiles','drops_preferences','drops_operations'])assert.equal((await checked(b.from(table).select('*').eq('user_id',owner))).length,0,`${table} read isolation`);
    const foreignUpdate=await checked(b.from('tracker_entries').update({amount:99}).eq('id',entry.id).select('id'));assert.equal(foreignUpdate.length,0);
    const foreignDelete=await checked(b.from('tracker_entries').delete().eq('id',entry.id).select('id'));assert.equal(foreignDelete.length,0);
    const foreignReference=await b.rpc('drops_mutate_entry',{mutation:{operationId:randomUUID(),kind:'add',before:null,after:{...next,id:randomUUID(),version:1}},request_payload:{kind:'add'}});assert.ok(foreignReference.error);
    const ownerForgery=await b.from('drops_preferences').insert({user_id:owner,preferences_json:{timezone:'UTC'}});assert.ok(ownerForgery.error);
    rows=await checked(a.from('tracker_entries').select('amount').eq('id',entry.id));assert.equal(rows[0].amount,next.amount);
    passed.push('cross-account read, update, delete, owner forgery and tracker-reference isolation');
    await checked(a.rpc('drops_set_primary',{tracker:tracker.id}));await checked(a.rpc('drops_save_profile',{profile:{...tracker,archived:true}}));
    const primary=await checked(a.from('tracker_preferences').select('primary_tracker_id').single());assert.equal(primary.primary_tracker_id,null);
    assert.equal((await checked(a.from('tracker_entries').select('id').eq('id',entry.id))).length,1);
    passed.push('archive clears primary and preserves actual history');
    const reloaded=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});await checked(reloaded.auth.setSession(users[0].session));
    assert.equal((await checked(reloaded.from('tracker_entries').select('id').eq('id',entry.id))).length,1);await reloaded.auth.signOut();
    passed.push('restored session reads persisted history');
    return {project:testProjectRef,asOf:new Date().toISOString(),passed,fixtureUserIds:users.map(u=>u.id)};
  }finally{for(const client of clients)await client.auth.signOut();}
}
/** Verify the deployed deletion endpoint with a freshly authenticated fixture. */
export async function runAccountDeletionQa({url,key,users}){
  guardCloudQa(url,users);
  validateBackend({EXPO_PUBLIC_SUPABASE_URL:url,EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key},'test');
  const [first,second]=users;
  const a=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),b=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const loggedIn=await checked(a.auth.signInWithPassword({email:first.email,password:first.password}));
    await checked(b.auth.signInWithPassword({email:second.email,password:second.password}));
    await checked(a.from('user_settings').insert({user_id:first.id,name:'Account deletion QA',height:0,weight:0,sex:'unspecified'}));
    await checked(a.rpc('drops_initialize_preferences',{initial:{timezone:'America/Chicago'}}));
    await checked(b.from('user_settings').insert({user_id:second.id,name:'Browser QA fixture',height:0,weight:0,sex:'unspecified'}));
    await checked(a.rpc('drops_patch_preferences',{changes:{priorUse:{creatine:'unknown',caffeine:'unknown'}}})); // Real onboarding trigger regression.
    const tracker={id:randomUUID(),name:'Deletion QA tracker',category:'medication',metricType:'other',unit:'tablet',savedDose:1,archived:false,plans:[]};
    await checked(a.rpc('drops_save_profile',{profile:tracker}));await checked(a.rpc('drops_set_primary',{tracker:tracker.id}));
    const at=new Date(Date.now()-3600000).toISOString();
    const entry={id:randomUUID(),storageKind:'tracker',trackerId:tracker.id,name:tracker.name,amount:1,unit:'tablet',consumedAt:at,consumedAtUtc:at,legacyLocal:null,day:at.slice(0,10),note:'Account cascade fixture',version:1};
    await checked(a.rpc('drops_mutate_entry',{mutation:{operationId:randomUUID(),kind:'add',before:null,after:entry},request_payload:{kind:'add',input:entry}}));
    const unauthenticated=await fetch(`${url}/functions/v1/delete-account`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({confirmation:'DELETE'})});
    assert.equal(unauthenticated.status,401,'unauthenticated deletion is rejected');
    const wrong=await a.functions.invoke('delete-account',{body:{confirmation:'KEEP'}});assert.ok(wrong.error,'wrong confirmation is rejected');
    assert.equal((await checked(a.from('user_settings').select('user_id'))).length,1,'rejected request preserves account');
    const own=await a.functions.invoke('delete-account',{body:{confirmation:'DELETE',userId:second.id}});await checked(Promise.resolve(own));
    const gone=await a.auth.getUser(loggedIn.session.access_token);assert.ok(gone.error || !gone.data.user,'deleted caller no longer authenticates');
    for(const table of ['user_settings','tracked_items','tracker_entries','drops_profiles','drops_preferences','drops_operations','tracker_preferences']){
      const rows=await a.from(table).select('user_id').eq('user_id',first.id);
      if(rows.error)assert.ok(['401','403'].includes(String(rows.status)),'revoked token must fail authentication');
      else assert.equal(rows.data.length,0,`${table} caller records are removed`);
    }
    const survived=await checked(b.auth.getUser());assert.equal(survived.user.id,second.id,'request UUID cannot target another owner');
    assert.equal((await checked(b.from('user_settings').select('user_id'))).length,1,'other account data remains');
    return {project:testProjectRef,asOf:new Date().toISOString(),passed:['unauthenticated deletion rejected','incorrect confirmation preserves account','recent password authentication permits own deletion','request account ID cannot delete another owner','deleted caller cannot authenticate; all owner rows removed; other owner and settings preserved'],deletedFixtureId:first.id};
  }finally{await a.auth.signOut();await b.auth.signOut();}
}
if(typeof process!=='undefined' && process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const configuration=await testConfiguration();
  let users,cleanup=async()=>{};
  if(process.env.DROPS_QA_CREDENTIALS_FILE) users=JSON.parse(await readFile(process.env.DROPS_QA_CREDENTIALS_FILE,'utf8'));
  else if(process.env.DROPS_QA_OWNER_A_EMAIL) users=[{id:process.env.DROPS_QA_OWNER_A_ID,email:process.env.DROPS_QA_OWNER_A_EMAIL,password:process.env.DROPS_QA_OWNER_A_PASSWORD},{id:process.env.DROPS_QA_OWNER_B_ID,email:process.env.DROPS_QA_OWNER_B_EMAIL,password:process.env.DROPS_QA_OWNER_B_PASSWORD}];
  else ({users,cleanup}=await provisionQaAccounts({...configuration,privateKey:process.env.DROPS_TEST_SERVICE_ROLE_KEY}));
  try{const result=await runCloudQa({...configuration,users});console.log(JSON.stringify({...result,fixtureUserIds:undefined},null,2));}
  finally{await cleanup();}
}
