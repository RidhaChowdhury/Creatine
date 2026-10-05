import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ScrollView, Text, YStack } from 'tamagui';
import { useAppDispatch } from '@/store/hooks';
import { addSettings } from '@/features/settings/settingsSlice';
import { savePreferences } from '@/lib/drops/repository';
import type { PriorUse } from '@/lib/drops/types';
import { Action, Choices, Field, Failure } from '@/components/drops/ui';
export default function Onboarding() {
  const dispatch = useAppDispatch();
  const [name, setName] = useState(''), [start, setStart] = useState(''), [dose, setDose] = useState('');
  const [prior, setPrior] = useState<PriorUse>({ creatine: 'unknown', caffeine: 'unknown' });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  async function submit() {
    if (busy) return; setError(null);
    if (!name.trim()) { setError('Enter your name.'); return; }
    if (start && (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(Date.parse(start)) || new Date(start).toISOString().slice(0,10) !== start || start > new Date().toISOString().slice(0,10))) { setError('Enter a real start date, today or earlier.'); return; }
    if (dose && (!Number.isFinite(Number(dose)) || Number(dose) <= 0)) { setError('Usual dose must be positive grams.'); return; }
    setBusy(true);
    try {
      await savePreferences({ priorUse: { ...prior, startDate: start || undefined, usualDoseGrams: dose ? Number(dose) : undefined } });
      await dispatch(addSettings({ formData: { name: name.trim(), height: 0, weight: 0, sex: '' } })).unwrap();
      router.replace('/(tabs)');
    } catch (e) { setError((e as Error).message || 'Unable to save your profile.'); } finally { setBusy(false); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0c0c' }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24 }}><YStack width="100%" maxWidth={560} alignSelf="center" gap={20}>
    <Text fontFamily="$brand" fontSize={26} color="#e9e9e9">DROPS.</Text><Text fontFamily="$display" fontSize={42} color="#e9e9e9">Your profile</Text>
    <Text color="#aaa">Only your name is required. Targets are yours to configure in Settings.</Text>
    <Field label="Name" value={name} onChange={setName} />
    <Choices label="Prior creatine use · optional" values={['unknown','not-using','using','established']} value={prior.creatine} onChange={v => setPrior(p => ({ ...p, creatine: v as PriorUse['creatine'] }))} />
    <Field label="Optional creatine start · YYYY-MM-DD" value={start} onChange={setStart} /><Field label="Optional usual creatine dose · g" value={dose} onChange={setDose} />
    <Choices label="Prior consistency · optional" values={['occasional','most-days','daily']} value={prior.consistency ?? ''} onChange={v => setPrior(p => ({ ...p, consistency: v as PriorUse['consistency'] }))} />
    <Choices label="Prior caffeine use · optional" values={['unknown','not-using','using']} value={prior.caffeine} onChange={v => setPrior(p => ({ ...p, caffeine: v as PriorUse['caffeine'] }))} />
    <Text color="#aaa">Unknown keeps history uncertain. Prior use does not measure saturation or readiness. Body measurements are optional and aren't needed for logging.</Text>
    <Failure message={error} /><Action label={busy ? 'Saving…' : 'Continue'} disabled={busy} onPress={() => void submit()} />
  </YStack></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
