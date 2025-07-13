import React, { useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";
import { useAppDispatch } from "@/store/hooks";
import { setUser, logout } from "./authSlice"
import { fetchDrinkLogs, fetchCreatineLogs, resetIntakeState } from "../intake/intakeSlice";
import { fetchSettings, resetSettingsState } from "../settings/settingsSlice";

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
            const handleAuthChange = async () => {
                if (session?.user) {
                    dispatch(setUser(session.user));
                    const settingsResult = await dispatch(fetchSettings());
                    
                    dispatch(fetchDrinkLogs());
                    dispatch(fetchCreatineLogs());
                    if (fetchSettings.fulfilled.match(settingsResult)) {
                        // Check if user has completed onboarding (has a name)
                        const onboarded = settingsResult.payload && 
                                       settingsResult.payload.name && 
                                       settingsResult.payload.name !== '';

                        if (onboarded) {
                          router.replace("/(tabs)");
                        } else {
                          router.replace('/(auth)/onboarding');
                        }
                    } else {
                    // If fetch failed, assume not onboarded and go to onboarding
                    router.replace('/(auth)/onboarding');
                    }
                } else {
                    dispatch(logout());
                    dispatch(resetIntakeState());
                    dispatch(resetSettingsState());
                    router.replace("/(auth)/login");
                }
            }

            handleAuthChange().catch(err => {
                console.error("Error handling auth state change: ", err);
            });
        });
    }, []);
    
    return null;
}