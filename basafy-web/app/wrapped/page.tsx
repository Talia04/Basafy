'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRight, CalendarDays, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import GmailConnectButtons from '../../components/GmailConnectButtons';
import WrappedShell from '../../components/wrapped/WrappedShell';
import { supabase } from '../../lib/supabaseClient';

const inboxSignals = [
  { company: 'Google', detail: 'Interview invitation', tone: 'text-blue-300', dot: 'bg-blue-400' },
  { company: 'Stripe', detail: 'Assessment due Friday', tone: 'text-amber-300', dot: 'bg-amber-400' },
  { company: 'Airbnb', detail: 'Application received', tone: 'text-emerald-300', dot: 'bg-emerald-400' },
];

export default function WrappedStartPage() {
  const router = useRouter();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/wrapped/analyzing');
    });
  }, [router]);

  return (
    <WrappedShell current={1}>
      <div className="grid min-w-0 w-full items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0 max-w-2xl"
        >
          <div className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase text-blue-200/80">
            <span className="h-px w-8 bg-blue-400/60" />
            Your job search, decoded
          </div>
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.04] sm:text-6xl">
            Turn your inbox into a clear next move.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/55 sm:text-lg">
            Connect Gmail once. Basafy organizes applications, interviews, assessments, and follow-ups into a private visual recap.
          </p>

          <div className="mt-10 max-w-xl border-y border-white/8 py-2">
            {inboxSignals.map((signal, index) => (
              <motion.div
                key={signal.company}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 + index * 0.1 }}
                className="flex items-center gap-4 border-b border-white/6 py-4 last:border-b-0"
              >
                <span className={`h-2 w-2 rounded-full ${signal.dot} shadow-[0_0_16px_currentColor]`} />
                <span className="w-20 text-sm font-semibold text-white/85">{signal.company}</span>
                <span className={`min-w-0 text-sm ${signal.tone}`}>{signal.detail}</span>
                <ArrowRight className="ml-auto h-4 w-4 text-white/20" />
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="relative min-w-0 overflow-hidden rounded-lg border border-white/12 bg-white/[0.055] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:p-8"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-blue-400/20 bg-blue-400/10 text-blue-300">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Connect Gmail</h2>
              <p className="mt-1 text-xs text-white/40">Read-only access · Last 90 days</p>
            </div>
          </div>

          <div className="my-7 border-y border-white/8">
            <TrustRow icon={ShieldCheck} title="Job-related messages only" detail="Personal conversations are excluded" />
            <TrustRow icon={LockKeyhole} title="Private by design" detail="Email content is not retained" />
            <TrustRow icon={CalendarDays} title="Revoke anytime" detail="Managed from your Google account" />
          </div>

          <GmailConnectButtons />

          <p className="mt-6 text-center text-[11px] leading-5 text-white/35">
            By continuing, you agree to the{' '}
            <Link href="/privacy" className="text-white/60 underline-offset-4 hover:underline">Privacy Policy</Link>
            {' '}and{' '}
            <Link href="/terms" className="text-white/60 underline-offset-4 hover:underline">Terms</Link>.
          </p>
        </motion.section>
      </div>
    </WrappedShell>
  );
}
function TrustRow({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof ShieldCheck;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/8 py-4 last:border-b-0">
      <Icon className="h-4 w-4 shrink-0 text-emerald-300/80" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-white/80">{title}</p>
        <p className="mt-0.5 text-xs text-white/35">{detail}</p>
      </div>
    </div>
  );
}
