import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

// ---- Types ----

export type IntakeLogRow = {
   id: string;
   amount: number;
   unit: string;
   consumable: string;
   consumed_at: string;
   consumed_at_utc?: string | null;
   logged_at: string;
};

export type UserSettingsRow = {
   id: number | string;
   name: string;
   height: number;
   weight: number;
   sex: string;
   drink_unit: string;
   supplement_unit: string;
   water_goal: number;
   creatine_goal: number;
   creatine_reminder_time: string | null;
};

// ---- Singleton DB handle ----

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
   if (!dbPromise) dbPromise = SQLite.openDatabaseAsync('creatine.db').catch(error => { dbPromise = null; throw error; });
   return dbPromise;
}

// ---- Schema initialization ----

export async function initializeDatabase(): Promise<void> {
   const database = await getDatabase();

   await database.execAsync(`
      CREATE TABLE IF NOT EXISTS intake_log (
         id TEXT PRIMARY KEY NOT NULL,
         amount REAL NOT NULL,
         unit TEXT NOT NULL,
         consumable TEXT NOT NULL,
         consumed_at TEXT NOT NULL,
         logged_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS user_settings (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT NOT NULL,
         height REAL NOT NULL,
         weight REAL NOT NULL,
         sex TEXT NOT NULL,
         drink_unit TEXT NOT NULL DEFAULT 'oz',
         supplement_unit TEXT NOT NULL DEFAULT 'g',
         water_goal REAL NOT NULL DEFAULT 0,
         creatine_goal REAL NOT NULL DEFAULT 0,
         creatine_reminder_time TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_intake_consumable_date
         ON intake_log (consumable, consumed_at);
   `);
}

// ---- Helpers ----

