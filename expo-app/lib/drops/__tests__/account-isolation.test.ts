jest.mock('@/lib/data', () => ({ fetchSettingsDB: jest.fn(), insertSettingsDB: jest.fn(), updateSettingsDB: jest.fn(), updateCreatineReminderTimeDB: jest.fn(), fetchDrinkLogsDB: jest.fn(), fetchCreatineLogsDB: jest.fn(), insertIntakeLog: jest.fn(), updateIntakeLogDB: jest.fn(), deleteIntakeLogDB: jest.fn() }));
jest.mock('@/lib/trackers', () => ({ listTrackers: jest.fn(), getPrimaryTrackerId: jest.fn(), fetchTrackerHistory: jest.fn(), saveTracker: jest.fn(), selectPrimaryTracker: jest.fn(), logDose: jest.fn(), deleteDose: jest.fn() }));
import { configureStore } from '@reduxjs/toolkit';
import settings, { fetchSettings, updateSettings, resetSettingsState, selectUserSettings } from '@/features/settings/settingsSlice';
import intake, { fetchDrinkLogs, fetchCreatineLogs, addDrinkLog, addCreatineLog, updateIntakeLog, deleteIntakeLog, resetIntakeState } from '@/features/intake/intakeSlice';
import trackers, { fetchTrackers, fetchTrackerHistory, saveTrackerThunk, setPrimaryTracker, addTrackerDose, deleteTrackerDose, resetTrackersState } from '@/features/trackers/trackersSlice';
import * as data from '@/lib/data';
import * as trackerDb from '@/lib/trackers';
import drops from '@/features/drops/dropsSlice';
const account = (name: string) => ({ name, height: 0, weight: 0, sex: '', drink_unit: 'oz', supplement_unit: 'g', water_goal: 64, creatine_goal: 5, creatine_reminder_time: null });
const log = { id: 'same-id', amount: 8, unit: 'oz', consumable: 'water' as const, consumed_at: '2026-10-04 10:00:00', logged_at: '2026-10-04 10:00:00' };
const tracker = { id: 't', name: 'New account', category: 'supplement' as const, unit: 'g', savedDose: 5, builtinKey: null } as any;
function deferred<T>() { let resolve!: (value: T) => void, reject!: (value: Error) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
const create = () => configureStore({ reducer: { settings, intake, trackers, drops } });
beforeEach(() => jest.clearAllMocks());
test('old actual settings fetch/mutation completions cannot overwrite newly loaded account', async () => {
  const store = create(), oldFetch = deferred<any>(), oldUpdate = deferred<any>();
  (data.fetchSettingsDB as jest.Mock).mockReturnValueOnce(oldFetch.promise).mockResolvedValueOnce({ id: 2, ...account('New') });
  (data.updateSettingsDB as jest.Mock).mockReturnValueOnce(oldUpdate.promise);
  const fetch = store.dispatch(fetchSettings()), mutation = store.dispatch(updateSettings({ formData: account('Old edited') }));
  store.dispatch(resetSettingsState()); await store.dispatch(fetchSettings());
  oldFetch.resolve({ id: 1, ...account('Old') }); oldUpdate.resolve({ id: 1, ...account('Old edited') }); await Promise.all([fetch, mutation]);
  expect(store.getState().settings.name).toBe('New'); expect(store.getState().settings.error).toBeNull();
  expect(selectUserSettings(store.getState() as any)).not.toHaveProperty('_pendingRequests');
});
test('all old intake fetch/add/update/delete completions and errors are ignored across reset', () => {
  let state = intake(undefined, { type: 'init' });
  const thunks = [fetchDrinkLogs, fetchCreatineLogs, addDrinkLog, addCreatineLog, updateIntakeLog, deleteIntakeLog] as any[];
  thunks.forEach((t, i) => { state = intake(state, t.pending(`old-${i}`, undefined)); });
  state = intake(state, resetIntakeState());
  state = intake(state, fetchDrinkLogs.pending('new', undefined)); state = intake(state, fetchDrinkLogs.fulfilled([log], 'new', undefined));
  const clean = state;
  thunks.forEach((t, i) => {
    const payload = t === fetchDrinkLogs || t === fetchCreatineLogs ? [{ ...log, amount: 999 }] : t === deleteIntakeLog ? { id: log.id, consumable: 'water' } : { ...log, amount: 999 };
    state = intake(state, t.fulfilled(payload, `old-${i}`, undefined));
    state = intake(state, t.rejected(new Error('old account failure'), `old-${i}`, undefined));
  });
  expect(state).toEqual(clean); expect(state.drinkLogs[0].amount).toBe(8);
});
test('all old tracker fetch/history/mutation results are ignored and current concurrent operations remain distinct', () => {
  let state = trackers(undefined, { type: 'init' });
  const thunks = [fetchTrackers, fetchTrackerHistory, saveTrackerThunk, setPrimaryTracker, addTrackerDose, deleteTrackerDose] as any[];
  thunks.forEach((t, i) => { state = trackers(state, t.pending(`old-${i}`, undefined)); });
  state = trackers(state, resetTrackersState()); state = trackers(state, fetchTrackers.pending('new', undefined));
  state = trackers(state, fetchTrackers.fulfilled({ trackers: [tracker], primaryTrackerId: 't' }, 'new', undefined));
  const clean = state;
  thunks.forEach((t, i) => {
    const payload = t === fetchTrackers ? { trackers: [{ ...tracker, name: 'Old' }], primaryTrackerId: null } : t === fetchTrackerHistory ? { trackerId: 'old', entries: [] } : t === setPrimaryTracker ? 'old' : t === deleteTrackerDose ? { trackerId: 't', id: 'old' } : { ...tracker, name: 'Old' };
    state = trackers(state, t.fulfilled(payload, `old-${i}`, undefined)); state = trackers(state, t.rejected(new Error('old'), `old-${i}`, undefined));
  });
  expect(state).toEqual(clean);
  state = trackers(state, saveTrackerThunk.pending('one', {} as any)); state = trackers(state, saveTrackerThunk.pending('two', {} as any));
  state = trackers(state, saveTrackerThunk.fulfilled({ ...tracker, id: 'one' }, 'one', {} as any));
  state = trackers(state, saveTrackerThunk.fulfilled({ ...tracker, id: 'two' }, 'two', {} as any));
  expect(state.trackers.map(t => t.id)).toEqual(['t','one','two']);
});
test('deferred old tracker fetch rejection cannot replace new account status with an error', async () => {
  const store = create(), old = deferred<any>();
  (trackerDb.listTrackers as jest.Mock).mockReturnValueOnce(old.promise).mockResolvedValueOnce([tracker]);
  (trackerDb.getPrimaryTrackerId as jest.Mock).mockResolvedValue('t');
  const pending = store.dispatch(fetchTrackers()); store.dispatch(resetTrackersState()); await store.dispatch(fetchTrackers());
  old.reject(new Error('Old account request')); await pending;
  expect(store.getState().trackers.trackers[0].name).toBe('New account'); expect(store.getState().trackers.initialFetchStatus).toBe('succeeded'); expect(store.getState().trackers.error).toBeNull();
});
test('current intake update/delete still work after request guards', () => {
  let state = intake(undefined, fetchDrinkLogs.pending('load', undefined)); state = intake(state, fetchDrinkLogs.fulfilled([log], 'load', undefined));
  state = intake(state, updateIntakeLog.pending('edit', { id: log.id, amount: 16 }));
  state = intake(state, updateIntakeLog.fulfilled({ ...log, amount: 16 }, 'edit', { id: log.id, amount: 16 })); expect(state.drinkLogs[0].amount).toBe(16);
  state = intake(state, deleteIntakeLog.pending('delete', log.id)); state = intake(state, deleteIntakeLog.fulfilled({ id: log.id, consumable: 'water' }, 'delete', log.id)); expect(state.drinkLogs).toEqual([]);
});
