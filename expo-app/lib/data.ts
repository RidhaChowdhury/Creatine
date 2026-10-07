import * as local from './database';
import * as cloud from './cloudDatabase';
import { supabase } from './supabase';

// A configured cloud backend never silently falls back to browser-only data.
const backend = supabase ? cloud : local;
export const fetchDrinkLogsDB = backend.fetchDrinkLogsDB;
export const fetchCreatineLogsDB = backend.fetchCreatineLogsDB;
export const insertIntakeLog = backend.insertIntakeLog;
export const updateIntakeLogDB = backend.updateIntakeLogDB;
export const deleteIntakeLogDB = backend.deleteIntakeLogDB;
export const fetchSettingsDB = backend.fetchSettingsDB;
export const insertSettingsDB = backend.insertSettingsDB;
export const updateSettingsDB = backend.updateSettingsDB;
export const updateCreatineReminderTimeDB = backend.updateCreatineReminderTimeDB;
export async function initializeDatabase() {
   if (!supabase) await local.initializeDatabase();
}
