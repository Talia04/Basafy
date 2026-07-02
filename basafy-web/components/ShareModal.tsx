'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowUpRight, Check, Download, Image, Loader2, QrCode, Share2, X } from 'lucide-react';
import { Button } from './ui/button';
import { APP_STORE_URL } from '../lib/appLinks';
import { ErrorState } from './error/ErrorState';

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
      await document.fonts.ready;
      const canvas = document.createElement('canvas');
      canvas.width = 1800;
      canvas.height = 1200;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable.');

      drawExportCard(context, data);

      const phone = await loadCanvasImage('/graphics/basafy-feature-phones/generated/basafy-feature-insights-phone-normalized.png');
      const phoneScale = Math.min(430 / phone.width, 720 / phone.height);
      const phoneWidth = phone.width * phoneScale;
      const phoneHeight = phone.height * phoneScale;
      context.drawImage(phone, 1115 + (430 - phoneWidth) / 2, 215 + (720 - phoneHeight) / 2, phoneWidth, phoneHeight);

      const appQr = cardRef.current.querySelector<SVGSVGElement>('#share-qr-blue');
      const websiteQr = cardRef.current.querySelector<SVGSVGElement>('#share-qr-mint');
      if (!appQr || !websiteQr) throw new Error('QR codes are unavailable.');
      const [appQrImage, websiteQrImage] = await Promise.all([loadSvgImage(appQr), loadSvgImage(websiteQr)]);
      drawExportQr(context, appQrImage, 1510, 290, 'GET THE APP', '#93c5fd');
      drawExportQr(context, websiteQrImage, 1510, 590, 'VISIT BASAFY', '#6ee7b7');

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
        {downloadError ? (
          <div className="mt-3">
            <ErrorState
              message={downloadError}
              compact
              primaryAction={{ label: 'Try download again', onClick: handleDownloadImage }}
            />
          </div>
        ) : null}
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
        <QRCodeSVG id={`share-qr-${tone}`} value={value} size={96} level="H" marginSize={1} bgColor="#ffffff" fgColor="#05070d" title={`${label} QR code`} className="h-auto w-full" />
      </div>
      <p className={`mt-2 text-center text-[9px] font-semibold ${tone === 'blue' ? 'text-blue-200' : 'text-emerald-200'}`}>{label}</p>
    </div>
  );
}

function drawExportCard(context: CanvasRenderingContext2D, data: ShareModalProps['data']) {
  const background = context.createLinearGradient(0, 0, 1800, 1200);
  background.addColorStop(0, '#080d19');
  background.addColorStop(0.55, '#070912');
  background.addColorStop(1, '#06110f');
  context.fillStyle = background;
  context.fillRect(0, 0, 1800, 1200);

  const glow = context.createRadialGradient(230, 170, 0, 230, 170, 520);
  glow.addColorStop(0, 'rgba(59,130,246,0.24)');
  glow.addColorStop(1, 'rgba(59,130,246,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 900, 700);

  const accent = context.createLinearGradient(0, 0, 1800, 0);
  accent.addColorStop(0, '#3b82f6');
  accent.addColorStop(0.4, '#a78bfa');
  accent.addColorStop(0.7, '#fcd34d');
  accent.addColorStop(1, '#34d399');
  context.fillStyle = accent;
  context.fillRect(0, 0, 1800, 10);

  context.fillStyle = '#ffffff';
  context.font = '700 34px Inter, Arial, sans-serif';
  context.fillText('BASAFY WRAPPED', 100, 110);
  context.fillStyle = 'rgba(255,255,255,0.42)';
  context.font = '500 20px Inter, Arial, sans-serif';
  context.fillText('YOUR JOB-SEARCH OPERATING REPORT', 100, 148);

  context.fillStyle = 'rgba(147,197,253,0.16)';
  roundedRect(context, 100, 220, 410, 52, 26);
  context.fill();
  context.fillStyle = '#bfdbfe';
  context.font = '700 17px Inter, Arial, sans-serif';
  context.fillText('PREPARED FOR THE JOB SEEKER', 126, 253);

  context.fillStyle = '#93c5fd';
  context.font = '700 20px Inter, Arial, sans-serif';
  context.fillText('YOUR SEARCH IDENTITY', 100, 345);
  context.fillStyle = '#ffffff';
  context.font = '700 68px Inter, Arial, sans-serif';
  drawWrappedText(context, data.title, 100, 430, 850, 78, 3);
  context.fillStyle = 'rgba(255,255,255,0.62)';
  context.font = '500 27px Inter, Arial, sans-serif';
  drawWrappedText(context, data.stat, 100, 620, 830, 38, 2);
  context.fillStyle = 'rgba(255,255,255,0.4)';
  context.font = '400 21px Inter, Arial, sans-serif';
  drawWrappedText(context, 'A snapshot of your job-application activity, built from the opportunities, interviews, and offers Basafy organized from your search.', 100, 735, 830, 32, 3);

  const stats = [
    { value: data.applications, label: 'JOB APPLICATIONS', color: '#93c5fd' },
    { value: data.interviews, label: 'INTERVIEWS EARNED', color: '#c4b5fd' },
    { value: data.offers, label: 'OFFERS RECEIVED', color: '#6ee7b7' },
  ];
  stats.forEach((stat, index) => {
    const x = 100 + index * 285;
    context.fillStyle = 'rgba(255,255,255,0.055)';
    roundedRect(context, x, 860, 255, 145, 18);
    context.fill();
    context.fillStyle = stat.color;
    context.font = '700 48px Inter, Arial, sans-serif';
    context.fillText(stat.value.toLocaleString(), x + 24, 925);
    context.fillStyle = 'rgba(255,255,255,0.4)';
    context.font = '700 14px Inter, Arial, sans-serif';
    context.fillText(stat.label, x + 24, 970);
  });

  context.strokeStyle = 'rgba(255,255,255,0.1)';
  context.beginPath();
  context.moveTo(1000, 85);
  context.lineTo(1000, 1115);
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = '700 31px Inter, Arial, sans-serif';
  context.fillText('Know where every application stands.', 1080, 120);
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.font = '400 19px Inter, Arial, sans-serif';
  drawWrappedText(context, 'Connect Gmail once. Basafy finds job activity, builds your pipeline, and keeps follow-ups from slipping through.', 1080, 160, 620, 28, 3);

  context.fillStyle = 'rgba(255,255,255,0.06)';
  roundedRect(context, 1080, 1010, 620, 105, 20);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = '700 23px Inter, Arial, sans-serif';
  context.fillText('Turn your inbox into a job-search command center.', 1110, 1055);
  context.fillStyle = '#6ee7b7';
  context.font = '700 18px Inter, Arial, sans-serif';
  context.fillText('GET BASAFY  •  BASAFY.COM', 1110, 1090);
}

function drawExportQr(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, label: string, color: string) {
  context.fillStyle = '#ffffff';
  roundedRect(context, x, y, 180, 180, 18);
  context.fill();
  context.drawImage(image, x + 12, y + 12, 156, 156);
  context.fillStyle = color;
  context.font = '700 15px Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText(label, x + 90, y + 216);
  context.textAlign = 'left';
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = '';
  let lineIndex = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    context.fillText(line, x, y + lineIndex * lineHeight);
    line = word;
    lineIndex += 1;
    if (lineIndex >= maxLines - 1) break;
  }
  if (line && lineIndex < maxLines) context.fillText(line, x, y + lineIndex * lineHeight);
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

async function loadSvgImage(svg: SVGSVGElement) {
  const markup = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    return await loadCanvasImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
