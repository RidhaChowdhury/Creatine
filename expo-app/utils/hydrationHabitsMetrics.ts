export type SimpleWaterLog = {
   consumed_at: string; // ISO timestamp
   amount: number; // assumed in user's preferred unit already
};

export const HYDRATION_TIME_BUCKETS = [
   '12a-9a',
   '9a-12p',
   '12p-3p',
   '3p-6p',
   '6p-9p',
   '9p-12a'
] as const;

export type HydrationBuckets = {
   labels: string[]; // length 6
   values: number[]; // length 6
};

function getBucketIndex(date: Date): number {
   const h = date.getHours();
   if (h < 9) return 0; // 0:00 - 8:59
   if (h < 12) return 1; // 9:00 - 11:59
   if (h < 15) return 2; // 12:00 - 14:59
   if (h < 18) return 3; // 15:00 - 17:59
   if (h < 21) return 4; // 18:00 - 20:59
   return 5; // 21:00 - 23:59
}

function toDateOnlyISO(d: Date) {
   const copy = new Date(d);
   copy.setHours(0, 0, 0, 0);
   return copy.toISOString().slice(0, 10);
}

/** Buckets the water logs for a specific calendar date (local) into the 6 time ranges. */
export function computeHydrationBucketsForDate(
   logs: SimpleWaterLog[],
   dateISO?: string
): HydrationBuckets {
   const labels = [...HYDRATION_TIME_BUCKETS];
   const values = [0, 0, 0, 0, 0, 0];
   const targetISO = dateISO ?? toDateOnlyISO(new Date());

   for (const l of logs) {
      if (!l || typeof l.amount !== 'number' || !l.consumed_at) continue;
      if (l.consumed_at.slice(0, 10) !== targetISO) continue;
      const dt = new Date(l.consumed_at);
      const idx = getBucketIndex(dt);
      values[idx] += l.amount || 0;
   }

   return { labels, values };
}

/**
 * Computes average intake for each period across the last `daysWindow` days (default 30).
 * Days with zero intake are included in the average.
 */
export function computeAverageHydrationBuckets(
   logs: SimpleWaterLog[],
   daysWindow = 30
): HydrationBuckets {
   const labels = [...HYDRATION_TIME_BUCKETS];
   const sums = [0, 0, 0, 0, 0, 0];
   const today = new Date();
   today.setHours(0, 0, 0, 0);

   // Map date -> bucket array
   const dayMap: Record<string, number[]> = {};
   for (let i = 0; i < daysWindow; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - (daysWindow - 1) + i);
      dayMap[toDateOnlyISO(d)] = [0, 0, 0, 0, 0, 0];
   }

   for (const l of logs) {
      if (!l || typeof l.amount !== 'number' || !l.consumed_at) continue;
      const dateKey = l.consumed_at.slice(0, 10);
      if (!(dateKey in dayMap)) continue; // outside window
      const dt = new Date(l.consumed_at);
      const idx = getBucketIndex(dt);
      dayMap[dateKey][idx] += l.amount || 0;
   }

   // Sum across days then divide by window size to get averages
   for (const arr of Object.values(dayMap)) {
      for (let i = 0; i < 6; i++) sums[i] += arr[i];
   }
   const averages = sums.map((s) => s / daysWindow);
   return { labels, values: averages };
}
