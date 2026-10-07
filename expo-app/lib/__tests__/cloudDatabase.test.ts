/// <reference types="jest" />
import { supabase } from '../supabase';
import { fetchDrinkLogsDB, fetchSettingsDB, updateIntakeLogDB, insertIntakeLog } from '../cloudDatabase';

jest.mock('../supabase', () => ({
   supabase: { auth: { getSession: jest.fn() }, from: jest.fn() }
}));

const client = supabase as unknown as {
   auth: { getSession: jest.Mock }; from: jest.Mock;
};
let query: Record<string, jest.Mock>;
beforeEach(() => {
   jest.clearAllMocks();
   query = {};
   for (const method of ['select', 'eq', 'update', 'insert', 'in', 'gte', 'or', 'order']) {
      query[method] = jest.fn().mockImplementation(() => query);
   }
   query.single = jest.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null });
   query.maybeSingle = jest.fn().mockResolvedValue({ data: { user_id: 'account-1', name: 'Test' }, error: null });
   client.from.mockReturnValue(query);
   client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'account-1' } } }, error: null });
});

it('requires a login before reading or writing cloud data', async () => {
   client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
   await expect(fetchSettingsDB()).rejects.toThrow('Please sign in');
   expect(client.from).not.toHaveBeenCalled();
});

it('loads the existing user_id-based profile schema', async () => {
   const row = await fetchSettingsDB();
   expect(query.eq).toHaveBeenCalledWith('user_id', 'account-1');
   expect(row).toEqual({ id: 'account-1', name: 'Test' });
});

it('uses the signed-in owner when logging intake', async () => {
   await insertIntakeLog({ amount: 8, unit: 'oz', consumable: 'water', consumed_at: '2026-10-01 12:00:00',
      user_id: 'another-account' } as Parameters<typeof insertIntakeLog>[0]);
   expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'account-1' }));
});

it('restricts updates to the signed-in owner and allowed fields', async () => {
   await updateIntakeLogDB({ id: 'log-1', amount: 12, user_id: 'another-account' } as Parameters<typeof updateIntakeLogDB>[0]);
   expect(query.update).toHaveBeenCalledWith({ amount: 12 });
   expect(query.eq).toHaveBeenCalledWith('id', 'log-1');
   expect(query.eq).toHaveBeenCalledWith('user_id', 'account-1');
});

it('preserves local-wall timestamps in legacy cloud filters and updates', async () => {
   const localWall = '2026-10-01 12:00:00';
   await fetchDrinkLogsDB(['water'], localWall);
   const expectedUtc = new Date('2026-10-01T12:00:00').toISOString();
   expect(query.or).toHaveBeenCalledWith(
      `consumed_at_utc.gte.${expectedUtc},and(consumed_at_utc.is.null,consumed_at.gte.${localWall})`
   );

   await updateIntakeLogDB({ id: 'log-1', amount: 12, consumed_at: localWall });
   expect(query.update).toHaveBeenCalledWith({
      amount: 12, consumed_at: localWall, consumed_at_utc: expectedUtc
   });
});

it('returns edited rows with canonical UTC time from companion metadata', async () => {
   const utc = '2026-10-02T03:27:00.000Z';
   query.single.mockResolvedValue({ data: {
      id: 'log-utc', amount: 12, unit: 'oz', consumable: 'water',
      consumed_at: '2026-10-01 22:27:00', consumed_at_utc: utc, user_id: 'account-1'
   }, error: null });

   const updated = await updateIntakeLogDB({ id: 'log-utc', amount: 12 });

   expect(updated.consumed_at).toBe(utc);
});

it('surfaces a database rejection instead of claiming a successful save', async () => {
   const error = { message: 'Permission denied' };
   query.single.mockResolvedValue({ data: null, error });
   await expect(insertIntakeLog({ amount: 8, unit: 'oz', consumable: 'water',
      consumed_at: '2026-10-01 12:00:00' })).rejects.toEqual(error);
});

it('writes ISO picker timestamps as local wall time for timestamp-without-time-zone columns', async () => {
   const consumedAt = new Date(2026, 9, 1, 22, 27, 0).toISOString();
   const expectedWall = '2026-10-01 22:27:00';
   const expectedUtc = consumedAt;
   const row = {
      id: 'operation-1', amount: 8, unit: 'oz', consumable: 'water', consumed_at: expectedUtc,
      consumed_at_utc: expectedUtc, logged_at: new Date().toISOString(), user_id: 'account-1'
   };
   query.maybeSingle.mockResolvedValue({ data: null, error: null });
   query.single.mockResolvedValue({ data: row, error: null });
   const result = await insertIntakeLog({
      operationId: 'operation-1', amount: 8, unit: 'oz', consumable: 'water', consumed_at: consumedAt
   });

   expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'operation-1', user_id: 'account-1', consumed_at: expectedWall, consumed_at_utc: expectedUtc
   }));
   expect(result).toEqual(row);
});

