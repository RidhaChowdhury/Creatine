import { Platform } from 'react-native';
import { supabase } from '../supabase';
import { addEntry, loadSnapshot } from './repository';
import { addDays, dayInZone } from './dates';
import { convertAmount } from './units';
import type { DropsEntry, DropsTracker } from './types';

const prefix = 'sample-history:v1:';
const note = 'Sample data — not actual intake.';
const metrics = ['water', 'creatine', 'fiber', 'caffeine'] as const;
type Metric = typeof metrics[number];
export type SampleHistoryResult = {
  added: number; existing: number; total: number; skippedDays: number;
  fromDay: string; toDay: string;
};

/** Reject configured cloud clients even when signed out. Never seed hosted or native apps. */
function requireLocalPreview() {
  if (supabase || Platform.OS !== 'web' || typeof window === 'undefined' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname)) {
    throw new Error('Sample history is available only in the local web preview without cloud storage.');
  }
}
function eligible(tracker: DropsTracker | undefined, metric: Metric): tracker is DropsTracker {
  if (!tracker || tracker.archived || tracker.metricType !== metric ||
      tracker.category !== (metric === 'water' ? 'water' : 'supplement')) return false;
  try { convertAmount(1, metric === 'water' ? 'oz' : metric === 'caffeine' ? 'mg' : 'g', tracker.unit); return true; }
  catch { return false; }
}
function isSample(entry: DropsEntry) { return entry.id.startsWith(prefix); }
function slots(metric: Metric, day: string) {
  // The civil date, rather than its distance from today, keeps overlapping reruns canonical.
  const variation = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000) % 4;
  if (metric === 'water') return ['08:00:00','12:00:00','17:00:00','20:00:00'].map((time, index) => ({ time, amount: 12 + 4 * ((variation + index) % 3), unit: 'oz' }));
  if (metric === 'creatine') return [{ time:'08:30:00', amount:variation % 2 ? 3 : 5, unit:'g' }];
  if (metric === 'fiber') return [{ time:'12:30:00', amount:3 + variation, unit:'g' }];
  return [{ time:'09:00:00', amount:75 + 25 * variation, unit:'mg' }];
}

/** Fill only empty builtin tracker/days in the previous 30 complete saved-timezone days.
 * Repository operation IDs retain retry receipts, including samples deliberately deleted later.
 * Profiles, plans, settings, custom trackers and medications are never written.
 */
export async function addSampleHistory(options: { onProgress?: (completed: number, total: number) => void } = {}): Promise<SampleHistoryResult> {
  requireLocalPreview();
  const initial = await loadSnapshot();
  const timezone = initial.preferences.timezone;
  const today = dayInZone(new Date(), timezone);
  const result: SampleHistoryResult = { added:0, existing:0, total:0, skippedDays:0, fromDay:addDays(today,-30), toDay:addDays(today,-1) };
  const candidates: { day:string; metric:Metric; trackerId:string }[] = [];
  for (let offset=1; offset<=30; offset++) for (const metric of metrics) {
    const day = addDays(today,-offset), trackerId = `builtin:${metric}`;
    const tracker = initial.trackers.find(t=>t.id===trackerId);
    if (!eligible(tracker,metric) || initial.entries.some(e=>e.trackerId===trackerId && e.day===day && !isSample(e))) { result.skippedDays++; continue; }
    candidates.push({day,metric,trackerId}); result.total += slots(metric,day).length;
  }
  let completed = 0;
  options.onProgress?.(completed,result.total);
  for (const {day,metric,trackerId} of candidates) for (const [index,slot] of slots(metric,day).entries()) {
    requireLocalPreview();
    const current = await loadSnapshot();
    if (current.preferences.timezone !== timezone) throw new Error('Timezone changed while adding samples. Retry with the current timezone.');
    const operationId = `${prefix}${day}:${trackerId}:${index}`;
    // Recheck real history and archive changes immediately before each deliberate add.
    if (!eligible(current.trackers.find(t=>t.id===trackerId),metric) || current.entries.some(e=>e.trackerId===trackerId && e.day===day && !isSample(e))) {
      completed++; options.onProgress?.(completed,result.total); continue;
    }
    if (current.entries.some(e=>e.id===operationId)) result.existing++;
    else {
      requireLocalPreview();
      await addEntry({trackerId,amount:slot.amount,unit:slot.unit,consumedAt:`${day}T${slot.time}`,note},operationId);
      // A retained receipt for a deliberately deleted sample does not recreate that entry.
      if ((await loadSnapshot()).entries.some(e=>e.id===operationId)) result.added++;
      else result.existing++;
    }
    completed++; options.onProgress?.(completed,result.total);
  }
  return result;
}
