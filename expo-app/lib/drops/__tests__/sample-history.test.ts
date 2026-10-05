jest.mock('../../supabase',()=>({supabase:null}));
jest.mock('expo-crypto',()=>{let sequence=0;return {randomUUID:jest.fn(()=>`sample-test-${++sequence}`)};});
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
import { Platform } from 'react-native';
import * as repository from '../repository';
import { addSampleHistory } from '../sample-history';
const testDb=(require('expo-sqlite') as any).__testDb;
const cloud=require('../../supabase');

describe('local sample history through the real SQLite repository',()=>{
  beforeAll(async()=>{
    Object.defineProperty(Platform,'OS',{value:'web',configurable:true});
    Object.defineProperty(globalThis,'window',{value:{location:{hostname:'127.0.0.1'}},configurable:true,writable:true});
    jest.useFakeTimers({now:new Date('2026-11-03T01:00:00Z')}); // Chicago still Nov 2, across DST.
    await repository.loadSnapshot();
    await testDb.runAsync('INSERT INTO user_settings(name,height,weight,sex,water_goal,creatine_goal) VALUES(?,?,?,?,?,?)',['Existing owner',0,0,'unspecified',80,5]);
    await repository.savePreferences({timezone:'America/Chicago',bedtime:'21:30'});
  });
  afterAll(()=>jest.useRealTimers());

  test('rejects cloud, hosted and native before any repository read',async()=>{
    const read=jest.spyOn(repository,'loadSnapshot');
    cloud.supabase={};
    await expect(addSampleHistory()).rejects.toThrow('local web preview');
    cloud.supabase=null;
    window.location.hostname='drops-ridha--abcdefghi.expo.app';
    await expect(addSampleHistory()).rejects.toThrow('local web preview');
    window.location.hostname='127.0.0.1';
    Object.defineProperty(Platform,'OS',{value:'android',configurable:true});
    await expect(addSampleHistory()).rejects.toThrow('local web preview');
    Object.defineProperty(Platform,'OS',{value:'web',configurable:true});
    expect(read).not.toHaveBeenCalled(); read.mockRestore();
  });

  test('fills 30 complete timezone days, preserves real totals and every profile/settings value',async()=>{
    const snapshot=await repository.loadSnapshot();
    const caffeine=snapshot.trackers.find(t=>t.id==='builtin:caffeine')!;
    await repository.saveProfile({...caffeine,archived:true});
    const fiber=snapshot.trackers.find(t=>t.id==='builtin:fiber')!;
    await repository.saveProfile({...fiber,unit:'capsule',savedDose:null});
    await repository.saveProfile({name:'Medicine',category:'medication',metricType:'other',unit:'tablet',savedDose:null,archived:false});
    const receipt=await repository.addEntry({trackerId:'builtin:water',amount:7.25,unit:'oz',consumedAt:'2026-11-01T10:00:00',note:'Real existing intake'},'existing-real');
    const before=await repository.loadSnapshot();
    const settings=await testDb.getAllAsync('SELECT * FROM user_settings');
    const progress=jest.fn();
    const result=await addSampleHistory({onProgress:progress});
    expect(result).toEqual({added:146,existing:0,total:146,skippedDays:61,fromDay:'2026-10-03',toDay:'2026-11-01'});
    const after=await repository.loadSnapshot();
    expect(after.trackers).toEqual(before.trackers);
    expect(after.preferences).toEqual(before.preferences);
    expect(after.primaryTrackerId).toEqual(before.primaryTrackerId);
    expect(await testDb.getAllAsync('SELECT * FROM user_settings')).toEqual(settings);
    expect(after.entries.find(e=>e.id==='existing-real')).toEqual(receipt.after);
    expect(after.entries.filter(e=>e.trackerId==='builtin:water' && e.day==='2026-11-01')).toEqual([receipt.after]);
    const samples=after.entries.filter(e=>e.id.startsWith('sample-history:'));
    expect(new Set(samples.map(e=>e.day)).size).toBe(30);
    expect(samples.every(e=>e.day>='2026-10-03' && e.day<='2026-11-01' && e.note==='Sample data — not actual intake.')).toBe(true);
    expect(samples.every(e=>['builtin:water','builtin:creatine'].includes(e.trackerId))).toBe(true);
    expect(progress).toHaveBeenLastCalledWith(146,146);
  });

  test('retries preserve edited/deleted samples and overlapping next-day amounts',async()=>{
    const before=await repository.loadSnapshot();
    const sample=before.entries.find(e=>e.id.startsWith('sample-history:') && e.trackerId==='builtin:creatine')!;
    await repository.deleteEntry(sample,'sample-delete');
    const editable=before.entries.find(e=>e.id.startsWith('sample-history:') && e.trackerId==='builtin:water')!;
    const edited=await repository.editEntry(editable,{trackerId:editable.trackerId,amount:2,unit:'oz',consumedAt:editable.consumedAt,note:'Edited sample'},'sample-edit');
    expect((await addSampleHistory()).added).toBe(0);
    const retried=await repository.loadSnapshot();
    expect(retried.entries.find(e=>e.id===editable.id)).toEqual(edited.after);
    expect(retried.entries.some(e=>e.id===sample.id)).toBe(false);
    expect(retried.entries).toHaveLength(before.entries.length-1);
    jest.setSystemTime(new Date('2026-11-04T01:00:00Z'));
    expect((await addSampleHistory()).added).toBe(5);
    const next=await repository.loadSnapshot();
    for(const entry of retried.entries) expect(next.entries.find(e=>e.id===entry.id)).toEqual(entry);
  });

  test('rechecks the local guard before writing when configuration changes mid-run',async()=>{
    jest.setSystemTime(new Date('2026-11-05T01:00:00Z'));
    const before=await repository.loadSnapshot();
    await expect(addSampleHistory({onProgress:()=>{cloud.supabase={};}})).rejects.toThrow('local web preview');
    cloud.supabase=null;
    expect((await repository.loadSnapshot()).entries).toEqual(before.entries);
  });

  test('active fiber and caffeine receive varied explicitly mass-unit samples without using saved doses',async()=>{
    const before=await repository.loadSnapshot();
    for(const metric of ['fiber','caffeine']) {
      const tracker=before.trackers.find(t=>t.id===`builtin:${metric}`)!;
      await repository.saveProfile({...tracker,archived:false,unit:metric==='fiber'?'g':'mg',savedDose:null});
    }
    const configured=await repository.loadSnapshot();
    await addSampleHistory();
    const after=await repository.loadSnapshot();
    expect(after.trackers).toEqual(configured.trackers);
    for(const [metric,unit,min,max] of [['fiber','g',3,6],['caffeine','mg',75,150]] as const) {
      const entries=after.entries.filter(e=>e.trackerId===`builtin:${metric}`);
      expect(entries).toHaveLength(30);
      expect(new Set(entries.map(e=>e.amount)).size).toBe(4);
      expect(entries.every(e=>e.unit===unit && e.amount>=min && e.amount<=max && e.day<'2026-11-04')).toBe(true);
    }
    for(const entry of before.entries) expect(after.entries.find(e=>e.id===entry.id)).toEqual(entry);
    const unchanged=after.entries;
    await addSampleHistory();
    expect((await repository.loadSnapshot()).entries).toEqual(unchanged);
  });
});
