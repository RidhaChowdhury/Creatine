import React from 'react';
import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '@/tamagui.config';

export function AppUIProvider({ children }: { children: React.ReactNode }) {
   const [fontsLoaded, fontError] = useFonts({
      Inter: require('@tamagui/font-inter/otf/Inter-Regular.otf'),
      InterMedium: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
      InterSemiBold: require('@tamagui/font-inter/otf/Inter-SemiBold.otf'),
      InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
      BarlowCondensed: require('@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf'),
      BarlowCondensedItalic: require('@expo-google-fonts/barlow-condensed/600SemiBold_Italic/BarlowCondensed_600SemiBold_Italic.ttf'),
      Archivo: require('@expo-google-fonts/archivo/400Regular/Archivo_400Regular.ttf'),
      ArchivoExtraBold: require('@expo-google-fonts/archivo/800ExtraBold/Archivo_800ExtraBold.ttf'),
      IBMPlexMono: require('@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf'),
      IBMPlexMonoMedium: require('@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf')
   });

   if (fontError) throw fontError;
   if (!fontsLoaded) {
      return (
         <View style={{ flex: 1, backgroundColor: '#07070a', justifyContent: 'center' }}>
            <ActivityIndicator color='#ffffff' accessibilityLabel='Loading fonts' />
         </View>
      );
   }

   return (
      <TamaguiProvider config={tamaguiConfig} defaultTheme='dark'>
         {children}
      </TamaguiProvider>
   );
}
