/**
 * Utility functions to compute intake & hydration metrics.
 *
 * Assumptions / Notes:
 * - Log objects are expected to have an ISO 8601 timestamp property `consumed_at` (creatine/water)
 *   and an `amount` number (grams for creatine, ml or oz for water depending on app convention).
 * - Date granularity is per local day derived from the timestamp (using toISOString slice 0-10).
 * - "Average dose time" (creatine) selects ONE representative dose per day: if multiple doses
 *   exist, we pick the one whose time-of-day (minutes since midnight) is closest to the current
 *   running mean. (For the first day we take the earliest dose.) This rewards consistency.
 * - "Through most days" requirement interpreted as a windowed average (e.g. last 7/30/90 days).
 *   You can call the window variant with any window length.
 * - Adherence: percentage of days meeting the criterion (>=1 creatine entry; water total >= goal)
 *   over a period (specified by `periodDays`, else entire history up to `referenceDate`).
 * - Streaks: counted as consecutive days up to (and including) `referenceDate` meeting the criterion.
 */

export interface IntakeLog {
   consumed_at: string; // ISO timestamp
   amount: number; // grams (creatine) or volume (water)
}

export interface AverageDoseTimeResult {
   minutesSinceMidnight: number; // -1 if insufficient data
   hhmm: string; // formatted HH:MM ("--:--" if none)
   daysCounted: number; // number of days contributing
}

const MIN_PER_HOUR = 60;

const toDateKey = (iso: string): string => {
   try {
      return new Date(iso).toISOString().slice(0, 10);
   } catch {
      return iso.slice(0, 10);
   }
};

const minutesSinceMidnight = (iso: string): number => {
   const d = new Date(iso);
   return d.getHours() * MIN_PER_HOUR + d.getMinutes();
};

