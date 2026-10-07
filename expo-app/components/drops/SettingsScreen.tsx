import React, { useRef, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { Input, ScrollView, Text, XStack, YStack } from 'tamagui';
import { useDrops } from '@/features/drops/DropsProvider';
import { useFeedback } from '@/components/FeedbackProvider';
import { PitwallSheet } from '@/components/pitwall/PitwallOverlays';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchSettings, selectUserSettings } from '@/features/settings/settingsSlice';
import { saveAccountName } from '@/lib/drops/repository';
import { addSampleHistory, isSampleHistoryPreviewEligible } from '@/lib/drops/sample-history';
import { signOutAccount, deleteAccount } from '@/lib/drops/account';
import { supabase } from '@/lib/supabase';
import { compatibleUnits, convertAmount } from '@/lib/drops/units';
import { dayInZone } from '@/lib/drops/dates';
import { planForDay } from '@/lib/drops/domain';
import { reminderPermission, openReminderSettings } from '@/lib/drops/reminders';
import type { DropsTracker, PriorUse, WaterPreset } from '@/lib/drops/types';
import { Action, Choices, Field, Failure, Screen, StateGate } from './ui';

type Section = 'Profile' | 'Targets' | 'Units' | 'Water presets' | 'Reminders' | 'Motion' | 'Sound' | 'Haptics' | 'Intake context' | 'Delete account';
export default function SettingsScreen() {
  const drops = useDrops(), feedback = useFeedback(), dispatch = useAppDispatch(), account = useAppSelector(selectUserSettings);
  const [section, setSection] = useState<Section | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [name, setName] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [trackerId, setTrackerId] = useState(''), [unit, setUnit] = useState(''), [target, setTarget] = useState(''), [limit, setLimit] = useState('');
  const [presets, setPresets] = useState<WaterPreset[]>([]), [pinned, setPinned] = useState<string[]>([]);
  const [presetAmounts, setPresetAmounts] = useState<Record<string,string>>({});
  const [permission, setPermission] = useState('Checking…'), [enabled, setEnabled] = useState(false);
  const [zone, setZone] = useState(''), [halfLife, setHalfLife] = useState(''), [bedtime, setBedtime] = useState('');
  const [prior, setPrior] = useState<PriorUse>({ creatine: 'unknown', caffeine: 'unknown' });
  const [start, setStart] = useState(''), [dose, setDose] = useState('');
  const samplePending = useRef(false);
  const [sampleBusy, setSampleBusy] = useState(false), [sampleProgress, setSampleProgress] = useState<string | null>(null), [sampleError, setSampleError] = useState<string | null>(null);
  const localPreview = isSampleHistoryPreviewEligible();
  const phonePreview = process.env.EXPO_PUBLIC_DROPS_PHONE_PREVIEW === '1' && localPreview;
  const snapshot = drops.snapshot;
  async function addSamples() {
    if (!localPreview || samplePending.current || busy) return;
    samplePending.current = true; setSampleBusy(true); setSampleError(null); setSampleProgress('Preparing 30 days of sample history…');
    try {
      const result = await addSampleHistory({ onProgress: (completed, total) => setSampleProgress(`Adding sample history… ${completed}/${total}`) });
      setSampleProgress(`${result.added} sample entries added · ${result.existing} already present · ${result.fromDay} — ${result.toDay}. Existing records and settings preserved.${result.skippedDays ? ` ${result.skippedDays} tracker days skipped to preserve real entries or unavailable trackers.` : ''}`);
    } catch (e) {
      setSampleError((e as Error).message || 'Unable to finish adding sample history. Completed sample entries are retained; retry continues without duplicates.');
    } finally {
      try { await drops.refresh(); } finally { samplePending.current = false; setSampleBusy(false); }
    }
  }
  function selectTracker(tracker: DropsTracker) {
    setTrackerId(tracker.id); setUnit(tracker.unit);
    const plan = planForDay(tracker, dayInZone(drops.now, snapshot!.preferences.timezone));
    setTarget(plan?.target == null ? '' : String(convertAmount(plan.target, plan.unit, tracker.unit)));
    setLimit(plan?.limit == null ? '' : String(convertAmount(plan.limit, plan.unit, tracker.unit)));
  }
  function open(next: Section) {
    if (!snapshot) return;
    setError(null); setSection(next); setName(account.name); setPassword(''); setConfirmation('');
    setPresets(snapshot.preferences.waterPresets.map(p => ({ ...p }))); setPinned([...snapshot.preferences.prominentPresetIds]);
    setPresetAmounts(Object.fromEntries(snapshot.preferences.waterPresets.map(p => [p.id, String(p.amount)])));
    setEnabled(snapshot.preferences.remindersEnabled); setZone(snapshot.preferences.timezone); setHalfLife(String(snapshot.preferences.caffeineHalfLifeHours)); setBedtime(snapshot.preferences.bedtime);
    setPrior({ ...snapshot.preferences.priorUse }); setStart(snapshot.preferences.priorUse.startDate ?? ''); setDose(snapshot.preferences.priorUse.usualDoseGrams?.toString() ?? '');
    if (snapshot.trackers[0]) selectTracker(snapshot.trackers[0]);
    if (next === 'Reminders') void reminderPermission().then(setPermission).catch(e => setPermission((e as Error).message));
  }
  async function run(work: () => Promise<void>, close = true) {
    if (busy) return; setBusy(true); setError(null);
    try { await work(); if (close) setSection(null); } catch (e) { setError((e as Error).message || 'Unable to save.'); } finally { setBusy(false); }
  }
  async function save() {
    if (!snapshot) return;
    await run(async () => {
      if (section === 'Profile') { if (!name.trim()) throw new Error('Enter your name.'); await saveAccountName(name.trim()); await dispatch(fetchSettings()).unwrap(); }
      if (section === 'Targets' || section === 'Units') {
        const tracker = snapshot.trackers.find(t => t.id === trackerId)!;
        const { plans, ...profile } = tracker;
        const plan = planForDay(tracker, dayInZone(drops.now, snapshot.preferences.timezone));
        if (section === 'Units') await drops.saveProfile({ ...profile, unit, savedDose: tracker.savedDose === null ? null : convertAmount(tracker.savedDose, tracker.unit, unit) });
        else {
          const number = (text: string) => { if (!text.trim()) return null; const value = Number(text); if (!Number.isFinite(value) || value <= 0) throw new Error('Enter a positive finite target or limit, or leave blank to remove it.'); return value; };
          const targetValue = number(target), limitValue = number(limit);
          if (targetValue !== null && limitValue !== null && limitValue < targetValue) throw new Error('Limit must be at least the target.');
          await drops.saveProfile({ ...profile, plan: { mode: plan?.mode ?? 'as-needed', days: plan?.days ?? [], doses: plan?.doses ?? [], unit: plan?.unit ?? tracker.unit,
            target: targetValue === null ? null : convertAmount(targetValue, tracker.unit, plan?.unit ?? tracker.unit), limit: limitValue === null ? null : convertAmount(limitValue, tracker.unit, plan?.unit ?? tracker.unit) } });
        }
      }
      if (section === 'Water presets') {
        const savedPresets = presets.map(p => ({ ...p, amount: Number(presetAmounts[p.id]) }));
        if (savedPresets.some(p => !Number.isFinite(p.amount) || p.amount <= 0)) throw new Error('Every preset needs a positive finite amount.');
        await drops.savePreferences({ waterPresets: savedPresets, prominentPresetIds: pinned.filter(id => presets.some(p => p.id === id)).slice(0,2) });
      }
      if (section === 'Reminders') await drops.savePreferences({ remindersEnabled: enabled });
      if (section === 'Intake context') {
        new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
        if (!Number.isFinite(Number(halfLife)) || Number(halfLife) < 1 || Number(halfLife) > 24) throw new Error('Assumed half-life must be between 1 and 24 hours.');
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(bedtime)) throw new Error('Bedtime must use HH:mm.');
        if (start && (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(Date.parse(start)) || new Date(start).toISOString().slice(0,10) !== start || start > dayInZone(drops.now, zone))) throw new Error('Enter a real start date, today or earlier.');
        if (dose && (!Number.isFinite(Number(dose)) || Number(dose) <= 0)) throw new Error('Usual dose must be positive grams.');
        await drops.savePreferences({ timezone: zone, caffeineHalfLifeHours: Number(halfLife), bedtime, priorUse: { ...prior, startDate: start || undefined, usualDoseGrams: dose ? Number(dose) : undefined } });
      }
    });
  }
  return <StateGate><Screen title="Settings">
    {localPreview && <YStack gap={10} paddingVertical={12} borderBottomWidth={1} borderColor="#333">
      {phonePreview && <Text color="#aaa">Phone preview: your entries stay in this browser. Sample history is optional.</Text>}
      <Action label={sampleBusy ? 'Adding sample history…' : 'Add 30 days of sample history'} disabled={sampleBusy || busy} onPress={() => void addSamples()} />
      <Text color="#aaa">Optional sample water and supplement entries are labeled as sample data. Existing records and settings are preserved. Repeating this action avoids duplicate samples.</Text>
      {sampleProgress && <Text color="#aaa" role="status">{sampleProgress}</Text>}
      <Failure message={sampleError} />
    </YStack>}
    {(['Profile','Targets','Units','Water presets','Reminders','Motion','Sound','Haptics','Intake context'] as Section[]).map(item => <YStack key={item} paddingVertical={12} borderBottomWidth={1} borderColor="#333"><Action label={item} onPress={() => open(item)} /></YStack>)}
    {supabase && <><Action label={busy ? 'Signing out…' : 'Sign out'} disabled={busy} onPress={() => void run(async () => { await signOutAccount(); router.replace('/'); })} />
    <Action label="Delete account" onPress={() => open('Delete account')} /></>}<Failure message={section ? null : error} />
    <PitwallSheet open={section !== null} onOpenChange={value => { if (!value && !busy) { setSection(null); setPassword(''); setConfirmation(''); } }} title={section ?? 'Settings'}>
      <ScrollView keyboardShouldPersistTaps="handled"><YStack gap={18} paddingBottom={40}>
        {section === 'Profile' && <Field label="Name" value={name} onChange={setName} />}
        {(section === 'Targets' || section === 'Units') && <>
          <XStack gap={8} flexWrap="wrap">{snapshot?.trackers.map(t => <Action key={t.id} label={t.name} selected={trackerId === t.id} onPress={() => selectTracker(t)} />)}</XStack>
          {section === 'Targets' ? <><Field label={`Optional target · ${unit}`} value={target} onChange={setTarget} /><Field label={`Optional limit · ${unit}`} value={limit} onChange={setLimit} /><Text color="#aaa">Blank removes the quantity target or limit. Scheduled doses remain separate. Changes apply today; prior plans are retained.</Text></> : <><Choices label="Display unit" values={compatibleUnits(snapshot?.trackers.find(t => t.id === trackerId)?.unit ?? unit)} value={unit} onChange={setUnit} /><Text color="#aaa">Saved dose is converted. Recorded quantities and historical plans retain source units. Cup means 240 mL.</Text></>}
        </>}
        {section === 'Water presets' && <>
          {presets.map((p, index) => <YStack key={p.id} gap={8} borderBottomWidth={1} borderColor="#333" paddingBottom={12}>
            <Field label={`Preset ${index + 1} amount`} value={presetAmounts[p.id] ?? ''} onChange={value => setPresetAmounts(amounts => ({ ...amounts, [p.id]: value }))} />
            <Choices label="Unit" values={['oz','mL','L','cup']} value={p.unit} onChange={value => {
              const amount = Number(presetAmounts[p.id]);
              if (Number.isFinite(amount) && amount > 0) setPresetAmounts(amounts => ({ ...amounts, [p.id]: String(convertAmount(amount, p.unit, value)) }));
              setPresets(ps => ps.map(x => x.id === p.id ? { ...x, unit: value } : x));
            }} />
            <XStack gap={8} flexWrap="wrap"><Action label={pinned.includes(p.id) ? 'Unpin prominent preset' : 'Pin prominent preset'} disabled={!pinned.includes(p.id) && pinned.length >= 2} onPress={() => setPinned(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids,p.id])} /><Action label="Move up" disabled={!index} onPress={() => setPresets(ps => { const next = [...ps]; [next[index - 1], next[index]] = [next[index],next[index - 1]]; return next; })} /><Action label="Remove preset" onPress={() => { setPresets(ps => ps.filter(x => x.id !== p.id)); setPinned(ids => ids.filter(id => id !== p.id)); }} /></XStack>
          </YStack>)}
          <Action label="Add preset" onPress={() => setPresets(ps => [...ps, { id: Crypto.randomUUID(), amount: 0, unit: 'mL' }])} /><Text color="#aaa">Choose up to two prominent actions. Enter an amount before saving a new preset.</Text>
        </>}
        {section === 'Reminders' && <><Choices label="Scheduled reminders" values={['Off','On']} value={enabled ? 'On' : 'Off'} onChange={v => setEnabled(v === 'On')} /><Text color="#aaa">Permission: {permission}. {Platform.OS === 'web' ? 'Browser shows upcoming and overdue doses; closed-browser notifications are unavailable.' : 'Only outstanding future scheduled doses receive notifications. Other closed or offline devices may update later.'}</Text>{Platform.OS !== 'web' && <XStack gap={8} flexWrap="wrap"><Action label="Request notification permission" onPress={() => void run(async () => { setPermission(await reminderPermission(true)); }, false)} /><Action label="Open device settings" onPress={() => void openReminderSettings()} /></XStack>}</>}
        {section === 'Motion' && <><Choices label="Motion" values={['system','full','reduced']} value={feedback.preferences.motion} onChange={value => feedback.update({ motion: value as 'system'|'full'|'reduced' })} /><Text color="#aaa">System follows the OS preference. Full overrides reduced motion. Reduced retains a static wave and instant feedback. Saved on this device.</Text></>}
        {(section === 'Sound' || section === 'Haptics') && <><Choices label={section} values={['Off','On']} value={(section === 'Sound' ? feedback.preferences.soundEnabled : feedback.preferences.vibrationEnabled) ? 'On' : 'Off'} onChange={value => feedback.update(section === 'Sound' ? { soundEnabled: value === 'On' } : { vibrationEnabled: value === 'On' })} /><Text color="#aaa">Independent preference, saved on this device. {section === 'Haptics' && Platform.OS === 'web' ? 'Browser haptics are unavailable.' : ''}</Text></>}
        {section === 'Intake context' && <><Field label="IANA timezone" value={zone} onChange={setZone} /><Choices label="Prior creatine use" values={['unknown','not-using','using','established']} value={prior.creatine} onChange={v => setPrior(p => ({ ...p, creatine: v as PriorUse['creatine'] }))} /><Field label="Optional creatine start · YYYY-MM-DD" value={start} onChange={setStart} /><Field label="Optional usual dose · g" value={dose} onChange={setDose} /><Choices label="Prior consistency" values={['occasional','most-days','daily']} value={prior.consistency ?? ''} onChange={v => setPrior(p => ({ ...p, consistency: v as PriorUse['consistency'] }))} /><Choices label="Prior caffeine use" values={['unknown','not-using','using']} value={prior.caffeine} onChange={v => setPrior(p => ({ ...p, caffeine: v as PriorUse['caffeine'] }))} /><Field label="Assumed caffeine half-life · hours" value={halfLife} onChange={setHalfLife} /><Field label="Bedtime · HH:mm" value={bedtime} onChange={setBedtime} /><Text color="#aaa">Prior use is context, not a measured body state. Caffeine estimates use known logged doses and the assumed clearance.</Text></>}
        {section === 'Delete account' && <><Text color="#ffb3aa">Permanently delete your account and its cloud intake records, profiles and preferences. This cannot be undone.</Text><Field label="Type DELETE to confirm" value={confirmation} onChange={setConfirmation} /><Text color="#aaa">Current password</Text><Input secureTextEntry value={password} onChangeText={setPassword} accessibilityLabel="Current password" minHeight={44} /><Action label={busy ? 'Deleting…' : 'Permanently delete account'} disabled={busy || confirmation !== 'DELETE' || !password} onPress={() => void run(async () => { await deleteAccount(password); setPassword(''); router.replace('/'); })} /></>}
        <Failure message={error} />
        {!['Motion','Sound','Haptics','Delete account'].includes(section ?? '') && <Action label={busy ? 'Saving…' : 'Save'} disabled={busy} onPress={() => void save()} />}
      </YStack></ScrollView>
    </PitwallSheet>
  </Screen></StateGate>;
}
