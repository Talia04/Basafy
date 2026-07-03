'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, ArrowRight, Mail, Building2, Sparkles, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { supabase, supabaseUrl } from '../../../lib/supabaseClient';
import { buildAuthCallbackUrl, rememberAuthDestination } from '../../../lib/authRedirect';
import WrappedShell from '../../../components/wrapped/WrappedShell';
import { classifyError } from '../../../components/error/ErrorState';

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
    icon: <Image src="/gmail-icon.png" alt="Gmail" width={40} height={40} className="h-10 w-10 object-contain" priority />,
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
    syncRunId?: string;
  };
  wrapped_report_id?: string | null;
  wrapped_report_error?: string | null;
  skipped?: 'sync_in_progress';
  wrapped_session_id?: string;
  wrapped_session_complete?: boolean;
  wrapped_has_more?: boolean;
  wrapped_messages_processed?: number;
  wrapped_target_messages?: number;
  wrapped_lookback_months?: number;
  wrapped_bucket?: string;
  wrapped_finalizing?: boolean;
};

async function invokeGmailSync(
  url: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (![502, 503, 504].includes(response.status) || attempt === 2) return response;
      lastError = new Error(`Supabase gateway returned ${response.status}.`);
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1_000 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error('Unable to reach Gmail sync.');
}

