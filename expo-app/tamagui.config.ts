import { defaultConfig } from '@tamagui/config/v5';
import { animationsReactNative } from '@tamagui/config/v5-rn';
import { createFont } from 'tamagui';
import { createTamagui } from 'tamagui';

const displayFont = createFont({
   family: 'BarlowCondensed',
   size: { 1: 11, 2: 12, 3: 13, 4: 14, 5: 16, 6: 18, 7: 20, 8: 23, 9: 30, 10: 42, 11: 64 },
   lineHeight: { 1: 14, 2: 16, 3: 17, 4: 18, 5: 20, 6: 22, 7: 24, 8: 27, 9: 34, 10: 44, 11: 64 },
   weight: { 4: '600', 6: '600', 8: '600' },
   face: {
      600: { normal: 'BarlowCondensed', italic: 'BarlowCondensedItalic' }
   }
});

const bodyFont = createFont({
   family: 'Archivo',
   size: { 1: 11, 2: 12, 3: 13, 4: 14, 5: 16, 6: 18, 7: 20, 8: 23, 9: 30 },
   lineHeight: { 1: 14, 2: 16, 3: 17, 4: 18, 5: 21, 6: 24, 7: 26, 8: 30, 9: 38 },
   weight: { 4: '400', 5: '500', 6: '600', 8: '800' },
   face: {
      400: { normal: 'Archivo' },
      500: { normal: 'Archivo' },
      600: { normal: 'Archivo' },
      800: { normal: 'ArchivoExtraBold' }
   }
});

const monoFont = createFont({
   family: 'IBMPlexMono',
   size: { 1: 9, 2: 10, 3: 11, 4: 12, 5: 13, 6: 14, 7: 16 },
   lineHeight: { 1: 12, 2: 13, 3: 14, 4: 16, 5: 17, 6: 18, 7: 21 },
   weight: { 4: '400', 5: '500', 6: '600' },
   face: {
      400: { normal: 'IBMPlexMono' },
      500: { normal: 'IBMPlexMonoMedium' },
      600: { normal: 'IBMPlexMono' }
   }
});

const brandFont = createFont({ ...bodyFont, family: 'ArchivoExtraBold', face: { 800: { normal: 'ArchivoExtraBold' } } });
const supplementFont = createFont({ ...displayFont, family: 'BarlowCondensedItalic', face: { 600: { normal: 'BarlowCondensedItalic' } } });

export const tamaguiConfig = createTamagui({
   ...defaultConfig,
   animations: animationsReactNative,
   fonts: { heading: displayFont, display: displayFont, body: bodyFont, mono: monoFont, brand: brandFont, supplement: supplementFont },
   themes: {
      ...defaultConfig.themes,
      light: {
         ...defaultConfig.themes.light,
         background: '#0c0c0c',
         accent: '#398eff',
         accentHover: '#66a8ff',
         accentPress: '#1d6fd2',
         onAccent: '#0c0c0c'
      },
      dark: {
         ...defaultConfig.themes.dark,
         background: '#0c0c0c',
         accent: '#398eff',
         accentHover: '#66a8ff',
         accentPress: '#1d6fd2',
         onAccent: '#0c0c0c'
      }
   },
   settings: {
      ...defaultConfig.settings,
      // Keep full React Native style prop names available alongside shorthands.
      onlyAllowShorthands: false
   }
});

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module 'tamagui' {
   interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default tamaguiConfig;
