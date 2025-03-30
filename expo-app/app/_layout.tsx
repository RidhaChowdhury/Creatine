import React from "react";
import { AuthProvider } from "../context/authContext";
import { Stack } from "expo-router";

import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { RefreshProvider } from "@/context/refreshContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <RefreshProvider>
        <GluestackUIProvider mode="dark">
          <Stack screenOptions={{ headerShown: false }}/>
        </GluestackUIProvider>
      </RefreshProvider>
    </AuthProvider>
    
  );
}
