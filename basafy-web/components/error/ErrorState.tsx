'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Home, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

export type ErrorKind = 'auth' | 'configuration' | 'network' | 'report' | 'sync' | 'unknown';

const presentations = {
  auth: { eyebrow: 'Connection required', title: 'Reconnect your account', icon: ShieldAlert, accent: 'text-amber-200', border: 'border-amber-300/20', glow: 'bg-amber-300/10' },
  configuration: { eyebrow: 'Setup required', title: 'This service is not configured', icon: AlertTriangle, accent: 'text-red-200', border: 'border-red-300/20', glow: 'bg-red-300/10' },
  network: { eyebrow: 'Connection interrupted', title: 'Check your connection', icon: WifiOff, accent: 'text-cyan-200', border: 'border-cyan-300/20', glow: 'bg-cyan-300/10' },
  report: { eyebrow: 'Report paused', title: 'Your report needs another pass', icon: RefreshCw, accent: 'text-violet-200', border: 'border-violet-300/20', glow: 'bg-violet-300/10' },
  sync: { eyebrow: 'Sync paused', title: 'Gmail sync could not finish', icon: AlertTriangle, accent: 'text-amber-200', border: 'border-amber-300/20', glow: 'bg-amber-300/10' },
  unknown: { eyebrow: 'Something went wrong', title: 'We could not complete that request', icon: AlertTriangle, accent: 'text-red-200', border: 'border-red-300/20', glow: 'bg-red-300/10' },
} as const;

export function classifyError(message?: string | null): ErrorKind {
  const value = message?.toLowerCase() ?? '';
  if (value.includes('grounded report') || value.includes('wrapped report') || value.includes('report')) return 'report';
  if (value.includes('session') || value.includes('sign-in') || value.includes('oauth') || value.includes('auth')) return 'auth';
  if (value.includes('environment') || value.includes('configured') || value.includes('supabase')) return 'configuration';
  if (value.includes('network') || value.includes('fetch') || value.includes('offline')) return 'network';
  if (value.includes('gmail') || value.includes('sync')) return 'sync';
  return 'unknown';
}

type Action = { label: string; href?: string; onClick?: () => void; icon?: ReactNode };

function ErrorAction({ action, primary = false }: { action: Action; primary?: boolean }) {
  const className = primary
    ? 'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90'
    : 'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-5 text-sm font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white';
  const content = <>{action.icon}{action.label}<ArrowRight className="h-4 w-4" /></>;
  return action.href
    ? <Link href={action.href} className={className}>{content}</Link>
    : <button type="button" onClick={action.onClick} className={className}>{content}</button>;
}

export function ErrorState({
  message,
  kind,
  title,
  primaryAction,
  secondaryAction,
  reference,
  compact = false,
}: {
  message: string;
  kind?: ErrorKind;
  title?: string;
  primaryAction?: Action;
  secondaryAction?: Action;
  reference?: string;
  compact?: boolean;
}) {
  const resolvedKind = kind ?? classifyError(message);
  const presentation = presentations[resolvedKind];
  const Icon = presentation.icon;

  if (compact) {
    return (
      <div role="alert" className={`flex items-start gap-3 rounded-lg border ${presentation.border} bg-[#0b0e16]/90 p-4 text-left shadow-lg backdrop-blur-xl`}>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${presentation.glow} ${presentation.accent}`}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold uppercase ${presentation.accent}`}>{presentation.eyebrow}</p>
          <p className="mt-1 text-sm leading-6 text-white/60">{message}</p>
          {primaryAction ? <div className="mt-3"><ErrorAction action={primaryAction} primary /></div> : null}
        </div>
      </div>
    );
  }

  return (
    <section role="alert" className="relative mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-white/10 bg-[#0b0e16]/92 p-7 text-center shadow-[0_28px_90px_rgba(0,0,0,0.48)] backdrop-blur-2xl sm:p-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-lg border ${presentation.border} ${presentation.glow} ${presentation.accent}`}><Icon className="h-6 w-6" /></span>
      <p className={`mt-6 text-xs font-semibold uppercase ${presentation.accent}`}>{presentation.eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{title ?? presentation.title}</h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/48">{message}</p>
      {reference ? <p className="mt-3 font-mono text-[10px] text-white/25">Reference: {reference}</p> : null}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {primaryAction ? <ErrorAction action={primaryAction} primary /> : null}
        {secondaryAction ? <ErrorAction action={secondaryAction} /> : null}
      </div>
    </section>
  );
}

export const defaultHomeAction: Action = { label: 'Return home', href: '/', icon: <Home className="h-4 w-4" /> };
