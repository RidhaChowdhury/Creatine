import React from "react";
import { AuthProvider } from "../context/authContext";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack />
    </AuthProvider>
    
  );
}
