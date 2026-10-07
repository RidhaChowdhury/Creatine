import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { getDatabase } from './database';

export type TrackerCategory = 'supplement' | 'medication';
export type TrackerRow = {
   id: string;
   name: string;
   unit: string;
   saved_dose: number | null;
   category: TrackerCategory;
   builtin_key: string | null;
};
export type TrackerEntryRow = {
   id: string;
   tracker_id: string;
   name: string;
   unit: string;
   amount: number;
   consumed_at: string;
};

const BUILT_INS: Array<TrackerRow> = [
   { id: 'builtin:creatine', name: 'Creatine', unit: 'g', saved_dose: 5, category: 'supplement', builtin_key: 'creatine' },
   { id: 'builtin:fiber', name: 'Fiber', unit: 'g', saved_dose: null, category: 'supplement', builtin_key: 'fiber' },
   { id: 'builtin:caffeine', name: 'Caffeine', unit: 'mg', saved_dose: null, category: 'supplement', builtin_key: 'caffeine' }
];

async function localDb() {
   return getDatabase();
}

async function cloudConnection() {
   if (!supabase) throw new Error('Supabase is not configured.');
   const { data, error } = await supabase.auth.getSession();
   if (error) throw error;
   if (!data.session?.user) throw new Error('Please sign in to your account.');
   return { client: supabase, userId: data.session.user.id };
}