function nowLocal(): string {
   const d = new Date();
   const yyyy = d.getFullYear();
   const mm = String(d.getMonth() + 1).padStart(2, '0');
   const dd = String(d.getDate()).padStart(2, '0');
   const hh = String(d.getHours()).padStart(2, '0');
   const min = String(d.getMinutes()).padStart(2, '0');
   const ss = String(d.getSeconds()).padStart(2, '0');
   return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

// ---- Intake Log Operations ----

export async function fetchDrinkLogsDB(
   drinkTypes: readonly string[],
   since: string
): Promise<IntakeLogRow[]> {
   const database = await getDatabase();
   const placeholders = drinkTypes.map(() => '?').join(', ');
   return database.getAllAsync<IntakeLogRow>(
      `SELECT * FROM intake_log
       WHERE consumable IN (${placeholders})
         AND consumed_at >= ?
       ORDER BY consumed_at DESC`,
      [...drinkTypes, since]
   );
}

export async function fetchCreatineLogsDB(since: string): Promise<IntakeLogRow[]> {
   const database = await getDatabase();
   return database.getAllAsync<IntakeLogRow>(
      `SELECT * FROM intake_log
       WHERE consumable = ?
         AND consumed_at >= ?
       ORDER BY consumed_at DESC`,
      ['creatine', since]
   );
}

export async function insertIntakeLog(params: {
   id?: string;
   operationId?: string;
   amount: number;
   unit: string;
   consumable: string;
   consumed_at: string;
}): Promise<IntakeLogRow> {
   const database = await getDatabase();
   if (params.id && params.operationId && params.id !== params.operationId) {
      throw new Error('Conflicting intake operation IDs were supplied.');
   }
   const operationId = params.operationId ?? params.id;
   if (operationId !== undefined && !operationId.trim()) throw new Error('Operation ID must not be empty.');
   const id = operationId ?? Crypto.randomUUID();
   const logged_at = nowLocal();

   const readExisting = () => database.getFirstAsync<IntakeLogRow>(
      'SELECT * FROM intake_log WHERE id = ?', [id]
   );
   const existing = operationId ? await readExisting() : null;
   if (existing) return matchIdempotentIntakeLog(existing, params);

   try {
      await database.runAsync(
         `INSERT INTO intake_log (id, amount, unit, consumable, consumed_at, logged_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
         [id, params.amount, params.unit, params.consumable, params.consumed_at, logged_at]
      );
   } catch (insertError) {
      // Concurrent retries can both miss the initial lookup; resolve the unique-ID race safely.
      if (operationId) {
         const concurrent = await readExisting();
         if (concurrent) return matchIdempotentIntakeLog(concurrent, params);
      }
      throw insertError;
   }

   const row = await readExisting();
   return row!;
}

function matchIdempotentIntakeLog(
   row: IntakeLogRow,
   input: { amount: number; unit: string; consumable: string; consumed_at: string }
): IntakeLogRow {
   const sameTime = timestampMatches(row.consumed_at, input.consumed_at);
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

export async function updateIntakeLogDB(params: {
   id: string;
   amount: number;
   unit?: string;
   consumed_at?: string;
}): Promise<IntakeLogRow> {
   const database = await getDatabase();

   const setClauses: string[] = ['amount = ?'];
   const values: (string | number)[] = [params.amount];

   if (params.unit) {
      setClauses.push('unit = ?');
      values.push(params.unit);
   }
   if (params.consumed_at) {
      setClauses.push('consumed_at = ?');
      values.push(params.consumed_at);
   }

   values.push(params.id);

   await database.runAsync(
      `UPDATE intake_log SET ${setClauses.join(', ')} WHERE id = ?`,
      values
   );

   const row = await database.getFirstAsync<IntakeLogRow>(
      'SELECT * FROM intake_log WHERE id = ?',
      [params.id]
   );
   return row!;
}

export async function deleteIntakeLogDB(id: string): Promise<string> {
   const database = await getDatabase();

   const row = await database.getFirstAsync<{ consumable: string }>(
      'SELECT consumable FROM intake_log WHERE id = ?',
      [id]
   );

   if (!row) {
      throw new Error(`Intake log with id ${id} not found`);
   }

   await database.runAsync('DELETE FROM intake_log WHERE id = ?', [id]);
   return row.consumable;
}

// ---- User Settings Operations ----

export async function fetchSettingsDB(): Promise<UserSettingsRow | null> {
   const database = await getDatabase();
   const row = await database.getFirstAsync<UserSettingsRow>(
      'SELECT * FROM user_settings LIMIT 1'
   );
   return row ?? null;
}

export async function insertSettingsDB(params: {
   name: string;
   height: number;
   weight: number;
   sex: string;
}): Promise<UserSettingsRow> {
   const database = await getDatabase();

   await database.runAsync(
      `INSERT INTO user_settings (name, height, weight, sex)
       VALUES (?, ?, ?, ?)`,
      [params.name, params.height, params.weight, params.sex]
   );

   const row = await database.getFirstAsync<UserSettingsRow>(
      'SELECT * FROM user_settings ORDER BY id DESC LIMIT 1'
   );
   return row!;
}

export async function updateSettingsDB(
   params: Omit<UserSettingsRow, 'id'>
): Promise<UserSettingsRow> {
   const database = await getDatabase();

   await database.runAsync(
      `UPDATE user_settings SET
         name = ?,
         height = ?,
         weight = ?,
         sex = ?,
         drink_unit = ?,
         supplement_unit = ?,
         water_goal = ?,
         creatine_goal = ?,
         creatine_reminder_time = ?
       WHERE id = (SELECT id FROM user_settings LIMIT 1)`,
      [
         params.name,
         params.height,
         params.weight,
         params.sex,
         params.drink_unit,
         params.supplement_unit,
         params.water_goal,
         params.creatine_goal,
         params.creatine_reminder_time
      ]
   );

   const row = await database.getFirstAsync<UserSettingsRow>(
      'SELECT * FROM user_settings LIMIT 1'
   );
   return row!;
}

export async function updateCreatineReminderTimeDB(
   creatineReminderTime: string
): Promise<UserSettingsRow> {
   const database = await getDatabase();

   await database.runAsync(
      `UPDATE user_settings SET creatine_reminder_time = ?
       WHERE id = (SELECT id FROM user_settings LIMIT 1)`,
      [creatineReminderTime]
   );

   const row = await database.getFirstAsync<UserSettingsRow>(
      'SELECT * FROM user_settings LIMIT 1'
   );
   return row!;
}
