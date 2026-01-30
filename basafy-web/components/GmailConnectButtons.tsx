'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';

export default function GmailConnectButtons() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleConnect = async () => {
    if (!supabase) {
      setError('Missing Supabase environment variables.');
      return;
    }

    setIsLoading(true);
    setError(null);
    window.localStorage.setItem('basafy-story-data', 'live');

    // Use current origin for redirect - ensure localhost works in development
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectTo = `${origin}/wrapped/analyzing`;

    // Store the intended origin so we can redirect back properly after OAuth
    // This is needed because Supabase may redirect to the production URL
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('basafy-auth-origin', origin);
    }

    console.log('OAuth redirect URL:', redirectTo); // Debug log

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
  };

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
