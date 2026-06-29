export const WRAPPED_ANALYZING_PATH = '/wrapped/analyzing';
export const AUTH_NEXT_STORAGE_KEY = 'basafy-auth-next';
export const PRODUCTION_AUTH_ORIGIN = 'https://www.basafy.com';

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
  const url = new URL('/auth/callback', getAuthOrigin(origin));
  url.searchParams.set('next', nextPath);
  return url.toString();
}

export function rememberAuthDestination(nextPath = WRAPPED_ANALYZING_PATH) {
  window.localStorage.setItem(AUTH_NEXT_STORAGE_KEY, nextPath);
}
