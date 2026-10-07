jest.mock('../../supabase',()=>({supabase:null}));
jest.mock('expo-crypto',()=>{let sequence=0;return {randomUUID:jest.fn(()=>`uuid-${++sequence}`)};});
jest.mock('expo-sqlite',()=>{
  const {DatabaseSync}=jest.requireActual('node:sqlite');
  const database=new DatabaseSync(':memory:');
  const db={
    execAsync:async(sql:string)=>database.exec(sql),
    getAllAsync:async(sql:string,params:unknown[]=[])=>database.prepare(sql).all(...params),
    getFirstAsync:async(sql:string,params:unknown[]=[])=>database.prepare(sql).get(...params) ?? null,
    runAsync:async(sql:string,params:unknown[]=[])=>database.prepare(sql).run(...params),
    withTransactionAsync:async(work:()=>Promise<void>)=>{database.exec('BEGIN');try{await work();database.exec('COMMIT');}catch(error){database.exec('ROLLBACK');throw error;}},
  };
  return {openDatabaseAsync:async()=>db,__testDb:db};
});
import * as repository from '../repository';
import { convertAmount } from '../units';
import { planForDay } from '../domain';
import type { EntryInput, SaveProfileInput } from '../types';
const testDb=(require('expo-sqlite') as any).__testDb;
const water:EntryInput={trackerId:'builtin:water',amount:8,unit:'oz',consumedAt:'2026-10-01T12:00:00Z',note:'source'};
const custom:SaveProfileInput={name:'Medication',category:'medication',unit:'tablet',savedDose:null,archived:false,metricType:'other',plan:{mode:'scheduled',days:[0,1,2,3,4,5,6],doses:[{id:'dose1',time:'09:00',amount:1,unit:'tablet'}],target:null,limit:null,unit:'tablet'}};