export default function WrappedAnalyzingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [reconnectLoading, setReconnectLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ processed: 0, target: 250, bucket: 'Preparing Gmail search' });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [estimatedProgress, setEstimatedProgress] = useState(2);
  const errorKind = classifyError(syncError);
  const needsReconnect = errorKind === 'auth';
  const errorTitle = errorKind === 'report'
    ? 'Your report needs another pass'
    : errorKind === 'configuration'
      ? 'Basafy needs configuration'
      : errorKind === 'network'
        ? 'The connection was interrupted'
        : needsReconnect
          ? 'Reconnect your Gmail account'
          : 'Gmail sync could not finish';

  useEffect(() => {
    if (syncStatus !== 'running') return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((seconds) => {
        const nextSeconds = seconds + 1;
        const estimate = Math.min(94, Math.round(2 + 92 * (1 - Math.exp(-nextSeconds / 55))));
        setEstimatedProgress((current) => Math.max(current, estimate));
        return nextSeconds;
      });
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [syncStatus]);

  // Auto-redirect when progress animation completes and sync is done
  useEffect(() => {
    if (syncStatus === 'complete') {
      const timer = setTimeout(() => {
        router.push('/wrapped/story');
      }, 4200);
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
      const journeyStartedAt = performance.now();

      const session = await waitForSession();
      if (!session) {
        setSyncStatus('error');
        setSyncError('Missing authenticated session.');
        return;
      }

      try {
        const refreshToken = (session as any).provider_refresh_token ?? null;
        const body: Record<string, unknown> = {
          sync_mode: 'wrapped_deep_sync',
          lookback_months: 3,
          max_messages: 10,
          max_pages: 1
        };

        if (refreshToken) {
          body.refresh_token = refreshToken;
        }

        const syncUrl = `${supabaseUrl}/functions/v1/gmail-sync-user`;
        let wrappedSessionId = window.localStorage.getItem('basafy-wrapped-session-id');
        let payload: (SyncResult & { error?: string }) | null = null;
        let busyRetries = 0;
        let fetchedTotal = 0;
        let createdTotal = 0;
        let updatedTotal = 0;
        let sessionResets = 0;

        for (let chunk = 0; chunk < 30; chunk += 1) {
          const chunkBody = wrappedSessionId ? { ...body, wrapped_session_id: wrappedSessionId } : body;
          setSyncProgress((previous) => ({
            ...previous,
            bucket: wrappedSessionId ? 'Scanning next email batch' : 'Connecting to Gmail',
          }));
          const response = await invokeGmailSync(syncUrl, session.access_token, chunkBody);
          payload = await response.json().catch(() => null) as (SyncResult & { error?: string }) | null;
          if ([404, 409].includes(response.status) && wrappedSessionId && sessionResets < 1) {
            sessionResets += 1;
            wrappedSessionId = null;
            window.localStorage.removeItem('basafy-wrapped-session-id');
            chunk -= 1;
            continue;
          }
          if (!response.ok) throw new Error(payload?.error || 'Gmail sync failed.');

          if (response.status === 202 && payload?.skipped === 'sync_in_progress') {
            busyRetries += 1;
            if (busyRetries > 36) throw new Error('Another Gmail sync is taking longer than expected. Please retry shortly.');
            await new Promise((resolve) => window.setTimeout(resolve, 5_000));
            chunk -= 1;
            continue;
          }
          busyRetries = 0;
          if (payload?.wrapped_session_id) {
            wrappedSessionId = payload.wrapped_session_id;
            window.localStorage.setItem('basafy-wrapped-session-id', wrappedSessionId);
          }
          fetchedTotal += payload?.total_messages_fetched ?? 0;
          createdTotal += payload?.applications_created ?? 0;
          updatedTotal += payload?.applications_updated ?? 0;
          payload = {
            ...payload,
            total_messages_fetched: fetchedTotal,
            applications_created: createdTotal,
            applications_updated: updatedTotal,
          };
          const processed = payload.wrapped_messages_processed ?? 0;
          const target = Math.max(1, payload.wrapped_target_messages ?? 250);
          const ratio = processed / target;
          const derivedStep = ratio >= 0.75 ? 3 : ratio >= 0.35 ? 2 : ratio > 0 ? 1 : 0;
          setCurrentStep((previous) => Math.max(previous, derivedStep));
          setSyncProgress((previous) => ({
            processed: Math.max(previous.processed, processed),
            target,
            bucket: payload?.wrapped_finalizing
              ? 'Finalizing grounded report'
              : payload?.wrapped_bucket?.replaceAll('_', ' ') ?? previous.bucket,
          }));
          setSyncResult(payload);
          if (payload.wrapped_report_id) break;
          if (!payload.wrapped_has_more) {
            throw new Error(payload.wrapped_report_error || 'The grounded report could not be finalized.');
          }
        }

        if (!payload?.wrapped_report_id) {
          throw new Error(payload?.wrapped_report_error || 'The Gmail sync completed, but its grounded report could not be generated.');
        }
        window.localStorage.setItem('basafy-wrapped-report-id', payload.wrapped_report_id);
        window.localStorage.removeItem('basafy-wrapped-session-id');
        if (payload.debug?.syncRunId) {
          window.localStorage.setItem('basafy-wrapped-sync-run-id', payload.debug.syncRunId);
        }

        const remainingJourneyTime = Math.max(0, 7800 - (performance.now() - journeyStartedAt));
        if (remainingJourneyTime > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, remainingJourneyTime));
        }

        setSyncResult(payload);
        setSyncProgress((previous) => ({ ...previous, processed: previous.target, bucket: 'Report complete' }));
        setCurrentStep(analysisSteps.length - 1);
        setEstimatedProgress(96);
        await new Promise((resolve) => window.setTimeout(resolve, 1_200));
        setEstimatedProgress(100);
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
  const progressPercentage = syncStatus === 'complete' ? 100 : estimatedProgress;
  const progressLabel = `${progressPercentage}%`;

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
    <WrappedShell current={2}>
      <div className="grid min-w-0 w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <section className="relative min-h-[430px] overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] p-6 backdrop-blur-2xl sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.13),transparent_52%)]" />
          <div className="relative flex h-full min-h-[350px] flex-col items-center justify-center text-center">
            <div className="relative mb-9 flex h-40 w-40 items-center justify-center">
              {syncStatus !== 'complete' && syncStatus !== 'error' && (
                <>
                  <motion.span
                    className="absolute inset-0 rounded-full border border-blue-400/25"
                    animate={{ scale: [0.82, 1.18], opacity: [0.7, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <motion.span
                    className="absolute inset-5 rounded-full border border-violet-400/25"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  >
                    <span className="absolute -top-1 left-1/2 h-2 w-2 rounded-full bg-violet-300 shadow-[0_0_16px_rgba(196,181,253,0.9)]" />
                  </motion.span>
                </>
              )}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${currentStep}-${syncStatus}`}
                  initial={{ opacity: 0, scale: 0.75, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -8 }}
                  className={`relative flex h-24 w-24 items-center justify-center rounded-full border ${
                    syncStatus === 'complete'
                      ? 'border-emerald-400/35 bg-emerald-400/12 text-emerald-300'
                      : syncStatus === 'error'
                        ? 'border-red-400/35 bg-red-400/10 text-red-300'
                        : 'border-blue-400/30 bg-blue-400/10 text-blue-200'
                  }`}
                >
                  {syncStatus === 'complete' ? <CheckCircle2 className="h-10 w-10" /> : syncStatus === 'error' ? <AlertCircle className="h-10 w-10" /> : analysisSteps[currentStep].icon}
                </motion.div>
              </AnimatePresence>
              {syncStatus === 'running' ? (
                <motion.span
                  key={progressPercentage}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -bottom-3 rounded-md border border-white/10 bg-[#0a0d15] px-2.5 py-1 font-mono text-xs font-semibold text-blue-100"
                >
                  {progressLabel}
                </motion.span>
              ) : null}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <p className="mb-3 text-xs font-semibold uppercase text-blue-200/65">
                  {syncStatus === 'complete' ? 'Sync complete' : syncStatus === 'error' ? 'Sync paused' : 'Live Gmail sync'}
                </p>
                <h1 className="text-3xl font-semibold sm:text-4xl">
                  {syncStatus === 'error' ? errorTitle : analysisSteps[currentStep].title}
                </h1>
                <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/45">
                  {syncStatus === 'error' ? (syncError || 'Gmail sync could not finish.') : analysisSteps[currentStep].description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase text-white/35">Processing securely</p>
          <h2 className="mt-3 text-3xl font-semibold">From inbox signals to a clear story.</h2>

          <div className="mt-7 border-y border-white/8 py-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold tabular-nums text-white">{progressLabel}</p>
                <p className="mt-1 text-xs capitalize text-white/35">{syncStatus === 'complete' ? 'Report ready' : syncProgress.bucket}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums text-white/70">{syncProgress.processed.toLocaleString()} processed</p>
                {syncStatus === 'running' ? <p className="mt-1 text-[10px] tabular-nums text-white/30">Secure scan active · {elapsedSeconds}s</p> : null}
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-400 to-emerald-400"
                animate={{ width: `${progressPercentage}%`, x: '0%' }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          <div className="mt-5 border-y border-white/8">
            {analysisSteps.map((step, index) => {
              const complete = syncStatus === 'complete' || index < currentStep;
              const active = index === currentStep && syncStatus !== 'error';
              return (
                <div key={step.title} className="flex gap-4 border-b border-white/8 py-4 last:border-b-0">
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                    complete
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                      : active
                        ? 'border-blue-400/35 bg-blue-400/10 text-blue-200'
                        : 'border-white/10 text-white/25'
                  }`}>
                    {complete ? <CheckCircle2 className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : index + 1}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${active || complete ? 'text-white/85' : 'text-white/35'}`}>{step.title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/30">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {syncStatus === 'complete' && completedMetrics.length > 0 && (
            <div className="mt-7 grid grid-cols-3 divide-x divide-white/8 border-y border-white/8 py-4">
              {completedMetrics.map((metric) => (
                <div key={metric.label} className="px-3 first:pl-0 last:pr-0">
                  <p className="text-2xl font-semibold text-white">{metric.value.toLocaleString()}</p>
                  <p className="mt-1 text-[10px] leading-4 text-white/35">{metric.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {syncStatus === 'error' && needsReconnect && (
              <button
                type="button"
                onClick={handleReconnect}
                disabled={reconnectLoading}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-5 text-sm font-semibold text-red-200 transition hover:bg-red-400/15 disabled:opacity-60"
              >
                {reconnectLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {reconnectLoading ? 'Reconnecting' : 'Reconnect Gmail'}
              </button>
            )}
            {syncStatus === 'error' && !needsReconnect && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                <RefreshCw className="h-4 w-4" />
                {errorKind === 'report' ? 'Retry report' : 'Retry sync'}
              </button>
            )}
            {(syncStatus === 'complete' || syncStatus === 'error') && (
              <Link
                href="/wrapped/story"
                className="group inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                {syncStatus === 'complete' ? 'View results' : 'View existing data'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </div>
        </section>
      </div>
    </WrappedShell>
  );
}
