'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Building2, Calendar, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { supabase, supabaseUrl } from '../../../lib/supabaseClient';
import { buildAuthCallbackUrl, rememberAuthDestination } from '../../../lib/authRedirect';

async function waitForSession() {
  if (!supabase) return null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  return null;
}

const analysisSteps = [
  {
    icon: <Mail className="w-8 h-8" />,
    title: 'Finding job emails',
    description: 'Securely checking your inbox for job-related messages.'
  },
  {
    icon: <Building2 className="w-8 h-8" />,
    title: 'Grouping applications',
    description: 'Organizing detected updates by company and position.'
  },
  {
    icon: <Calendar className="w-8 h-8" />,
    title: 'Detecting interviews and tasks',
    description: 'Looking for interview invites, assessments, and deadlines.'
  },
  {
    icon: <Sparkles className="w-8 h-8" />,
    title: 'Building your story',
    description: 'Your Gmail sync is complete and your live results are ready.'
  }
];

type SyncResult = {
  processed?: number;
  total_messages_fetched?: number;
  applications_created?: number;
  applications_updated?: number;
  job_email_events_created?: number;
  debug?: {
    inserted?: number;
    updated?: number;
    eventInserted?: number;
  };
};

export default function WrappedAnalyzingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [reconnectLoading, setReconnectLoading] = useState(false);

  useEffect(() => {
    if (syncStatus !== 'running') return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < analysisSteps.length - 2 ? prev + 1 : prev));
    }, 2400);

    return () => clearInterval(interval);
  }, [syncStatus]);

  // Auto-redirect when progress animation completes and sync is done
  useEffect(() => {
    if (syncStatus === 'complete') {
      const timer = setTimeout(() => {
        router.push('/wrapped/story');
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [syncStatus, router]);

  useEffect(() => {
    const runSync = async () => {
      if (!supabase || !supabaseUrl) {
        setSyncStatus('error');
        setSyncError('Missing Supabase environment variables.');
        return;
      }

      window.localStorage.setItem('basafy-story-data', 'live');
      setSyncStatus('running');
      setSyncError(null);
      setSyncResult(null);

      const session = await waitForSession();
      if (!session) {
        setSyncStatus('error');
        setSyncError('Missing authenticated session.');
        return;
      }

      try {
        const refreshToken = (session as any).provider_refresh_token ?? null;
        const body: Record<string, unknown> = {
          light_sync: true,
          lookback_months: 3
        };

        if (refreshToken) {
          body.refresh_token = refreshToken;
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/gmail-sync-user`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        const payload = await response.json().catch(() => null) as (SyncResult & { error?: string }) | null;

        if (!response.ok) {
          throw new Error(payload?.error || 'Gmail sync failed.');
        }

        setSyncResult(payload);
        setCurrentStep(analysisSteps.length - 1);
        setSyncStatus('complete');
      } catch (err) {
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : 'Gmail sync failed.');
      }
    };

    runSync();
  }, [router]);

  const completedMetrics = syncResult
    ? [
        {
          label: 'Messages checked',
          value: syncResult.total_messages_fetched ?? syncResult.processed,
        },
        {
          label: 'New applications',
          value: syncResult.applications_created ?? syncResult.debug?.inserted,
        },
        {
          label: 'Records updated',
          value: syncResult.applications_updated ?? syncResult.debug?.updated,
        },
      ].filter((metric): metric is { label: string; value: number } => typeof metric.value === 'number')
    : [];

  const handleReconnect = async () => {
    if (!supabase) {
      setSyncStatus('error');
      setSyncError('Missing Supabase environment variables.');
      return;
    }
    setReconnectLoading(true);

    rememberAuthDestination();
    const redirectTo = buildAuthCallbackUrl(window.location.origin);

    const { error } = await supabase.auth.signInWithOAuth({
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

    if (error) {
      setSyncStatus('error');
      setSyncError(error.message);
      setReconnectLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center gap-2 mb-12">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-chart-1 to-chart-2 p-[2px]">
            <img
              src="/basafy-icon.png"
              alt="Basafy"
              className="h-full w-full rounded-[6px]"
            />
          </div>
          <span className="text-2xl font-bold">Basafy</span>
        </div>

        <div className="mb-12">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Step 2 of 3</span>
            <span className="text-sm text-muted-foreground">
              {syncStatus === 'complete' ? 'Complete' : syncStatus === 'error' ? 'Needs attention' : 'Syncing securely'}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            {syncStatus === 'complete' ? (
              <div className="h-full w-full bg-gradient-to-r from-chart-1 to-chart-2" />
            ) : (
              <motion.div
                className="h-full w-1/3 rounded-full bg-gradient-to-r from-chart-1 to-chart-2"
                animate={{ x: ['-110%', '310%'] }}
                transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <div className="inline-flex p-4 rounded-full bg-chart-1/10 mb-6">
              <div className="text-chart-1">{analysisSteps[currentStep].icon}</div>
            </div>
            <h2 className="text-3xl font-bold mb-3">{analysisSteps[currentStep].title}</h2>
            <p className="text-lg text-muted-foreground mb-6">{analysisSteps[currentStep].description}</p>
            {syncStatus === 'complete' && completedMetrics.length > 0 ? (
              <div className="mx-auto grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                {completedMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
                    <div className="text-2xl font-bold text-chart-1">{metric.value.toLocaleString()}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{metric.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full bg-muted px-5 py-3 text-sm text-muted-foreground">
                {syncStatus === 'complete' ? (
                  <CheckCircle2 className="h-4 w-4 text-chart-2" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-chart-1" />
                )}
                {syncStatus === 'complete' ? 'Preparing your live dashboard' : 'No preview numbers until the sync finishes'}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-center gap-3 mb-8">
          {analysisSteps.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${idx <= currentStep ? 'w-12 bg-chart-1' : 'w-8 bg-muted'}`}
            />
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <span>
            {syncStatus === 'running' && 'Syncing Gmail and building your story.'}
            {syncStatus === 'complete' && 'Sync complete. Your story is ready.'}
            {syncStatus === 'error' && (syncError || 'Sync failed. You can continue anyway.')}
            {syncStatus === 'idle' && 'Almost there. We will take you to your story as soon as the scan is complete.'}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {syncStatus === 'error' && (
              <button
                type="button"
                onClick={handleReconnect}
                disabled={reconnectLoading}
                className="rounded-full border border-destructive/40 px-5 py-2 text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-70"
              >
                {reconnectLoading ? 'Reconnecting…' : 'Reconnect Gmail'}
              </button>
            )}
            {(syncStatus === 'complete' || syncStatus === 'error') && (
              <Link
                href="/wrapped/story"
                className="rounded-full bg-gradient-to-r from-chart-1 to-chart-2 px-6 py-3 text-xs font-semibold text-white shadow-[0_16px_30px_rgba(32,82,255,0.25)]"
              >
                {syncStatus === 'complete' ? 'View results' : 'View existing data'}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
