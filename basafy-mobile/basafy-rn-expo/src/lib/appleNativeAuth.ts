import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from '@backend/supabase/client';

type AppleSignInResult = {
  data: Awaited<ReturnType<typeof supabase.auth.signInWithIdToken>>['data'];
  credential: AppleAuthentication.AppleAuthenticationCredential;
};

// Use a cryptographically secure random nonce generator
const nonceAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';

export async function isAppleSignInAvailable() {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithAppleNative(): Promise<AppleSignInResult> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple sign-in is only available on iOS.');
  }
  const available = await isAppleSignInAvailable();
  if (!available) {
    throw new Error('Apple sign-in is not available on this device.');
  }

  const rawNonce = createNonce(32);
  const hashedNonce = await sha256HexAsync(rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err: any) {
    const code = err?.code || err?.message || '';
    if (code === 'ERR_CANCELED' || code === 'ERR_CANCELED_SIGN_IN' || code === 'ERR_REQUEST_CANCELED') {
      throw new Error('Apple sign-in was cancelled.');
    }
    throw err;
  }

  if (!credential.identityToken) {
    throw new Error('Apple sign-in did not return an identity token.');
  }

  // Intentionally no debug logging in production builds.

  // Pass the raw nonce to Supabase; it will hash and verify against the token
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  const fullName = formatAppleName(credential.fullName);
  const existingName =
    data?.user?.user_metadata?.full_name ||
    data?.user?.user_metadata?.name ||
    '';
  if (fullName) {
    await supabase.auth.updateUser({ data: { full_name: fullName } }).catch(() => null);
  } else if (!existingName || looksLikeEmail(existingName)) {
    const fallbackName = createFallbackName(data?.user?.id);
    await supabase.auth.updateUser({ data: { full_name: fallbackName } }).catch(() => null);
  }
  return { data, credential };
}


// Generate a cryptographically secure nonce
function createNonce(length: number) {
  const bytes = Crypto.getRandomBytes(length);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += nonceAlphabet[bytes[i] % nonceAlphabet.length];
  }
  return result;
}

function formatAppleName(name: AppleAuthentication.AppleAuthenticationFullName | null | undefined) {
  if (!name) return '';
  const parts = [name.givenName, name.familyName].filter(Boolean);
  return parts.join(' ').trim();
}

function looksLikeEmail(value: string) {
  return typeof value === 'string' && value.includes('@');
}

function createFallbackName(userId?: string | null) {
  let seed = 0;
  if (userId) {
    for (let i = 0; i < userId.length; i += 1) {
      seed = (seed + userId.charCodeAt(i) * (i + 1)) % 10000;
    }
  } else {
    seed = Math.floor(Math.random() * 9000) + 1000;
  }
  const suffix = (seed % 9000) + 1000;
  return `Basafy User ${suffix}`;
}

// Hash nonce using SHA256 and encode as hex (matches Supabase native examples)
async function sha256HexAsync(message: string) {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return hash;
}
