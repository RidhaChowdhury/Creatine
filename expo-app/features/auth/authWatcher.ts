import React, { useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";
import { useAppDispatch } from "@/store/hooks";
import { setUser, logout } from "./authSlice"

export const AuthWatcher = () => {
    const dispatch = useAppDispatch();

    const checkUserSettings = async (userId: string) => {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .single();
    
        if (error) {
          return false;
        }
    
        return !!data;
      };
    
      useEffect(() => {
        const loadSession = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            dispatch(setUser(session.user));
            const hasSettings = await checkUserSettings(session.user.id);
            router.replace(hasSettings ? "/(tabs)" : "/(auth)/onboarding");
          }
        };
    
        loadSession();
    
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            dispatch(setUser(session.user));
            const hasSettings = await checkUserSettings(session.user.id);
            router.replace(hasSettings ? "/(tabs)" : "/(auth)/onboarding");
          } else {
            dispatch(logout());
            router.replace("/(auth)/login");
          }
        });
    
        return () => {
          authListener.subscription.unsubscribe();
        };
      }, [dispatch]);
    
      return null;
}