const formatHHMM = (mins: number): string => {
   if (mins < 0) return '--:--';
   const h = Math.floor(mins / MIN_PER_HOUR);
   const m = mins % MIN_PER_HOUR;
   return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Computes the average creatine dose time across days choosing one representative dose per day.
 */
export function getAverageCreatineDoseTime(creatineLogs: IntakeLog[]): AverageDoseTimeResult {
   if (!creatineLogs.length) return { minutesSinceMidnight: -1, hhmm: '--:--', daysCounted: 0 };

   // Group by day
   const byDay: Record<string, IntakeLog[]> = {};
   for (const log of creatineLogs) {
      const key = toDateKey(log.consumed_at);
      (byDay[key] ||= []).push(log);
   }

   const dayKeys = Object.keys(byDay).sort();
   const chosenTimes: number[] = [];

   for (const day of dayKeys) {
      const doses = byDay[day];
      if (!doses.length) continue;
      const times = doses.map((d) => minutesSinceMidnight(d.consumed_at));
      let chosen: number;
      if (!chosenTimes.length) {
         // first day: pick earliest dose to seed
         chosen = Math.min(...times);
      } else {
         const currentMean = chosenTimes.reduce((a, b) => a + b, 0) / chosenTimes.length;
         // pick dose whose time is closest to current mean
         chosen = times.reduce(
            (best, t) => (Math.abs(t - currentMean) < Math.abs(best - currentMean) ? t : best),
            times[0]
         );
      }
      chosenTimes.push(chosen);
   }

   if (!chosenTimes.length) return { minutesSinceMidnight: -1, hhmm: '--:--', daysCounted: 0 };

   const avg = Math.round(chosenTimes.reduce((a, b) => a + b, 0) / chosenTimes.length);
   return { minutesSinceMidnight: avg, hhmm: formatHHMM(avg), daysCounted: chosenTimes.length };
}

/**
 * Windowed average creatine dose time over the last `windowDays` ending at `referenceDate` (today default).
 */
export function getAverageCreatineDoseTimeWindow(
   creatineLogs: IntakeLog[],
   windowDays: number,
   referenceDate: Date = new Date()
): AverageDoseTimeResult {
   const ref = new Date(referenceDate);
   ref.setHours(0, 0, 0, 0);
   const start = new Date(ref);
   start.setDate(ref.getDate() - (windowDays - 1));
   const startKey = start.toISOString().slice(0, 10);
   const endKey = ref.toISOString().slice(0, 10);

   const filtered = creatineLogs.filter((l) => {
      const k = toDateKey(l.consumed_at);
      return k >= startKey && k <= endKey;
   });
   return getAverageCreatineDoseTime(filtered);
}

/**
 * Adherence rate: fraction of days with >=1 creatine entry.
 * If periodDays provided, consider only the last `periodDays` days ending at referenceDate.
 */
export function getCreatineAdherenceRate(
   creatineLogs: IntakeLog[],
   periodDays?: number,
   referenceDate: Date = new Date()
): number {
   if (!creatineLogs.length) return 0;
   const ref = new Date(referenceDate);
   ref.setHours(0, 0, 0, 0);
   let startDate: Date;
   if (periodDays) {
      startDate = new Date(ref);
      startDate.setDate(ref.getDate() - (periodDays - 1));
   } else {
      const earliest = creatineLogs
         .map((l) => new Date(l.consumed_at))
         .reduce((a, b) => (a < b ? a : b));
      startDate = new Date(earliest);
      startDate.setHours(0, 0, 0, 0);
   }
   const startKey = startDate.toISOString().slice(0, 10);
   const endKey = ref.toISOString().slice(0, 10);
   const daysSpan = Math.floor((ref.getTime() - startDate.getTime()) / 86400000) + 1;
   const daysWithDose = new Set<string>();
   for (const log of creatineLogs) {
      const k = toDateKey(log.consumed_at);
      if (k >= startKey && k <= endKey) daysWithDose.add(k);
   }
   return daysSpan ? daysWithDose.size / daysSpan : 0;
}

/**
 * Hydration adherence: fraction of days meeting or exceeding water goal (volume units must match goal).
 */
export function getHydrationAdherenceRate(
   waterLogs: IntakeLog[],
   waterGoal: number,
   periodDays?: number,
   referenceDate: Date = new Date()
): number {
   if (!waterLogs.length || waterGoal <= 0) return 0;
   const ref = new Date(referenceDate);
   ref.setHours(0, 0, 0, 0);
   let startDate: Date;
   if (periodDays) {
      startDate = new Date(ref);
      startDate.setDate(ref.getDate() - (periodDays - 1));
   } else {
      const earliest = waterLogs
         .map((l) => new Date(l.consumed_at))
         .reduce((a, b) => (a < b ? a : b));
      startDate = new Date(earliest);
      startDate.setHours(0, 0, 0, 0);
   }
   const totalsByDay: Record<string, number> = {};
   for (const log of waterLogs) {
      const k = toDateKey(log.consumed_at);
      if (k < startDate.toISOString().slice(0, 10) || k > ref.toISOString().slice(0, 10)) continue;
      totalsByDay[k] = (totalsByDay[k] || 0) + log.amount;
   }
   const daysSpan = Math.floor((ref.getTime() - startDate.getTime()) / 86400000) + 1;
   let successDays = 0;
   for (let i = 0; i < daysSpan; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const k = d.toISOString().slice(0, 10);
      if ((totalsByDay[k] || 0) >= waterGoal) successDays++;
   }
   return daysSpan ? successDays / daysSpan : 0;
}

export interface TotalIntakeResult {
   total: number;
   days: number;
}

export function getTotalCreatine(creatineLogs: IntakeLog[]): TotalIntakeResult {
   if (!creatineLogs.length) return { total: 0, days: 0 };
   const total = creatineLogs.reduce((s, l) => s + (l.amount || 0), 0);
   const daySet = new Set(creatineLogs.map((l) => toDateKey(l.consumed_at)));
   return { total, days: daySet.size };
}

export function getTotalWater(waterLogs: IntakeLog[]): TotalIntakeResult {
   if (!waterLogs.length) return { total: 0, days: 0 };
   const total = waterLogs.reduce((s, l) => s + (l.amount || 0), 0);
   const daySet = new Set(waterLogs.map((l) => toDateKey(l.consumed_at)));
   return { total, days: daySet.size };
}

/** Generic streak helper */
function computeStreak(daysPredicate: (dayKey: string) => boolean, referenceDate: Date): number {
   const ref = new Date(referenceDate);
   ref.setHours(0, 0, 0, 0);
   let streak = 0;
   while (true) {
      const key = ref.toISOString().slice(0, 10);
      if (!daysPredicate(key)) break;
      streak++;
      ref.setDate(ref.getDate() - 1);
   }
   return streak;
}

export function getCreatineStreak(
   creatineLogs: IntakeLog[],
   referenceDate: Date = new Date()
): number {
   if (!creatineLogs.length) return 0;
   const daysWithDose = new Set(creatineLogs.map((l) => toDateKey(l.consumed_at)));
   return computeStreak((k) => daysWithDose.has(k), referenceDate);
}

export function getHydrationStreak(
   waterLogs: IntakeLog[],
   waterGoal: number,
   referenceDate: Date = new Date()
): number {
   if (!waterLogs.length || waterGoal <= 0) return 0;
   const totalsByDay: Record<string, number> = {};
   for (const log of waterLogs) {
      const k = toDateKey(log.consumed_at);
      totalsByDay[k] = (totalsByDay[k] || 0) + log.amount;
   }
   return computeStreak((k) => (totalsByDay[k] || 0) >= waterGoal, referenceDate);
}

/** Convenience aggregation returning all metrics at once (optional use). */
export function getAllMetrics(params: {
   creatineLogs: IntakeLog[];
   waterLogs: IntakeLog[];
   waterGoal: number;
   periodDays?: number;
   referenceDate?: Date;
   windowDays?: number;
}) {
   const {
      creatineLogs,
      waterLogs,
      waterGoal,
      periodDays,
      referenceDate = new Date(),
      windowDays = 30
   } = params;
   return {
      averageDoseTime: getAverageCreatineDoseTime(creatineLogs),
      averageDoseTimeWindow: getAverageCreatineDoseTimeWindow(
         creatineLogs,
         windowDays,
         referenceDate
      ),
      creatineAdherence: getCreatineAdherenceRate(creatineLogs, periodDays, referenceDate),
      hydrationAdherence: getHydrationAdherenceRate(
         waterLogs,
         waterGoal,
         periodDays,
         referenceDate
      ),
      totalCreatine: getTotalCreatine(creatineLogs),
      totalWater: getTotalWater(waterLogs),
      creatineStreak: getCreatineStreak(creatineLogs, referenceDate),
      hydrationStreak: getHydrationStreak(waterLogs, waterGoal, referenceDate)
   };
}

// End of metrics utilities
