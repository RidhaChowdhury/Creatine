import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useFeedback } from '@/components/FeedbackProvider';
import { supabase } from '@/lib/supabase';
import * as repository from '@/lib/drops/repository';
import type { DropsEntry, EntryInput, MutationReceipt, SaveProfileInput, DropsPreferences } from '@/lib/drops/types';
import { confirmedMutation, confirmedPreferences, confirmedPrimary, confirmedProfile, failedDrops, loadedDrops, resetDrops } from './dropsSlice';
import { fetchSettings } from '@/features/settings/settingsSlice';
import { fetchDrinkLogs, fetchCreatineLogs } from '@/features/intake/intakeSlice';
import { fetchTrackers } from '@/features/trackers/trackersSlice';
import { reconcileDoseReminders, listenForDoseReminder, clearDoseReminders } from '@/lib/drops/reminders';

type Prefill = { trackerId?: string; amount?: number; unit?: string };
function useController() {
  const dispatch = useAppDispatch();
  const state = useAppSelector(s => s.drops);
  const { active } = useFeedback();
  const [now, setNow] = useState(() => new Date());
  const [addRequest, setAddRequest] = useState<Prefill | null>(null);
  const revision = useRef(0);
  const accountEpoch = useRef(0);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    try {
      const snapshot = await repository.loadSnapshot();
      if (mounted.current && current === revision.current) dispatch(loadedDrops(snapshot));
    } catch (e) {
      if (mounted.current && current === revision.current) dispatch(failedDrops((e as Error).message || 'Unable to load your records.'));
    }
  }, [dispatch]);
  const syncLegacy = useCallback(() => {
    void Promise.all([dispatch(fetchSettings()), dispatch(fetchDrinkLogs()), dispatch(fetchCreatineLogs()), dispatch(fetchTrackers())]);
  }, [dispatch]);
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; revision.current++; accountEpoch.current++; dispatch(resetDrops()); }; }, [dispatch, refresh]);
  useEffect(() => {
    if (!active) return;
    setNow(new Date()); void refresh();
    const timer = setInterval(() => { setNow(new Date()); void refresh(); }, 60_000);
    return () => clearInterval(timer);
  }, [active, refresh]);
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('drops-account-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intake_log' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker_entries' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracked_items' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drops_preferences' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drops_profiles' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker_preferences' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings' }, () => void refresh()).subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [refresh]);
  useEffect(() => {
    let current = true;
    const epoch = accountEpoch.current;
    if (state.snapshot && active) void reconcileDoseReminders(state.snapshot, now).catch(e => {
      if (current && mounted.current && epoch === accountEpoch.current) dispatch(failedDrops(`Reminder update failed: ${(e as Error).message}`));
    });
    return () => { current = false; };
  }, [state.snapshot, now, active, dispatch]);
  useEffect(() => listenForDoseReminder(prefill => setAddRequest(prefill)), []);
  useEffect(() => {
    if (!supabase) return;
    let owner: string | null | undefined;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const nextOwner = session?.user.id ?? null;
      if (event === 'SIGNED_OUT' || (owner !== undefined && owner !== nextOwner)) {
        revision.current++; accountEpoch.current++; dispatch(resetDrops()); setAddRequest(null); void clearDoseReminders();
      }
      owner = nextOwner;
    });
    return () => data.subscription.unsubscribe();
  }, [dispatch]);
  async function mutation(work: Promise<MutationReceipt>) {
    const epoch = accountEpoch.current;
    const receipt = await work;
    if (!mounted.current || epoch !== accountEpoch.current) return receipt;
    revision.current++; dispatch(confirmedMutation(receipt)); setNow(new Date()); syncLegacy();
    // A refresh failure must never disguise a persisted write as an unsuccessful save.
    void refresh(); return receipt;
  }
  return { ...state, now, refresh, addRequest,
    openAdd: (prefill: Prefill = {}) => setAddRequest(prefill), closeAdd: () => setAddRequest(null),
    add: (input: EntryInput, id: string) => mutation(repository.addEntry(input, id)),
    edit: (before: DropsEntry, input: EntryInput, id: string) => mutation(repository.editEntry(before, input, id)),
    remove: (before: DropsEntry, id: string) => mutation(repository.deleteEntry(before, id)),
    undo: (receipt: MutationReceipt, id: string) => mutation(repository.undoMutation(receipt, id)),
    saveProfile: async (input: SaveProfileInput) => { const epoch = accountEpoch.current; const tracker = await repository.saveProfile(input); if (!mounted.current || epoch !== accountEpoch.current) return tracker; revision.current++; dispatch(confirmedProfile(tracker)); syncLegacy(); void refresh(); return tracker; },
    setPrimary: async (id: string | null) => { const epoch = accountEpoch.current; await repository.setPrimary(id); if (!mounted.current || epoch !== accountEpoch.current) return; revision.current++; dispatch(confirmedPrimary(id)); syncLegacy(); void refresh(); },
    savePreferences: async (changes: Partial<DropsPreferences>) => { const epoch = accountEpoch.current; await repository.savePreferences(changes); if (!mounted.current || epoch !== accountEpoch.current) return; revision.current++; dispatch(confirmedPreferences(changes)); void refresh(); }
  };
}
const Context = createContext<ReturnType<typeof useController> | null>(null);
export function DropsProvider({ children }: { children: React.ReactNode }) { return <Context.Provider value={useController()}>{children}</Context.Provider>; }
export function useDrops() { const value = useContext(Context); if (!value) throw new Error('DropsProvider is required.'); return value; }