export function isTrackerSchemaMissing(error: unknown): boolean {
   const value = error as { code?: string; message?: string } | null;
   const message = value?.message?.toLowerCase() ?? '';
   const names = ['tracked_items', 'tracker_entries', 'tracker_preferences'];
   return value?.code === '42P01' || value?.code === 'PGRST205' ||
      (names.some((name) => message.includes(name)) &&
         (message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find the table')));
}

export function migrationRequiredError(): Error {
   return new TrackerStorageUnavailableError();
}

export class TrackerStorageUnavailableError extends Error {
   readonly code = 'TRACKER_STORAGE_UNAVAILABLE';

   constructor() {
      super('Supplement storage is unavailable. Please retry after setup is complete.');
      this.name = 'TrackerStorageUnavailableError';
   }
}

export async function initializeTrackerDatabase(): Promise<void> {
   if (supabase) return;
   const database = await localDb();
   await database.execAsync(`
      CREATE TABLE IF NOT EXISTS tracked_items (
         id TEXT NOT NULL,
         name TEXT NOT NULL CHECK (length(trim(name)) > 0),
         unit TEXT NOT NULL CHECK (length(trim(unit)) > 0),
         saved_dose REAL CHECK (saved_dose IS NULL OR (saved_dose > 0 AND saved_dose < 1.0e308)),
         category TEXT NOT NULL CHECK (category IN ('supplement', 'medication')),
         builtin_key TEXT UNIQUE,
         CHECK (builtin_key IS NOT 'creatine' OR (category = 'supplement' AND unit IN ('g', 'mg'))),
         PRIMARY KEY (id)
      );
      CREATE TABLE IF NOT EXISTS tracker_entries (
         id TEXT PRIMARY KEY NOT NULL,
         tracker_id TEXT NOT NULL REFERENCES tracked_items(id) ON DELETE CASCADE,
         name TEXT NOT NULL,
         unit TEXT NOT NULL,
         amount REAL NOT NULL CHECK (amount > 0 AND amount < 1.0e308),
         consumed_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tracker_entries_tracker_date
         ON tracker_entries (tracker_id, consumed_at DESC);
      CREATE TABLE IF NOT EXISTS tracker_preferences (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         primary_tracker_id TEXT REFERENCES tracked_items(id) ON DELETE SET NULL
      );
      INSERT OR IGNORE INTO tracker_preferences (id, primary_tracker_id) VALUES (1, NULL);
   `);
   // The requested creatine default is 5 g; other built-in doses remain unset.
   for (const item of BUILT_INS) {
      await database.runAsync(
         `INSERT OR IGNORE INTO tracked_items (id, name, unit, saved_dose, category, builtin_key)
          VALUES (?, ?, ?, ?, ?, ?)`,
         [item.id, item.name, item.unit, item.saved_dose, item.category, item.builtin_key]
      );
   }
}

export async function listTrackerRows(): Promise<TrackerRow[]> {
   if (!supabase) {
      const database = await localDb();
      return database.getAllAsync<TrackerRow>(
         'SELECT id, name, unit, saved_dose, category, builtin_key FROM tracked_items ORDER BY builtin_key IS NULL, name COLLATE NOCASE'
      );
   }
   const { client, userId } = await cloudConnection();
   const { data: existing, error: readError } = await client.from('tracked_items')
      .select('id,name,unit,saved_dose,category,builtin_key').eq('user_id', userId);
   if (readError) {
      if (isTrackerSchemaMissing(readError)) return [BUILT_INS[0]];
      throw readError;
   }
   const keys = new Set((existing ?? []).map((row: TrackerRow) => row.builtin_key));
   const missing = BUILT_INS.filter((item) => !keys.has(item.builtin_key));
   if (missing.length) {
      const { error } = await client.from('tracked_items').upsert(
         missing.map((item) => ({ ...item, user_id: userId })),
         { onConflict: 'user_id,id', ignoreDuplicates: true }
      );
      if (error) {
         if (isTrackerSchemaMissing(error)) return [BUILT_INS[0]];
         throw error;
      }
      const { data, error: rereadError } = await client.from('tracked_items')
         .select('id,name,unit,saved_dose,category,builtin_key').eq('user_id', userId);
      if (rereadError) throw rereadError;
      return (data ?? []) as TrackerRow[];
   }
   return (existing ?? []) as TrackerRow[];
}

export async function saveTrackerRow(input: {
   id?: string; name: string; unit: string; savedDose: number | null; category: TrackerCategory;
}): Promise<TrackerRow> {
   const name = input.name.trim();
   const unit = input.unit.trim();
   if (!name || !unit) throw new Error('Enter a name and unit for this tracker.');
   if (input.savedDose !== null && (!Number.isFinite(input.savedDose) || input.savedDose <= 0)) {
      throw new Error('Saved dose must be a positive finite number.');
   }
   if (input.id === 'builtin:creatine' && (input.category !== 'supplement' || !['g', 'mg'].includes(unit))) {
      throw new Error('Creatine uses g or mg and must stay in the supplement category.');
   }
   const id = input.id ?? Crypto.randomUUID();
   if (!supabase) {
      const database = await localDb();
      await database.runAsync(
         `INSERT INTO tracked_items (id,name,unit,saved_dose,category,builtin_key) VALUES (?,?,?,?,?,NULL)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name, unit=excluded.unit,
          saved_dose=excluded.saved_dose, category=excluded.category`,
         [id, name, unit, input.savedDose, input.category]
      );
      const row = await database.getFirstAsync<TrackerRow>(
         'SELECT id,name,unit,saved_dose,category,builtin_key FROM tracked_items WHERE id = ?', [id]
      );
      if (!row) throw new Error('Could not save tracker.');
      return row;
   }
   const { client, userId } = await cloudConnection();
   const values = { id, name, unit, saved_dose: input.savedDose, category: input.category, user_id: userId };
   const query = input.id
      ? client.from('tracked_items').update({ name, unit, saved_dose: input.savedDose, category: input.category }).eq('id', id).eq('user_id', userId)
      : client.from('tracked_items').insert(values);
   const { data, error } = await query.select('id,name,unit,saved_dose,category,builtin_key').single();
   if (error) {
      if (isTrackerSchemaMissing(error)) throw migrationRequiredError();
      throw error;
   }
   return data as TrackerRow;
}

export async function selectPrimaryTrackerRow(id: string | null): Promise<string | null> {
   if (!supabase) {
      const database = await localDb();
      if (id) {
         const row = await database.getFirstAsync<{ id: string }>('SELECT id FROM tracked_items WHERE id = ?', [id]);
         if (!row) throw new Error('That tracker no longer exists.');
      }
      await database.runAsync('UPDATE tracker_preferences SET primary_tracker_id = ? WHERE id = 1', [id]);
      return id;
   }
   const { client, userId } = await cloudConnection();
   if (id) {
      const { data: item, error: itemError } = await client.from('tracked_items').select('id')
         .eq('id', id).eq('user_id', userId).maybeSingle();
      if (itemError) {
         if (isTrackerSchemaMissing(itemError)) throw migrationRequiredError();
         throw itemError;
      }
      if (!item) throw new Error('That tracker no longer exists.');
   }
   const { error } = await client.from('tracker_preferences').upsert(
      { user_id: userId, primary_tracker_id: id }, { onConflict: 'user_id' }
   );
   if (error) {
      if (isTrackerSchemaMissing(error)) throw migrationRequiredError();
      throw error;
   }
   return id;
}

export async function getPrimaryTrackerRow(): Promise<string | null> {
   if (!supabase) {
      const database = await localDb();
      const row = await database.getFirstAsync<{ primary_tracker_id: string | null }>(
         'SELECT primary_tracker_id FROM tracker_preferences WHERE id = 1'
      );
      return row?.primary_tracker_id ?? null;
   }
   const { client, userId } = await cloudConnection();
   const { data, error } = await client.from('tracker_preferences').select('primary_tracker_id')
      .eq('user_id', userId).maybeSingle();
   if (error) {
      // Existing cloud accounts can still open legacy creatine before this additive table exists.
      if (isTrackerSchemaMissing(error)) return null;
      throw error;
   }
   return data?.primary_tracker_id ?? null;
}

export async function insertTrackerEntry(input: {
   trackerId: string; id: string; name: string; unit: string; amount: number; consumedAt: string;
}): Promise<TrackerEntryRow> {
   if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Dose must be a positive finite number.');
   if (!supabase) {
      const database = await localDb();
      await database.runAsync(
         `INSERT OR IGNORE INTO tracker_entries (id,tracker_id,name,unit,amount,consumed_at) VALUES (?,?,?,?,?,?)`,
         [input.id, input.trackerId, input.name, input.unit, input.amount, input.consumedAt]
      );
      const row = await database.getFirstAsync<TrackerEntryRow>(
         'SELECT id,tracker_id,name,unit,amount,consumed_at FROM tracker_entries WHERE id = ?', [input.id]
      );
      if (!row) throw new Error('Could not save dose entry.');
      matchTrackerEntry(row, input);
      return row;
   }
   const { client, userId } = await cloudConnection();
   const { data: inserted, error: insertError } = await client.from('tracker_entries').upsert({
      id: input.id, tracker_id: input.trackerId, name: input.name, unit: input.unit,
      amount: input.amount, consumed_at: input.consumedAt, user_id: userId
   }, { onConflict: 'user_id,id', ignoreDuplicates: true })
      .select('id,tracker_id,name,unit,amount,consumed_at').maybeSingle();
   if (insertError) {
      if (isTrackerSchemaMissing(insertError)) throw migrationRequiredError();
      throw insertError;
   }
   if (inserted) return inserted as TrackerEntryRow;
   const { data: row, error } = await client.from('tracker_entries')
      .select('id,tracker_id,name,unit,amount,consumed_at').eq('id', input.id).eq('user_id', userId).single();
   if (error) throw error;
   matchTrackerEntry(row as TrackerEntryRow, input);
   return row as TrackerEntryRow;
}

function matchTrackerEntry(
   row: TrackerEntryRow,
   input: { id: string; trackerId: string; name: string; unit: string; amount: number; consumedAt: string }
): void {
   const actualTime = Date.parse(row.consumed_at);
   const expectedTime = Date.parse(input.consumedAt);
   const sameTime = Number.isFinite(actualTime) && Number.isFinite(expectedTime)
      ? actualTime === expectedTime
      : row.consumed_at === input.consumedAt;
   if (row.id !== input.id || row.tracker_id !== input.trackerId || row.name !== input.name ||
      row.unit !== input.unit || row.amount !== input.amount || !sameTime) {
      throw new Error('This operation ID already belongs to a different dose entry.');
   }
}

export async function deleteTrackerEntry(trackerId: string, id: string): Promise<void> {
   if (!supabase) {
      const database = await localDb();
      const result = await database.runAsync('DELETE FROM tracker_entries WHERE id = ? AND tracker_id = ?', [id, trackerId]);
      if (!result.changes) throw new Error('Dose entry was not found.');
      return;
   }
   const { client, userId } = await cloudConnection();
   const { data, error } = await client.from('tracker_entries').delete().eq('id', id)
      .eq('tracker_id', trackerId).eq('user_id', userId).select('id').maybeSingle();
   if (error) {
      if (isTrackerSchemaMissing(error)) throw migrationRequiredError();
      throw error;
   }
   if (!data) throw new Error('Dose entry was not found.');
}

export async function fetchTrackerEntryRows(trackerId: string, since: string): Promise<TrackerEntryRow[]> {
   if (!supabase) {
      const database = await localDb();
      return database.getAllAsync<TrackerEntryRow>(
         `SELECT id,tracker_id,name,unit,amount,consumed_at FROM tracker_entries
          WHERE tracker_id = ? AND consumed_at >= ? ORDER BY consumed_at DESC`, [trackerId, since]
      );
   }
   const { client, userId } = await cloudConnection();
   const { data, error } = await client.from('tracker_entries')
      .select('id,tracker_id,name,unit,amount,consumed_at').eq('tracker_id', trackerId)
      .eq('user_id', userId).gte('consumed_at', since).order('consumed_at', { ascending: false });
   if (error) {
      if (isTrackerSchemaMissing(error)) throw migrationRequiredError();
      throw error;
   }
   return (data ?? []) as TrackerEntryRow[];
}
