import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { supabase } from "@/lib/supabase";
import { RootState } from "@/store/store";

type WaterLog = {
    id: string;
    user_id: string;
    amount: number;
    consumable: string;
    consumed_at: string;
    logged_at: string;
}

type WaterState = {
    waterLogs: WaterLog[];
    dailyTotal: number;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: WaterState = {
    waterLogs: [],
    dailyTotal: 0,
    status: 'idle',
    error: null,
}

const formatDate = (date: Date) => {
	// format to only yy-mm-dd
	const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`
}

const formatDateTime = (date: Date) => {
	const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

const getTodayDate = () => {
    const today = new Date();
		return formatDate(today);
};

const get30DaysAgo = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 30);

  return formatDateTime(date);
};

const calculateDailyTotal = (logs: WaterLog[]): number => {
    const today = getTodayDate();
    return logs
      .filter(log => log.consumed_at.startsWith(today))
      .reduce((sum, log) => sum + Number(log.amount), 0);
};

// thunk to get the last 30 days of logs from the db
export const fetchWaterLogs = createAsyncThunk<WaterLog[], void, { state: RootState }>(
    'water/fetchWaterLogs',
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
        .eq('consumable', 'water')
        .gte('consumed_at', thirtyDaysAgo)
        .order('consumed_at', { ascending: false });
  
      if (error) {
        throw new Error(error.message);
    
      }
    
      return data || [];
    }
);

// thunk to add new water log
export const addWaterLog = createAsyncThunk<WaterLog, { amount: number, consumed_at?: string}, { state: RootState }>(
    'water/addWaterLog',
    async ({ amount, consumed_at }, thunkAPI) => {
			const state = thunkAPI.getState();
			const userId = state.auth.user?.id;

			if (!userId) {
					throw new Error('No user ID found');
			}

			const { data, error } = await supabase
				.from('intake_log')
				.insert([{
						user_id: userId,
						amount,
						unit: 'oz', // hardcode this now, when we put the settings into the redux store, grab from there
						consumable: 'water',
						consumed_at: consumed_at || formatDateTime(new Date()),
				}])
				.select()
				.single();

			if (error) {
				throw new Error(error.message);
			}

			return data;
    }
)

// thunk to update water log
export const updateWaterLog = createAsyncThunk<WaterLog, { id: string; amount: number }, { state: RootState }>(
  'water/updateWaterLog',
  async ({ id, amount }, thunkAPI) => {
    const state = thunkAPI.getState();
    const userId = state.auth.user?.id;
    
    if (!userId) {
      throw new Error('No user ID found');
    }

    const { data, error } = await supabase
      .from('intake_log')
      .update({ amount })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
);

// thunk to delete water log
export const deleteWaterLog = createAsyncThunk<string, string, { state: RootState }>(
  'water/deleteWaterLog',
  async (id, thunkAPI) => {
    const state = thunkAPI.getState();
    const userId = state.auth.user?.id;
    
    if (!userId) {
      throw new Error('No user ID found');
    }

    const { error } = await supabase
      .from('intake_log')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    return id;
  }
);

const waterSlice = createSlice({
  name: 'water',
  initialState,
  reducers: {
    resetWaterState: (state) => {
      state.waterLogs = [];
      state.dailyTotal = 0;
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch water logs
      .addCase(fetchWaterLogs.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchWaterLogs.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.waterLogs = action.payload;
        state.dailyTotal = calculateDailyTotal(action.payload);
      })
      .addCase(fetchWaterLogs.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch water logs';
      })
      
      // Add water log
      .addCase(addWaterLog.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(addWaterLog.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.waterLogs.unshift(action.payload);
        state.dailyTotal += action.payload.amount;
      })
      .addCase(addWaterLog.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to add water log';
      })
      
      // Update water log
      .addCase(updateWaterLog.fulfilled, (state, action) => {
        const index = state.waterLogs.findIndex(log => log.id === action.payload.id);
        if (index !== -1) {
          state.waterLogs[index] = action.payload;
          state.dailyTotal = calculateDailyTotal(state.waterLogs);
        }
      })
      .addCase(updateWaterLog.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to update water log';
      })
      
      // Delete water log
      .addCase(deleteWaterLog.fulfilled, (state, action) => {
        state.waterLogs = state.waterLogs.filter(log => log.id !== action.payload);
        state.dailyTotal = calculateDailyTotal(state.waterLogs);
      })
      .addCase(deleteWaterLog.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to delete water log';
      });
  },
});

export const { resetWaterState } = waterSlice.actions;

// Selectors
export const selectWaterLogs = (state: RootState) => state.water.waterLogs;
export const selectDailyWaterTotal = (state: RootState) => state.water.dailyTotal;
export const selectWaterStatus = (state: RootState) => state.water.status;
export const selectWaterError = (state: RootState) => state.water.error;

// Selector for today's logs only
export const selectTodayLogs = (state: RootState) => {
  const today = getTodayDate();

  return state.water.waterLogs.filter(log => 
    log.consumed_at.startsWith(today)
  );
};

// Selector for logs by date
export const selectLogsByDate = (state: RootState, date: string) => {
  return state.water.waterLogs.filter(log => 
    log.consumed_at.startsWith(date)
  );
};

export default waterSlice.reducer;