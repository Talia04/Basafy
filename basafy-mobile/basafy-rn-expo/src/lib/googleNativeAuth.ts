import { Alert, Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '@backend/supabase/client';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let configured = false;

export function ensureGoogleConfigured() {
  if (configured) return;
  if (!webClientId) {
    console.warn('Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID for Google sign-in');
    return;
  }
  GoogleSignin.configure({
    webClientId,
    iosClientId,
  });
  configured = true;
}

export async function signInWithGoogleNative() {
  ensureGoogleConfigured();
  try {
    // Google native sign-in may not work on iOS Simulator; keep native first, fallback only on simulator.
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    const idToken = response?.data?.idToken;
    if (!idToken) {
      throw new Error('No Google ID token returned.');
    }
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw error;
    return data;
  } catch (err: any) {
    // Fallback to browser-based OAuth only when running on simulator/dev
    try {
      if (!Constants.isDevice) {
        const result = await signInWithGoogleBrowser();
        return result;
      }
      throw err;
    } catch (fallbackErr: any) {
      const message = fallbackErr?.message || err?.message || 'Google sign-in failed.';
      Alert.alert('Google sign-in', message);
      throw fallbackErr;
    }
  }
}

async function signInWithGoogleBrowser() {
  const isExpoGo = Constants.appOwnership === 'expo';
  const redirectTo =
    (isExpoGo ? process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URI : null) ||
    AuthSession.makeRedirectUri({
      useProxy: isExpoGo,
      scheme: 'basafy',
      path: 'auth/callback',
    });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'email profile https://www.googleapis.com/auth/gmail.readonly',
      queryParams: { prompt: 'consent', access_type: 'offline' },
      redirectTo,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('No OAuth URL returned.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    preferEphemeralSession: Platform.OS === 'ios',
  });
  if (result.type !== 'success' || !result.url) {
    throw new Error('Auth session did not complete.');
  }

  const authCode = getParam(result.url, 'code');
  if (authCode) {
    const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
    if (exchangeError) throw exchangeError;
    return exchangeData;
  }

  const { access_token, refresh_token } = getTokensFromUrl(result.url);
  if (access_token && refresh_token) {
    const { data: sessionData, error: setError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (setError) throw setError;
    return sessionData;
  }

  throw new Error('No auth code returned from Google redirect.');
}

export async function signOutGoogle() {
  try {
    await GoogleSignin.signOut();
    if (Platform.OS === 'android') {
      await GoogleSignin.revokeAccess();
    }
  } catch {
    // ignore
  }
}

function getParam(url: string, param: string) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get(param);
  } catch {
    return null;
  }
}

function getTokensFromUrl(url: string) {
  try {
    const hash = url.split('#')[1];
    if (!hash) return { access_token: null, refresh_token: null };
    const params = new URLSearchParams(hash);
    return {
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token'),
    };
  } catch {
    return { access_token: null, refresh_token: null };
  }
}
