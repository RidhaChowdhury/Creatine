import { Platform } from 'react-native';
import { supabase } from './supabase';

let recoveryPending = false;
const exchanges = new Map<string, Promise<boolean>>();
const listeners = new Set<(pending: boolean) => void>();
export const isPasswordRecoveryPending = () => recoveryPending;
function setRecovery(pending: boolean) { recoveryPending = pending; listeners.forEach(listener => listener(pending)); }
export const beginPasswordRecovery = () => setRecovery(true);
export const finishPasswordRecovery = () => setRecovery(false);
export function clearAuthLinkState() { recoveryPending = false; exchanges.clear(); listeners.forEach(listener => listener(false)); }
export function subscribePasswordRecovery(listener: (pending: boolean) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function recoveryRedirect() {
  return Platform.OS === 'web' ? `${window.location.origin}/reset-password` : 'myapp://reset-password';
}

/** Consume this app's callbacks once, including callbacks received while open. */
export function receiveAuthLink(url: string): Promise<boolean> {
  const previous = exchanges.get(url);
  if (previous) return previous;
  const exchange = (async () => {
    if (!supabase) return false;
    let parsed: URL;
    try { parsed = new URL(url); } catch { return false; }
    const nativeRoute = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+|\/+$/g, '');
    if (parsed.protocol === 'myapp:' ? !['','reset-password','auth/callback'].includes(nativeRoute) : !(Platform.OS === 'web' && parsed.origin === window.location.origin && ['/','/reset-password','/auth/callback'].includes(parsed.pathname))) return false;
    const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const code = parsed.searchParams.get('code');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const recovery = parsed.pathname === '/reset-password' || parsed.hostname === 'reset-password' || params.get('type') === 'recovery' || parsed.searchParams.get('type') === 'recovery';
    const callbackError = params.get('error_description') || parsed.searchParams.get('error_description');
    if (callbackError) throw new Error(callbackError);
    if (!code && !(accessToken && refreshToken)) return recovery && recoveryPending;
    if (recovery) beginPasswordRecovery();
    try {
      const result = code ? await supabase.auth.exchangeCodeForSession(code) :
        await supabase.auth.setSession({ access_token: accessToken!, refresh_token: refreshToken! });
      if (result.error) throw result.error;
      if (Platform.OS === 'web') window.history.replaceState(null, '', recovery ? '/reset-password' : '/');
      return recovery;
    } catch (error) { if (recovery) finishPasswordRecovery(); throw error; }
  })();
  exchanges.set(url, exchange);
  if (exchanges.size > 8) exchanges.delete(exchanges.keys().next().value!);
  return exchange;
}

/** Remain in recovery on failed updates; completion notifies bootstrap only after success. */
export async function updateRecoveredPassword(password: string, confirmation: string) {
  if (!supabase) throw new Error('Password recovery requires a cloud account.');
  if (password.length < 8 || password !== confirmation) throw new Error('Use at least 8 characters and enter the same password twice.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session || !recoveryPending) throw new Error('Open a fresh recovery link from your email before changing the password.');
  const result = await supabase.auth.updateUser({ password });
  if (result.error) throw result.error;
  finishPasswordRecovery();
}
