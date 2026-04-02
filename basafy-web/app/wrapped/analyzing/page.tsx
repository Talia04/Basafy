'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Building2, Calendar, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { supabase, supabaseUrl } from '../../../lib/supabaseClient';

function buildWrappedAuthRedirect(origin: string) {
  const redirectTo = new URL('/auth/callback', origin);
  redirectTo.searchParams.set('next', '/wrapped/analyzing');
  redirectTo.searchParams.set('origin', origin);
  return redirectTo.toString();
}

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
    description: 'Scanning your inbox for job-related messages...',
    count: 'Emails scanned'
  },
  {
    icon: <Building2 className="w-8 h-8" />,
    title: 'Grouping applications',
    description: 'Organizing by company and position...',
    count: 'Applications detected'
  },
  {
    icon: <Calendar className="w-8 h-8" />,
    title: 'Detecting interviews and tasks',
    description: 'Finding interview invites and assessment requests...',
    count: 'Events identified'
  },
  {
    icon: <Sparkles className="w-8 h-8" />,
    title: 'Building your story',
    description: 'Creating your personalized insights...',
    count: 'Insights generated'
  }
];

export default function WrappedAnalyzingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const [progress, setProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [reconnectLoading, setReconnectLoading] = useState(false);

  useEffect(() => {
    const stepDuration = 2000;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < analysisSteps.length - 1 ? prev + 1 : prev));
    }, stepDuration);

    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev < 100 ? prev + 1 : prev));
    }, 80);

    const countInterval = setInterval(() => {
      setCounts((prev) =>
        prev.map((count, idx) => {
          if (idx <= currentStep && count < [247, 89, 12, 25][idx]) {
            return count + Math.floor(Math.random() * 10) + 1;
          }
          return Math.min(count, [247, 89, 12, 25][idx]);
        })
      );
    }, 100);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
      clearInterval(countInterval);
    };
  }, [currentStep]);

  // Auto-redirect when progress completes and sync is done or complete
  useEffect(() => {
    if (progress >= 100 && (syncStatus === 'complete' || syncStatus === 'idle')) {
      const timer = setTimeout(() => {
        router.push('/wrapped/story');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [progress, syncStatus, router]);

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

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Gmail sync failed.');
        }

        setSyncStatus('complete');
        // Auto-redirect to story page after successful sync
        setTimeout(() => {
          router.push('/wrapped/story');
        }, 1500);
      } catch (err) {
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : 'Gmail sync failed.');
      }
    };

    runSync();
  }, [router]);

  const handleReconnect = async () => {
    if (!supabase) {
      setSyncStatus('error');
      setSyncError('Missing Supabase environment variables.');
      return;
    }
    setReconnectLoading(true);

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectTo = buildWrappedAuthRedirect(origin);

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
            <span className="text-sm font-medium">Step {Math.min(currentStep + 2, 3)} of 3</span>
            <span className="text-sm text-muted-foreground">{Math.min(progress, 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-gradient-to-r from-chart-1 to-chart-2" style={{ width: `${Math.min(progress, 100)}%` }} />
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
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-muted"
            >
              <span className="text-3xl font-bold text-chart-1">
                {counts[currentStep].toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">{analysisSteps[currentStep].count}</span>
            </motion.div>
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
            <Link
              href="/wrapped/story"
              className="rounded-full bg-gradient-to-r from-chart-1 to-chart-2 px-6 py-3 text-xs font-semibold text-white shadow-[0_16px_30px_rgba(32,82,255,0.25)]"
            >
              Continue
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
