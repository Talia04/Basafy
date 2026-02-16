import { Alert, AppState, Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '@backend/supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const gmailScope = 'https://www.googleapis.com/auth/gmail.readonly';
const openIdScopes = ['openid', 'email', 'profile', gmailScope];
const googleCacheTtlMs = 5 * 60 * 1000;

let lastGoogleAuth: {
  idToken?: string | null;
  serverAuthCode?: string | null;
  scopes?: string[] | null;
  email?: string | null;
  at: number;
} | null = null;
let googleSignInInFlight: Promise<any> | null = null;
const googleFirstRunKey = 'basafy:google-auth-initialized';

type GoogleConfigOptions = {
  scopes?: string[];
  offlineAccess?: boolean;
  forceCodeForRefreshToken?: boolean;
};

export function ensureGoogleConfigured(options: GoogleConfigOptions = {}) {
  if (!webClientId) {
    console.warn('[GoogleAuth] Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID for Google sign-in. ID token will not be returned.');
  }
  GoogleSignin.configure({
    webClientId,
    iosClientId,
    scopes: options.scopes,
    offlineAccess: options.offlineAccess,
    forceCodeForRefreshToken: options.forceCodeForRefreshToken,
  });
}

function assertGoogleNativeConfig() {
  if (!webClientId) {
    throw new Error('Google sign-in is not configured. Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
  }
  if (Platform.OS === 'ios' && !iosClientId) {
    throw new Error('Google sign-in is not configured. Missing EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.');
  }
  if (Platform.OS === 'ios' && iosClientId && webClientId && iosClientId === webClientId) {
    throw new Error('Google sign-in is misconfigured. iOS client ID must be different from the web client ID.');
  }
  if (Platform.OS === 'ios' && iosClientId && !iosClientId.endsWith('.apps.googleusercontent.com')) {
    throw new Error('Google sign-in is misconfigured. iOS client ID must end with .apps.googleusercontent.com.');
  }
}

export async function signInWithGoogleNative() {
  assertGoogleNativeConfig();
  ensureGoogleConfigured({
    // Request Gmail scope here so we don't need a second sign-in later.
    scopes: openIdScopes,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });
  const cached = getCachedGoogleAuth(['openid', 'email', 'profile']);
  if (cached?.idToken) {
    return await signInWithSupabaseGoogle(cached.idToken);
  }
  try {
    // Google native sign-in may not work on iOS Simulator; keep native first, fallback only on simulator.
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    let response: any = null;
    let responseSource: 'silent' | 'interactive' = 'silent';
    const silent = await GoogleSignin.signInSilently().catch(() => null);
    const silentData = (silent as any)?.data ?? silent;
    if (silentData) {
      response = { type: 'success', data: silentData };
    } else {
      responseSource = 'interactive';
      response = await runGoogleSignIn();
    }
    let responseType = (response as any)?.type ?? null;
    let googleData = (response as any)?.data ?? response;
    let tokens = await GoogleSignin.getTokens().catch(() => null);
    let idToken =
      googleData?.idToken ??
      (googleData as any)?.data?.idToken ??
      tokens?.idToken ??
      null;
    if (!idToken && responseSource === 'silent') {
      responseSource = 'interactive';
      response = await runGoogleSignIn();
      responseType = (response as any)?.type ?? null;
      googleData = (response as any)?.data ?? response;
      tokens = await GoogleSignin.getTokens().catch(() => null);
      idToken =
        googleData?.idToken ??
        (googleData as any)?.data?.idToken ??
        tokens?.idToken ??
        null;
    }
    if (!idToken) {
      if (responseType === 'cancelled') {
        throw new Error('Google sign-in was cancelled.');
      }
      throw new Error('[GoogleAuth] No Google ID token returned. Ensure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is set to a Web OAuth client ID.');
    }
    cacheGoogleAuth({
      idToken,
      serverAuthCode: googleData?.serverAuthCode ?? null,
      scopes: googleData?.scopes ?? null,
      email: googleData?.user?.email ?? null,
    });
    return await signInWithSupabaseGoogle(idToken);
  } catch (err: any) {
    const isCancelled = err?.message === 'Google sign-in was cancelled.';
    const message = isCancelled ? 'Google sign-in was cancelled.' : 'Google sign-in failed. Please try again.';
    console.log('[GoogleAuth] signInWithGoogleNative error', {
      message: err?.message ?? null,
      code: err?.code ?? null,
    });
    Alert.alert('Google sign-in', message);
    throw err;
  }
}

export async function connectGmailWithGoogleNative() {
  assertGoogleNativeConfig();
  ensureGoogleConfigured({
    scopes: openIdScopes,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });
  await clearGoogleAuthOnFreshInstall();
  // Prefer native sign-in UI; do not fall back to any browser-based flow.
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitForActive = async () => {
    if (AppState.currentState === 'active') return;
    await new Promise<void>((resolve) => {
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          sub.remove();
          resolve();
        }
      });
    });
  };
  const retryDelayMs = 1000;
  const maxRetries = 12;
  let data: any = null;
  let serverAuthCode: string | null = null;
  let email: string | null = null;

  const silent = await GoogleSignin.signInSilently().catch(() => null);
  data = (silent as any)?.data ?? silent;
  serverAuthCode = data?.serverAuthCode ?? null;
  email = data?.user?.email ?? null;
  if (!serverAuthCode) {
    await waitForActive();
    const response = await runGoogleSignIn();
    data = (response as any)?.data ?? response;
    serverAuthCode = data?.serverAuthCode ?? null;
    email = data?.user?.email ?? null;
  }
  if (!serverAuthCode) {
    await waitForActive();
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      await wait(retryDelayMs);
      const retrySilent = await GoogleSignin.signInSilently().catch(() => null);
      data = (retrySilent as any)?.data ?? retrySilent;
      serverAuthCode = data?.serverAuthCode ?? null;
      email = data?.user?.email ?? null;
      if (serverAuthCode) break;
    }
  }
  if (!serverAuthCode) {
    throw new Error('Google sign-in did not return a server auth code. Please try again.');
  }
  // Do not cache serverAuthCode; it's single-use and expires quickly.
  cacheGoogleAuth({
    idToken: data?.idToken ?? null,
    serverAuthCode: null,
    scopes: data?.scopes ?? null,
    email,
  });
  return { serverAuthCode, email };
}


