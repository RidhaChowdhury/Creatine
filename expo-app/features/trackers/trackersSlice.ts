import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { RootState } from '@/store/store';
import {
   deleteDose,
   fetchTrackerHistory as fetchTrackerHistoryDB,
   getPrimaryTrackerId,
   listTrackers,
   logDose,
   saveTracker,
   selectPrimaryTracker,
   type DoseEntry,
   type LogDoseInput,
   type SaveTrackerInput,
   type Tracker
} from '@/lib/trackers';

type TrackersState = {
   /** Request membership is cleared at account reset; late results cannot enter the next account. */
   _pendingRequests: Record<string, true>;
   trackers: Tracker[];
   primaryTrackerId: string | null;
   entries: DoseEntry[];
   historyTrackerId: string | null;
   initialFetchStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
   historyStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
   mutationStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
   error: string | null;
};

const initialState: TrackersState = {
   _pendingRequests: {},
   trackers: [],
   primaryTrackerId: null,
   entries: [],
   historyTrackerId: null,
   initialFetchStatus: 'idle',
   historyStatus: 'idle',
   mutationStatus: 'idle',
   error: null
};

export const fetchTrackers = createAsyncThunk<
   { trackers: Tracker[]; primaryTrackerId: string | null }, void, { state: RootState }
>('trackers/fetchTrackers', async () => {
   const [trackers, primaryTrackerId] = await Promise.all([listTrackers(), getPrimaryTrackerId()]);
   return { trackers, primaryTrackerId };
});

export const fetchTrackerHistory = createAsyncThunk<
   { trackerId: string; entries: DoseEntry[] }, string, { state: RootState }
>('trackers/fetchHistory', async (trackerId) => ({
   trackerId, entries: await fetchTrackerHistoryDB(trackerId)
}));

export const saveTrackerThunk = createAsyncThunk<Tracker, SaveTrackerInput, { state: RootState }>(
   'trackers/saveTracker', async (input) => saveTracker(input)
);

export const setPrimaryTracker = createAsyncThunk<string | null, string | null, { state: RootState }>(
   'trackers/selectPrimary', async (id) => selectPrimaryTracker(id)
);

export const addTrackerDose = createAsyncThunk<DoseEntry, LogDoseInput, { state: RootState }>(
   'trackers/logDose', async (input) => logDose(input)
);

export const deleteTrackerDose = createAsyncThunk<
   { trackerId: string; id: string }, { trackerId: string; id: string }, { state: RootState }
>('trackers/deleteDose', async ({ trackerId, id }) => {
   await deleteDose(trackerId, id);
   return { trackerId, id };
});

