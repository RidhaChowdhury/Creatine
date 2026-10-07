import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
   process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (Boolean(supabaseUrl) !== Boolean(publicKey)) {
   throw new Error('Set both the Supabase project URL and public client key.');
}
if (publicKey?.startsWith('sb_secret_')) {
   throw new Error('Use a Supabase publishable or anon key in the app.');
}
if (publicKey?.startsWith('eyJ')) {
   const payload = publicKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
   if (JSON.parse(atob(payload)).role !== 'anon') {
      throw new Error('Use a Supabase anon key in the app.');
   }
}

export const supabase = supabaseUrl && publicKey ? createClient(supabaseUrl, publicKey, {
   auth: {
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      persistSession: true,
      autoRefreshToken: true,
      // AppInit consumes cold and warm callbacks once on both web and native.
      detectSessionInUrl: false
   }
}) : null;

if (Platform.OS !== 'web' && supabase) {
   AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
   });
}

export async function checkSupabaseConnection(): Promise<void> {
   if (!supabaseUrl || !publicKey) throw new Error('Supabase is not configured.');
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 10000);
   try {
      const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
         headers: { apikey: publicKey }, signal: controller.signal
      });
      if (!response.ok) throw new Error(`Supabase returned HTTP ${response.status}.`);
   } catch {
      throw new Error('Cannot reach your Supabase project. Check that it is running, then retry.');
   } finally {
      clearTimeout(timeout);
   }
}
