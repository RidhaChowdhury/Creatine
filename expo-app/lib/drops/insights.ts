import { addDays, dayInZone } from './dates';
import { dailyProgress, entryQuantity, planForDay } from './domain';
import type { DropsSnapshot, DropsTracker, DropsEntry } from './types';

export function trackerInsights(snapshot: DropsSnapshot, tracker: DropsTracker, days: number, now: Date) {
  const today = dayInZone(now, snapshot.preferences.timezone);
  const series = Array.from({ length: days }, (_, index) => {
    const day = addDays(today, index - days + 1);
    const entries = snapshot.entries.filter(e => e.trackerId === tracker.id && e.day === day && (!e.consumedAtUtc || Date.parse(e.consumedAtUtc) <= now.getTime()));
    const quantities = entries.map(e => entryQuantity(e, tracker));
    const observed = entries.length > 0;
    const amount = observed && quantities.every(q => q !== null) ? quantities.reduce<number>((sum, q) => sum + (q ?? 0), 0) : null;
    const plan = planForDay(tracker, day);
    let target = plan?.target ?? null, limit = plan?.limit ?? null;
    if (plan) {
      // Targets belong to their version's source unit, never to the current display unit implicitly.
      const convert = (value: number | null) => value === null ? null : value === 0 ? 0 : entryQuantity({ amount: value, unit: plan.unit } as DropsEntry, tracker);
      target = convert(target); limit = convert(limit);
    }
    const progress = dailyProgress(tracker, entries, day);
    return { day, amount, target, limit, observed, occasions: entries.length, excluded: quantities.filter(q => q === null).length,
      completed: progress.completed, planned: progress.total, shortfall: amount !== null && target !== null ? Math.max(0, target - amount) : null,
      rolling: null as number | null };
  });
  series.forEach((point, i) => {
    const known = series.slice(Math.max(0, i - 6), i + 1).filter(p => p.amount !== null);
    point.rolling = known.length ? known.reduce((sum, p) => sum + p.amount!, 0) / known.length : null;
  });
  const observed = series.filter(p => p.amount !== null);
  const targetDays = observed.filter(p => p.target !== null);
  const within = targetDays.filter(p => p.amount! >= p.target! && (p.limit === null || p.amount! <= p.limit)).length;
  let streak = 0;
  // Today is still in progress: count completed historical planned days backwards.
  for (let i = series.length - 2; i >= 0; i--) {
    const p = series[i];
    if (!p.planned) continue;
    if (p.amount === null || p.completed < p.planned) break;
    streak++;
  }
  const timeShare = Array.from({ length: 24 }, (_, hour) => ({ hour, amount: 0, occasions: 0 }));
  let timedOccasions = 0;
  for (const entry of snapshot.entries.filter(e => e.trackerId === tracker.id && e.day >= series[0].day && e.day <= today)) {
    if (!entry.consumedAtUtc || Date.parse(entry.consumedAtUtc) > now.getTime()) continue;
    const quantity = entryQuantity(entry, tracker);
    if (quantity === null) continue;
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: snapshot.preferences.timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(entry.consumedAtUtc)));
    timeShare[hour].amount += quantity; timeShare[hour].occasions++; timedOccasions++;
  }
  const firstRecorded = snapshot.entries.filter(e => e.trackerId === tracker.id && e.day <= today).map(e => e.day).sort()[0];
  const start = tracker.metricType === 'creatine' ? snapshot.preferences.priorUse.startDate ?? firstRecorded : firstRecorded;
  const protocolElapsedDays = start && start <= today ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) : null;
  return { series, protocolElapsedDays, average: observed.length ? observed.reduce((sum, p) => sum + p.amount!, 0) / observed.length : null,
    observedDays: observed.length, days, within, targetDays: targetDays.length, occasions: series.reduce((sum, p) => sum + p.occasions, 0),
    streak, timeShare, timedOccasions, excluded: series.reduce((sum, p) => sum + p.excluded, 0) };
}
