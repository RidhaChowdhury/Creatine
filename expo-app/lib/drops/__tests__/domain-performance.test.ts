import { dailyProgress, planForDay } from '../domain';
import { caffeineAt, evaluatePerformance } from '../performance';
import { trackerInsights } from '../insights';
import { addDays } from '../dates';
import type { DropsTracker, DropsSnapshot, DropsEntry } from '../types';

const tracker: DropsTracker = { id: 'c', name: 'Creatine', metricType: 'creatine', category: 'supplement', unit: 'g', savedDose: 5, archived: false,
  plans: [{ id: 'p', effectiveFrom: '2026-01-01', mode: 'scheduled', days: [0,1,2,3,4,5,6], doses: [{ id: 'a', time: '09:00', amount: 5, unit: 'g' }, { id: 'b', time: '18:00', amount: 10, unit: 'g' }], target: 15, limit: null, unit: 'g' }] };
const now = new Date('2026-10-04T17:00:00Z');
const entry = (amount: number, day = '2026-10-04', changes: Partial<DropsEntry> = {}): DropsEntry => ({ id: `${day}-${amount}`, trackerId: 'c', storageKind: 'tracker', name: 'Creatine', amount, unit: 'g', consumedAt: `${day}T12:00:00Z`, consumedAtUtc: `${day}T12:00:00Z`, legacyLocal: null, day, note: '', version: 1, ...changes });
const snapshot = (entries: DropsEntry[] = [], trackers = [tracker]): DropsSnapshot => ({ trackers, entries, primaryTrackerId: 'c', preferences: { timezone: 'America/Chicago', waterPresets: [], prominentPresetIds: [], remindersEnabled: false, caffeineHalfLifeHours: 5, bedtime: '22:00', priorUse: { creatine: 'unknown', caffeine: 'unknown' } } });
test('accumulates unequal doses chronologically and preserves beyond-plan quantity', () => {
  const progress = dailyProgress(tracker, [entry(2), entry(5)], '2026-10-04');
  expect(progress.doses.map(d => [d.allocated, d.remaining, d.complete])).toEqual([[5,0,true],[2,8,false]]);
  expect(progress.completed).toBe(1); expect(progress.remaining).toBe(8);
  expect(dailyProgress(tracker, [entry(20)], '2026-10-04').beyond).toBe(5);
  expect(dailyProgress(tracker, [], '2026-10-04').completed).toBe(0);
});
test('quantity unit conversion, version selection and no as-needed obligations', () => {
  expect(dailyProgress(tracker, [entry(7000, undefined, { unit: 'mg' })], '2026-10-04').logged).toBe(7);
  const changed = { ...tracker, plans: [...tracker.plans, { ...tracker.plans[0], id: 'new', effectiveFrom: '2026-10-04', mode: 'as-needed' as const }] };
  expect(planForDay(changed, '2026-10-03')?.id).toBe('p');
  expect(dailyProgress(changed, [entry(7)], '2026-10-04').total).toBe(0);
  expect(dailyProgress({ ...tracker, plans: [{ ...tracker.plans[0], days: [1] }] }, [], '2026-10-04').total).toBe(0);
});
test('known-dose decay exact half-lives, carryover and no future contamination', () => {
  expect(caffeineAt([{ at: 0, mg: 100 }, { at: 18000000, mg: 50 }], 0, 5)).toBe(100);
  expect(caffeineAt([{ at: 0, mg: 100 }], 18000000, 5)).toBe(50);
  expect(caffeineAt([{ at: 0, mg: 100 }], 36000000, 5)).toBe(25);
  expect(caffeineAt([{ at: 0, mg: 100 }, { at: 18000000, mg: 50 }], 18000000, 5)).toBe(100);
  expect(caffeineAt([], 0, 0)).toBeNull();
});
test('empty, dense and established use never fabricate readiness; same-day taps remain one observed day', () => {
  const sparse = snapshot(Array.from({ length: 30 }, (_, i) => entry(i + 1)));
  const dense = snapshot(Array.from({ length: 30 }, (_, i) => entry(3, addDays('2026-10-04', -i))));
  dense.preferences.priorUse.creatine = 'established';
  for (const s of [snapshot(), sparse, dense]) {
    const result = evaluatePerformance(s, now);
    expect(result.state).toBe('insufficient'); expect(result.score).toBeNull(); expect(result.range).toBeNull();
    expect(result.timeline).toHaveLength(49); expect(result.timeline[24].at).toBe(now.toISOString());
  }
  expect(evaluatePerformance(sparse, now).contributors[2].coverage).toContain('1/30');
  expect(evaluatePerformance(dense, now).contributors[2].coverage).toContain('30/30');
  expect(evaluatePerformance(dense, now).contributors[2].value).toBe(28);
});
test('legacy caffeine contributes daily intake but cannot become a precise kinetic dose', () => {
  const c = { ...tracker, metricType: 'caffeine' as const, unit: 'mg' };
  const s = snapshot([entry(100, undefined, { unit: 'mg', consumedAtUtc: null, legacyLocal: '2026-10-04T07:00:00' })], [c]);
  expect(evaluatePerformance(s, now).contributors[1].value).toBeNull();
  expect(trackerInsights(s, c, 7, now).series[6].amount).toBe(100);
});
test('forecast only remaining future quantity; archived and as-needed do not project', () => {
  const c = { ...tracker, metricType: 'caffeine' as const, unit: 'mg', plans: [{ ...tracker.plans[0], unit: 'mg', doses: [{ id: 'a', time: '09:00', amount: 50, unit: 'mg' }, { id: 'b', time: '18:00', amount: 100, unit: 'mg' }] }] };
  const s = snapshot([entry(70, undefined, { unit: 'mg', consumedAtUtc: now.toISOString() })], [c]);
  const timeline = evaluatePerformance(s, now).timeline;
  expect(timeline[24].caffeineMg).toBe(70);
  const atDose = timeline.find(p => p.at === '2026-10-04T23:00:00.000Z')!;
  expect(atDose.caffeineMg).toBeCloseTo(70 * 2 ** (-6 / 5) + 80);
  expect(evaluatePerformance({ ...s, trackers: [{ ...c, archived: true }] }, now).timeline[36].caffeineMg).toBeCloseTo(70 * 2 ** (-6 / 5));
});
test('missing days never become zero, historical targets change, observed rolling denominator excludes missing', () => {
  const s = snapshot([entry(3, '2026-10-01'), entry(5)]);
  const result = trackerInsights(s, tracker, 7, now);
  expect(result.observedDays).toBe(2); expect(result.average).toBe(4);
  expect(result.series[5].amount).toBeNull(); expect(result.series[6].rolling).toBe(4);
  expect(result.targetDays).toBe(2);
});
test('DST forecast skips ambiguous repeated-hour time instead of inventing a precise dose', () => {
  const c = { ...tracker, metricType: 'caffeine' as const, unit: 'mg', plans: [{ ...tracker.plans[0], unit: 'mg', doses: [{ id: 'd', time: '01:30', amount: 100, unit: 'mg' }] }] };
  const result = evaluatePerformance(snapshot([], [c]), new Date('2026-11-01T05:00:00Z'));
  expect(result.reasons.some(r => r.includes('ambiguous'))).toBe(true);
  expect(result.timeline.every(p => p.caffeineMg === null)).toBe(true);
});
test('DST spring-gap forecast is skipped and midnight uses civil-day boundaries', () => {
  const c = { ...tracker, metricType: 'caffeine' as const, unit: 'mg', plans: [{ ...tracker.plans[0], unit: 'mg', doses: [{ id: 'd', time: '02:30', amount: 100, unit: 'mg' }] }] };
  const result = evaluatePerformance(snapshot([], [c]), new Date('2026-03-08T06:00:00Z'));
  expect(result.reasons.some(r => r.includes('nonexistent'))).toBe(true);
  expect(result.timeline.every(p => p.caffeineMg === null)).toBe(true);
  const data = trackerInsights(snapshot([entry(3, '2026-03-07'), entry(5, '2026-03-08')]), tracker, 7, new Date('2026-03-09T04:30:00Z'));
  expect(data.series[6].day).toBe('2026-03-08'); expect(data.observedDays).toBe(2);
});
test('historical target versions retain source units and future actual records stay excluded', () => {
  const t = { ...tracker, plans: [tracker.plans[0], { ...tracker.plans[0], id: 'new', effectiveFrom: '2026-10-04', target: 7000, unit: 'mg' }] };
  const data = trackerInsights(snapshot([entry(3, '2026-10-03'), entry(5), entry(100, undefined, { consumedAtUtc: '2026-10-04T23:00:00Z' })], [t]), t, 7, now);
  expect(data.series[5].target).toBe(15); expect(data.series[6].target).toBe(7);
  expect(data.series[6].amount).toBe(5); expect(data.series[6].shortfall).toBe(2);
});
test('unknown mass conversion is excluded; explicit grams per source unit enables caffeine model', () => {
  const t = { ...tracker, metricType: 'caffeine' as const, unit: 'tablet', plans: [] };
  const s = snapshot([entry(1, undefined, { unit: 'tablet', consumedAtUtc: now.toISOString() })], [t]);
  expect(evaluatePerformance(s, now).contributors[1].value).toBeNull();
  expect(evaluatePerformance({ ...s, trackers: [{ ...t, gramsPerUnit: 0.1 }] }, now).contributors[1].value).toBe(100);
});
