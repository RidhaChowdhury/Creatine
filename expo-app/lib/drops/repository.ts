import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';
import { getDatabase, initializeDatabase } from '../database';
import { initializeTrackerDatabase } from '../trackerDatabase';
import { convertAmount } from './units';
import { addDays, dayInZone, wallInZone, wallTimeToInstant } from './dates';
import type { DropsEntry, DropsPreferences, DropsSnapshot, DropsTracker, EntryInput, HistoryQuery, MutationReceipt, PlanVersion, SaveProfileInput } from './types';

type Raw = Record<string, any>;
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(work, work); writeQueue = next.catch(() => undefined); return next;
}
async function localDatabase() {
  if (!databasePromise) databasePromise = (async () => {
    await initializeDatabase(); await initializeTrackerDatabase();
    const db = await getDatabase();
    for (const [table, columns] of Object.entries({
      intake_log: { consumed_at_utc: 'TEXT', note: "TEXT NOT NULL DEFAULT ''", mutation_version: 'INTEGER NOT NULL DEFAULT 1' },
      tracker_entries: { consumed_at_utc: 'TEXT', note: "TEXT NOT NULL DEFAULT ''", mutation_version: 'INTEGER NOT NULL DEFAULT 1' },
      tracked_items: { metric_type: "TEXT NOT NULL DEFAULT 'other'", archived: 'INTEGER NOT NULL DEFAULT 0', grams_per_unit: 'REAL' },
    })) {
      const existing = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      for (const [column, definition] of Object.entries(columns)) if (!existing.some(c => c.name === column)) {
        await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        if(table==='tracked_items'&&column==='metric_type') await db.execAsync("UPDATE tracked_items SET metric_type=builtin_key WHERE builtin_key IN ('creatine','fiber','caffeine')");
      }
    }
    await db.execAsync(`CREATE TABLE IF NOT EXISTS drops_profiles (tracker_id TEXT PRIMARY KEY, profile_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS drops_preferences (id INTEGER PRIMARY KEY CHECK(id=1), preferences_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS drops_operations (operation_id TEXT PRIMARY KEY, request_json TEXT NOT NULL, receipt_json TEXT NOT NULL, raw_before TEXT, undone_by TEXT);`);
    await db.execAsync(`CREATE TRIGGER IF NOT EXISTS drops_retain_tracker_history BEFORE DELETE ON tracked_items
      WHEN EXISTS(SELECT 1 FROM tracker_entries WHERE tracker_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Archive trackers to preserve their history.'); END;`);
    await db.runAsync('INSERT OR IGNORE INTO drops_preferences(id,preferences_json) VALUES(1,?)',[JSON.stringify(defaults())]);
    const operationColumns = await db.getAllAsync<{ name:string }>('PRAGMA table_info(drops_operations)');
    for(const column of ['raw_before','undone_by']) if(!operationColumns.some(c=>c.name===column)) await db.execAsync(`ALTER TABLE drops_operations ADD COLUMN ${column} TEXT`);
    return db;
  })().catch(error => { databasePromise = null; throw error; });
  return databasePromise;
}
async function connection() {
  if (!supabase) throw new Error('Cloud storage is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error('Sign in to access your Drops data.');
  return { client: supabase, owner: data.session.user.id };
}
function storageError(error: any): Error {
  if (['42P01','42703','PGRST202','PGRST204','PGRST205'].includes(error?.code)) return new Error('Drops storage needs the additive 202610040001 migration. Apply it to the configured project, then retry. No changes were saved.');
  return error instanceof Error ? error : new Error(error?.message ?? 'Could not access Drops storage.');
}
async function cloudRows(table: string): Promise<Raw[]> {
  const { client, owner } = await connection();
  const rows: Raw[] = [];
  for (let offset = 0; ; offset += 1000) {
    const key = table === 'drops_profiles' ? 'tracker_id' : ['drops_preferences','user_settings','tracker_preferences'].includes(table) ? 'user_id' : 'id';
    const { data, error } = await client.from(table).select('*').eq('user_id', owner).order(key).range(offset, offset + 999);
    if (error) throw storageError(error);
    rows.push(...(data ?? [])); if ((data?.length ?? 0) < 1000) return rows;
  }
}
function defaults(): DropsPreferences {
  return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', waterPresets: [{ id: 'water-8', amount: 8, unit: 'oz' }, { id: 'water-16', amount: 16, unit: 'oz' }], prominentPresetIds: ['water-8','water-16'], remindersEnabled: false, priorUse: { creatine: 'unknown', caffeine: 'unknown' }, caffeineHalfLifeHours: 5, bedtime: '22:00' };
}
function plan(id: string, unit: string, target: number): PlanVersion[] {
  return target > 0 ? [{ id: `legacy:${id}`, effectiveFrom: '0001-01-01', mode: 'scheduled', days: [0,1,2,3,4,5,6], doses: [], target, limit: null, unit }] : [];
}
export function mapEntry(row: Raw, kind: 'intake'|'tracker', timezone: string): DropsEntry {
  const instant = row.consumed_at_utc ?? (kind === 'tracker' && /([zZ]|[+-]\d{2}:\d{2})$/.test(row.consumed_at) ? row.consumed_at : null);
  const legacy = instant ? null : row.consumed_at;
  return { id: row.id, storageKind: kind, trackerId: kind === 'tracker' ? row.tracker_id : row.consumable === 'creatine' ? 'builtin:creatine' : 'builtin:water', name: kind === 'tracker' ? row.name : row.consumable.charAt(0).toUpperCase()+row.consumable.slice(1), amount: row.amount, unit: row.unit, consumedAt: instant ?? row.consumed_at, consumedAtUtc: instant, legacyLocal: legacy, day: instant ? dayInZone(instant, timezone) : row.consumed_at.slice(0,10), note: row.note ?? '', version: row.mutation_version ?? 1 };
}
export async function loadSnapshot(): Promise<DropsSnapshot> {
  let items: Raw[], intake: Raw[], entries: Raw[], profiles: Raw[], preferenceRows: Raw[], settings: Raw[], primaryRows: Raw[];
  if (supabase) {
    [items,intake,entries,profiles,preferenceRows,settings,primaryRows] = await Promise.all(['tracked_items','intake_log','tracker_entries','drops_profiles','drops_preferences','user_settings','tracker_preferences'].map(cloudRows));
    if(!preferenceRows.length) {
      const {client}=await connection(); const {data,error}=await client.rpc('drops_initialize_preferences',{initial:defaults()});
      if(error) throw storageError(error); preferenceRows=[{preferences_json:data}];
    }
  } else {
    const db = await localDatabase();
    [items,intake,entries,profiles,preferenceRows,settings,primaryRows] = await Promise.all(['tracked_items','intake_log','tracker_entries','drops_profiles','drops_preferences','user_settings','tracker_preferences'].map(table => db.getAllAsync<Raw>(`SELECT * FROM ${table}`)));
  }
  const preferences = { ...defaults(), ...(preferenceRows[0] ? typeof preferenceRows[0].preferences_json === 'string' ? JSON.parse(preferenceRows[0].preferences_json) : preferenceRows[0].preferences_json : {}) };
  const savedProfiles = new Map<string, DropsTracker>(profiles.map(row => [row.tracker_id, typeof row.profile_json === 'string' ? JSON.parse(row.profile_json) : row.profile_json]));
  const oldSettings = settings[0];
  const waterUnit = oldSettings?.drink_unit ?? 'oz';
  const trackers: DropsTracker[] = [{ id: 'builtin:water', name: 'Water', category: 'water', metricType: 'water', unit: waterUnit, savedDose: null, archived: false, plans: plan('water', waterUnit, oldSettings?.water_goal ?? 0) }];
  for (const row of items) trackers.push({ id: row.id, name: row.name, category: row.category, metricType: row.builtin_key && !savedProfiles.has(row.id) ? row.builtin_key : row.metric_type ?? 'other', unit: row.unit, savedDose: row.saved_dose, archived: !!row.archived, gramsPerUnit: row.grams_per_unit, plans: row.id === 'builtin:creatine' ? plan('creatine', oldSettings?.supplement_unit ?? row.unit, oldSettings?.creatine_goal ?? 0) : [] });
  // Existing cloud accounts without initialized built-ins still retain creatine history and settings.
  if (!trackers.some(t => t.id === 'builtin:creatine')) trackers.push({ id:'builtin:creatine', name:'Creatine', category:'supplement', metricType:'creatine', unit:oldSettings?.supplement_unit ?? 'g', savedDose:convertAmount(5,'g',oldSettings?.supplement_unit ?? 'g'), archived:false, plans:plan('creatine', oldSettings?.supplement_unit ?? 'g', oldSettings?.creatine_goal ?? 0) });
  for (let i = 0; i < trackers.length; i++) if (savedProfiles.has(trackers[i].id)) trackers[i] = savedProfiles.get(trackers[i].id)!;
  const allEntries = [...intake.map(row => mapEntry(row,'intake',preferences.timezone)), ...entries.map(row => mapEntry(row,'tracker',preferences.timezone))].sort((a,b) => {
    if(a.day!==b.day) return b.day.localeCompare(a.day);
    if(a.consumedAtUtc && b.consumedAtUtc) return Date.parse(b.consumedAtUtc)-Date.parse(a.consumedAtUtc);
    const wallA=a.legacyLocal?.replace(' ','T') ?? wallInZone(a.consumedAtUtc!,preferences.timezone);
    const wallB=b.legacyLocal?.replace(' ','T') ?? wallInZone(b.consumedAtUtc!,preferences.timezone);
    return wallB.localeCompare(wallA);
  });
  const requestedPrimary = primaryRows[0]?.primary_tracker_id ?? null;
  return { trackers, entries: allEntries, preferences, primaryTrackerId: trackers.some(t => t.id === requestedPrimary && !t.archived) ? requestedPrimary : null };
}
export async function queryHistory(query: HistoryQuery): Promise<DropsEntry[]> {
  addDays(query.fromDay,0); addDays(query.toDay,0);
  if (query.fromDay > query.toDay) throw new Error('History start must be before its end.');
  const snapshot = await loadSnapshot();
  return snapshot.entries.filter(e => e.day >= query.fromDay && e.day <= query.toDay && (!query.trackerIds?.length || query.trackerIds.includes(e.trackerId)));
}
function validateProfile(input: SaveProfileInput) {
  if (!input.name.trim() || !input.unit.trim()) throw new Error('Tracker name and unit are required.');
  if (!['water','supplement','medication'].includes(input.category) || !['water','creatine','fiber','caffeine','other'].includes(input.metricType)) throw new Error('Invalid tracker type.');
  for (const value of [input.savedDose,input.gramsPerUnit,input.plan?.target,input.plan?.limit]) if (value != null && (!Number.isFinite(value) || value <= 0)) throw new Error('Dose, targets, limits and conversions must be positive finite numbers.');
  if (input.id === 'builtin:water' && (input.category !== 'water' || input.metricType !== 'water' || input.archived)) throw new Error('Water must remain an active water tracker.');
  if (input.id === 'builtin:water' && !['oz','ml','mL','L','cup'].includes(input.unit)) throw new Error('Water requires a volume unit.');
  if(input.id !== 'builtin:water' && (input.category==='water' || input.metricType==='water')) throw new Error('Water uses its built-in tracker.');
  if (input.id === 'builtin:creatine' && (input.category !== 'supplement' || input.metricType !== 'creatine' || !['g','mg'].includes(input.unit))) throw new Error('Built-in creatine uses g or mg.');
  if (input.plan) {
    const p = input.plan;
    if (!['scheduled','as-needed'].includes(p.mode) || p.days.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(p.days).size !== p.days.length) throw new Error('Invalid planned days.');
    if (p.mode === 'as-needed' && p.doses.length) throw new Error('As-needed trackers do not have scheduled doses.');
    if (new Set(p.doses.map(d => d.id)).size !== p.doses.length) throw new Error('Dose row identifiers must be distinct.');
    convertAmount(1,p.unit,input.unit);
    for (const d of p.doses) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time) || !Number.isFinite(d.amount) || d.amount <= 0) throw new Error('Every dose needs a valid time and positive amount.'); convertAmount(d.amount,d.unit,p.unit); }
  }
}
export async function saveProfile(input: SaveProfileInput): Promise<DropsTracker> {
  validateProfile(input);
  return serial(async () => {
    const snapshot = await loadSnapshot();
    const id = input.id ?? Crypto.randomUUID();
    const old = snapshot.trackers.find(t => t.id === id);
    if (input.id && !old) throw new Error('Tracker no longer exists.');
    const today = dayInZone(new Date(),snapshot.preferences.timezone);
    const plans = [...(old?.plans ?? [])];
    if (input.plan) { const next = { ...input.plan, id:Crypto.randomUUID(), effectiveFrom:today }; const index = plans.findIndex(p => p.effectiveFrom === today); if (index >= 0) plans[index] = next; else plans.push(next); }
    const { plan: ignored, ...fields } = input;
    const tracker: DropsTracker = { ...fields, id, name:input.name.trim(), unit:input.unit.trim(), plans };
    if (supabase) {
      const { client } = await connection(); const { error } = await client.rpc('drops_save_profile', { profile:tracker }); if (error) throw storageError(error);
    } else {
      const db = await localDatabase();
      await db.withTransactionAsync(async () => {
        if (id !== 'builtin:water') await db.runAsync(`INSERT INTO tracked_items (id,name,unit,saved_dose,category,builtin_key,metric_type,archived,grams_per_unit) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,unit=excluded.unit,saved_dose=excluded.saved_dose,category=excluded.category,metric_type=excluded.metric_type,archived=excluded.archived,grams_per_unit=excluded.grams_per_unit`,[id,tracker.name,tracker.unit,tracker.savedDose,tracker.category,id.startsWith('builtin:') ? id.slice(8) : null,tracker.metricType,tracker.archived ? 1 : 0,tracker.gramsPerUnit ?? null]);
        await db.runAsync('INSERT INTO drops_profiles (tracker_id,profile_json) VALUES (?,?) ON CONFLICT(tracker_id) DO UPDATE SET profile_json=excluded.profile_json',[id,JSON.stringify(tracker)]);
        if (tracker.archived) await db.runAsync('UPDATE tracker_preferences SET primary_tracker_id=NULL WHERE primary_tracker_id=?',[id]);
        const activePlan = [...plans].filter(p=>p.effectiveFrom<=today).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
        const target = activePlan?.target != null ? convertAmount(activePlan.target,activePlan.unit,tracker.unit) : 0;
        if (id === 'builtin:water') await db.runAsync('UPDATE user_settings SET drink_unit=?,water_goal=?',[tracker.unit,target]);
        if (id === 'builtin:creatine') await db.runAsync('UPDATE user_settings SET supplement_unit=?,creatine_goal=?',[tracker.unit,target]);
      });
    }
    return tracker;
  });
}
export async function setPrimary(id: string | null): Promise<void> {
  return serial(async () => {
    const snapshot = await loadSnapshot(); if (id && !snapshot.trackers.some(t => t.id === id && t.category !== 'water' && !t.archived)) throw new Error('Choose an active supplement or medication.');
    if (supabase) { const { client } = await connection(); if(id === 'builtin:creatine') {const {error}=await client.rpc('drops_save_profile',{profile:snapshot.trackers.find(t=>t.id===id)}); if(error) throw storageError(error);} const { error } = await client.rpc('drops_set_primary',{tracker:id}); if (error) throw storageError(error); }
    else { const db = await localDatabase(); await db.runAsync('UPDATE tracker_preferences SET primary_tracker_id=? WHERE id=1',[id]); }
  });
}
/** Account section saves only its own field; goals and device preferences are untouched. */
export async function saveAccountName(name:string):Promise<void> {
  const value=name.trim(); if(!value) throw new Error('Enter your name.');
  return serial(async()=>{
    if(supabase) {const {client,owner}=await connection(); const {data,error}=await client.from('user_settings').update({name:value}).eq('user_id',owner).select('user_id').maybeSingle(); if(error) throw storageError(error); if(!data) throw new Error('Complete account setup before saving your name.');}
    else {const db=await localDatabase(); const result=await db.runAsync('UPDATE user_settings SET name=? WHERE id=(SELECT id FROM user_settings LIMIT 1)',[value]); if(!result.changes) throw new Error('Complete account setup before saving your name.');}
  });
}
export async function savePreferences(changes: Partial<DropsPreferences>): Promise<void> {
  return serial(async () => {
    const snapshot = await loadSnapshot(); const next = {...snapshot.preferences,...changes};
    dayInZone(new Date(),next.timezone);
    if (!Number.isFinite(next.caffeineHalfLifeHours) || next.caffeineHalfLifeHours < 1 || next.caffeineHalfLifeHours > 24 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(next.bedtime)) throw new Error('Invalid caffeine elimination settings.');
    if (next.waterPresets.some(p => !p.id || !Number.isFinite(p.amount) || p.amount <= 0 || !['oz','ml','mL','L','cup'].includes(p.unit)) || new Set(next.waterPresets.map(p=>p.id)).size !== next.waterPresets.length || next.prominentPresetIds.length>2 || new Set(next.prominentPresetIds).size!==next.prominentPresetIds.length || next.prominentPresetIds.some(id=>!next.waterPresets.some(p=>p.id===id))) throw new Error('Invalid water presets.');
    if(!['unknown','not-using','using','established'].includes(next.priorUse.creatine) || !['unknown','not-using','using'].includes(next.priorUse.caffeine) || (next.priorUse.usualDoseGrams != null && (!Number.isFinite(next.priorUse.usualDoseGrams)||next.priorUse.usualDoseGrams<=0))) throw new Error('Invalid prior-use context.');
    if(next.priorUse.startDate) {addDays(next.priorUse.startDate,0); if(next.priorUse.startDate>dayInZone(new Date(),next.timezone)) throw new Error('Prior-use start date cannot be in the future.');}
    if (supabase) { const {client} = await connection(); const {error} = await client.rpc('drops_patch_preferences',{changes}); if(error) throw storageError(error); }
    else { const db = await localDatabase(); await db.runAsync('INSERT INTO drops_preferences(id,preferences_json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET preferences_json=excluded.preferences_json',[JSON.stringify(next)]); }
  });
}
async function entryFromInput(input: EntryInput, id: string, version: number): Promise<DropsEntry> {
  const snapshot = await loadSnapshot(); const tracker = snapshot.trackers.find(t => t.id === input.trackerId);
  if (!tracker) throw new Error('Tracker no longer exists.');
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Amount must be a positive finite number.');
  convertAmount(input.amount,input.unit,tracker.unit);
  const consumedAtUtc = /([zZ]|[+-]\d{2}:\d{2})$/.test(input.consumedAt) ? new Date(input.consumedAt).toISOString() : wallTimeToInstant(input.consumedAt,snapshot.preferences.timezone);
  if (Date.parse(consumedAtUtc) > Date.now()) throw new Error('Actual intake cannot be in the future.');
  return {id,storageKind:['builtin:water','builtin:creatine'].includes(tracker.id)?'intake':'tracker',trackerId:tracker.id,name:tracker.name,amount:input.amount,unit:input.unit,consumedAt:consumedAtUtc,consumedAtUtc,legacyLocal:null,day:dayInZone(consumedAtUtc,snapshot.preferences.timezone),note:input.note ?? '',version};
}
function equalEntry(a: DropsEntry, b: DropsEntry) { return a.id===b.id && a.storageKind===b.storageKind && a.trackerId===b.trackerId && a.version===b.version && a.amount===b.amount && a.unit===b.unit && a.consumedAt===b.consumedAt && a.note===b.note; }
async function mutate(receipt: MutationReceipt, request: {kind:string; receipt?:MutationReceipt; [key:string]:unknown}): Promise<MutationReceipt> {
  if (!receipt.operationId.trim()) throw new Error('Operation ID is required.');
  if (supabase) { const {client}=await connection(); const {data,error}=await client.rpc('drops_mutate_entry',{mutation:receipt,request_payload:request}); if(error) throw storageError(error); return data as MutationReceipt; }
  const db=await localDatabase(); let result=receipt;
  const zone=(await loadSnapshot()).preferences.timezone;
  await db.withTransactionAsync(async()=>{
    const existing=await db.getFirstAsync<{request_json:string;receipt_json:string}>('SELECT request_json,receipt_json FROM drops_operations WHERE operation_id=?',[receipt.operationId]);
    if(existing) {if(existing.request_json!==JSON.stringify(request)) throw new Error('Operation ID already belongs to a different action.'); result=JSON.parse(existing.receipt_json); return;}
    let currentRow:Raw|null=null; let originalRow:Raw|null=null;
    if(request.kind==='undo') {
      const original=await db.getFirstAsync<{receipt_json:string;raw_before:string|null;undone_by:string|null}>('SELECT receipt_json,raw_before,undone_by FROM drops_operations WHERE operation_id=?',[request.receipt!.operationId]);
      if(!original || original.receipt_json!==JSON.stringify(request.receipt) || original.undone_by) throw new Error('This Undo receipt is stale or has already been used.');
      originalRow=original.raw_before ? JSON.parse(original.raw_before):null;
    }
    if(receipt.before) { const before=receipt.before; const table=before.storageKind==='intake'?'intake_log':'tracker_entries'; currentRow=await db.getFirstAsync<Raw>(`SELECT * FROM ${table} WHERE id=?`,[before.id]); if(!currentRow || !equalEntry(mapEntry(currentRow,before.storageKind,zone),before)) throw new Error('This entry changed since you opened it. Refresh before editing or Undo.'); await db.runAsync(`DELETE FROM ${table} WHERE id=?`,[before.id]); }
    if(receipt.after) {
      const a=receipt.after; const wall=originalRow?.consumed_at ?? a.legacyLocal ?? wallInZone(a.consumedAtUtc!,zone).replace('T',' ');
      if(a.storageKind==='intake') await db.runAsync("INSERT INTO intake_log(id,amount,unit,consumable,consumed_at,consumed_at_utc,note,mutation_version,logged_at) VALUES(?,?,?,?,?,?,?,?,COALESCE(?,datetime('now','localtime')))",[a.id,a.amount,a.unit,originalRow?.consumable ?? (receipt.before?.trackerId===a.trackerId ? currentRow?.consumable:null) ?? (a.trackerId==='builtin:creatine'?'creatine':'water'),wall,a.consumedAtUtc,a.note,a.version,originalRow?.logged_at ?? currentRow?.logged_at ?? null]);
      else await db.runAsync('INSERT INTO tracker_entries(id,tracker_id,name,amount,unit,consumed_at,consumed_at_utc,note,mutation_version) VALUES(?,?,?,?,?,?,?,?,?)',[a.id,a.trackerId,a.name,a.amount,a.unit,originalRow?.consumed_at ?? a.legacyLocal ?? a.consumedAtUtc!,a.consumedAtUtc,a.note,a.version]);
    }
    await db.runAsync('INSERT INTO drops_operations(operation_id,request_json,receipt_json,raw_before) VALUES(?,?,?,?)',[receipt.operationId,JSON.stringify(request),JSON.stringify(receipt),currentRow ? JSON.stringify(currentRow):null]);
    if(request.kind==='undo') await db.runAsync('UPDATE drops_operations SET undone_by=? WHERE operation_id=?',[receipt.operationId,request.receipt!.operationId]);
  }); return result;
}
export function addEntry(input:EntryInput,operationId:string):Promise<MutationReceipt> {return serial(async()=>{const after=await entryFromInput(input,operationId,1);return mutate({operationId,kind:'add',before:null,after},{kind:'add',input});});}
export function editEntry(before:DropsEntry,input:EntryInput,operationId:string):Promise<MutationReceipt> {return serial(async()=>{const after=await entryFromInput(input,before.id,before.version+1);return mutate({operationId,kind:'edit',before,after},{kind:'edit',before,input});});}
export function deleteEntry(before:DropsEntry,operationId:string):Promise<MutationReceipt> {return serial(()=>mutate({operationId,kind:'delete',before,after:null},{kind:'delete',before}));}
export function undoMutation(receipt:MutationReceipt,operationId:string):Promise<MutationReceipt> {return serial(()=>{const after=receipt.before ? {...receipt.before,version:(receipt.after?.version ?? receipt.before.version)+1}:null;return mutate({operationId,kind:after?'restore':'delete',before:receipt.after,after},{kind:'undo',receipt});});}
