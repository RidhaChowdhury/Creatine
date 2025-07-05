import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@supabase/supabase-js';

type AuthState = {
    user: User | null;
    isLoading: boolean;
    error: string | null;
};

const initialState: AuthState = {
    user: null,
    isLoading: false,
    error: null,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<User | null>) => {
            state.user = action.payload;
            state.error = null;
        },
        logout: (state) => {
            state.user = null;
            state.error = null;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = !state.isLoading;;
        }
    },
});

export const { setUser, logout, setError, setLoading } = authSlice.actions;
export const selectUser = (state: {auth: AuthState}) => state.auth.user;
export const selectIsLoading = (state: {auth: AuthState}) => state.auth.isLoading;
export const selectError = (state: {auth: AuthState}) => state.auth.error;

export default authSlice.reducer;
