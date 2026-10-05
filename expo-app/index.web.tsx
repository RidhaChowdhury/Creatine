import '@expo/metro-runtime';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';

// Skia modules must be evaluated after the browser's CanvasKit engine is ready.
LoadSkiaWeb({ locateFile: (file) => `/${file}` })
   .then(() => renderRootComponent(App))
   .catch((error) => {
      console.error('Unable to start the app:', error);
      const root = document.getElementById('root');
      if (root) root.textContent = 'Unable to start the app. Please refresh to try again.';
   });
