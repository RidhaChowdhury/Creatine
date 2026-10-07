jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, usePathname: jest.fn(() => '/login') }));
jest.mock('@/store/hooks', () => ({ useAppDispatch: () => (action: any) => action }));
jest.mock('@/lib/data', () => ({ initializeDatabase: jest.fn(async () => {}) }));
jest.mock('@/lib/trackers', () => ({ initializeTrackerDatabase: jest.fn(async () => {}) }));
jest.mock('@/lib/drops/reminders', () => ({ clearDoseReminders: jest.fn(async () => {}) }));
jest.mock('@/features/settings/settingsSlice', () => ({ fetchSettings: jest.fn(() => ({ unwrap: async () => ({ name: 'Owner' }) })), resetSettingsState: () => ({ type: 'reset' }) }));
jest.mock('@/features/intake/intakeSlice', () => ({ fetchDrinkLogs: () => ({ unwrap: async () => [] }), fetchCreatineLogs: () => ({ unwrap: async () => [] }), resetIntakeState: () => ({ type: 'reset' }) }));
jest.mock('@/features/trackers/trackersSlice', () => ({ fetchTrackers: () => ({ unwrap: async () => [] }), resetTrackersState: () => ({ type: 'reset' }) }));
jest.mock('@/features/drops/dropsSlice', () => ({ resetDrops: () => ({ type: 'reset' }) }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: 'u' } } } })), onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })), exchangeCodeForSession: jest.fn(async () => ({ error: null })), setSession: jest.fn(async () => ({ error: null })), updateUser: jest.fn(async () => ({ error: null })) } } }));
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Linking, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { AppInit } from '@/features/appInit';
import { fetchSettings } from '@/features/settings/settingsSlice';
import { supabase } from '@/lib/supabase';
import { beginPasswordRecovery, clearAuthLinkState, isPasswordRecoveryPending, updateRecoveredPassword } from '@/lib/authLinks';
let tree: TestRenderer.ReactTestRenderer | undefined;
async function flush() { await act(async () => { for (let i=0;i<12;i++) await Promise.resolve(); jest.runOnlyPendingTimers(); for (let i=0;i<12;i++) await Promise.resolve(); }); }
beforeEach(() => {
  clearAuthLinkState(); jest.clearAllMocks(); jest.useFakeTimers();
  (Platform as any).OS = 'ios'; (usePathname as jest.Mock).mockReturnValue('/login');
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null); jest.spyOn(Linking,'addEventListener').mockReturnValue({ remove: jest.fn() } as any);
  (fetchSettings as any).mockImplementation(() => ({ unwrap: async () => ({ name: 'Owner' }) }));
});
afterEach(async () => { if(tree) await act(async () => tree!.unmount()); tree=undefined; jest.useRealTimers(); });
test('in-flight bootstrap cannot overwrite recovery; successful reset reboots account and failed reset retains recovery', async () => {
  let resolve!: (value: any) => void;
  (fetchSettings as any).mockImplementationOnce(() => ({ unwrap: () => new Promise(r => { resolve=r; }) }));
  await act(async () => { tree = TestRenderer.create(<AppInit />); }); await flush();
  await act(async () => { beginPasswordRecovery(); });
  resolve({ name: 'Owner' }); await flush();
  expect(router.replace).toHaveBeenLastCalledWith('/(auth)/reset-password');
  (supabase!.auth.updateUser as jest.Mock).mockResolvedValueOnce({ error: new Error('network') });
  await expect(updateRecoveredPassword('password123','password123')).rejects.toThrow('network'); expect(isPasswordRecoveryPending()).toBe(true);
  await act(async () => { await updateRecoveredPassword('password123','password123'); }); await flush();
  expect(fetchSettings).toHaveBeenCalledTimes(2); expect(router.replace).toHaveBeenLastCalledWith('/(tabs)');
});
test('cold native recovery waits for callback and routes reset; signedout clears pending recovery', async () => {
  (Linking.getInitialURL as jest.Mock).mockResolvedValue('myapp://reset-password?code=cold');
  await act(async () => { tree=TestRenderer.create(<AppInit />); }); await flush();
  expect(isPasswordRecoveryPending()).toBe(true); expect(router.replace).toHaveBeenLastCalledWith('/(auth)/reset-password');
  const event = (supabase!.auth.onAuthStateChange as jest.Mock).mock.calls[0][0];
  (supabase!.auth.getSession as jest.Mock).mockResolvedValueOnce({ data: { session: null } });
  await act(async () => { event('SIGNED_OUT', null); }); await flush();
  expect(isPasswordRecoveryPending()).toBe(false); expect(router.replace).toHaveBeenLastCalledWith('/(auth)/login');
});
test.each(['/history','/supps','/metrics','/settings'])('initial bootstrap preserves requested tab %s', async path => {
  (usePathname as jest.Mock).mockReturnValue(path);
  await act(async () => { tree=TestRenderer.create(<AppInit />); }); await flush();
  expect(fetchSettings).toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled();
});
test('tab selected while account bootstrap is in flight remains selected', async () => {
  let resolve!: (value: any) => void;
  (fetchSettings as any).mockImplementationOnce(() => ({ unwrap: () => new Promise(r => { resolve=r; }) }));
  await act(async () => { tree=TestRenderer.create(<AppInit />); }); await flush();
  (usePathname as jest.Mock).mockReturnValue('/history'); await act(async () => { tree!.update(<AppInit />); });
  (router.replace as jest.Mock).mockClear(); resolve({ name: 'Owner' }); await flush(); expect(router.replace).not.toHaveBeenCalled();
});
