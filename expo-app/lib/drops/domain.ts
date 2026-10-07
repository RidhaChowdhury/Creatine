import { convertAmount } from './units';
import type { DropsTracker, DropsEntry, PlanVersion, DailyProgress } from './types';

export function planForDay(tracker: DropsTracker, day: string): PlanVersion | null {
  return [...tracker.plans].filter(plan => plan.effectiveFrom <= day)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null;
}

/** Source quantities stay unchanged. Unknown conversions are never summed. */
export function entryQuantity(entry: DropsEntry, tracker: DropsTracker, unit = tracker.unit): number | null {
  if (!Number.isFinite(entry.amount) || entry.amount <= 0) return null;
  try { return convertAmount(entry.amount, entry.unit, unit); } catch {
    if (tracker.gramsPerUnit && tracker.gramsPerUnit > 0 && entry.unit === tracker.unit && (unit === 'g' || unit === 'mg')) {
      return entry.amount * tracker.gramsPerUnit * (unit === 'mg' ? 1000 : 1);
    }
    return null;
  }
}

export function dailyProgress(tracker: DropsTracker, entries: DropsEntry[], day: string): DailyProgress {
  const logged = entries.filter(entry => entry.trackerId === tracker.id && entry.day === day)
    .reduce((sum, entry) => sum + (entryQuantity(entry, tracker) ?? 0), 0);
  const plan = planForDay(tracker, day);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const scheduled = plan?.mode === 'scheduled' && plan.days.includes(weekday);
  let available = logged;
  const doses = scheduled ? [...plan.doses].sort((a, b) => a.time.localeCompare(b.time)).flatMap(dose => {
    let required: number;
    try { required = convertAmount(dose.amount, dose.unit, tracker.unit); } catch { return []; }
    if (!Number.isFinite(required) || required <= 0) return [];
    const allocated = Math.min(available, required);
    available = Math.max(0, available - allocated);
    return [{ dose, allocated, remaining: Math.max(0, required - allocated), complete: allocated >= required - 1e-9 }];
  }) : [];
  const planned = doses.reduce((sum, dose) => sum + dose.allocated + dose.remaining, 0);
  return { doses, completed: doses.filter(dose => dose.complete).length, total: doses.length, planned, logged,
    remaining: Math.max(0, planned - logged), beyond: Math.max(0, logged - planned) };
}
