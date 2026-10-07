import React from 'react';
import { Platform } from 'react-native';
import { AppUIProvider } from '@/components/AppUIProvider';

const { renderToStaticMarkup } = require('react-dom/server.node');
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  View: ({ children }: any) => require('react').createElement('div', null, children),
  ActivityIndicator: ({ accessibilityLabel }: any) => require('react').createElement('div', { role: 'status', 'aria-label': accessibilityLabel }),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('tamagui', () => ({ TamaguiProvider: ({ children }: any) => children }));
jest.mock('@/tamagui.config', () => ({ tamaguiConfig: {} }));
jest.mock('@tamagui/font-inter/otf/Inter-Regular.otf', () => 1);
jest.mock('@tamagui/font-inter/otf/Inter-Medium.otf', () => 2);
jest.mock('@tamagui/font-inter/otf/Inter-SemiBold.otf', () => 3);
jest.mock('@tamagui/font-inter/otf/Inter-Bold.otf', () => 4);

afterEach(() => { (Platform as any).OS = 'web'; });

it('static web output cannot expose inputs before their event handlers hydrate', () => {
  const markup = renderToStaticMarkup(<AppUIProvider><input aria-label="Email" /><button>Login</button></AppUIProvider>);
  expect(markup).toContain('Loading Drops');
  expect(markup).not.toContain('<input');
  expect(markup).not.toContain('<button');
});

it('native startup still renders the app as soon as its fonts are ready', () => {
  (Platform as any).OS = 'ios';
  const markup = renderToStaticMarkup(<AppUIProvider><button>Login</button></AppUIProvider>);
  expect(markup).toContain('Login');
  expect(markup).not.toContain('Loading Drops');
});
