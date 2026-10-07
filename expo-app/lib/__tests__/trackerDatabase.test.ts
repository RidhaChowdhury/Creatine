/// <reference types="jest" />
import { supabase } from '../supabase';
import {
   insertTrackerEntry,
   isTrackerSchemaMissing,
   getPrimaryTrackerRow,
   listTrackerRows,
   migrationRequiredError,
   selectPrimaryTrackerRow
} from '../trackerDatabase';

jest.mock('../supabase', () => ({
   supabase: { auth: { getSession: jest.fn() }, from: jest.fn() }
}));

const client = supabase as unknown as {
   auth: { getSession: jest.Mock };
   from: jest.Mock;
};
let query: Record<string, jest.Mock>;

beforeEach(() => {
   jest.clearAllMocks();
   query = {};
   for (const method of ['select', 'eq', 'upsert', 'maybeSingle', 'single']) {
      query[method] = jest.fn().mockImplementation(() => query);
   }
   client.from.mockReturnValue(query);
   client.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'account-1' } } }, error: null
   });
});

it('returns only the legacy creatine catalog when the additive cloud schema is missing', async () => {
   query.eq.mockResolvedValue({ data: null, error: {
      code: 'PGRST205', message: 'Could not find the table public.tracked_items in the schema cache'
   } });

   const trackers = await listTrackerRows();

   expect(trackers).toEqual([expect.objectContaining({
      id: 'builtin:creatine', name: 'Creatine', saved_dose: 5, unit: 'g'
   })]);
   expect(client.from).toHaveBeenCalledWith('tracked_items');
   expect(query.eq).toHaveBeenCalledWith('user_id', 'account-1');
   expect(query.upsert).not.toHaveBeenCalled();
});

it('identifies missing tracker tables so generic writes can show migration guidance', () => {
   expect(isTrackerSchemaMissing({ code: '42P01', message: 'relation does not exist' })).toBe(true);
   expect(isTrackerSchemaMissing({ code: 'PGRST205', message: 'tracker_preferences is not in the schema cache' })).toBe(true);
   expect(migrationRequiredError().message).toBe('Supplement storage is unavailable. Please retry after setup is complete.');
   expect(migrationRequiredError()).toMatchObject({ code: 'TRACKER_STORAGE_UNAVAILABLE' });
});

it('keeps a legacy cloud account bootable when the primary preference table is absent', async () => {
   query.maybeSingle.mockResolvedValue({ data: null, error: {
      code: 'PGRST205', message: 'Could not find the table public.tracker_preferences in the schema cache'
   } });
   await expect(getPrimaryTrackerRow()).resolves.toBeNull();
});

it('uses a stable entry operation ID for idempotent cloud retries and returns the original row', async () => {
   const original = {
      id: 'operation-42', tracker_id: 'medication-1', name: 'Prescription tablet', unit: 'tablets',
      amount: 1, consumed_at: '2026-10-01 12:00:00'
   };
   query.maybeSingle.mockResolvedValue({ data: null, error: null });
   query.single.mockResolvedValue({ data: original, error: null });

   const result = await insertTrackerEntry({
      id: 'operation-42', trackerId: 'medication-1', name: 'Prescription tablet',
      unit: 'tablets', amount: 1, consumedAt: '2026-10-01 12:00:00'
   });

   expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'operation-42', user_id: 'account-1', tracker_id: 'medication-1'
   }), { onConflict: 'user_id,id', ignoreDuplicates: true });
   expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'operation-42');
   expect(query.eq).toHaveBeenNthCalledWith(2, 'user_id', 'account-1');
   expect(result).toEqual(original);
});

it('rejects reusing a tracker operation ID with a different dose or unit', async () => {
   query.maybeSingle.mockResolvedValue({ data: null, error: null });
   query.single.mockResolvedValue({ data: {
      id: 'operation-43', tracker_id: 'medication-1', name: 'Prescription tablet', unit: 'tablets',
      amount: 1, consumed_at: '2026-10-01T12:00:00.000Z'
   }, error: null });

   await expect(insertTrackerEntry({
      id: 'operation-43', trackerId: 'medication-1', name: 'Prescription tablet',
      unit: 'mg', amount: 2, consumedAt: '2026-10-01 12:00:00'
   })).rejects.toThrow('different dose entry');
});

it('validates and persists the primary tracker for the signed-in owner', async () => {
   query.maybeSingle.mockResolvedValue({ data: { id: 'supplement-1' }, error: null });
   query.upsert.mockResolvedValue({ error: null });

   await expect(selectPrimaryTrackerRow('supplement-1')).resolves.toBe('supplement-1');

   expect(client.from).toHaveBeenNthCalledWith(1, 'tracked_items');
   expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'supplement-1');
   expect(query.eq).toHaveBeenNthCalledWith(2, 'user_id', 'account-1');
   expect(client.from).toHaveBeenNthCalledWith(2, 'tracker_preferences');
   expect(query.upsert).toHaveBeenCalledWith(
      { user_id: 'account-1', primary_tracker_id: 'supplement-1' }, { onConflict: 'user_id' }
   );
});
