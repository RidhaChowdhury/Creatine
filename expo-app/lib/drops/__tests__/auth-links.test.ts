jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('../../supabase', () => ({ supabase: { auth: { setSession: jest.fn(), exchangeCodeForSession: jest.fn(), getSession: jest.fn(), updateUser: jest.fn() } } }));
import { Platform } from 'react-native';
import { supabase } from '../../supabase';
import { receiveAuthLink, clearAuthLinkState, beginPasswordRecovery, isPasswordRecoveryPending, updateRecoveredPassword, subscribePasswordRecovery } from '../../authLinks';
const auth = supabase!.auth as any;
beforeEach(() => { clearAuthLinkState(); jest.clearAllMocks(); (Platform as any).OS = 'ios'; auth.setSession.mockResolvedValue({ error: null }); auth.exchangeCodeForSession.mockResolvedValue({ error: null }); auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u' } } }, error: null }); auth.updateUser.mockResolvedValue({ error: null }); });
test('cold and warm implicit recovery is consumed once and stays pending', async () => {
  const link = 'myapp://reset-password#access_token=access&refresh_token=refresh&type=recovery';
  const cold = receiveAuthLink(link), warm = receiveAuthLink(link); expect(cold).toBe(warm);
  expect(isPasswordRecoveryPending()).toBe(true); expect(await cold).toBe(true); expect(auth.setSession).toHaveBeenCalledTimes(1);
  expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' });
});
test('signup implicit and PKCE callbacks sign in without recovery', async () => {
  expect(await receiveAuthLink('myapp://#access_token=a&refresh_token=r&type=signup')).toBe(false);
  expect(await receiveAuthLink('myapp://?code=signup-code')).toBe(false);
  expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('signup-code'); expect(isPasswordRecoveryPending()).toBe(false);
});
test('PKCE recovery path is deduplicated; invalid native paths and remote origin are ignored', async () => {
  expect(await receiveAuthLink('myapp://reset-password?code=recovery')).toBe(true);
  expect(await receiveAuthLink('https://evil.example/reset-password?code=x')).toBe(false);
  expect(await receiveAuthLink('myapp://evil?code=x')).toBe(false);
  expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
});
test('ordinary reset route does not manufacture recovery authorization', async () => {
  expect(await receiveAuthLink('myapp://reset-password')).toBe(false);
  await expect(updateRecoveredPassword('password123','password123')).rejects.toThrow('fresh recovery link'); expect(auth.updateUser).not.toHaveBeenCalled();
});
test('reset errors preserve recovery and completion only notifies after successful update', async () => {
  beginPasswordRecovery(); const listener = jest.fn(), unsubscribe = subscribePasswordRecovery(listener);
  auth.updateUser.mockResolvedValueOnce({ error: new Error('retry update') });
  await expect(updateRecoveredPassword('password123','password123')).rejects.toThrow('retry update'); expect(isPasswordRecoveryPending()).toBe(true); expect(listener).not.toHaveBeenCalled();
  await expect(updateRecoveredPassword('short','short')).rejects.toThrow('8 characters'); expect(isPasswordRecoveryPending()).toBe(true);
  await updateRecoveredPassword('password123','password123'); expect(isPasswordRecoveryPending()).toBe(false); expect(listener).toHaveBeenCalledWith(false); unsubscribe();
});
test('complete signout clears pending recovery and callback dedup state', async () => {
  const link = 'myapp://reset-password?code=once'; await receiveAuthLink(link); clearAuthLinkState(); expect(isPasswordRecoveryPending()).toBe(false);
  await receiveAuthLink(link); expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(2);
});
test('failed token exchange reports callback error and clears recovery state', async () => {
  auth.exchangeCodeForSession.mockResolvedValue({ error: new Error('expired code') });
  await expect(receiveAuthLink('myapp://reset-password?code=expired')).rejects.toThrow('expired code'); expect(isPasswordRecoveryPending()).toBe(false);
  await expect(receiveAuthLink('myapp://reset-password#error_description=Link%20expired')).rejects.toThrow('Link expired');
});
test('web accepts only same-origin known callback routes and removes credentials from URL', async () => {
  const before = (globalThis as any).window;
  const replaceState = jest.fn();
  (globalThis as any).window = { location: { origin: 'https://drops.example' }, history: { replaceState } }; (Platform as any).OS = 'web';
  try {
    expect(await receiveAuthLink('https://evil.example/reset-password?code=evil')).toBe(false);
    expect(await receiveAuthLink('https://drops.example/unrecognized?code=evil')).toBe(false);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(await receiveAuthLink('https://drops.example/reset-password?code=valid')).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/reset-password');
  } finally { (globalThis as any).window = before; }
});
