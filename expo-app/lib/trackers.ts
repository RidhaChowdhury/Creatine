import * as Crypto from 'expo-crypto';
import {
   deleteTrackerEntry,
   fetchTrackerEntryRows,
   getPrimaryTrackerRow,
   insertTrackerEntry,
   isTrackerSchemaMissing,
   listTrackerRows,
   migrationRequiredError,
   saveTrackerRow,
   selectPrimaryTrackerRow,
   initializeTrackerDatabase,
   type TrackerCategory,
   type TrackerRow
} from './trackerDatabase';
import { fetchCreatineLogsDB, insertIntakeLog, deleteIntakeLogDB } from './data';
import { supabase } from './supabase';

export type Tracker = {
   id: string;
   name: string;
   unit: string;
   savedDose: number | null;
   category: TrackerCategory;
};

export type DoseEntry = {
   id: string;
   trackerId: string;
   name: string;
   unit: string;
   amount: number;
   consumedAt: string;
};

export type SaveTrackerInput = {
   id?: string;
   name: string;
   unit: string;
   savedDose: number | null;
   category: TrackerCategory;
};

export type LogDoseInput = {
   trackerId: string;
   amount: number;
   unit?: string;
   consumedAt?: string;
   operationId?: string;
};

const CREATINE_ID = 'builtin:creatine';
const DEFAULT_HISTORY_DAYS = 30;

function fromRow(row: TrackerRow): Tracker {
   return { id: row.id, name: row.name, unit: row.unit, savedDose: row.saved_dose, category: row.category };
}

function dateTimeNow(): string {
   if (supabase) return new Date().toISOString();
   const date = new Date();
   const yyyy = date.getFullYear();
   const mm = String(date.getMonth() + 1).padStart(2, '0');
   const dd = String(date.getDate()).padStart(2, '0');
   const hh = String(date.getHours()).padStart(2, '0');
   const min = String(date.getMinutes()).padStart(2, '0');
   const ss = String(date.getSeconds()).padStart(2, '0');
   return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function thirtyDaysAgo(): string {
   const date = new Date();
   date.setHours(0, 0, 0, 0);
   date.setDate(date.getDate() - (DEFAULT_HISTORY_DAYS - 1));
   return supabase ? date.toISOString() : dateTime(date);
}

function dateTime(date: Date): string {
   const yyyy = date.getFullYear();
   const mm = String(date.getMonth() + 1).padStart(2, '0');
   const dd = String(date.getDate()).padStart(2, '0');
   const hh = String(date.getHours()).padStart(2, '0');
   const min = String(date.getMinutes()).padStart(2, '0');
   const ss = String(date.getSeconds()).padStart(2, '0');
   return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export { initializeTrackerDatabase };

export async function listTrackers(): Promise<Tracker[]> {
   return (await listTrackerRows()).map(fromRow);
}

export async function saveTracker(input: SaveTrackerInput): Promise<Tracker> {
   if (input.id === CREATINE_ID && (input.category !== 'supplement' || !['g', 'mg'].includes(input.unit.trim()))) {
      throw new Error('Creatine uses g or mg and must stay in the supplement category.');
   }
   return fromRow(await saveTrackerRow(input));
}

export async function selectPrimaryTracker(id: string | null): Promise<string | null> {
   return selectPrimaryTrackerRow(id);
}

export async function getPrimaryTrackerId(): Promise<string | null> {
   try {
      return await getPrimaryTrackerRow();
   } catch (error) {
      // Old cloud installs can still open the legacy creatine tracker while the additive migration is pending.
      if (supabase && isTrackerSchemaMissing(error)) return null;
      throw error;
   }
}

export async function logDose(input: LogDoseInput): Promise<DoseEntry> {
   if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Dose must be a positive finite number.');
   }
   const consumedAt = input.consumedAt ?? dateTimeNow();
   if (input.trackerId === CREATINE_ID) {
      const unit = input.unit ?? 'g';
      if (!['g', 'mg'].includes(unit)) throw new Error('Creatine doses use g or mg.');
      const row = await insertIntakeLog({
         ...(input.operationId ? { operationId: input.operationId } : {}),
         amount: input.amount, unit, consumable: 'creatine', consumed_at: consumedAt
      });
      return {
         id: row.id, trackerId: CREATINE_ID, name: 'Creatine', unit: row.unit,
         amount: row.amount, consumedAt: row.consumed_at
      };
   }
   const trackers = await listTrackers();
   const tracker = trackers.find((item) => item.id === input.trackerId);
   if (!tracker) {
      if (supabase && trackers.some((item) => item.id === CREATINE_ID)) throw migrationRequiredError();
      throw new Error('That tracker no longer exists.');
   }
   const row = await insertTrackerEntry({
      trackerId: tracker.id, id: input.operationId ?? Crypto.randomUUID(), name: tracker.name,
      unit: tracker.unit, amount: input.amount, consumedAt
   });
   return {
      id: row.id, trackerId: row.tracker_id, name: row.name, unit: row.unit,
      amount: row.amount, consumedAt: row.consumed_at
   };
}

export async function deleteDose(trackerId: string, id: string): Promise<void> {
   if (trackerId === CREATINE_ID) {
      const existing = await fetchCreatineLogsDB('0001-01-01 00:00:00');
      if (!existing.some((row) => row.id === id)) throw new Error('Dose entry was not found.');
      const consumable = await deleteIntakeLogDB(id);
      if (consumable !== 'creatine') throw new Error('That dose entry is not creatine.');
      return;
   }
   await deleteTrackerEntry(trackerId, id);
}

export async function fetchTrackerHistory(trackerId: string, since = thirtyDaysAgo()): Promise<DoseEntry[]> {
   if (trackerId === CREATINE_ID) {
      const rows = await fetchCreatineLogsDB(since);
      return rows.map((row) => ({
         id: row.id, trackerId: CREATINE_ID, name: 'Creatine', unit: row.unit,
         amount: row.amount, consumedAt: row.consumed_at
      }));
   }
   const rows = await fetchTrackerEntryRows(trackerId, since);
   return rows.map((row) => ({
      id: row.id, trackerId: row.tracker_id, name: row.name, unit: row.unit,
      amount: row.amount, consumedAt: row.consumed_at
   }));
}
