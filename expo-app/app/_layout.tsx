import React from 'react';
import { Stack } from 'expo-router';
import { store } from '@/store/store';
import { Provider } from 'react-redux';
import { AppInit } from '@/features/appInit';

import { AppUIProvider } from '@/components/AppUIProvider';
import { FeedbackProvider } from '@/components/FeedbackProvider';

export default function RootLayout() {
   return (
      <Provider store={store}>
         <AppUIProvider>
            <FeedbackProvider>
            <AppInit />
            <Stack screenOptions={{ headerShown: false }} />
            </FeedbackProvider>
         </AppUIProvider>
      </Provider>
   );
}
