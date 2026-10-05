import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAppDispatch } from '@/store/hooks';
import { initializeDatabase } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { fetchSettings, resetSettingsState } from './settings/settingsSlice';
import { fetchDrinkLogs, fetchCreatineLogs, resetIntakeState } from './intake/intakeSlice';
import { initializeTrackerDatabase } from '@/lib/trackers';
import { fetchTrackers, resetTrackersState } from './trackers/trackersSlice';
import { Linking, Platform } from 'react-native';
import { receiveAuthLink, isPasswordRecoveryPending, beginPasswordRecovery, clearAuthLinkState, subscribePasswordRecovery } from '@/lib/authLinks';
import { clearDoseReminders } from '@/lib/drops/reminders';
import { resetDrops } from './drops/dropsSlice';

export const AppInit = () => {
   const dispatch = useAppDispatch();
   const [error, setError] = useState<string | null>(null);
   const [attempt, setAttempt] = useState(0);
   const pathname = usePathname();
   const currentPath = useRef(pathname); currentPath.current = pathname;

   useEffect(() => {
      let active = true;
      let identity: string | null | undefined;
      let revision = 0;
      let queue = Promise.resolve();
      const onTabRoute = () => /^\/(?:\(tabs\)\/)?(?:history|supps|metrics|settings)\/?$/.test(currentPath.current);
      const bootstrap = async (userId?: string | null) => {
         if (!active || isPasswordRecoveryPending()) return;
         setError(null);
         dispatch(resetSettingsState());
         dispatch(resetIntakeState());
         dispatch(resetTrackersState());
         dispatch(resetDrops());
         if (supabase && !userId) {
            router.replace('/(auth)/login');
            return;
         }
         const currentRevision = revision;
         try {
            await initializeDatabase();
            await initializeTrackerDatabase();
            const settings = await dispatch(fetchSettings()).unwrap();
            if (!active || currentRevision !== revision) return;
            if (settings?.name) {
               await Promise.all([
                  dispatch(fetchDrinkLogs()).unwrap(),
                  dispatch(fetchCreatineLogs()).unwrap(),
                  dispatch(fetchTrackers()).unwrap()
               ]);
               // Replenish reminders already enabled by the user, without a permission prompt.
               if (active && currentRevision === revision && !isPasswordRecoveryPending() && !onTabRoute()) router.replace('/(tabs)');
            } else {
               if (active && currentRevision === revision && !isPasswordRecoveryPending()) router.replace('/(auth)/onboarding');
            }
         } catch (err) {
            if (active && currentRevision === revision) {
               setError((err as Error).message || 'Unable to load your account.');
            }
         }
      };
      const enqueue = (userId: string | null) => {
         if (!active) return;
         if (isPasswordRecoveryPending()) { router.replace('/(auth)/reset-password'); return; }
         if (!active || identity === userId) return;
         identity = userId;
         revision++;
         const requestedRevision = revision;
         if (!onTabRoute()) router.replace('/');
         queue = queue.then(() => active && requestedRevision === revision ? bootstrap(userId) : undefined);
      };
      if (!supabase) {
         void bootstrap();
         return () => { active = false; };
      }
      const recoverySubscription = subscribePasswordRecovery(pending => {
         if (!active) return;
         revision++; identity = undefined;
         if (pending) { setError(null); router.replace('/(auth)/reset-password'); return; }
         // Run outside the auth event/session lock, and force a fresh account bootstrap.
         setTimeout(() => { void supabase!.auth.getSession().then(({data,error:sessionError}) => {
            if (!active) return; if (sessionError) setError(sessionError.message); else enqueue(data.session?.user.id ?? null);
         }).catch(err => { if (active) setError(err.message || 'Unable to refresh your session.'); }); }, 0);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
         if (_event === 'PASSWORD_RECOVERY') { beginPasswordRecovery(); return; }
         if (_event === 'SIGNED_OUT') { clearAuthLinkState(); void clearDoseReminders(); }
         // Run requests outside Supabase's auth callback session lock.
         setTimeout(() => enqueue(session?.user.id ?? null), 0);
      });
      const handleLink = async (url: string | null) => {
         if (url && await receiveAuthLink(url) && active) router.replace('/(auth)/reset-password');
      };
      const linkSubscription = Linking.addEventListener('url', ({ url }) => {
         void handleLink(url).catch(err => { if (active) setError(err.message); });
      });
      const initialLink = Platform.OS === 'web' ? Promise.resolve(window.location.href) : Linking.getInitialURL();
      initialLink.then(handleLink).then(() => supabase!.auth.getSession()).then(({ data, error: sessionError }) => {
         if (!active) return;
         if (sessionError) setError(sessionError.message);
         else enqueue(data.session?.user.id ?? null);
      }).catch((err) => { if (active) setError(err.message); });
      return () => { active = false; subscription.unsubscribe(); linkSubscription.remove(); recoverySubscription(); };
   }, [dispatch, attempt]);
   if (!error) return null;
   return React.createElement(View, {
      style: { position: 'absolute', inset: 0, zIndex: 100, backgroundColor: '#080808',
         padding: 30, justifyContent: 'center', gap: 20 }
   },
   React.createElement(Text, { style: { color: 'white', fontSize: 24 } }, 'Unable to load your account'),
   React.createElement(Text, { style: { color: 'white' }, accessibilityRole: 'alert' }, error),
   React.createElement(Pressable, { onPress: () => setAttempt((value) => value + 1),
      accessibilityRole: 'button' }, React.createElement(Text, { style: { color: '#98bfff' } }, 'Retry')),
   supabase ? React.createElement(Pressable, { onPress: () => { void supabase?.auth.signOut({ scope: 'local' }); },
      accessibilityRole: 'button' }, React.createElement(Text, { style: { color: '#98bfff' } }, 'Sign out')) : null);
};
