import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabase';
import { RootState } from '@/store/store';

export type UserSettings = {
   name: string;
   height: number;
   weight: number;
   sex: string;
   drink_unit: string;
   supplement_unit: string;
   water_goal: number;
   creatine_goal: number;
   creatine_reminder_time: string | null;
};

type OnboardingSettings = {
   name: string;
   height: number;
   weight: number;
   sex: string;
};

type SettingsState = UserSettings & {
   initialFetchStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
   status: 'idle' | 'loading' | 'succeeded' | 'failed';
   error: string | null;
};

const initialState: SettingsState = {
   name: '',
   height: 0,
   weight: 0,
   sex: '',
   drink_unit: 'oz',
   supplement_unit: 'g',
   water_goal: 0,
   creatine_goal: 0,
   creatine_reminder_time: null,
   initialFetchStatus: 'idle',
   status: 'idle',
   error: null
};

export const fetchSettings = createAsyncThunk<UserSettings | null, void, { state: RootState }>(
   'settings/fetchSettings',
   async (_, thunkAPI) => {
      const state = thunkAPI.getState();
      const userId = state.auth.user?.id;

      if (!userId) {
         throw new Error('No user ID found');
      }

      const { data, error } = await supabase
         .from('user_settings')
         .select('*')
         .eq('user_id', userId)
         .maybeSingle();

      if (error) {
         console.error('Error fetching: ', error);
         throw new Error(error.message);
      }

      return data;
   }
);

export const updateSettings = createAsyncThunk<
   UserSettings,
   { formData: UserSettings },
   { state: RootState }
>('settings/updateSettings', async ({ formData }, thunkAPI) => {
   const state = thunkAPI.getState();
   const userId = state.auth.user?.id;

   if (!userId) {
      throw new Error('No user ID found');
   }

   const { data, error } = await supabase
      .from('user_settings')
      .update({
         ...formData
      })
      .eq('user_id', userId)
      .select()
      .single();

   if (error) {
      console.error('Error updating: ', error);
      throw new Error(error.message);
   }

   return data;
});

// should only be called in onboarding
export const addSettings = createAsyncThunk<
   UserSettings,
   { formData: OnboardingSettings },
   { state: RootState }
>('settings/addSettings', async ({ formData }, thunkAPI) => {
   const state = thunkAPI.getState();
   const userId = state.auth.user?.id;

   if (!userId) {
      throw new Error('No user ID found');
   }

   const { data, error } = await supabase
      .from('user_settings')
      .insert({
         ...formData,
         user_id: userId
      })
      .select()
      .single();

   if (error) {
      console.error(error);
      throw new Error(error.message);
   }

   return data;
});

export const updateCreatineReminderTime = createAsyncThunk<
   UserSettings,
   { creatineReminderTime: string },
   { state: RootState }
>('settings/updateCreatineReminderTime', async ({ creatineReminderTime }, thunkAPI) => {
   const state = thunkAPI.getState();
   const userId = state.auth.user?.id;

   if (!userId) {
      throw new Error('No user ID found');
   }

   const { data, error } = await supabase
      .from('user_settings')
      .update({ creatine_reminder_time: creatineReminderTime })
      .eq('user_id', userId)
      .select()
      .single();

   if (error) {
      console.error('Error updating: ', error);
      throw new Error(error.message);
   }

   return data;
});

const settingsSlice = createSlice({
   name: 'settings',
   initialState,
   reducers: {
      resetSettingsState: (state) => {
         state.name = '';
         state.height = 0;
         state.weight = 0;
         state.sex = '';
         state.drink_unit = 'oz';
         state.supplement_unit = 'g';
         state.water_goal = 0;
         state.creatine_goal = 0;
         state.initialFetchStatus = 'idle';
         state.status = 'idle';
         state.error = null;
      }
   },
   extraReducers: (builder) => {
      builder
         .addCase(fetchSettings.pending, (state) => {
            state.initialFetchStatus = 'loading';
            state.status = 'loading';
            state.error = null;
         })
         .addCase(fetchSettings.fulfilled, (state, action) => {
            state.initialFetchStatus = 'succeeded';
            state.status = 'succeeded';
            if (action.payload) {
               Object.assign(state, action.payload);
            }
         })
         .addCase(fetchSettings.rejected, (state, action) => {
            state.initialFetchStatus = 'failed';
            state.status = 'failed';
            state.error = action.error.message || 'Failed to fetch user settings';
         })

         .addCase(updateSettings.fulfilled, (state, action) => {
            state.status = 'succeeded';
            Object.assign(state, action.payload);
         })
         .addCase(updateSettings.pending, (state) => {
            state.status = 'loading';
            state.error = null;
         })
         .addCase(updateSettings.rejected, (state, action) => {
            state.status = 'failed';
            state.error = action.error.message || 'Failed to update settings';
         })

         .addCase(addSettings.pending, (state) => {
            state.status = 'loading';
            state.error = null;
         })
         .addCase(addSettings.fulfilled, (state, action) => {
            state.status = 'succeeded';
            Object.assign(state, action.payload);
         })
         .addCase(addSettings.rejected, (state, action) => {
            state.status = 'failed';
            state.error = action.error.message || 'Failed to add settings';
         })
         .addCase(updateCreatineReminderTime.pending, (state) => {
            state.status = 'loading';
            state.error = null;
         })
         .addCase(updateCreatineReminderTime.fulfilled, (state, action) => {
            state.status = 'succeeded';
            Object.assign(state, action.payload);
         })
         .addCase(updateCreatineReminderTime.rejected, (state, action) => {
            state.status = 'failed';
            state.error = action.error.message || 'Failed to update creatine reminder time';
         });
   }
});

export const { resetSettingsState } = settingsSlice.actions;

export const selectSettings = (state: RootState) => state.settings;
export const selectUserSettings = createSelector([selectSettings], (settings) => {
   const { initialFetchStatus, status, error, ...userSettings } = settings;
   return userSettings;
});
export const selectWaterGoal = (state: RootState) => state.settings.water_goal;
export const selectDrinkUnit = (state: RootState) => state.settings.drink_unit;
export const selectSupplementUnit = (state: RootState) => state.settings.supplement_unit;
export const selectInitialFetchStatus = (state: RootState) => state.settings.initialFetchStatus;
export const selectCreatineGoal = (state: RootState) => state.settings.creatine_goal;
export const selectSettingsStatus = (state: RootState) => state.settings.status;

export default settingsSlice.reducer;
