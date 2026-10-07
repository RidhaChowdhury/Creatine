jest.mock('../../supabase', () => ({ supabase: { auth: { signOut: jest.fn(), getSession: jest.fn(), signInWithPassword: jest.fn() }, functions: { invoke: jest.fn() } } }));
jest.mock('../reminders', () => ({ clearDoseReminders: jest.fn() }));
jest.mock('@/store/store', () => ({ store: { dispatch: jest.fn() } }));
jest.mock('@/features/drops/dropsSlice', () => ({ resetDrops: () => ({ type: 'drops/reset' }) }));
jest.mock('@/features/intake/intakeSlice', () => ({ resetIntakeState: () => ({ type: 'intake/reset' }) }));
jest.mock('@/features/settings/settingsSlice', () => ({ resetSettingsState: () => ({ type: 'settings/reset' }) }));
jest.mock('@/features/trackers/trackersSlice', () => ({ resetTrackersState: () => ({ type: 'trackers/reset' }) }));
import { supabase } from '../../supabase';
import { store } from '@/store/store';
import { clearDoseReminders } from '../reminders';
import { signOutAccount, deleteAccount } from '../account';
const client = supabase as any;
beforeEach(() => { jest.clearAllMocks(); (clearDoseReminders as jest.Mock).mockResolvedValue(undefined); client.auth.signOut.mockResolvedValue({ error: null }); client.auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'test@example.invalid' } } } }); client.auth.signInWithPassword.mockResolvedValue({ error: null }); client.functions.invoke.mockResolvedValue({ error: null }); });
test('successful signout uses local session scope, clears all account-owned Redux slices and reminders', async () => {
  await signOutAccount(); expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect((store.dispatch as jest.Mock).mock.calls.map(c => c[0].type)).toEqual(['drops/reset','intake/reset','settings/reset','trackers/reset']); expect(clearDoseReminders).toHaveBeenCalledTimes(1);
});
test('failed signout still clears user caches and reminders while surfacing the error', async () => {
  client.auth.signOut.mockResolvedValue({ error: new Error('network') }); await expect(signOutAccount()).rejects.toThrow('network');
  expect(store.dispatch).toHaveBeenCalledTimes(4); expect(clearDoseReminders).toHaveBeenCalledTimes(1);
});
test('deletion requires password and successful reauthentication before calling protected function', async () => {
  await expect(deleteAccount('')).rejects.toThrow('password'); expect(client.functions.invoke).not.toHaveBeenCalled();
  client.auth.signInWithPassword.mockResolvedValue({ error: new Error('Wrong password') }); await expect(deleteAccount('bad')).rejects.toThrow('Wrong password'); expect(client.functions.invoke).not.toHaveBeenCalled(); expect(store.dispatch).not.toHaveBeenCalled();
});
test('backend deletion failure remains recoverable and does not erase account state', async () => {
  client.functions.invoke.mockResolvedValue({ error: new Error('not deployed') }); await expect(deleteAccount('pw')).rejects.toThrow('could not be completed');
  expect(client.auth.signOut).not.toHaveBeenCalled(); expect(store.dispatch).not.toHaveBeenCalled();
});
test('successful delete sends only confirmation to endpoint, then signs out and clears state', async () => {
  await deleteAccount('pw'); expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'test@example.invalid', password: 'pw' });
  expect(client.functions.invoke).toHaveBeenCalledWith('delete-account', { body: { confirmation: 'DELETE' } }); expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' }); expect(store.dispatch).toHaveBeenCalledTimes(4); expect(clearDoseReminders).toHaveBeenCalledTimes(1);
});
test('completed deletion still clears all cached data/reminders when remote signout fails and reports cleanup precisely', async () => {
  client.auth.signOut.mockResolvedValue({ error: new Error('offline') });
  await expect(deleteAccount('pw')).rejects.toThrow('account was deleted');
  expect(store.dispatch).toHaveBeenCalledTimes(4); expect(clearDoseReminders).toHaveBeenCalledTimes(1);
});
test('reminder cleanup failure after deletion does not misreport deletion as unperformed or retain records', async () => {
  (clearDoseReminders as jest.Mock).mockRejectedValue(new Error('native unavailable'));
  await expect(deleteAccount('pw')).rejects.toThrow('account was deleted'); expect(store.dispatch).toHaveBeenCalledTimes(4);
});
