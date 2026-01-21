'use client';

import { useEffect } from 'react';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  data: {
    title: string;
    stat: string;
    applications: number;
    interviews: number;
    offers: number;
  };
}

export default function ShareModal({ open, onClose, data }: ShareModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Basafy Wrapped',
          text: `I'm ${data.title}! ${data.stat}`,
          url: window.location.href
        });
      } catch {
        // ignore cancel
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Close share modal"
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-2xl rounded-[32px] border border-border/60 bg-card/80 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs font-semibold text-muted-foreground"
        >
          Close
        </button>

        <h2 className="text-2xl font-semibold">Share Your Wrapped</h2>
        <p className="mt-2 text-sm text-muted-foreground">Show off your job search signature.</p>

        <div className="mt-6 rounded-[28px] bg-gradient-to-br from-chart-1 to-chart-2 p-8 text-white">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.3em] text-white/80">
            <span className="h-2 w-2 rounded-full bg-white/70" />
            Basafy Wrapped
          </div>
          <h3 className="mt-4 text-3xl font-semibold">{data.title}</h3>
          <p className="mt-2 text-lg text-white/90">{data.stat}</p>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <Stat label="Applications" value={data.applications} />
            <Stat label="Interviews" value={data.interviews} />
            <Stat label="Offers" value={data.offers} />
          </div>

          <p className="mt-6 text-xs text-white/70">Get your own at basafy.com</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button className="rounded-full border border-border px-4 py-2 text-sm font-semibold" onClick={handleShare}>
            Share
          </button>
          <button className="rounded-full border border-border px-4 py-2 text-sm font-semibold" onClick={handleShare}>
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-white/80">{label}</div>
    </div>
  );
}