export async function signOutGoogle() {
  try {
    await GoogleSignin.signOut();
    if (Platform.OS === 'android') {
      await GoogleSignin.revokeAccess();
    }
    lastGoogleAuth = null;
  } catch {
    // ignore
  }
}

async function runGoogleSignIn() {
  if (!googleSignInInFlight) {
    googleSignInInFlight = GoogleSignin.signIn().finally(() => {
      googleSignInInFlight = null;
    });
  }
  return googleSignInInFlight;
}

function cacheGoogleAuth(data: {
  idToken?: string | null;
  serverAuthCode?: string | null;
  scopes?: string[] | null;
  email?: string | null;
}) {
  lastGoogleAuth = {
    ...data,
    at: Date.now(),
  };
}

function getCachedGoogleAuth(requiredScopes: string[]) {
  if (!lastGoogleAuth) return null;
  if (Date.now() - lastGoogleAuth.at > googleCacheTtlMs) return null;
  const scopes = lastGoogleAuth.scopes || [];
  const hasScopes = requiredScopes.every((scope) => scopes.includes(scope));
  if (!hasScopes) return null;
  return lastGoogleAuth;
}

async function clearGoogleAuthOnFreshInstall() {
  try {
    const alreadyInitialized = await AsyncStorage.getItem(googleFirstRunKey);
    if (alreadyInitialized) return;
    await GoogleSignin.signOut().catch(() => null);
    await GoogleSignin.revokeAccess().catch(() => null);
  } catch {
    // ignore cleanup failures
  } finally {
    await AsyncStorage.setItem(googleFirstRunKey, '1');
  }
}


async function signInWithSupabaseGoogle(idToken: string) {
  const tokenNonce = getJwtNonce(idToken);
  const attempt = async (nonce?: string | null) => {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      nonce: nonce ?? undefined,
    });
    if (error) throw error;
    return data;
  };

  try {
    return await attempt(tokenNonce);
  } catch (err: any) {
    const message = err?.message || '';
    if (tokenNonce && message.includes('Nonces mismatch')) {
      const base64UrlNonce = sha256Base64Url(tokenNonce);
      if (base64UrlNonce) {
        try {
          return await attempt(base64UrlNonce);
        } catch (retryErr: any) {
          const retryMessage = retryErr?.message || '';
          if (!retryMessage.includes('Nonces mismatch')) throw retryErr;
        }
      }
      const hexNonce = sha256Hex(tokenNonce);
      return await attempt(hexNonce);
    }
    throw err;
  }
}

function getJwtNonce(idToken: string) {
  try {
    const payloadSegment = idToken.split('.')[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded));
    return typeof payload?.nonce === 'string' ? payload.nonce : null;
  } catch {
    return null;
  }
}

function sha256Hex(message: string) {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i: number;
  let j: number;
  let result = '';

  const words: number[] = [];
  const messageBitLength = message[lengthProperty] * 8;

  // Attach static properties to the function object with type assertion
  type Sha256HexStatic = typeof sha256Hex & { h?: number[]; k?: number[] };
  const sha256HexStatic = sha256Hex as Sha256HexStatic;

  let hash = sha256HexStatic.h || [];
  let k = sha256HexStatic.k || [];
  let primeCounter = k[lengthProperty];

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }

  sha256HexStatic.h = hash;
  sha256HexStatic.k = k;

  message += '\u0080';
  while (message[lengthProperty] % 64 - 56) message += '\u0000';
  for (i = 0; i < message[lengthProperty]; i += 1) {
    j = message.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (messageBitLength / maxWord) | 0;
  words[words[lengthProperty]] = messageBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7)) ^
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3)) +
                w[i - 7] +
                (((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (i = 0; i < 8; i += 1) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i += 1) {
    for (j = 3; j + 1; j -= 1) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

function sha256Base64Url(message: string) {
  const hex = sha256Hex(message);
  if (!hex) return '';
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  const base64 = bytesToBase64(bytes);
  if (!base64) return '';
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToBase64(bytes: number[]) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(binary, 'binary').toString('base64');
  }
  return '';
}