it('uses repaired UTC metadata for duplicate retries while preserving uncorrected legacy timestamps', async () => {
   const expectedUtc = new Date('2026-10-01T22:27:00').toISOString();
   const row = {
      id: 'operation-evening', amount: 8, unit: 'oz', consumable: 'water',
      consumed_at: '2026-10-02 03:27:00', consumed_at_utc: expectedUtc,
      logged_at: expectedUtc, user_id: 'account-1'
   };
   query.maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null });
   const result = await insertIntakeLog({
      operationId: 'operation-evening', amount: 8, unit: 'oz', consumable: 'water',
      consumed_at: new Date('2026-10-01T22:27:00').toISOString()
   });
   expect(result.consumed_at).toBe(expectedUtc);
   expect(query.insert).not.toHaveBeenCalled();

   const legacy = {
      id: 'legacy-row', amount: 12, unit: 'oz', consumable: 'water',
      consumed_at: '2025-07-04 22:30:00', consumed_at_utc: null, logged_at: '2025-07-05T03:30:00Z'
   };
   query.or.mockResolvedValue({ data: [legacy], error: null });
   const rows = await fetchDrinkLogsDB(['water'], '2025-07-01 00:00:00');
   expect(rows[0].consumed_at).toBe(legacy.consumed_at);
});

it('sorts mixed repaired and legacy rows by normalized consumed time', async () => {
   const earlyUtc = '2026-10-01T00:00:00.000Z';
   const lateUtc = '2026-10-02T03:27:00.000Z';
   query.or.mockResolvedValue({ data: [
      { id: 'new-late', consumed_at: '2026-10-02 03:27:00', consumed_at_utc: lateUtc },
      { id: 'legacy-mid', consumed_at: '2026-10-01 12:30:00', consumed_at_utc: null },
      { id: 'new-early', consumed_at: '2026-10-01 15:00:00', consumed_at_utc: earlyUtc }
   ], error: null });

   const rows = await fetchDrinkLogsDB(['water'], '2026-10-01 00:00:00');

   expect(rows.map(row => row.id)).toEqual(['new-late', 'legacy-mid', 'new-early']);
   expect(rows[0].consumed_at).toBe(lateUtc);
   expect(rows[1].consumed_at).toBe('2026-10-01 12:30:00');
   expect(rows[2].consumed_at).toBe(earlyUtc);
});

it('returns the same owner row for a duplicate cloud operation ID', async () => {
   const row = {
      id: 'operation-2', amount: 5, unit: 'g', consumable: 'creatine',
      consumed_at: new Date('2026-10-01T12:00:00').toISOString(), logged_at: '2026-10-01T17:00:00.000Z', user_id: 'account-1'
   };
   query.maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null });
   const result = await insertIntakeLog({
      operationId: 'operation-2', amount: 5, unit: 'g', consumable: 'creatine', consumed_at: '2026-10-01 12:00:00'
   });

   expect(query.eq).toHaveBeenCalledWith('id', 'operation-2');
   expect(query.eq).toHaveBeenCalledWith('user_id', 'account-1');
   expect(query.insert).not.toHaveBeenCalled();
   expect(result).toEqual(row);
});

it('rejects a cloud operation ID reused with a mismatched payload', async () => {
   query.maybeSingle = jest.fn().mockResolvedValue({ data: {
      id: 'operation-3', amount: 4, unit: 'oz', consumable: 'water',
      consumed_at: new Date('2026-10-01T12:00:00').toISOString(), user_id: 'account-1'
   }, error: null });
   await expect(insertIntakeLog({
      operationId: 'operation-3', amount: 8, unit: 'oz', consumable: 'water', consumed_at: '2026-10-01 12:00:00'
   })).rejects.toThrow('different intake entry');
   expect(query.insert).not.toHaveBeenCalled();
});

it('resolves a concurrent cloud insert conflict by reading the identical owner row', async () => {
   const row = {
      id: 'operation-4', amount: 8, unit: 'oz', consumable: 'water',
      consumed_at: new Date('2026-10-01T12:00:00').toISOString(), user_id: 'account-1'
   };
   query.maybeSingle = jest.fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: row, error: null });
   query.single.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } });

   const result = await insertIntakeLog({
      operationId: 'operation-4', amount: 8, unit: 'oz', consumable: 'water', consumed_at: '2026-10-01 12:00:00'
   });

   expect(query.insert).toHaveBeenCalledTimes(1);
   expect(result).toEqual(row);
});
