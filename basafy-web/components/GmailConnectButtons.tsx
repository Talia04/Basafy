'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import {
  buildAuthCallbackUrl,
  getAuthOrigin,
  rememberAuthDestination,
  WRAPPED_ANALYZING_PATH,
} from '../lib/authRedirect';
import { Button } from './ui/button';

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
    if (authOrigin !== window.location.origin) {
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
    router.push('/wrapped/story');
  };

  return (
    <div className="space-y-4">
      <Button
        type="button"
        onClick={handleConnect}
        disabled={isLoading}
        size="lg"
        className="w-full text-lg py-6 bg-gradient-to-r from-chart-1 to-chart-2 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Mail className="mr-2 h-5 w-5" />
        {isLoading ? 'Connecting…' : 'Connect with Gmail'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={handleDemo}
        className="w-full text-lg py-6"
      >
        Try Demo Mode (Sample Data)
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
