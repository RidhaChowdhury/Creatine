import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice' 
import waterReducer from '../features/water/waterSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer, 
    water: waterReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;