/** Shared Drops v0.1 contracts. Persisted quantities retain their source unit. */
export type MetricType = 'water' | 'creatine' | 'fiber' | 'caffeine' | 'other';
export type StorageKind = 'intake' | 'tracker';
export type DosePlan = { id: string; time: string; amount: number; unit: string };
export type PlanVersion = {
  id: string; effectiveFrom: string; mode: 'scheduled' | 'as-needed';
  days: number[]; doses: DosePlan[]; target: number | null; limit: number | null; unit: string;
};
export type DropsTracker = {
  id: string; name: string; category: 'water' | 'supplement' | 'medication';
  metricType: MetricType; unit: string; savedDose: number | null; archived: boolean;
  plans: PlanVersion[]; /** Optional explicit grams per source unit, never inferred. */
  gramsPerUnit?: number | null;
};
export type DropsEntry = {
  id: string; storageKind: StorageKind; trackerId: string; name: string;
  amount: number; unit: string; consumedAt: string; consumedAtUtc: string | null;
  /** Original timezone-free legacy context is retained exactly. */
  legacyLocal: string | null; day: string; note: string; version: number;
};
export type EntryInput = { trackerId: string; amount: number; unit: string; consumedAt: string; note: string };
export type MutationReceipt = {
  operationId: string; kind: 'add' | 'edit' | 'delete' | 'restore';
  before: DropsEntry | null; after: DropsEntry | null;
};
export type PriorUse = {
  creatine: 'unknown' | 'not-using' | 'using' | 'established';
  caffeine: 'unknown' | 'not-using' | 'using';
  startDate?: string; usualDoseGrams?: number; consistency?: 'occasional' | 'most-days' | 'daily';
};
export type WaterPreset = { id: string; amount: number; unit: string };
export type DropsPreferences = {
  timezone: string; waterPresets: WaterPreset[]; prominentPresetIds: string[];
  remindersEnabled: boolean; priorUse: PriorUse; caffeineHalfLifeHours: number; bedtime: string;
};
export type DropsSnapshot = {
  trackers: DropsTracker[]; entries: DropsEntry[]; primaryTrackerId: string | null;
  preferences: DropsPreferences;
};
export type HistoryQuery = { fromDay: string; toDay: string; trackerIds?: string[] };
export type SaveProfileInput = Omit<DropsTracker, 'id' | 'plans'> & { id?: string; plan?: Omit<PlanVersion, 'id' | 'effectiveFrom'> };
export type DoseProgress = { dose: DosePlan; allocated: number; remaining: number; complete: boolean };
export type DailyProgress = { doses: DoseProgress[]; completed: number; total: number; planned: number; logged: number; remaining: number; beyond: number };
export type PerformanceResult = {
  modelVersion: string; asOf: string; state: 'baseline' | 'ready' | 'insufficient';
  score: number | null; range: [number, number] | null; label: string; reasons: string[];
  contributors: { key: string; label: string; value: number | null; unit: string; detail: string; coverage: string }[];
  timeline: { at: string; score: number | null; low: number | null; high: number | null; planned: boolean; caffeineMg: number | null }[];
};
