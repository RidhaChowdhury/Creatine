/// <reference types="jest" />
import { openDatabaseAsync } from 'expo-sqlite';
import { insertIntakeLog } from '../database';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'generated-id') }));

const openDb = openDatabaseAsync as jest.Mock;
let rows: Map<string, Record<string, unknown>>;
const database: { runAsync: jest.Mock; getFirstAsync: jest.Mock } = {
   runAsync: jest.fn(), getFirstAsync: jest.fn()
};

beforeEach(() => {
   jest.clearAllMocks();
   rows = new Map();
   database.runAsync.mockImplementation(async (_sql: string, values: unknown[]) => {
      const [id, amount, unit, consumable, consumed_at, logged_at] = values;
      if (rows.has(String(id))) throw new Error('UNIQUE constraint failed: intake_log.id');
      rows.set(String(id), { id, amount, unit, consumable, consumed_at, logged_at });
   });
   database.getFirstAsync.mockImplementation(async (_sql: string, values: unknown[]) => rows.get(String(values[0])) ?? null);
   openDb.mockResolvedValue(database);
});

it('returns the original local water row when the same operation ID is retried', async () => {
   const input = {
      operationId: 'operation-water-1', amount: 10, unit: 'oz', consumable: 'water',
      consumed_at: '2026-10-01 12:00:00'
   };
   const first = await insertIntakeLog(input);
   const retry = await insertIntakeLog(input);

   expect(first.id).toBe('operation-water-1');
   expect(retry).toEqual(first);
   expect(rows.size).toBe(1);
   expect(database.runAsync).toHaveBeenCalledTimes(1);
});

it('rejects reusing a local operation ID with a different payload', async () => {
   const input = {
      operationId: 'operation-creatine-1', amount: 5, unit: 'g', consumable: 'creatine',
      consumed_at: '2026-10-01 12:00:00'
   };
   await insertIntakeLog(input);
   await expect(insertIntakeLog({ ...input, amount: 8 })).rejects.toThrow('different intake entry');
   expect(rows.get(input.operationId)?.amount).toBe(5);
   expect(database.runAsync).toHaveBeenCalledTimes(1);
});
