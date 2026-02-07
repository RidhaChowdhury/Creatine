import React from 'react';
import { Stack } from 'expo-router';
import { store } from '@/store/store';
import { Provider } from 'react-redux';
import { AppInit } from '@/features/appInit';

import '@/global.css';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';

export default function RootLayout() {
   return (
      <Provider store={store}>
         <GluestackUIProvider mode='dark'>
            <AppInit />
            <Stack screenOptions={{ headerShown: false }} />
         </GluestackUIProvider>
      </Provider>
   );
}
