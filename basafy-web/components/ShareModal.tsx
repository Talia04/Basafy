'use client';

import { useEffect } from 'react';
import { X, Share2, Download } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl">
        <Card className="border-2 border-border bg-card p-8 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Share Your Wrapped</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close share modal"
              className="rounded-lg p-2 transition-colors hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-8">
            <Card className="relative overflow-hidden bg-gradient-to-br from-chart-1 to-chart-2 p-10 text-white">
              <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

              <div className="relative z-10">
                <div className="mb-8 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-white/20 p-[2px]">
                    <img src="/basafy-icon.png" alt="Basafy" className="h-full w-full rounded-[6px]" />
                  </div>
                  <span className="text-xl font-bold">Basafy Wrapped</span>
                </div>
                <h3 className="mb-3 text-4xl font-bold">{data.title}</h3>
                <p className="mb-8 text-2xl text-white/90">{data.stat}</p>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <Stat label="Applications" value={data.applications} />
                  <Stat label="Interviews" value={data.interviews} />
                  <Stat label="Offers" value={data.offers} />
                </div>

                <p className="mt-8 text-center text-sm text-white/70">Get your own at basafy.com</p>
              </div>
            </Card>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleShare}
            >
              <Download className="h-4 w-4" />
              Copy Link
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-chart-1 to-chart-2"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </Card>
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
