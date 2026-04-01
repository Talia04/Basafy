import { Platform } from 'react-native';

export const typography = {
  display: 'SpaceGrotesk_700Bold',
  body: Platform.select({
    ios: 'Avenir Next',
    android: 'sans-serif',
    default: 'Avenir Next',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'Menlo',
  }),
};
