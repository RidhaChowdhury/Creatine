import React from "react";
import { Stack } from "expo-router";
import { store } from "@/store/store";
import { Provider } from "react-redux";
import { AuthWatcher } from "@/features/auth/authWatcher";

import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

export default function RootLayout() {
  return (
      <Provider store={store}>
        <GluestackUIProvider mode="dark">
          <AuthWatcher />
          <Stack screenOptions={{ headerShown: false }}/>
        </GluestackUIProvider>
      </Provider>
    
  );
}
