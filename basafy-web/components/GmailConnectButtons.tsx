'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Mail, Play } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import {
  buildAuthCallbackUrl,
  getAuthOrigin,
  isLocalAuthOrigin,
  rememberAuthDestination,
  WRAPPED_ANALYZING_PATH,
} from '../lib/authRedirect';
import { Button } from './ui/button';
import { ErrorState } from './error/ErrorState';

export default function GmailConnectButtons() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleConnect = useCallback(async () => {
    if (!supabase) {
      setError('Missing Supabase environment variables.');
      return;
    }

    const authOrigin = getAuthOrigin(window.location.origin);
    if (!isLocalAuthOrigin(window.location.origin) && authOrigin !== window.location.origin) {
      const resumeUrl = new URL('/wrapped', authOrigin);
      resumeUrl.searchParams.set('connect', 'gmail');
      window.location.assign(resumeUrl.toString());
      return;
    }

    setIsLoading(true);
    setError(null);
    window.localStorage.setItem('basafy-story-data', 'live');
    rememberAuthDestination();

    const redirectTo = buildAuthCallbackUrl(window.location.origin, WRAPPED_ANALYZING_PATH);

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/gmail.readonly',
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('connect') !== 'gmail') return;

    url.searchParams.delete('connect');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    void handleConnect();
  }, [handleConnect]);

  const handleDemo = () => {
    window.localStorage.setItem('basafy-story-data', 'demo');
    router.push('/wrapped/story?mode=demo');
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={handleConnect}
        disabled={isLoading}
        size="lg"
        className="group h-12 w-full rounded-lg border border-blue-300/15 bg-gradient-to-r from-blue-600 via-violet-600 to-blue-500 px-5 text-sm text-white shadow-[0_14px_40px_rgba(59,130,246,0.24)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {isLoading ? 'Connecting…' : 'Connect with Gmail'}
        {!isLoading && <ArrowRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-1" />}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={handleDemo}
        className="h-12 w-full rounded-lg border-white/10 bg-white/[0.035] px-5 text-sm text-white/70 hover:bg-white/[0.07] hover:text-white"
      >
        <Play className="h-4 w-4" />
        Preview with sample data
      </Button>
      {error ? (
        <ErrorState
          message={error}
          compact
          primaryAction={{ label: 'Try again', onClick: handleConnect }}
        />
      ) : null}
    </div>
  );
}
