import React from "react";
import { AuthProvider } from "../context/authContext";
import { Stack } from "expo-router";

import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <GluestackUIProvider mode="light">
        <Stack />
      </GluestackUIProvider>
    </AuthProvider>
    
  );
}
