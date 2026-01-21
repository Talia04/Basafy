'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const steps = [
  {
    title: 'Connect Your Gmail',
    description: 'Securely connect with read-only access. We never send emails or store content.',
    icon: MailIcon
  },
  {
    title: 'Watch the Analysis',
    description: 'Our system scans job-related emails and generates your personalized insights.',
    icon: ChartIcon
  },
  {
    title: 'Explore Your Story',
    description: 'Scroll through 8 chapters of stats, charts, and actionable recommendations.',
    icon: SparklesIcon
  }
];

export default function QuickStartGuide() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeenGuide = window.localStorage.getItem('basafy-has-seen-guide');
    if (!hasSeenGuide) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    window.localStorage.setItem('basafy-has-seen-guide', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 py-10 fade-in">
      <button
        type="button"
        aria-label="Close quick start"
        onClick={handleClose}
        className="absolute inset-0 bg-background/82 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-3xl rounded-[32px] border border-chart-1/40 bg-card/82 p-10 shadow-[0_50px_140px_rgba(0,0,0,0.55)] backdrop-blur-2xl fade-in-up"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-6 top-6 rounded-full border border-border/60 bg-background/40 p-2 text-muted-foreground transition hover:text-foreground"
          aria-label="Close"
        >
          <span aria-hidden="true">x</span>
        </button>

        <div className="flex flex-col items-center text-center fade-in-up">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-chart-1 to-chart-2 text-white shadow-[0_10px_30px_rgba(32,82,255,0.35)]">
            <SparklesIcon className="h-7 w-7" />
          </div>
          <h2 className="mt-6 text-3xl font-semibold md:text-4xl">Welcome to Basafy Wrapped!</h2>
          <p className="mt-3 text-base text-muted-foreground">
            Get instant insights into your job search journey in 3 simple steps
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className={`flex items-start gap-4 rounded-2xl border border-border/60 bg-background/55 px-5 py-4 fade-in-up stagger-${index + 1}`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-chart-1 to-chart-2 text-sm font-semibold text-white">
                {index + 1}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <step.icon className="h-4 w-4 text-chart-2" />
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 fade-in-up stagger-4">
          <Link
            href="/wrapped"
            onClick={handleClose}
            className="min-w-[160px] rounded-full bg-gradient-to-r from-chart-1 to-chart-2 px-6 py-3 text-sm font-semibold text-white"
          >
            Get Started
          </Link>
          <Link
            href="/wrapped/story"
            onClick={handleClose}
            className="min-w-[160px] rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground"
          >
            Try Demo First
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your privacy is our priority. Read our{' '}
          <Link href="/privacy" className="text-chart-1 hover:underline" onClick={handleClose}>
            Privacy Policy
          </Link>
          .
        </p>
      </div>
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

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M4 19h16" />
      <path d="M7 16V9" />
      <path d="M12 16V5" />
      <path d="M17 16v-4" />
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
