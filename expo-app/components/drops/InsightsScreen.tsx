import React, { useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { useDrops } from '@/features/drops/DropsProvider';
import { trackerInsights } from '@/lib/drops/insights';
import { evaluatePerformance } from '@/lib/drops/performance';
import { addDays, dayInZone, wallTimeToInstant } from '@/lib/drops/dates';
import { Action, Screen, StateGate } from './ui';
import { DataChart } from './DataChart';
import PerformanceSheet from './PerformanceSheet';
export { DataChart } from './DataChart';

export default function InsightsScreen() {
  const { snapshot, now } = useDrops();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ranges, setRanges] = useState<Record<string, number>>({});
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const tracker = snapshot?.trackers.find(t => t.id === selectedId) ?? snapshot?.trackers[0];
  const days = tracker ? ranges[tracker.id] ?? 7 : 7;
  const data = snapshot && tracker ? trackerInsights(snapshot, tracker, days, now) : null;
  const performance = snapshot ? evaluatePerformance(snapshot, now) : null;
  const format = (v: number | null) => v === null ? '—' : String(Number(v.toFixed(1)));
  const caffeine = tracker?.metricType === 'caffeine';
  const trackerPerformance = snapshot && tracker && caffeine ? evaluatePerformance({ ...snapshot, trackers: snapshot.trackers.filter(t => t.id === tracker.id), entries: snapshot.entries.filter(e => e.trackerId === tracker.id) }, now) : performance;
  let bedtimeValue: number | null = null;
  if (snapshot && caffeine) {
    let day = dayInZone(now, snapshot.preferences.timezone);
    try {
      let instant = wallTimeToInstant(`${day}T${snapshot.preferences.bedtime}`, snapshot.preferences.timezone);
      if (Date.parse(instant) <= now.getTime()) { day = addDays(day, 1); instant = wallTimeToInstant(`${day}T${snapshot.preferences.bedtime}`, snapshot.preferences.timezone); }
      const hours = (Date.parse(instant) - now.getTime()) / 3600000;
      const knownNow = trackerPerformance?.contributors.find(c => c.key === 'caffeine')?.value;
      bedtimeValue = knownNow === null || knownNow === undefined ? null : knownNow * 2 ** (-hours / snapshot.preferences.caffeineHalfLifeHours);
    } catch { /* Ambiguous bedtime remains unknown. */ }
  }
  const first = caffeine ? trackerPerformance?.contributors.find(c => c.key === 'caffeine')?.value ?? null : data?.average ?? null;
  const timedTotal = data?.timeShare.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const morningShare = timedTotal > 0 ? 100 * (data?.timeShare.filter(p => p.hour < 12).reduce((sum, p) => sum + p.amount, 0) ?? 0) / timedTotal : null;
  return <StateGate><Screen title="Insights" action={<Action label="Performance" onPress={() => setPerformanceOpen(true)} />}>
    <Text color="#aaa">{performance?.label}</Text>
    <XStack flexWrap="wrap" gap={8}>{snapshot?.trackers.map(t => <Action key={t.id} label={`${t.name}${t.archived ? ' · archived' : ''}`} selected={t.id === tracker?.id} onPress={() => setSelectedId(t.id)} />)}</XStack>
    {tracker && data ? <>
      <XStack gap={8}>{[7, 30, 90].map(range => <Action key={range} label={`${range} days`} selected={days === range} onPress={() => setRanges(previous => ({ ...previous, [tracker.id]: range }))} />)}</XStack>
      <XStack gap={28} flexWrap="wrap">
        {[{ label: caffeine ? 'KNOWN-DOSE NOW · MG' : `OBSERVED AVERAGE · ${tracker.unit}`, value: format(first) },
          { label: caffeine ? 'AT BEDTIME · MG' : 'OBSERVED DAYS', value: caffeine ? format(bedtimeValue) : `${data.observedDays}/${days}` },
          { label: caffeine ? `LOGGED TODAY · ${tracker.unit}` : tracker.metricType === 'creatine' ? 'PLANNED-DAY STREAK' : tracker.metricType === 'water' ? 'BEFORE NOON · TIMED %' : tracker.metricType === 'fiber' ? `OBSERVED SHORTFALL · ${tracker.unit}` : 'INTAKE OCCASIONS', value: caffeine ? format(data.series[data.series.length - 1].amount) : tracker.metricType === 'water' ? format(morningShare) : tracker.metricType === 'fiber' ? format(data.targetDays ? data.series.reduce((sum, p) => sum + (p.shortfall ?? 0), 0) : null) : String(tracker.metricType === 'creatine' ? data.streak : data.occasions) }].map(item => <YStack key={item.label} gap={5}><Text fontFamily="$display" fontSize={42} color="#e9e9e9">{item.value}</Text><Text fontFamily="$mono" fontSize={10} color="#aaa">{item.label}</Text></YStack>)}
      </XStack>
      <Text color="#aaa">{data.within}/{data.targetDays} observed target days within configured bounds. Missing days remain unknown. {data.excluded ? `${data.excluded} incompatible quantities excluded.` : ''}</Text>
      {tracker.metricType === 'creatine' && <Text color="#aaa">Protocol elapsed: {data.protocolElapsedDays ?? 'unknown'} civil days from reported start or first log. Elapsed time does not establish consistent dosing or saturation.</Text>}
      <Text color="#e9e9e9">{caffeine ? 'Recorded and planned caffeine model' : 'Daily recorded intake'}</Text>
      {caffeine && trackerPerformance ? <DataChart key={tracker.id} points={trackerPerformance.timeline.map(p => ({ label: new Date(p.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: snapshot!.preferences.timezone }), value: p.caffeineMg, detail: p.planned ? 'Planned scenario · remaining scheduled doses' : 'Recorded-dose model' }))} unit="mg" nowIndex={24} /> : <DataChart key={`${tracker.id}-${days}-daily`} points={data.series.map(p => ({ label: p.day, value: p.amount, detail: `Recorded · target ${format(p.target)} ${tracker.unit} · ${p.observed ? 'observed' : 'unlogged'} · ${p.completed}/${p.planned} doses · shortfall ${format(p.shortfall)}` }))} unit={tracker.unit} />}
      <Text color="#e9e9e9">{tracker.metricType === 'water' ? 'Time of day · precise timestamps' : caffeine ? 'Daily recorded caffeine' : '7-day observed rolling average'}</Text>
      <DataChart key={`${tracker.id}-${days}-secondary`} points={tracker.metricType === 'water' ? data.timeShare.map(p => ({ label: `${p.hour}:00`, value: p.occasions ? p.amount : null, detail: `${timedTotal > 0 ? format(100 * p.amount / timedTotal) : 'unknown'}% of precisely timed volume · ${p.occasions} occasions; ${data.timedOccasions}/${data.occasions} timed total` })) : data.series.map(p => ({ label: p.day, value: caffeine ? p.amount : p.rolling, detail: caffeine ? 'Recorded quantity · unlogged days unknown' : 'Mean among observed days in preceding 7 days; missing days excluded' }))} unit={tracker.unit} />
      <Text color="#888" fontSize={12}>{tracker.metricType === 'fiber' ? 'Supplemental fiber only; other food sources are not inferred.' : tracker.metricType === 'water' ? 'Recorded water only; this does not measure total body hydration.' : tracker.metricType === 'creatine' ? performance?.contributors.find(c => c.key === 'creatine')?.detail : caffeine ? 'Known-dose amount equivalent, not measured concentration or energy. Bedtime assumes no additional caffeine. Curve assumes remaining future scheduled doses.' : 'Recorded quantities and your configured plan; no physiological effect is inferred.'}</Text>
    </> : <Text color="#aaa">Create a tracker to review its history.</Text>}
    <PerformanceSheet open={performanceOpen} onOpenChange={setPerformanceOpen} />
  </Screen></StateGate>;
}
