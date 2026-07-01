'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import {
  AUTH_RETURN_ORIGIN_PARAM,
  AUTH_NEXT_STORAGE_KEY,
  getAuthOrigin,
  isLocalAuthOrigin,
  isSafeInternalPath,
  WRAPPED_ANALYZING_PATH,
} from '../../../lib/authRedirect';

function getNextPath(queryValue: string | null): string {
  if (isSafeInternalPath(queryValue)) return queryValue;
  if (typeof window === 'undefined') return WRAPPED_ANALYZING_PATH;

  const stored = window.localStorage.getItem(AUTH_NEXT_STORAGE_KEY);
  return isSafeInternalPath(stored) ? stored : WRAPPED_ANALYZING_PATH;
}

export default function CallbackClient() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const finishAuth = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const returnOrigin = searchParams.get(AUTH_RETURN_ORIGIN_PARAM) ?? hashParams.get(AUTH_RETURN_ORIGIN_PARAM);
      if (returnOrigin && isLocalAuthOrigin(returnOrigin) && window.location.origin !== returnOrigin) {
        const localCallback = new URL('/auth/callback', returnOrigin);
        const callbackParams = new URLSearchParams(window.location.search);
        callbackParams.delete(AUTH_RETURN_ORIGIN_PARAM);
        localCallback.search = callbackParams.toString();
        hashParams.delete(AUTH_RETURN_ORIGIN_PARAM);
        localCallback.hash = hashParams.toString();
        window.location.replace(localCallback.toString());
        return;
      }

      const authOrigin = getAuthOrigin(window.location.origin);
      if (authOrigin !== window.location.origin) {
        window.location.replace(
          `${authOrigin}${window.location.pathname}${window.location.search}${window.location.hash}`
        );
        return;
      }

      if (!supabase) {
        setError('Missing Supabase environment variables.');
        return;
      }

      try {
        const oauthError = searchParams.get('error_description') ?? searchParams.get('error');
        if (oauthError) throw new Error(oauthError);

        const code = searchParams.get('code');
        const initialSession = await supabase.auth.getSession();
        if (initialSession.error) throw initialSession.error;
        let session = initialSession.data.session;

        if (!session && code) {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          session = exchangeData.session;

          if (exchangeError) {
            // A concurrent callback can consume the one-time PKCE verifier first.
            // Give that successful exchange time to persist its session before failing.
            for (let attempt = 0; attempt < 8 && !session; attempt += 1) {
              await new Promise((resolve) => window.setTimeout(resolve, 125));
              const retry = await supabase.auth.getSession();
              if (retry.error) throw retry.error;
              session = retry.data.session;
            }

            if (!session) throw exchangeError;
          }
        }

        if (!session) throw new Error('Missing authenticated session.');

        const nextPath = getNextPath(searchParams.get('next'));
        window.localStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
        window.localStorage.setItem('basafy-story-data', 'live');
        window.location.replace(nextPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to complete sign-in.');
      }
    };

    finishAuth();
  }, [searchParams]);

  return (
    <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/80 p-8 text-center shadow-xl backdrop-blur">
      {error ? (
        <>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold">Sign-in failed</h1>
          <p className="mb-6 text-sm text-muted-foreground">{error}</p>
          <Link
            href="/wrapped"
            className="inline-flex rounded-full bg-gradient-to-r from-chart-1 to-chart-2 px-6 py-3 text-sm font-semibold text-white"
          >
            Try again
          </Link>
        </>
      ) : (
        <>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-chart-1/10 text-chart-1">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold">Finishing Gmail connection</h1>
          <p className="text-sm text-muted-foreground">
            Completing sign-in and sending you to your Basafy Wrapped.
          </p>
        </>
      )}
    </div>
  );
}
