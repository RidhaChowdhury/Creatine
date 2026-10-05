import { supabase } from './supabase';
import type { IntakeLogRow, UserSettingsRow } from './database';

function settingsRow(row: Omit<UserSettingsRow, 'id'> & { user_id: string }): UserSettingsRow {
   const { user_id, ...settings } = row;
   return { ...settings, id: user_id };
}

async function connection() {
   if (!supabase) throw new Error('Supabase is not configured.');
   const { data, error } = await supabase.auth.getSession();
   if (error) throw error;
   if (!data.session?.user) throw new Error('Please sign in to your account.');
   return { client: supabase, userId: data.session.user.id };
}

export async function fetchDrinkLogsDB(drinkTypes: readonly string[], since: string) {
   const { client, userId } = await connection();
   const time = cloudIntakeTime(since);
   const { data, error } = await client.from('intake_log').select('*')
      .eq('user_id', userId).in('consumable', [...drinkTypes])
      .or(`consumed_at_utc.gte.${time.utc},and(consumed_at_utc.is.null,consumed_at.gte.${time.localWall})`);
   if (error) throw error;
   return ((data ?? []) as IntakeLogRow[]).map(normalizeCloudIntakeRow)
      .sort((a, b) => intakeTimestamp(b.consumed_at) - intakeTimestamp(a.consumed_at));
}

export async function fetchCreatineLogsDB(since: string) {
   return fetchDrinkLogsDB(['creatine'], since);
}

export async function insertIntakeLog(params: {
   id?: string; operationId?: string; amount: number; unit: string; consumable: string; consumed_at: string;
}) {
   const { client, userId } = await connection();
   if (params.id && params.operationId && params.id !== params.operationId) {
      throw new Error('Conflicting intake operation IDs were supplied.');
   }
   const operationId = params.operationId ?? params.id;
   if (operationId !== undefined && !operationId.trim()) throw new Error('Operation ID must not be empty.');
   const time = cloudIntakeTime(params.consumed_at);
   const values = {
      ...(operationId ? { id: operationId } : {}),
      amount: params.amount,
      unit: params.unit,
      consumable: params.consumable,
      consumed_at: time.localWall,
      consumed_at_utc: time.utc,
      user_id: userId
   };
   if (operationId) {
      const existing = await findIntakeLogById(client, operationId, userId);
      if (existing) return normalizeCloudIntakeRow(matchIdempotentIntakeLog(existing, values));
   }

   const { data, error } = await client.from('intake_log').insert(values).select().single();
   if (!error) return normalizeCloudIntakeRow(data as IntakeLogRow);
   if (operationId && error.code === '23505') {
      // A concurrent retry may insert after our read. Return only the same owner's identical row.
      const concurrent = await findIntakeLogById(client, operationId, userId);
      if (concurrent) return normalizeCloudIntakeRow(matchIdempotentIntakeLog(concurrent, values));
   }
   throw error;
}

async function findIntakeLogById(client: NonNullable<typeof supabase>, id: string, userId: string) {
   const { data, error } = await client.from('intake_log').select('*')
      .eq('id', id).eq('user_id', userId).maybeSingle();
   if (error) throw error;
   return data as IntakeLogRow | null;
}

function matchIdempotentIntakeLog(
   row: IntakeLogRow,
   input: { amount: number; unit: string; consumable: string; consumed_at: string; consumed_at_utc: string; user_id: string }
): IntakeLogRow {
   const owner = (row as IntakeLogRow & { user_id?: string }).user_id;
   if (owner !== undefined && owner !== input.user_id) {
      throw new Error('This operation ID belongs to another account.');
   }
   const sameTime = row.consumed_at_utc
      ? timestampMatches(row.consumed_at_utc, input.consumed_at_utc)
      : timestampMatches(row.consumed_at, input.consumed_at);
   if (row.amount !== input.amount || row.unit !== input.unit || row.consumable !== input.consumable || !sameTime) {
      throw new Error('This operation ID already belongs to a different intake entry.');
   }
   return row;
}

