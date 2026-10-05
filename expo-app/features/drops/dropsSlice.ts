import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DropsSnapshot, MutationReceipt, DropsTracker, DropsPreferences } from '@/lib/drops/types';

type State = { snapshot: DropsSnapshot | null; status: 'loading' | 'ready' | 'error'; error: string | null };
const initialState: State = { snapshot: null, status: 'loading', error: null };
const slice = createSlice({ name: 'drops', initialState, reducers: {
  resetDrops: () => initialState,
  loadedDrops: (s, a: PayloadAction<DropsSnapshot>) => { s.snapshot = a.payload; s.status = 'ready'; s.error = null; },
  failedDrops: (s, a: PayloadAction<string>) => { s.error = a.payload; s.status = s.snapshot ? 'ready' : 'error'; },
  confirmedMutation: (s, a: PayloadAction<MutationReceipt>) => {
    if (!s.snapshot) return;
    const { before, after } = a.payload;
    s.snapshot.entries = s.snapshot.entries.filter(e => !(before && e.id === before.id && e.storageKind === before.storageKind) && !(after && e.id === after.id && e.storageKind === after.storageKind));
    if (after) s.snapshot.entries.push(after);
  },
  confirmedProfile: (s, a: PayloadAction<DropsTracker>) => {
    if (!s.snapshot) return;
    const index = s.snapshot.trackers.findIndex(t => t.id === a.payload.id);
    if (index < 0) s.snapshot.trackers.push(a.payload); else s.snapshot.trackers[index] = a.payload;
    if (a.payload.archived && s.snapshot.primaryTrackerId === a.payload.id) s.snapshot.primaryTrackerId = null;
  },
  confirmedPrimary: (s, a: PayloadAction<string | null>) => { if (s.snapshot) s.snapshot.primaryTrackerId = a.payload; },
  confirmedPreferences: (s, a: PayloadAction<Partial<DropsPreferences>>) => { if (s.snapshot) Object.assign(s.snapshot.preferences, a.payload); }
}});
export const { resetDrops, loadedDrops, failedDrops, confirmedMutation, confirmedProfile, confirmedPrimary, confirmedPreferences } = slice.actions;
export default slice.reducer;
