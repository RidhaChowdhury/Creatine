import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { supabase } from '@/lib/supabase';
import { RootState } from '@/store/store';
import { DRINK_TYPES } from '@/lib/constants';
import { selectDrinkUnit, selectSupplementUnit } from '../settings/settingsSlice';

const OZ_TO_ML = 29.5735;

function ozToMl(oz: number) {
   return oz * OZ_TO_ML;
}

function mlToOz(ml: number) {
   return ml / OZ_TO_ML;
}

// rn only need oz and ml, but putting this logic in separate function in case we expand in future
function convertToDrinkUnit(amount: number, unit: string, drinkUnit: string) {
   if (unit === drinkUnit) return amount;
   return unit === 'oz' ? ozToMl(amount) : mlToOz(amount);
}

function convertToSupplementUnit(amount: number, unit: string, supplementUnit: string) {
   if (unit === supplementUnit) return amount;
   return unit === 'g' ? amount * 1000 : amount / 1000;
}

type DrinkType = (typeof DRINK_TYPES)[number];
type ConsumableType = DrinkType | 'creatine';

function isDrinkType(value: ConsumableType): value is DrinkType {
   return DRINK_TYPES.includes(value as DrinkType);
}

type IntakeLog = {
   id: string;
   user_id: string;
   amount: number;
   unit: string;
   consumable: ConsumableType;
   consumed_at: string;
   logged_at: string;
};

type IntakeState = {
   drinkLogs: IntakeLog[];
   creatineLogs: IntakeLog[];
   drinkStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
   creatineStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
   error: string | null;
};

const initialState: IntakeState = {
   drinkLogs: [],
   creatineLogs: [],
   drinkStatus: 'idle',
   creatineStatus: 'idle',
   error: null
};

const formatDate = (date: Date) => {
   // format to only yy-mm-dd
   const yyyy = date.getFullYear();
   const mm = String(date.getMonth() + 1).padStart(2, '0');
   const dd = String(date.getDate()).padStart(2, '0');
   return `${yyyy}-${mm}-${dd}`;
};