function timestampMatches(left: string, right: string): boolean {
   const leftTime = Date.parse(left);
   const rightTime = Date.parse(right);
   return Number.isFinite(leftTime) && Number.isFinite(rightTime) ? leftTime === rightTime : left === right;
}

function cloudIntakeTime(value: string): { localWall: string; utc: string } {
   const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
   if (!Number.isFinite(date.getTime())) throw new Error('Intake time must be a valid date.');
   const yyyy = date.getFullYear();
   const mm = String(date.getMonth() + 1).padStart(2, '0');
   const dd = String(date.getDate()).padStart(2, '0');
   const hh = String(date.getHours()).padStart(2, '0');
   const min = String(date.getMinutes()).padStart(2, '0');
   const ss = String(date.getSeconds()).padStart(2, '0');
   const milliseconds = date.getMilliseconds();
   return {
      localWall: `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}${milliseconds ? `.${String(milliseconds).padStart(3, '0')}` : ''}`,
      utc: date.toISOString()
   };
}

function normalizeCloudIntakeRow(row: IntakeLogRow): IntakeLogRow {
   // Legacy rows without the companion value remain byte-for-byte unchanged; their original zone is unknown.
   return row.consumed_at_utc ? { ...row, consumed_at: row.consumed_at_utc } : row;
}

function intakeTimestamp(value: string): number {
   // Legacy Postgres `timestamp without time zone` values use a space separator.
   // Replacing it with ISO's `T` keeps local-wall parsing portable in Hermes/Safari.
   return Date.parse(value.includes(' ') ? value.replace(' ', 'T') : value);
}

export async function updateIntakeLogDB(params: {
   id: string; amount: number; unit?: string; consumed_at?: string;
}) {
   const { client, userId } = await connection();
   const { id, amount, unit, consumed_at } = params;
   const time = consumed_at !== undefined ? cloudIntakeTime(consumed_at) : undefined;
   const changes = { amount, ...(unit !== undefined ? { unit } : {}),
      ...(time ? { consumed_at: time.localWall, consumed_at_utc: time.utc } : {}) };
   const { data, error } = await client.from('intake_log').update(changes)
      .eq('id', id).eq('user_id', userId).select().single();
   if (error) throw error;
   return normalizeCloudIntakeRow(data as IntakeLogRow);
}

export async function deleteIntakeLogDB(id: string) {
   const { client, userId } = await connection();
   const { data, error } = await client.from('intake_log').delete()
      .eq('id', id).eq('user_id', userId).select('consumable').single();
   if (error) throw error;
   return data.consumable as string;
}

export async function fetchSettingsDB() {
   const { client, userId } = await connection();
   const { data, error } = await client.from('user_settings').select('*')
      .eq('user_id', userId).maybeSingle();
   if (error) throw error;
   return data ? settingsRow(data) : null;
}

export async function insertSettingsDB(params: {
   name: string; height: number; weight: number; sex: string;
}) {
   const { client, userId } = await connection();
   const { data, error } = await client.from('user_settings')
      .insert({ ...params, user_id: userId }).select().single();
   if (error) throw error;
   return settingsRow(data);
}

export async function updateSettingsDB(params: Omit<UserSettingsRow, 'id'>) {
   const { client, userId } = await connection();
   // Only profile fields are writable; ownership always comes from the session.
   const { name, height, weight, sex, drink_unit, supplement_unit,
      water_goal, creatine_goal, creatine_reminder_time } = params;
   const { data, error } = await client.from('user_settings').update({
      name, height, weight, sex, drink_unit, supplement_unit,
      water_goal, creatine_goal, creatine_reminder_time
   }).eq('user_id', userId).select().single();
   if (error) throw error;
   return settingsRow(data);
}

export async function updateCreatineReminderTimeDB(creatineReminderTime: string) {
   const { client, userId } = await connection();
   const { data, error } = await client.from('user_settings')
      .update({ creatine_reminder_time: creatineReminderTime })
      .eq('user_id', userId).select().single();
   if (error) throw error;
   return settingsRow(data);
}
