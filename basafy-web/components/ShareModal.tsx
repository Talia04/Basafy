'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Share2, Download, Loader2, Check, Image } from 'lucide-react';
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
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadImage = async () => {
    setDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');

      // Helper function for rounded rectangles (for browser compatibility)
      const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };

      // Set canvas size (2x for retina)
      const width = 500;
      const height = 400;
      const scale = 2;
      canvas.width = width * scale;
      canvas.height = height * scale;
      ctx.scale(scale, scale);

      // Draw gradient background
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#6366f1');
      gradient.addColorStop(0.5, '#8b5cf6');
      gradient.addColorStop(1, '#a855f7');

      // Background rounded rectangle
      roundRect(0, 0, width, height, 16);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Decorative circles
      ctx.beginPath();
      ctx.arc(width + 20, -20, 100, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(-20, height + 20, 80, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fill();

      // Header icon box
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      roundRect(40, 40, 32, 32, 8);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.font = '18px system-ui';
      ctx.fillText('📊', 46, 62);

      ctx.font = 'bold 20px system-ui';
      ctx.fillText('Basafy Wrapped', 82, 62);

      // Title
      ctx.font = 'bold 32px system-ui';
      ctx.fillText(data.title, 40, 120);

      // Stat
      ctx.globalAlpha = 0.9;
      ctx.font = '20px system-ui';
      ctx.fillText(data.stat, 40, 155);
      ctx.globalAlpha = 1;

      // Stat boxes
      const boxY = 190;
      const boxWidth = 130;
      const boxHeight = 70;
      const boxGap = 16;
      const startX = 40;

      const stats = [
        { value: data.applications, label: 'Applications' },
        { value: data.interviews, label: 'Interviews' },
        { value: data.offers, label: 'Offers' }
      ];

      stats.forEach((stat, i) => {
        const x = startX + i * (boxWidth + boxGap);

        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        roundRect(x, boxY, boxWidth, boxHeight, 16);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(String(stat.value), x + boxWidth / 2, boxY + 35);

        ctx.globalAlpha = 0.8;
        ctx.font = '12px system-ui';
        ctx.fillText(stat.label, x + boxWidth / 2, boxY + 55);
        ctx.globalAlpha = 1;
      });

      ctx.textAlign = 'left';

      // Footer
      ctx.globalAlpha = 0.7;
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Get your own at basafy.com', width / 2, height - 40);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;

      // Download using blob for better compatibility
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'basafy-wrapped.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        setDownloading(false);
      }, 'image/png');
      return; // Don't set downloading false here, blob callback will do it
    } catch (error) {
      console.error('Failed to download image:', error);
      setDownloading(false);
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
            <div ref={cardRef}>
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
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              variant="outline"
              className="w-full sm:flex-1"
              onClick={handleDownloadImage}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Image className="h-4 w-4" />
              )}
              {downloading ? 'Generating...' : 'Download Image'}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:flex-1"
              onClick={handleShare}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button
              className="w-full sm:flex-1 bg-gradient-to-r from-chart-1 to-chart-2"
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
