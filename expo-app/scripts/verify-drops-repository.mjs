// PostgreSQL transaction/RLS regression suite. PGlite only: no network or production fixtures.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
const ownerA='10000000-0000-4000-8000-000000000001', ownerB='20000000-0000-4000-8000-000000000002';
const at='2026-01-01T12:00:00.000Z';
const entry={id:'30000000-0000-4000-8000-000000000001',storageKind:'intake',trackerId:'builtin:water',name:'Water',amount:8,unit:'oz',consumedAt:at,consumedAtUtc:at,legacyLocal:null,day:'2026-01-01',note:'exact source',version:1};
const profile={id:'medication',name:'Medication',category:'medication',metricType:'other',unit:'tablet',savedDose:1,archived:false,plans:[]};
const add={operationId:'add-water',kind:'add',before:null,after:entry};
async function asOwner(owner,work){
  await db.exec('SET ROLE authenticated'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
  try{return await work();}finally{await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)");}
}
async function rpc(mutation,request){return (await db.query('SELECT public.drops_mutate_entry($1::jsonb,$2::jsonb) AS receipt',[JSON.stringify(mutation),JSON.stringify(request)])).rows[0].receipt;}
async function fails(action,pattern){await assert.rejects(action,pattern);}
try{
  await db.exec(`CREATE ROLE authenticated NOLOGIN; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES('${ownerA}'),('${ownerB}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  const directory=resolve('supabase/migrations');
  const files=(await readdir(directory)).filter(f=>f.endsWith('.sql')).sort();
  for(const name of files) await db.exec(await readFile(resolve(directory,name),'utf8'));
  for(const name of files) await db.exec(await readFile(resolve(directory,name),'utf8'));
  await db.exec(`INSERT INTO public.user_settings(user_id,name,height,weight,sex,water_goal,creatine_goal) VALUES('${ownerA}','A',0,0,'unspecified',64,5),('${ownerB}','B',0,0,'unspecified',0,0);`);
  await asOwner(ownerA,async()=>{
    await db.query('SELECT public.drops_patch_preferences($1::jsonb)',[JSON.stringify({timezone:'America/Chicago',remindersEnabled:true})]);
    await db.query('SELECT public.drops_patch_preferences($1::jsonb)',[JSON.stringify({bedtime:'23:00'})]);
    const prefs=(await db.query('SELECT preferences_json FROM public.drops_preferences')).rows[0].preferences_json;
    assert.equal(prefs.remindersEnabled,true); assert.equal(prefs.bedtime,'23:00');
    const initialized=(await db.query('SELECT public.drops_initialize_preferences($1::jsonb) saved',[JSON.stringify({timezone:'Asia/Tokyo',remindersEnabled:false})])).rows[0].saved;
    assert.equal(initialized.timezone,'America/Chicago'); assert.equal(initialized.remindersEnabled,true,'insert-only defaults preserve existing preferences');
    await db.query('SELECT public.drops_save_profile($1::jsonb)',[JSON.stringify(profile)]);
    await fails(()=>db.query('SELECT public.drops_save_profile($1::jsonb)',[JSON.stringify({...profile,id:'builtin:water',category:'water',metricType:'water',unit:'g'})]),/volume/);
    await fails(()=>db.query('SELECT public.drops_save_profile($1::jsonb)',[JSON.stringify({...profile,name:null})]),/required/);
    await fails(()=>db.query('INSERT INTO public.drops_preferences(user_id,preferences_json) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET preferences_json=excluded.preferences_json',[ownerA,JSON.stringify({waterPresets:[{id:'bad',amount:null,unit:'oz'}]})]),/Invalid water preset/);
    await fails(()=>db.query('UPDATE public.drops_profiles SET profile_json=$1 WHERE tracker_id=$2',[JSON.stringify({...profile,archived:null}),profile.id]),/required/);
    assert.deepEqual(await rpc(add,{kind:'add',input:entry}),add);
    assert.deepEqual(await rpc(add,{kind:'add',input:entry}),add);
    await fails(()=>rpc(add,{kind:'add',input:{...entry,amount:9}}),/different action/);
    const next={...entry,storageKind:'tracker',trackerId:profile.id,name:profile.name,unit:'tablet',amount:2,version:2};
    const edit={operationId:'edit-water',kind:'edit',before:entry,after:next};
    await rpc(edit,{kind:'edit',before:entry,input:next});
    assert.equal((await db.query('SELECT count(*)::int n FROM public.intake_log')).rows[0].n,0);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.tracker_entries')).rows[0].n,1);
    await fails(()=>rpc({...edit,operationId:'stale-edit'},{kind:'edit'}),/changed/);
    const undo={operationId:'undo-cross',kind:'restore',before:next,after:{...entry,version:3}};
    await rpc(undo,{kind:'undo',receipt:edit});
    assert.equal((await db.query('SELECT amount FROM public.intake_log')).rows[0].amount,8);
    await fails(()=>rpc({...undo,operationId:'undo-again'},{kind:'undo',receipt:edit}),/already used/);
    const deleted={operationId:'delete-water',kind:'delete',before:undo.after,after:null};
    await rpc(deleted,{kind:'delete',before:undo.after});
    const restore={operationId:'restore-water',kind:'restore',before:null,after:{...entry,version:4}};
    await rpc(restore,{kind:'undo',receipt:deleted});
    assert.equal((await db.query('SELECT note,mutation_version FROM public.intake_log')).rows[0].mutation_version,4);
    const bad={...restore.after,amount:1,unit:'tablet',trackerId:'missing',storageKind:'tracker',version:5};
    await fails(()=>rpc({operationId:'bad-destination',kind:'edit',before:restore.after,after:bad},{kind:'edit'}),/belong/);
    assert.equal((await db.query('SELECT count(*)::int n FROM public.intake_log')).rows[0].n,1,'failed move retains source');
    const future={...entry,id:'30000000-0000-4000-8000-000000000002',consumedAtUtc:'2099-01-01T00:00:00Z'};
    await fails(()=>rpc({operationId:'future',kind:'add',before:null,after:future},{kind:'add'}),/future/);
    await fails(()=>rpc({operationId:'mass-water',kind:'add',before:null,after:{...entry,id:'30000000-0000-4000-8000-000000000003',unit:'g'}},{kind:'add'}),/Incompatible/);
    await db.query("INSERT INTO public.intake_log(user_id,id,amount,unit,consumable,consumed_at,logged_at) VALUES($1,$2,12.34567,'oz','water','2025-11-02 01:30:00','2025-11-02 09:00:00+00')",[ownerA,'30000000-0000-4000-8000-000000000004']);
    const old={...entry,id:'30000000-0000-4000-8000-000000000004',amount:12.34567,note:'',consumedAt:'2025-11-02T01:30:00',consumedAtUtc:null,legacyLocal:'2025-11-02T01:30:00',day:'2025-11-02'};
    const oldDelete={operationId:'delete-legacy',kind:'delete',before:old,after:null};
    await rpc(oldDelete,{kind:'delete',before:old});
    await rpc({operationId:'restore-legacy',kind:'restore',before:null,after:{...old,version:2}},{kind:'undo',receipt:oldDelete});
    const legacy=(await db.query("SELECT consumed_at::text,consumed_at_utc,logged_at::text,amount FROM public.intake_log WHERE id=$1",[old.id])).rows[0];
    assert.equal(legacy.consumed_at,'2025-11-02 01:30:00'); assert.equal(legacy.consumed_at_utc,null); assert.equal(legacy.amount,12.34567); assert.equal(Date.parse(legacy.logged_at),Date.parse('2025-11-02T09:00:00Z'));
    const cp={id:'builtin:creatine',name:'Creatine',category:'supplement',metricType:'creatine',unit:'mg',savedDose:5000,archived:false,plans:[{id:'old',effectiveFrom:'2025-01-01',mode:'scheduled',days:[0,1,2,3,4,5,6],doses:[],unit:'g',target:5,limit:null}]};
    await db.query('SELECT public.drops_save_profile($1::jsonb)',[JSON.stringify(cp)]);
    assert.equal((await db.query('SELECT creatine_goal FROM public.user_settings')).rows[0].creatine_goal,5000);
    await fails(()=>db.query('SELECT public.drops_save_profile($1::jsonb)',[JSON.stringify({...cp,plans:[]})]),/Historical plans/);
    await db.query('INSERT INTO public.tracker_entries(user_id,id,tracker_id,name,unit,amount,consumed_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[ownerA,'retain',profile.id,profile.name,'tablet',1,at]);
    await fails(()=>db.query('DELETE FROM public.tracked_items WHERE id=$1',[profile.id]),/foreign key/);
    await db.query('INSERT INTO public.tracker_preferences(user_id,primary_tracker_id) VALUES($1,$2)',[ownerA,profile.id]);
    await db.query('SELECT public.drops_save_profile($1::jsonb)',[JSON.stringify({...profile,archived:true})]);
    await fails(()=>db.query('SELECT public.drops_set_primary($1)',[profile.id]),/active owned/);
    assert.equal((await db.query('SELECT primary_tracker_id FROM public.tracker_preferences')).rows[0].primary_tracker_id,null);
    assert.equal((await db.query("SELECT count(*)::int n FROM public.tracker_entries WHERE id='retain'")).rows[0].n,1);
  });
  await asOwner(ownerB,async()=>{
    for(const table of ['intake_log','tracker_entries','tracked_items','drops_profiles','drops_preferences','drops_operations']) assert.equal((await db.query(`SELECT count(*)::int n FROM public.${table}`)).rows[0].n,0,`${table} hides other owner`);
    await fails(()=>db.query('INSERT INTO public.drops_profiles(user_id,tracker_id,profile_json) VALUES($1,$2,$3)',[ownerB,profile.id,JSON.stringify(profile)]),/owned tracker/);
    await fails(()=>rpc({operationId:'cross-owner-edit',kind:'delete',before:{...entry,version:4},after:null},{kind:'delete'}),/changed/);
    await fails(()=>db.query('INSERT INTO public.drops_preferences(user_id,preferences_json) VALUES($1,$2)',[ownerA,'{}']),/row-level security/);
    await fails(()=>rpc({operationId:'foreign-tracker',kind:'add',before:null,after:{...entry,storageKind:'tracker',trackerId:profile.id,unit:'tablet'}},{kind:'add'}),/belong/);
  });
  const functions=(await db.query("SELECT proname,prosecdef FROM pg_proc WHERE proname like 'drops_%'")).rows;
  assert.ok(functions.every(f=>f.prosecdef===false),'all Drops functions retain caller RLS');
  await db.query('DELETE FROM auth.users WHERE id=$1',[ownerA]);
  for(const table of ['intake_log','tracked_items','tracker_entries','drops_profiles','drops_preferences','drops_operations']) assert.equal((await db.query(`SELECT count(*)::int n FROM public.${table} WHERE user_id=$1`,[ownerA])).rows[0].n,0,`${table} account deletion cascades`);
  console.log('Drops database verified: rerun preservation, atomic cross-kind edit/Undo, exact legacy restore, stale receipts, idempotency, finite amounts, future rejection, historical plans, converted goals, archive, owner RLS and references.');
}finally{await db.close();}

