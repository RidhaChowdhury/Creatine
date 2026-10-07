import { addDays, dayInZone, wallTimeToInstant } from './dates';
import { dailyProgress, entryQuantity } from './domain';
import type { DropsSnapshot, DropsEntry, PerformanceResult } from './types';

export const MODEL_VERSION = 'intake-context-v1';
const HOUR = 3600000;
export function caffeineAt(doses: { at: number; mg: number }[], at: number, halfLife: number): number | null {
  if (!Number.isFinite(halfLife) || halfLife <= 0) return null;
  const result = doses.filter(dose => dose.at <= at).reduce((sum, dose) => sum + dose.mg * 2 ** (-(at - dose.at) / HOUR / halfLife), 0);
  return Number.isFinite(result) ? result : null;
}
export function evaluatePerformance(snapshot: DropsSnapshot, now: Date): PerformanceResult {
  const zone = snapshot.preferences.timezone, nowMs = now.getTime(), today = dayInZone(now, zone);
  const actual = snapshot.entries.filter(e => !e.consumedAtUtc || Date.parse(e.consumedAtUtc) <= nowMs);
  const byType = (type: string) => snapshot.trackers.filter(t => t.metricType === type);
  const rows = (type: string) => actual.filter(e => byType(type).some(t => t.id === e.trackerId));
  const total = (type: string, entries: DropsEntry[], unit: string) => entries.reduce((sum, e) => {
    const tracker = snapshot.trackers.find(t => t.id === e.trackerId)!;
    return sum + (entryQuantity(e, tracker, unit) ?? 0);
  }, 0);
  const coverage = (type: string, days: number, recencyHours: number, required = 1) => {
    const relevant = rows(type).filter(e => e.day >= addDays(today, 1 - days) && e.day <= today);
    const observed = new Set(relevant.map(e => e.day)).size;
    const instants = relevant.flatMap(e => e.consumedAtUtc ? [Date.parse(e.consumedAtUtc)] : []).filter(Number.isFinite);
    const age = instants.length ? (nowMs - Math.max(...instants)) / HOUR : null;
    return `${observed}/${days} observed days · ${age === null ? 'precise recency unknown' : age <= recencyHours ? 'recent' : 'stale'} · ${observed >= required ? 'density met' : 'sparse'}; completeness unknown`;
  };
  const caffeineRows = rows('caffeine');
  const known = caffeineRows.flatMap(e => {
    const tracker = snapshot.trackers.find(t => t.id === e.trackerId)!;
    const mg = entryQuantity(e, tracker, 'mg');
    const at = e.consumedAtUtc ? Date.parse(e.consumedAtUtc) : NaN;
    return mg !== null && Number.isFinite(at) ? [{ at, mg }] : [];
  });
  const forecast: { at: number; mg: number }[] = [];
  const reasons = ['Intake logs cannot identify individual hydration, muscle stores or physical readiness. No supported score or baseline range is available.',
    'Known-dose caffeine assumes immediate absorption and constant clearance; it is an amount equivalent, not measured blood concentration. Unlogged intake and earlier carryover remain unknown.',
    `Prior creatine use: ${snapshot.preferences.priorUse.creatine}; prior caffeine use: ${snapshot.preferences.priorUse.caffeine}. Self-reported established use does not establish readiness.`];
  for (const tracker of byType('caffeine').filter(t => !t.archived)) {
    for (const day of [today, addDays(today, 1)]) {
      const progress = dailyProgress(tracker, actual, day);
      for (const dose of progress.doses.filter(d => d.remaining > 0)) {
        try {
          const at = Date.parse(wallTimeToInstant(`${day}T${dose.dose.time}`, zone));
          const mg = entryQuantity({ amount: dose.remaining, unit: tracker.unit } as DropsEntry, tracker, 'mg');
          if (at > nowMs && at <= nowMs + 12 * HOUR && mg !== null) forecast.push({ at, mg });
        } catch { reasons.push(`Skipped ${tracker.name} forecast at ${day} ${dose.dose.time}: ambiguous or nonexistent local time.`); }
      }
    }
  }
  const creatineDays = new Map<string, number>();
  for (const entry of rows('creatine').filter(e => e.day < today)) {
    const tracker = snapshot.trackers.find(t => t.id === entry.trackerId)!;
    const grams = entryQuantity(entry, tracker, 'g');
    if (grams !== null) creatineDays.set(entry.day, (creatineDays.get(entry.day) ?? 0) + grams);
  }
  const streak = (minimum: number, cap: number) => {
    let count = 0, day = addDays(today, -1);
    while (count < cap && (creatineDays.get(day) ?? -1) >= minimum) { count++; day = addDays(day, -1); }
    return count;
  };
  const recentPrecise = known.filter(d => d.at >= nowMs - 72 * HOUR);
  const caffeineCoverage = `${recentPrecise.length} precise known doses in 72h · ${recentPrecise.some(d => d.at >= nowMs - 24 * HOUR) ? 'recent' : 'stale/no recent dose'} · ${caffeineRows.length - known.length} amount/time exclusions; completeness unknown`;
  return { modelVersion: MODEL_VERSION, asOf: now.toISOString(), state: 'insufficient', score: null, range: null, label: 'Readiness unavailable', reasons,
    contributors: [
      { key: 'water', label: 'Recorded water today', value: rows('water').some(e => e.day === today) ? total('water', rows('water').filter(e => e.day === today), 'mL') : null, unit: 'mL', detail: 'Recorded water, not total hydration. No future water assumed.', coverage: coverage('water', 7, 24) },
      { key: 'caffeine', label: 'Known-dose caffeine now', value: known.length ? caffeineAt(known, nowMs, snapshot.preferences.caffeineHalfLifeHours) : null, unit: 'mg', detail: `${snapshot.preferences.caffeineHalfLifeHours}h assumed half-life; logged doses only. Future scenario assumes remaining scheduled doses, with no catch-up doses.`, coverage: caffeineCoverage },
      { key: 'creatine', label: 'Creatine protocol context', value: creatineDays.size ? streak(3, 28) : null, unit: 'consecutive days ≥3g', detail: `Assuming monohydrate: ${streak(3, 28)}/28 daily-reference days; ${streak(20, 6)}/6 loading-reference days. This is dosing context, not saturation. Unknown days interrupt verification; stores are not reset.`, coverage: coverage('creatine', 30, 48, 21) },
    ], timeline: Array.from({ length: 49 }, (_, i) => {
      const at = nowMs + (i - 24) * HOUR / 2;
      return { at: new Date(at).toISOString(), score: null, low: null, high: null, planned: at > nowMs,
        caffeineMg: known.length || (at > nowMs && forecast.length) ? caffeineAt(at > nowMs ? [...known, ...forecast] : known, at, snapshot.preferences.caffeineHalfLifeHours) : null };
    }) };
}
