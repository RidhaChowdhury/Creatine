/// <reference types="jest" />
import { deleteIntakeLogDB, insertIntakeLog } from '../data';
import { deleteDose, fetchTrackerHistory, logDose, saveTracker, selectPrimaryTracker } from '../trackers';
import {
   deleteTrackerEntry,
   insertTrackerEntry,
   listTrackerRows,
   saveTrackerRow,
   selectPrimaryTrackerRow
} from '../trackerDatabase';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'generated-entry-id') }));
jest.mock('../supabase', () => ({ supabase: null }));
jest.mock('../data', () => ({
   fetchCreatineLogsDB: jest.fn(),
   insertIntakeLog: jest.fn(),
   deleteIntakeLogDB: jest.fn()
}));
jest.mock('../trackerDatabase', () => ({
   deleteTrackerEntry: jest.fn(),
   fetchTrackerEntryRows: jest.fn(),
   getPrimaryTrackerRow: jest.fn(),
   insertTrackerEntry: jest.fn(),
   isTrackerSchemaMissing: jest.fn(),
   listTrackerRows: jest.fn(),
   migrationRequiredError: jest.fn(() => new Error('Apply the additive tracker migration.')),
   saveTrackerRow: jest.fn(),
   selectPrimaryTrackerRow: jest.fn(),
   initializeTrackerDatabase: jest.fn()
}));

beforeEach(() => jest.clearAllMocks());

it('routes creatine dose logging through the legacy intake adapter and preserves its undo ID', async () => {
   const { fetchCreatineLogsDB } = jest.requireMock('../data') as { fetchCreatineLogsDB: jest.Mock };
   (insertIntakeLog as jest.Mock).mockResolvedValue({
      id: 'legacy-creatine-row', amount: 5, unit: 'g', consumable: 'creatine',
      consumed_at: '2026-10-01 12:00:00', logged_at: '2026-10-01 12:00:00'
   });
   fetchCreatineLogsDB.mockResolvedValue([{ id: 'legacy-creatine-row' }]);
   (deleteIntakeLogDB as jest.Mock).mockResolvedValue('creatine');
   const entry = await logDose({ trackerId: 'builtin:creatine', amount: 5, unit: 'g' });

   expect(insertIntakeLog).toHaveBeenCalledWith(expect.objectContaining({
      amount: 5, unit: 'g', consumable: 'creatine'
   }));
   expect(entry.id).toBe('legacy-creatine-row');
   expect(entry.trackerId).toBe('builtin:creatine');
   await deleteDose(entry.trackerId, entry.id);
   expect(deleteIntakeLogDB).toHaveBeenCalledWith('legacy-creatine-row');
});

it('rejects invalid doses before writing', async () => {
   await expect(logDose({ trackerId: 'builtin:creatine', amount: Infinity })).rejects.toThrow('positive finite');
   expect(insertIntakeLog).not.toHaveBeenCalled();
});

it('returns an exact undo error if the legacy intake ID is not creatine', async () => {
   const { fetchCreatineLogsDB } = jest.requireMock('../data') as { fetchCreatineLogsDB: jest.Mock };
   fetchCreatineLogsDB.mockResolvedValue([]);
   await expect(deleteDose('builtin:creatine', 'water-row')).rejects.toThrow('not found');
   expect(deleteIntakeLogDB).not.toHaveBeenCalled();
});

it.each([
   {
      id: 'supplement-1', name: 'Electrolyte blend', unit: 'scoops', saved_dose: 1.25,
      category: 'supplement' as const, builtin_key: null, amount: 1.25
   },
   {
      id: 'medication-1', name: 'Prescription tablet', unit: 'tablets', saved_dose: null,
      category: 'medication' as const, builtin_key: null, amount: 1
   }
])('saves and logs a user-defined $category with its exact unit and entry snapshot', async (row) => {
   (saveTrackerRow as jest.Mock).mockResolvedValue(row);
   (listTrackerRows as jest.Mock).mockResolvedValue([row]);
   (insertTrackerEntry as jest.Mock).mockImplementation(async (input) => ({
      id: input.id, tracker_id: input.trackerId, name: input.name, unit: input.unit,
      amount: input.amount, consumed_at: input.consumedAt
   }));

   const tracker = await saveTracker({
      id: row.id, name: row.name, unit: row.unit, savedDose: row.saved_dose, category: row.category
   });
   const entry = await logDose({ trackerId: tracker.id, amount: row.amount, operationId: `${row.id}-op` });

   expect(tracker).toMatchObject({ id: row.id, unit: row.unit, category: row.category });
   expect(entry).toMatchObject({
      id: `${row.id}-op`, trackerId: row.id, name: row.name, unit: row.unit, amount: row.amount
   });
   expect(insertTrackerEntry).toHaveBeenCalledWith(expect.objectContaining({
      id: `${row.id}-op`, trackerId: row.id, name: row.name, unit: row.unit, amount: row.amount
   }));
});

it('persists the selected primary tracker ID', async () => {
   (selectPrimaryTrackerRow as jest.Mock).mockResolvedValue('medication-1');
   await expect(selectPrimaryTracker('medication-1')).resolves.toBe('medication-1');
   expect(selectPrimaryTrackerRow).toHaveBeenCalledWith('medication-1');
});

it('keeps built-in creatine metadata in supported mass units and the supplement category', async () => {
   await expect(saveTracker({
      id: 'builtin:creatine', name: 'Creatine', unit: 'capsules', savedDose: 5, category: 'supplement'
   })).rejects.toThrow('Creatine uses g or mg');
   await expect(saveTracker({
      id: 'builtin:creatine', name: 'Creatine', unit: 'g', savedDose: null, category: 'medication'
   })).rejects.toThrow('Creatine uses g or mg');
   expect(saveTrackerRow).not.toHaveBeenCalled();
});

it('deletes the exact generic entry ID supplied for undo', async () => {
   await deleteDose('supplement-1', 'entry-row-2');
   expect(deleteTrackerEntry).toHaveBeenCalledWith('supplement-1', 'entry-row-2');
});

it('reuses a stable operation ID when a generic dose is retried', async () => {
   const row = {
      id: 'supplement-1', name: 'Electrolyte blend', unit: 'scoops', saved_dose: 1.25,
      category: 'supplement' as const, builtin_key: null
   };
   (listTrackerRows as jest.Mock).mockResolvedValue([row]);
   (insertTrackerEntry as jest.Mock).mockImplementation(async (input) => ({
      id: input.id, tracker_id: input.trackerId, name: input.name, unit: input.unit,
      amount: input.amount, consumed_at: input.consumedAt
   }));

   const payload = { trackerId: row.id, amount: 1.25, consumedAt: '2026-10-01 12:00:00', operationId: 'stable-op-42' };
   const first = await logDose(payload);
   const retry = await logDose(payload);

   expect(first.id).toBe('stable-op-42');
   expect(retry.id).toBe(first.id);
   expect(insertTrackerEntry).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: first.id }));
   expect(insertTrackerEntry).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: first.id }));
});

it('starts the default history window at local midnight 29 days before today', async () => {
   const { fetchCreatineLogsDB } = jest.requireMock('../data') as { fetchCreatineLogsDB: jest.Mock };
   jest.useFakeTimers().setSystemTime(new Date(2026, 9, 1, 14, 30, 0));
   fetchCreatineLogsDB.mockResolvedValue([]);
   await fetchTrackerHistory('builtin:creatine');
   expect(fetchCreatineLogsDB).toHaveBeenCalledWith('2026-09-02 00:00:00');
   jest.useRealTimers();
});
