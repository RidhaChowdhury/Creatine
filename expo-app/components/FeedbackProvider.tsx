import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { interactionFeedback, primeFeedback, stopFeedback, type FeedbackKind, type FeedbackPreferences } from '@/lib/interaction-feedback';

const defaults: FeedbackPreferences = { soundEnabled: true, vibrationEnabled: true, motion: 'system' };
const Context = createContext({ preferences: defaults, update: (_changes: Partial<FeedbackPreferences>) => {}, reducedMotion: false, active: true,
  confirm: (_kind: FeedbackKind) => {}, prime: () => {} });
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaults);
  const [systemReduced, setSystemReduced] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const edited = useRef(false);
  const current = useRef(preferences); current.current = preferences;
  const persistence = useRef(Promise.resolve());
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem('drops.feedback').then(value => {
      if (!mounted) return;
      if (value && !edited.current) { try { const saved = JSON.parse(value); setPreferences({ soundEnabled: typeof saved.soundEnabled === 'boolean' ? saved.soundEnabled : true,
        vibrationEnabled: typeof saved.vibrationEnabled === 'boolean' ? saved.vibrationEnabled : true, motion: ['system','full','reduced'].includes(saved.motion) ? saved.motion : 'system' }); } catch { /* Keep defaults for invalid preferences. */ } }
    }).catch(() => { /* Preferences remain usable if device storage is unavailable. */ });
    const subscription = AppState.addEventListener('change', state => { setActive(state === 'active'); if (state !== 'active') stopFeedback(); });
    let dispose = () => {};
    if (Platform.OS === 'web') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setSystemReduced(media.matches);
      const visibility = () => { setActive(!document.hidden); if (document.hidden) stopFeedback(); };
      media.addEventListener('change', change); document.addEventListener('visibilitychange', visibility); change(); visibility();
      dispose = () => { media.removeEventListener('change', change); document.removeEventListener('visibilitychange', visibility); };
    } else {
      void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setSystemReduced(value); }).catch(() => {});
      const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduced); dispose = () => listener.remove();
    }
    return () => { mounted = false; subscription.remove(); dispose(); stopFeedback(); };
  }, []);
  function update(changes: Partial<FeedbackPreferences>) {
    edited.current = true;
    const next = { ...current.current, ...changes }; current.current = next; setPreferences(next);
    if (!next.soundEnabled) stopFeedback();
    persistence.current = persistence.current.then(() => AsyncStorage.setItem('drops.feedback', JSON.stringify(next))).catch(() => {});
  }
  const reducedMotion = preferences.motion === 'reduced' || (preferences.motion === 'system' && systemReduced);
  return <Context.Provider value={{ preferences, update, active, reducedMotion, prime: () => primeFeedback(current.current.soundEnabled),
    confirm: kind => { void interactionFeedback(kind, current.current, active); } }}>{children}</Context.Provider>;
}
export const useFeedback = () => useContext(Context);