const formatDateTime = (date: Date) => {
   const yyyy = date.getFullYear();
   const mm = String(date.getMonth() + 1).padStart(2, '0');
   const dd = String(date.getDate()).padStart(2, '0');
   const hh = String(date.getHours()).padStart(2, '0');
   const min = String(date.getMinutes()).padStart(2, '0');
   const ss = String(date.getSeconds()).padStart(2, '0');

   return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

const getTodayDate = () => {
   const today = new Date();
   return formatDate(today);
};

const get30DaysAgo = (): string => {
   const date = new Date();
   date.setDate(date.getDate() - 30);

   return formatDateTime(date);
};

/* !TODO: Once we have settingsSlice and can change units, it's imperative we make sure we are accounting for the unit of each log 
when adding a total */

// Thunk to fetch drink logs (last 30 days)
export const fetchDrinkLogs = createAsyncThunk<IntakeLog[], void, { state: RootState }>(
   'intake/fetchDrinkLogs',
   async (_, thunkAPI) => {
      const state = thunkAPI.getState();
      const userId = state.auth.user?.id;

      if (!userId) {
         throw new Error('No user ID found');
      }

      const thirtyDaysAgo = get30DaysAgo();

      const { data, error } = await supabase
         .from('intake_log')
         .select('*')
         .eq('user_id', userId)
         .in('consumable', DRINK_TYPES)
         .gte('consumed_at', thirtyDaysAgo)
         .order('consumed_at', { ascending: false });

      if (error) {
         throw new Error(error.message);
      }

      return data || [];
   }
);

// Thunk to fetch creatine logs (last 30 days)
export const fetchCreatineLogs = createAsyncThunk<IntakeLog[], void, { state: RootState }>(
   'intake/fetchCreatineLogs',
   async (_, thunkAPI) => {
      const state = thunkAPI.getState();
      const userId = state.auth.user?.id;

      if (!userId) {
         throw new Error('No user ID found');
      }

      const thirtyDaysAgo = get30DaysAgo();

      const { data, error } = await supabase
         .from('intake_log')
         .select('*')
         .eq('user_id', userId)
         .eq('consumable', 'creatine')
         .gte('consumed_at', thirtyDaysAgo)
         .order('consumed_at', { ascending: false });

      if (error) {
         throw new Error(error.message);
      }

      return data || [];
   }
);

// Thunk to add drink log
export const addDrinkLog = createAsyncThunk<
   IntakeLog,
   { amount: number; consumable: DrinkType; unit?: string; consumed_at?: string },
   { state: RootState }
>('intake/addDrinkLog', async ({ amount, consumable, unit = 'oz', consumed_at }, thunkAPI) => {
   const state = thunkAPI.getState();
   const userId = state.auth.user?.id;

   if (!userId) {
      throw new Error('No user ID found');
   }

   const { data, error } = await supabase
      .from('intake_log')
      .insert([
         {
            user_id: userId,
            amount,
            unit,
            consumable,
            consumed_at: consumed_at || formatDateTime(new Date())
         }
      ])
      .select()
      .single();

   if (error) {
      throw new Error(error.message);
   }

   return data;
});

// Thunk to add creatine log
export const addCreatineLog = createAsyncThunk<
   IntakeLog,
   { amount: number; unit?: string; consumed_at?: string },
   { state: RootState }
>('intake/addCreatineLog', async ({ amount, unit = 'g', consumed_at }, thunkAPI) => {
   const state = thunkAPI.getState();
   const userId = state.auth.user?.id;

   if (!userId) {
      throw new Error('No user ID found');
   }

   const { data, error } = await supabase
      .from('intake_log')
      .insert([
         {
            user_id: userId,
            amount,
            unit,
            consumable: 'creatine',
            consumed_at: consumed_at || formatDateTime(new Date())
         }
      ])
      .select()
      .single();

   if (error) {
      throw new Error(error.message);
   }

   return data;
});

// Thunk to update intake log (works for both drinks and creatine)
export const updateIntakeLog = createAsyncThunk<
   IntakeLog,
   { id: string; amount: number; unit?: string },
   { state: RootState }
>('intake/updateIntakeLog', async ({ id, amount, unit }, thunkAPI) => {
   const state = thunkAPI.getState();
   const userId = state.auth.user?.id;

   if (!userId) {
      throw new Error('No user ID found');
   }

   const updateData: any = { amount };
   if (unit) {
      updateData.unit = unit;
   }

   const { data, error } = await supabase
      .from('intake_log')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

   if (error) {
      throw new Error(error.message);
   }

   return data;
});

// Thunk to delete intake log (works for both drinks and creatine)
export const deleteIntakeLog = createAsyncThunk<
   { id: string; consumable: ConsumableType },
   string,
   { state: RootState }
>('intake/deleteIntakeLog', async (id, thunkAPI) => {
   const state = thunkAPI.getState();
   const userId = state.auth.user?.id;

   if (!userId) {
      throw new Error('No user ID found');
   }

   // First get the log to know what type it is
   const { data: logData, error: fetchError } = await supabase
      .from('intake_log')
      .select('consumable')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

   if (fetchError) {
      throw new Error(fetchError.message);
   }

   const { error } = await supabase.from('intake_log').delete().eq('id', id).eq('user_id', userId);

   if (error) {
      throw new Error(error.message);
   }

   return { id, consumable: logData.consumable };
});

const intakeSlice = createSlice({
   name: 'intake',
   initialState,
   reducers: {
      resetIntakeState: (state) => {
         state.drinkLogs = [];
         state.creatineLogs = [];
         state.drinkStatus = 'idle';
         state.creatineStatus = 'idle';
         state.error = null;
      }
   },
   extraReducers: (builder) => {
      builder
         // Fetch drink logs
         .addCase(fetchDrinkLogs.pending, (state) => {
            state.drinkStatus = 'loading';
            state.error = null;
         })
         .addCase(fetchDrinkLogs.fulfilled, (state, action) => {
            state.drinkStatus = 'succeeded';
            state.drinkLogs = action.payload;
         })
         .addCase(fetchDrinkLogs.rejected, (state, action) => {
            state.drinkStatus = 'failed';
            state.error = action.error.message || 'Failed to fetch drink logs';
         })

         // Fetch creatine logs
         .addCase(fetchCreatineLogs.pending, (state) => {
            state.creatineStatus = 'loading';
            state.error = null;
         })
         .addCase(fetchCreatineLogs.fulfilled, (state, action) => {
            state.creatineStatus = 'succeeded';
            state.creatineLogs = action.payload;
         })
         .addCase(fetchCreatineLogs.rejected, (state, action) => {
            state.creatineStatus = 'failed';
            state.error = action.error.message || 'Failed to fetch creatine logs';
         })

         // Add drink log
         .addCase(addDrinkLog.pending, (state) => {
            state.drinkStatus = 'loading';
            state.error = null;
         })
         .addCase(addDrinkLog.fulfilled, (state, action) => {
            state.drinkStatus = 'succeeded';
            state.drinkLogs.unshift(action.payload);
         })
         .addCase(addDrinkLog.rejected, (state, action) => {
            state.drinkStatus = 'failed';
            state.error = action.error.message || 'Failed to add drink log';
         })

         // Add creatine log
         .addCase(addCreatineLog.pending, (state) => {
            state.creatineStatus = 'loading';
            state.error = null;
         })
         .addCase(addCreatineLog.fulfilled, (state, action) => {
            state.creatineStatus = 'succeeded';
            state.creatineLogs.unshift(action.payload);
         })
         .addCase(addCreatineLog.rejected, (state, action) => {
            state.creatineStatus = 'failed';
            state.error = action.error.message || 'Failed to add creatine log';
         })

         // Update intake log
         .addCase(updateIntakeLog.fulfilled, (state, action) => {
            const updatedLog = action.payload;

            // Check if it's a drink
            if (isDrinkType(updatedLog.consumable)) {
               const index = state.drinkLogs.findIndex((log) => log.id === updatedLog.id);
               if (index !== -1) {
                  state.drinkLogs[index] = updatedLog;
               }
            } else if (updatedLog.consumable === 'creatine') {
               const index = state.creatineLogs.findIndex((log) => log.id === updatedLog.id);
               if (index !== -1) {
                  state.creatineLogs[index] = updatedLog;
               }
            }
            state.creatineStatus = 'succeeded';
            state.drinkStatus = 'succeeded';
         })
         .addCase(updateIntakeLog.rejected, (state, action) => {
            state.creatineStatus = 'failed';
            state.drinkStatus = 'failed';
            state.error = action.error.message || 'Failed to update intake log';
         })

         // Delete intake log
         .addCase(deleteIntakeLog.fulfilled, (state, action) => {
            const { id, consumable } = action.payload;

            if (isDrinkType(consumable)) {
               state.drinkLogs = state.drinkLogs.filter((log) => log.id !== id);
            } else if (consumable === 'creatine') {
               state.creatineLogs = state.creatineLogs.filter((log) => log.id !== id);
            }
            state.creatineStatus = 'succeeded';
            state.drinkStatus = 'succeeded';
         })
         .addCase(deleteIntakeLog.rejected, (state, action) => {
            state.creatineStatus = 'failed';
            state.drinkStatus = 'failed';
            state.error = action.error.message || 'Failed to delete intake log';
         });
   }
});

export const { resetIntakeState } = intakeSlice.actions;

// Selectors
export const selectDrinkLogs = (state: RootState) => state.intake.drinkLogs;
export const selectCreatineLogs = (state: RootState) => state.intake.creatineLogs;
export const selectDrinkStatus = (state: RootState) => state.intake.drinkStatus;
export const selectCreatineStatus = (state: RootState) => state.intake.creatineStatus;
export const selectIntakeError = (state: RootState) => state.intake.error;

export const selectTodayDrinkLogs = (state: RootState) => {
   const today = getTodayDate();
   return state.intake.drinkLogs.filter((log) => log.consumed_at.startsWith(today));
};

export const selectTodayCreatineLogs = (state: RootState) => {
   const today = getTodayDate();
   return state.intake.creatineLogs.filter((log) => log.consumed_at.startsWith(today));
};

export const selectDrinkLogsByDate = (state: RootState, date: string) => {
   return state.intake.drinkLogs.filter((log) => log.consumed_at.startsWith(date));
};

export const selectCreatineLogsByDate = (state: RootState, date: string) => {
   return state.intake.creatineLogs.filter((log) => log.consumed_at.startsWith(date));
};

export const selectWaterLogs = (state: RootState) => {
   return state.intake.drinkLogs.filter((log) => log.consumable === 'water');
};

export const selectDailyWaterTotal = createSelector(
   [selectDrinkLogs, selectDrinkUnit],
   (logs, drinkUnit) => {
      const today = getTodayDate();
      return +logs
         .filter((log) => log.consumed_at.startsWith(today))
         .reduce((sum, log) => {
            const amountInTargetUnit = convertToDrinkUnit(log.amount, log.unit, drinkUnit);
            // TODO, add hyrdration factors
            const factor = 1.0;
            return sum + amountInTargetUnit * factor;
         }, 0)
         .toFixed(2);
   }
);

export const selectDailyCreatineTotal = createSelector(
   [selectCreatineLogs, selectSupplementUnit],
   (logs, supplementUnit) => {
      const today = getTodayDate();
      return logs
         .filter((log) => log.consumed_at.startsWith(today))
         .reduce((sum, log) => {
            const amountInTargetUnit = convertToSupplementUnit(
               log.amount,
               log.unit,
               supplementUnit
            );
            return sum + amountInTargetUnit;
         }, 0);
   }
);

export default intakeSlice.reducer;
