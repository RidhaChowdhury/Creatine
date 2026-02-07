import { configureStore } from '@reduxjs/toolkit';
import intakeReducer from '../features/intake/intakeSlice';
import settingsReducer from '../features/settings/settingsSlice';

export const store = configureStore({
   reducer: {
      intake: intakeReducer,
      settings: settingsReducer
   }
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
