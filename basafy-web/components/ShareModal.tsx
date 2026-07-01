'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowUpRight, Check, Download, Image, Loader2, QrCode, Share2, X } from 'lucide-react';
import { Button } from './ui/button';
import { APP_STORE_URL } from '../lib/appLinks';

const WEBSITE_URL = 'https://www.basafy.com';

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
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Basafy Wrapped',
          text: `My job-search report: ${data.title}. ${data.stat}`,
          url: WEBSITE_URL,
        });
        return;
      } catch {
        // User cancellation falls through without showing an error.
        return;
      }
    }

    await navigator.clipboard.writeText(WEBSITE_URL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(WEBSITE_URL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    setDownloadError(null);

    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#05070d',
        scale: 2.5,
        useCORS: true,
        logging: false,
        onclone: (clonedDocument) => {
          const root = clonedDocument.documentElement;
          const rgbTheme = {
            '--background': '#05070d',
            '--foreground': '#f8fafc',
            '--card': '#111827',
            '--card-foreground': '#f8fafc',
            '--popover': '#111827',
            '--popover-foreground': '#f8fafc',
            '--primary': '#f8fafc',
            '--primary-foreground': '#111827',
            '--secondary': '#1f2937',
            '--secondary-foreground': '#f8fafc',
            '--muted': '#1f2937',
            '--muted-foreground': '#9ca3af',
            '--accent': '#1f2937',
            '--accent-foreground': '#f8fafc',
            '--destructive': '#dc2626',
            '--destructive-foreground': '#fff7ed',
            '--border': '#334155',
            '--input': '#1f2937',
            '--ring': '#6366f1',
          };

          Object.entries(rgbTheme).forEach(([property, value]) => root.style.setProperty(property, value));
        },
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error('The report image could not be encoded.'));
        }, 'image/png');
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'basafy-wrapped-report.png';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Failed to download image:', error);
      setDownloadError('The image could not be created. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#020308]/86 px-3 py-6 backdrop-blur-xl sm:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button type="button" className="fixed inset-0 cursor-default" onClick={onClose} aria-label="Close share report" />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-report-title"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-auto w-full max-w-5xl"
      >
        <div className="mb-4 flex items-center justify-between px-1 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase text-blue-200/60">Export and share</p>
            <h2 id="share-report-title" className="mt-1 text-xl font-semibold">Your Basafy report card</h2>
          </div>
          <button type="button" onClick={onClose} title="Close" aria-label="Close share modal" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/55 transition hover:bg-white/[0.1] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={cardRef}
          className="relative overflow-hidden rounded-lg border border-white/12 bg-[#070a12] text-white shadow-[0_40px_120px_rgba(0,0,0,0.5)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(59,130,246,0.2),transparent_30%),radial-gradient(circle_at_86%_78%,rgba(52,211,153,0.13),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.035),transparent_42%)]" />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-violet-400 via-amber-300 to-emerald-400" />

          <div className="relative grid min-h-[610px] lg:grid-cols-[1.08fr_0.92fr]">
            <div className="flex flex-col justify-between border-b border-white/8 p-6 sm:p-9 lg:border-b-0 lg:border-r">
              <div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 via-violet-400 to-emerald-400 p-[2px]">
                    <img src="/basafy-icon.png" alt="Basafy" className="h-full w-full rounded-[6px]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Basafy Wrapped</p>
                    <p className="text-[10px] text-white/35">Job-search operating report</p>
                  </div>
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase">
                  <span className="rounded-full border border-blue-300/20 bg-blue-300/[0.07] px-3 py-1.5 text-blue-200/75">Prepared for the job seeker</span>
                  <span className="text-white/25">Personal job-search recap</span>
                </div>
                <p className="mt-7 text-xs font-semibold uppercase text-blue-200/65">Your search identity</p>
                <h3 className="mt-3 max-w-xl text-4xl font-semibold leading-[1.04] sm:text-5xl">{data.title}</h3>
                <p className="mt-4 text-lg text-white/55">{data.stat}</p>

                <p className="mt-5 max-w-lg text-sm leading-6 text-white/38">
                  A snapshot of your job-application activity, built from the opportunities, interviews, and offers Basafy organized from your search.
                </p>

                <div className="mt-10 grid grid-cols-3 divide-x divide-white/8 border-y border-white/8 py-5">
                  <ShareStat label="Job applications" value={data.applications} color="text-blue-300" />
                  <ShareStat label="Interviews earned" value={data.interviews} color="text-violet-300" />
                  <ShareStat label="Offers received" value={data.offers} color="text-emerald-300" />
                </div>
              </div>

              <div className="mt-10 flex items-end justify-between gap-5 border-t border-white/8 pt-6">
                <div>
                  <p className="text-[10px] uppercase text-white/25">Build your own report</p>
                  <a href={WEBSITE_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-white/75 hover:text-white">
                    basafy.com <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
                <p className="max-w-[230px] text-right text-[10px] leading-4 text-white/30">Basafy turns job-search emails into a live application pipeline, timely reminders, and clear next actions.</p>
              </div>
            </div>

            <div className="relative flex flex-col justify-between p-6 sm:p-8">
              <div className="mb-1">
                <p className="text-[10px] font-semibold uppercase text-emerald-200/60">Your search, finally organized</p>
                <h4 className="mt-2 text-2xl font-semibold leading-tight">Know where every application stands.</h4>
                <p className="mt-2 max-w-sm text-xs leading-5 text-white/38">Connect Gmail once. Basafy finds job activity, builds your pipeline, and keeps follow-ups from slipping through.</p>
              </div>

              <div className="grid min-h-[310px] grid-cols-[1fr_130px] items-center gap-3">
                <div className="relative h-[330px] min-w-0">
                  <img
                    src="/graphics/basafy-feature-phones/generated/basafy-feature-insights-phone-normalized.png"
                    alt="Basafy insights on iPhone"
                    className="h-full w-full object-contain drop-shadow-[0_28px_50px_rgba(0,0,0,0.58)]"
                  />
                </div>
                <div className="space-y-3">
                  <QrPanel value={APP_STORE_URL} label="Get the app" tone="blue" />
                  <QrPanel value={WEBSITE_URL} label="Visit Basafy" tone="mint" />
                </div>
              </div>

              <div className="mt-6 border-t border-white/8 pt-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
                  <QrCode className="h-4 w-4 text-blue-300" />
                  Start tracking your job search
                </div>
                <p className="mt-2 text-[10px] leading-4 text-white/30">Scan to get Basafy on iPhone or explore the product at basafy.com.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Button variant="outline" className="h-11 rounded-lg border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={handleDownloadImage} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
            {downloading ? 'Rendering' : 'Download PNG'}
          </Button>
          <Button variant="outline" className="h-11 rounded-lg border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={handleCopyLink}>
            {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Download className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy basafy.com'}
          </Button>
          <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-blue-400/20 bg-blue-400/10 px-4 text-sm font-semibold text-blue-100 transition hover:bg-blue-400/15">
            App Store <ArrowUpRight className="h-4 w-4" />
          </a>
          <Button className="h-11 rounded-lg bg-white text-black hover:bg-white/90" onClick={handleShare}>
            <Share2 className="h-4 w-4" /> Share report
          </Button>
        </div>
        {downloadError && <p role="alert" className="mt-3 text-center text-xs text-red-300">{downloadError}</p>}
      </motion.div>
    </motion.div>
  );
}

function ShareStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <p className={`text-3xl font-semibold sm:text-4xl ${color}`}>{value.toLocaleString()}</p>
      <p className="mt-2 text-[10px] text-white/30">{label}</p>
    </div>
  );
}

function QrPanel({ value, label, tone }: { value: string; label: string; tone: 'blue' | 'mint' }) {
  return (
    <div className={`rounded-lg border p-2 ${tone === 'blue' ? 'border-blue-400/20 bg-blue-400/[0.06]' : 'border-emerald-400/20 bg-emerald-400/[0.06]'}`}>
      <div className="rounded-md bg-white p-1.5">
        <QRCodeSVG value={value} size={96} level="H" marginSize={1} bgColor="#ffffff" fgColor="#05070d" title={`${label} QR code`} className="h-auto w-full" />
      </div>
      <p className={`mt-2 text-center text-[9px] font-semibold ${tone === 'blue' ? 'text-blue-200' : 'text-emerald-200'}`}>{label}</p>
    </div>
  );
}