describe('unified repository with real isolated SQLite',()=>{
  beforeAll(async()=>{
    jest.useFakeTimers({now:new Date('2026-10-04T18:00:00Z')});
    await repository.loadSnapshot();
    await testDb.runAsync('INSERT INTO user_settings(name,height,weight,sex,water_goal,creatine_goal) VALUES(?,?,?,?,?,?)',['Owner',0,0,'unspecified',64,5]);
    await repository.savePreferences({timezone:'America/Chicago'});
  });
  afterAll(()=>jest.useRealTimers());
  test('exact idempotency, failure and deliberate actions',async()=>{
    const first=await repository.addEntry(water,'water-first');
    expect(await repository.addEntry(water,'water-first')).toEqual(first);
    await expect(repository.addEntry({...water,amount:16},'water-first')).rejects.toThrow('different action');
    await repository.addEntry(water,'water-second');
    const before=(await repository.loadSnapshot()).entries.length;
    await expect(repository.addEntry({...water,amount:Infinity},'bad')).rejects.toThrow();
    await expect(repository.addEntry({...water,consumedAt:'2099-01-01T00:00:00Z'},'future')).rejects.toThrow('future');
    expect((await repository.loadSnapshot()).entries.length).toBe(before);
    await repository.undoMutation(first,'undo-first');
    expect((await repository.loadSnapshot()).entries.some(e=>e.id==='water-second')).toBe(true);
    expect((await repository.loadSnapshot()).entries.some(e=>e.id==='water-first')).toBe(false);
    await expect(repository.undoMutation(first,'undo-first-again')).rejects.toThrow('already');
  });
  test('atomic cross-kind reassignment and stale edits',async()=>{
    const tracker=await repository.saveProfile(custom);
    const added=await repository.addEntry(water,'cross-kind');
    const edited=await repository.editEntry(added.after!,{...water,trackerId:tracker.id,unit:'tablet',amount:2},'cross-edit');
    expect((await repository.loadSnapshot()).entries.filter(e=>e.id==='cross-kind')).toEqual([edited.after]);
    await expect(repository.editEntry(added.after!,water,'stale-edit')).rejects.toThrow('changed');
    const undo=await repository.undoMutation(edited,'undo-cross');
    expect(undo.after?.storageKind).toBe('intake');
    expect(undo.after?.amount).toBe(8);
    expect(undo.after?.version).toBe(3);
    const extra=await repository.addEntry({...water,trackerId:tracker.id,unit:'tablet',amount:1},'insertion-collision');
    // Force a conflicting destination ID to prove delete+insert rollback is one transaction.
    await testDb.runAsync('INSERT INTO intake_log(id,amount,unit,consumable,consumed_at) VALUES(?,?,?,?,?)',['insertion-collision',1,'oz','water','2026-10-01 10:00:00']);
    await expect(repository.editEntry(extra.after!,water,'failed-cross')).rejects.toThrow();
    expect((await repository.loadSnapshot()).entries.some(e=>e.id==='insertion-collision'&&e.storageKind==='tracker')).toBe(true);
  });
  test('legacy walls, exact deletion restore and older history',async()=>{
    await testDb.runAsync('INSERT INTO intake_log(id,amount,unit,consumable,consumed_at,logged_at) VALUES(?,?,?,?,?,?)',['legacy',12.34567,'oz','water','2025-11-02 01:30:00','2025-11-02 02:00:00']);
    const entry=(await repository.queryHistory({fromDay:'2025-01-01',toDay:'2025-12-31'}))[0];
    expect(entry.consumedAtUtc).toBeNull(); expect(entry.legacyLocal).toBe('2025-11-02 01:30:00');
    const deleted=await repository.deleteEntry(entry,'delete-legacy');
    const restored=await repository.undoMutation(deleted,'restore-legacy');
    expect(restored.after).toEqual({...entry,version:2});
    const raw=await testDb.getFirstAsync('SELECT * FROM intake_log WHERE id=?',['legacy']);
    expect(raw.logged_at).toBe('2025-11-02 02:00:00'); expect(raw.consumed_at).toBe('2025-11-02 01:30:00'); expect(raw.consumed_at_utc).toBeNull();
  });
  test('versioned plans, archive/primary, settings merge and unit conversion',async()=>{
    const tracker=await repository.saveProfile({...custom,name:'Archived later'});
    await repository.setPrimary(tracker.id);
    const saved=await repository.saveProfile({...tracker,plan:{...custom.plan!,doses:[{id:'dose2',time:'18:00',amount:2,unit:'tablet'}]}});
    expect(saved.plans).toHaveLength(1); expect(saved.plans[0].doses[0].amount).toBe(2);
    await repository.saveProfile({...saved,archived:true});
    expect((await repository.loadSnapshot()).primaryTrackerId).toBeNull();
    await expect(repository.setPrimary(tracker.id)).rejects.toThrow('active');
    await repository.savePreferences({remindersEnabled:true}); await repository.savePreferences({bedtime:'23:00'});
    expect((await repository.loadSnapshot()).preferences.remindersEnabled).toBe(true);
    await repository.saveAccountName('New owner');
    const before=await testDb.getFirstAsync('SELECT * FROM user_settings');
    expect(before.water_goal).toBe(64); expect(before.creatine_goal).toBe(5);
    const creatine=(await repository.loadSnapshot()).trackers.find(t=>t.id==='builtin:creatine')!;
    await repository.saveProfile({...creatine,unit:'mg',savedDose:5000});
    const after=await testDb.getFirstAsync('SELECT * FROM user_settings');
    expect(after.creatine_goal).toBe(5000); expect(after.water_goal).toBe(64); expect(after.name).toBe('New owner');
  });
  test('a later-day plan edit retains previous days and actual history',async()=>{
    const original=await repository.saveProfile({...custom,name:'Versioned plan'});
    const logged=await repository.addEntry({...water,trackerId:original.id,unit:'tablet',amount:1},'planned-history');
    jest.setSystemTime(new Date('2026-10-05T18:00:00Z'));
    const changed=await repository.saveProfile({...original,plan:{...custom.plan!,doses:[{id:'later',time:'20:00',amount:3,unit:'tablet'}]}});
    expect(changed.plans).toHaveLength(2);
    expect(changed.plans[0]).toEqual(original.plans[0]);
    expect(changed.plans[1].effectiveFrom).toBe('2026-10-05');
    expect((await repository.loadSnapshot()).entries.find(e=>e.id===logged.after!.id)).toEqual(logged.after);
  });
  test('water display-unit changes reload with converted legacy goals and unchanged source plans/history',async()=>{
    jest.setSystemTime(new Date('2026-10-06T18:00:00Z'));
    const before=await repository.loadSnapshot();
    const original=before.trackers.find(t=>t.id==='builtin:water')!;
    const targetMl=convertAmount(80,'oz','mL'),limitMl=convertAmount(100,'oz','mL');
    const metric=await repository.saveProfile({...original,unit:'mL',plan:{mode:'as-needed',days:[],doses:[],unit:'mL',target:targetMl,limit:limitMl}});
    await repository.saveProfile({...metric,unit:'oz'});
    let reloaded=await repository.loadSnapshot();
    const waterProfile=reloaded.trackers.find(t=>t.id==='builtin:water')!;
    const current=planForDay(waterProfile,'2026-10-06')!;
    expect(waterProfile.unit).toBe('oz');
    expect(waterProfile.plans).toEqual(metric.plans);
    expect(current.unit).toBe('mL');expect(current.target).toBe(targetMl);
    expect(convertAmount(current.target!,current.unit,waterProfile.unit)).toBeCloseTo(80,10);
    expect(convertAmount(current.limit!,current.unit,waterProfile.unit)).toBeCloseTo(100,10);
    const legacy=await testDb.getFirstAsync('SELECT drink_unit,water_goal FROM user_settings');
    expect(legacy.drink_unit).toBe('oz');expect(legacy.water_goal).toBeCloseTo(80,10);
    expect(reloaded.entries).toEqual(before.entries);
    // An unrelated older settings writer cannot override the authoritative saved profile.
    await testDb.runAsync('UPDATE user_settings SET drink_unit=?,water_goal=?',['mL',targetMl]);
    reloaded=await repository.loadSnapshot();
    expect(reloaded.trackers.find(t=>t.id==='builtin:water')).toEqual(waterProfile);
    expect(reloaded.entries).toEqual(before.entries);
  });
});
