'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, supabaseUrl } from '../../../lib/supabaseClient';

const steps = [
  {
    title: 'Finding job emails',
    description: 'Scanning your inbox for job-related messages...',
    count: 'Emails scanned',
    icon: MailIcon
  },
  {
    title: 'Grouping applications',
    description: 'Organizing by company and position...',
    count: 'Applications detected',
    icon: BuildingIcon
  },
  {
    title: 'Detecting interviews and tasks',
    description: 'Finding interview invites and assessment requests...',
    count: 'Events identified',
    icon: CalendarIcon
  },
  {
    title: 'Building your story',
    description: 'Creating your personalized insights...',
    count: 'Insights generated',
    icon: SparklesIcon
  }
];

const counts = ['247', '89', '12', '25'];

export default function WrappedAnalyzingPage() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const runSync = async () => {
      if (!supabase || !supabaseUrl) {
        setSyncStatus('error');
        setSyncError('Missing Supabase environment variables.');
        return;
      }

      setSyncStatus('running');
      setSyncError(null);

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setSyncStatus('error');
        setSyncError('Missing authenticated session.');
        return;
      }

      const refreshToken = (data.session as any).provider_refresh_token ?? null;
      if (!refreshToken) {
        setSyncStatus('error');
        setSyncError('Missing Gmail refresh token. Please reconnect Gmail.');
        return;
      }

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/gmail-sync-user`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            refresh_token: refreshToken,
            light_sync: true,
            lookback_months: 3
          })
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Gmail sync failed.');
        }

        setSyncStatus('complete');
      } catch (err) {
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : 'Gmail sync failed.');
      }
    };

    runSync();
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-muted">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-10 top-16 h-64 w-64 rounded-full bg-chart-1/10 blur-3xl" />
        <div className="absolute bottom-20 right-12 h-80 w-80 rounded-full bg-chart-2/10 blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-chart-1 to-chart-2" />
            <span className="text-lg font-semibold">Basafy</span>
          </div>
          <Link
            href="/wrapped"
            className="rounded-full border border-border/70 bg-background/40 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            Back
          </Link>
        </header>

        <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pb-20 pt-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Step 2 of 3</span>
            <span>•</span>
            <span>Analyze</span>
          </div>

          <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Analyzing your Gmail</h1>
          <p className="mt-4 max-w-2xl text-center text-base text-muted-foreground">
            We are scanning your last 90 days of job-related emails to build your Basafy Wrapped story.
          </p>

          <div className="mt-10 w-full rounded-[32px] border border-border/60 bg-card/70 p-10 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="mb-8">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <span>Step 2 of 3</span>
                <span>67%</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-muted">
                <div className="h-2 w-2/3 rounded-full bg-gradient-to-r from-chart-1 to-chart-2" />
              </div>
            </div>

            <div className="space-y-5">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-background/40 px-5 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-chart-1/10 text-chart-1">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                  <div className="rounded-full border border-border/50 bg-background/60 px-4 py-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{counts[index]}</span> {step.count}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
              <span>
                {syncStatus === 'running' && 'Syncing Gmail and building your story.'}
                {syncStatus === 'complete' && 'Sync complete. Your story is ready.'}
                {syncStatus === 'error' && (syncError || 'Sync failed. You can continue anyway.')}
                {syncStatus === 'idle' && 'Almost there. We will take you to your story as soon as the scan is complete.'}
              </span>
              <Link
                href="/wrapped/story"
                className="rounded-full bg-gradient-to-r from-chart-1 to-chart-2 px-6 py-3 text-xs font-semibold text-white"
              >
                Continue
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
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

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 9h2" />
      <path d="M9 13h2" />
      <path d="M9 17h2" />
      <path d="M13 9h2" />
      <path d="M13 13h2" />
      <path d="M13 17h2" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 11h18" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M12 3l1.6 4.3L18 9l-4.4 1.7L12 15l-1.6-4.3L6 9l4.4-1.7L12 3z" />
      <path d="M19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8L19 3z" />
    </svg>
  );
}
