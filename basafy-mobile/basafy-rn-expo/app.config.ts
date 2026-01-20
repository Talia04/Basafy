import 'dotenv/config';
import { ExpoConfig } from 'expo/config';

const iosUrlScheme = (() => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (iosClientId?.includes('.apps.googleusercontent.com')) {
    const prefix = iosClientId.split('.apps.googleusercontent.com')[0];
    return `com.googleusercontent.apps.${prefix}`;
  }
  return 'com.googleusercontent.apps.basafy';
})();

const config: ExpoConfig = {
  name: 'Basafy',
  scheme: 'basafy',
  slug: 'basafy',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0E1A',
  },
  owner: 'talia04',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.basafy.app',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [iosUrlScheme],
        },
      ],
      GIDClientID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      GIDServerClientID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    },
  },
  android: {
    "package": "com.basafy.app",
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0E1A',
    },
  },
  plugins: [
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme,
      },
    ],
  ],
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    // Values are injected at build time from .env / process.env
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: 'aec94b45-3c7b-4443-bad8-45c1525b782c',
    },
  },
};

export default config;
