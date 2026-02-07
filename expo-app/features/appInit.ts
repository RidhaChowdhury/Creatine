import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAppDispatch } from '@/store/hooks';
import { initializeDatabase } from '@/lib/database';
import { fetchSettings } from './settings/settingsSlice';
import { fetchDrinkLogs, fetchCreatineLogs } from './intake/intakeSlice';

export const AppInit = () => {
   const dispatch = useAppDispatch();

   useEffect(() => {
      const bootstrap = async () => {
         try {
            await initializeDatabase();

            const settingsResult = await dispatch(fetchSettings());

            if (
               fetchSettings.fulfilled.match(settingsResult) &&
               settingsResult.payload &&
               settingsResult.payload.name &&
               settingsResult.payload.name !== ''
            ) {
               dispatch(fetchDrinkLogs());
               dispatch(fetchCreatineLogs());
               router.replace('/(tabs)');
            } else {
               router.replace('/(auth)/onboarding');
            }
         } catch (error) {
            console.error('App initialization failed:', error);
            router.replace('/(auth)/onboarding');
         }
      };

      bootstrap();
   }, []);

   return null;
};