const slice = createSlice({
   name: 'trackers',
   initialState,
   reducers: {
      resetTrackersState: () => initialState
   },
   extraReducers: (builder) => {
      builder
         .addCase(fetchTrackers.pending, (state, action) => {
            state._pendingRequests[action.meta.requestId] = true;
            state.initialFetchStatus = 'loading';
            state.error = null;
         })
         .addCase(fetchTrackers.fulfilled, (state, action) => {
            if (!state._pendingRequests[action.meta.requestId]) return;
            delete state._pendingRequests[action.meta.requestId];
            state.initialFetchStatus = 'succeeded';
            state.trackers = action.payload.trackers;
            state.primaryTrackerId = action.payload.primaryTrackerId;
            if (state.primaryTrackerId && !state.trackers.some((item) => item.id === state.primaryTrackerId)) {
               state.primaryTrackerId = null;
            }
         })
         .addCase(fetchTrackers.rejected, (state, action) => {
            if (!state._pendingRequests[action.meta.requestId]) return;
            delete state._pendingRequests[action.meta.requestId];
            state.initialFetchStatus = 'failed';
            state.error = action.error.message || 'Failed to fetch trackers';
         })
         .addCase(fetchTrackerHistory.pending, (state, action) => {
            state._pendingRequests[action.meta.requestId] = true;
            state.historyStatus = 'loading';
            state.error = null;
         })
         .addCase(fetchTrackerHistory.fulfilled, (state, action) => {
            if (!state._pendingRequests[action.meta.requestId]) return;
            delete state._pendingRequests[action.meta.requestId];
            state.historyStatus = 'succeeded';
            state.historyTrackerId = action.payload.trackerId;
            state.entries = action.payload.entries;
         })
         .addCase(fetchTrackerHistory.rejected, (state, action) => {
            if (!state._pendingRequests[action.meta.requestId]) return;
            delete state._pendingRequests[action.meta.requestId];
            state.historyStatus = 'failed';
            state.error = action.error.message || 'Failed to fetch tracker history';
         })
         .addCase(saveTrackerThunk.pending, (state, action) => {
            state._pendingRequests[action.meta.requestId] = true;
            state.mutationStatus = 'loading';
            state.error = null;
         })
         .addCase(saveTrackerThunk.fulfilled, (state, action) => {
            if (!state._pendingRequests[action.meta.requestId]) return;
            delete state._pendingRequests[action.meta.requestId];
            state.mutationStatus = 'succeeded';
            const index = state.trackers.findIndex((item) => item.id === action.payload.id);
            if (index < 0) state.trackers.push(action.payload);
            else state.trackers[index] = action.payload;
         })
         .addCase(saveTrackerThunk.rejected, (state, action) => {
            if (!state._pendingRequests[action.meta.requestId]) return;
            delete state._pendingRequests[action.meta.requestId];
            state.mutationStatus = 'failed';
            state.error = action.error.message || 'Failed to save tracker';
         })
         .addCase(setPrimaryTracker.pending, (state, action) => {
            state._pendingRequests[action.meta.requestId] = true;
            state.mutationStatus = 'loading';
            state.error = null;
         })
         .addCase(setPrimaryTracker.fulfilled, (state, action) => {
            if (!state._pendingRequests[action.meta.requestId]) return;
            delete state._pendingRequests[action.meta.requestId];
            state.mutationStatus = 'succeeded';
            state.primaryTrackerId = action.payload;
         })
         .addCase(setPrimaryTracker.rejected, (state, action) => {
            if (!state._pendingRequests[action.meta.requestId]) return;
            delete state._pendingRequests[action.meta.requestId];
            state.mutationStatus = 'failed';
            state.error = action.error.message || 'Failed to save primary tracker';
         })
         .addCase(addTrackerDose.pending, (state, action) => {
            state._pendingRequests[action.meta.requestId] = true;
            state.mutationStatus = 'loading';
            state.error = null;
         })
         .addCase(addTrackerDose.fulfilled, (state, action) => {
            if (!state._pendingRequests[action.meta.requestId]) return;
            delete state._pendingRequests[action.meta.requestId];
            state.mutationStatus = 'succeeded';
            if (state.historyTrackerId === action.payload.trackerId &&
               !state.entries.some((entry) => entry.id === action.payload.id)) {
               state.entries.unshift(action.payload);
            }
         })
         .addCase(addTrackerDose.rejected, (state, action) => {
            if (!state._pendingRequests[action.meta.requestId]) return;
            delete state._pendingRequests[action.meta.requestId];
            state.mutationStatus = 'failed';
            state.error = action.error.message || 'Failed to log dose';
         })
         .addCase(deleteTrackerDose.pending, (state, action) => {
            state._pendingRequests[action.meta.requestId] = true;
            state.mutationStatus = 'loading';
            state.error = null;
         })
         .addCase(deleteTrackerDose.fulfilled, (state, action) => {
            if (!state._pendingRequests[action.meta.requestId]) return;
            delete state._pendingRequests[action.meta.requestId];
            state.mutationStatus = 'succeeded';
            if (state.historyTrackerId === action.payload.trackerId) {
               state.entries = state.entries.filter((entry) => entry.id !== action.payload.id);
            }
         })
         .addCase(deleteTrackerDose.rejected, (state, action) => {
            if (!state._pendingRequests[action.meta.requestId]) return;
            delete state._pendingRequests[action.meta.requestId];
            state.mutationStatus = 'failed';
            state.error = action.error.message || 'Failed to delete dose';
         });
   }
});

export const { resetTrackersState } = slice.actions;
export const selectTrackers = (state: RootState) => state.trackers.trackers;
export const selectPrimaryTrackerId = (state: RootState) => state.trackers.primaryTrackerId;
export const selectTrackerEntries = (state: RootState) => state.trackers.entries;
export const selectTrackerInitialFetchStatus = (state: RootState) => state.trackers.initialFetchStatus;
export const selectTrackerHistoryStatus = (state: RootState) => state.trackers.historyStatus;
export const selectTrackerMutationStatus = (state: RootState) => state.trackers.mutationStatus;
export const selectTrackerError = (state: RootState) => state.trackers.error;

export default slice.reducer;
