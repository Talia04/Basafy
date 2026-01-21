'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

export default function GmailConnectButtons() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!supabase) {
      setError('Missing Supabase environment variables.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const redirectTo = `${window.location.origin}/wrapped/analyzing`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/gmail.readonly',
        redirectTo
      }
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleConnect}
          disabled={isLoading}
          className="flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-chart-1 to-chart-2 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          <MailIcon className="mr-2 h-4 w-4" />
          {isLoading ? 'Connecting…' : 'Connect with Gmail'}
        </button>
        <Link
          href="/wrapped/story"
          className="flex flex-1 items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground"
        >
          Try Demo Mode
        </Link>
      </div>
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      <path d="m22 8-10 6L2 8" />
    </svg>
  );
}
