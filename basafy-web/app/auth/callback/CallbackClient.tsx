'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

function normalizeNext(next: string | null): string {
  if (!next || !next.startsWith('/')) return '/wrapped/analyzing';
  if (next.startsWith('//')) return '/wrapped/analyzing';
  return next;
}

function resolveOrigin(origin: string | null): string | null {
  if (!origin) return null;

  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export default function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => normalizeNext(searchParams.get('next')), [searchParams]);

  useEffect(() => {
    const targetOrigin = resolveOrigin(searchParams.get('origin'));

    if (targetOrigin && targetOrigin !== window.location.origin) {
      const redirectUrl = new URL('/auth/callback', targetOrigin);
      redirectUrl.search = window.location.search;
      redirectUrl.hash = window.location.hash;
      window.location.replace(redirectUrl.toString());
      return;
    }

    const finishAuth = async () => {
      if (!supabase) {
        setError('Missing Supabase environment variables.');
        return;
      }

      try {
        const code = searchParams.get('code');

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error('Missing authenticated session.');

        window.localStorage.setItem('basafy-story-data', 'live');
        router.replace(nextPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to complete sign-in.');
      }
    };

    finishAuth();
  }, [nextPath, router, searchParams]);

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
