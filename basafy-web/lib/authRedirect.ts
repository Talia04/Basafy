export const WRAPPED_ANALYZING_PATH = '/wrapped/analyzing';
export const AUTH_NEXT_STORAGE_KEY = 'basafy-auth-next';
export const PRODUCTION_AUTH_ORIGIN = 'https://www.basafy.com';
export const AUTH_RETURN_ORIGIN_PARAM = 'return_origin';

export function isLocalAuthOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

export function getAuthOrigin(origin: string) {
  const url = new URL(origin);
  return url.hostname === 'basafy.com' || url.hostname === 'www.basafy.com'
    ? PRODUCTION_AUTH_ORIGIN
    : url.origin;
}

export function isSafeInternalPath(value: string | null): value is string {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//'));
}

export function buildAuthCallbackUrl(origin: string, nextPath = WRAPPED_ANALYZING_PATH) {
  const localOrigin = isLocalAuthOrigin(origin) ? new URL(origin).origin : null;
  const url = new URL('/auth/callback', localOrigin ? PRODUCTION_AUTH_ORIGIN : getAuthOrigin(origin));
  url.searchParams.set('next', nextPath);
  if (localOrigin) {
    const bridgeParams = new URLSearchParams();
    bridgeParams.set(AUTH_RETURN_ORIGIN_PARAM, localOrigin);
    url.hash = bridgeParams.toString();
  }
  return url.toString();
}

export function rememberAuthDestination(nextPath = WRAPPED_ANALYZING_PATH) {
  window.localStorage.setItem(AUTH_NEXT_STORAGE_KEY, nextPath);
}
