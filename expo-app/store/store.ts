import { configureStore } from '@reduxjs/toolkit';
import intakeReducer from '../features/intake/intakeSlice';
import settingsReducer from '../features/settings/settingsSlice';
import trackersReducer from '../features/trackers/trackersSlice';
import dropsReducer from '../features/drops/dropsSlice';

export const store = configureStore({
   reducer: {
      intake: intakeReducer,
      settings: settingsReducer,
      trackers: trackersReducer,
      drops: dropsReducer
   }
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
