export const WRAPPED_ANALYZING_PATH = '/wrapped/analyzing';
export const AUTH_NEXT_STORAGE_KEY = 'basafy-auth-next';

export function isSafeInternalPath(value: string | null): value is string {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//'));
}

export function buildAuthCallbackUrl(origin: string, nextPath = WRAPPED_ANALYZING_PATH) {
  const url = new URL('/auth/callback', origin);
  url.searchParams.set('next', nextPath);
  return url.toString();
}

export function rememberAuthDestination(nextPath = WRAPPED_ANALYZING_PATH) {
  window.localStorage.setItem(AUTH_NEXT_STORAGE_KEY, nextPath);
}

