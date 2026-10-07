import { supabase } from '../supabase';
import { clearDoseReminders } from './reminders';
import { store } from '@/store/store';
import { resetDrops } from '@/features/drops/dropsSlice';
import { resetIntakeState } from '@/features/intake/intakeSlice';
import { resetSettingsState } from '@/features/settings/settingsSlice';
import { resetTrackersState } from '@/features/trackers/trackersSlice';
export function clearAccountState() {
  store.dispatch(resetDrops()); store.dispatch(resetIntakeState());
  store.dispatch(resetSettingsState()); store.dispatch(resetTrackersState());
}
export async function signOutAccount() {
  if (!supabase) return;
  let signOutError: unknown;
  try { const { error } = await supabase.auth.signOut({ scope: 'local' }); signOutError = error; }
  catch (error) { signOutError = error; }
  finally {
    clearAccountState();
    try { await clearDoseReminders(); } catch (error) { signOutError ??= error; }
  }
  if (signOutError) throw signOutError;
}
export async function deleteAccount(password: string) {
  if (!supabase) throw new Error('Account deletion is available for signed-in cloud accounts.');
  const { data: session } = await supabase.auth.getSession();
  const email = session.session?.user.email;
  if (!email || !password) throw new Error('Enter your current password to confirm deletion.');
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  const { error } = await supabase.functions.invoke('delete-account', { body: { confirmation: 'DELETE' } });
  if (error) throw new Error('Account deletion could not be completed. Check the connection and that account deletion is enabled, then retry.');
  // auth-js removes the local session for local sign-out even if server revocation fails.
  // Deletion has already succeeded: always remove cached records and reminders.
  let cleanupError: unknown;
  try { const result = await supabase.auth.signOut({ scope: 'local' }); cleanupError = result.error; }
  catch (error) { cleanupError = error; }
  clearAccountState();
  try { await clearDoseReminders(); } catch (error) { cleanupError ??= error; }
  if (cleanupError) throw new Error('Your account was deleted, but session or reminder cleanup could not finish. Close the app and sign in again if a session remains.');
}
