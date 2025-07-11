import React, { useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";
import { useAppDispatch } from "@/store/hooks";
import { setUser, logout } from "./authSlice"
import { fetchWaterLogs, resetWaterState } from "../water/waterSlice";

export const AuthWatcher = () => {
    const dispatch = useAppDispatch();
    
    useEffect(() => {
        supabase.auth.getSession().then(({ data: {session}}) => {
            if (session?.user) {
                dispatch(setUser(session.user));
                router.replace("/(tabs)");
            } else {
                router.replace("/(auth)/login");
            }
        });
              
        supabase.auth.onAuthStateChange((_event, session) => {
            const hasSettings = async (userId: string) => {
                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (error) {
                    console.error(error);
                    return false;
                }

                return !!data;
            }

            const handleAuthChange = async () => {
                if (session?.user) {
                    const onboarded = await hasSettings(session.user.id);
                    dispatch(setUser(session.user));
                    dispatch(fetchWaterLogs());
                    if (onboarded) {
                        router.replace("/(tabs)");
                    } else {
                        router.replace('/(auth)/onboarding');
                    }
                } else {
                    dispatch(logout());
                    dispatch(resetWaterState())
                    router.replace("/(auth)/login");
                }
            }

            handleAuthChange();
        });
    }, []);
    
    return null;
}