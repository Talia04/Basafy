'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Award,
  BarChart3,
  Check,
  Clock3,
  Download,
  QrCode,
  Share2,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { APP_STORE_URL } from '../../lib/appLinks';
import { WrappedProgress } from './WrappedShell';

export type WrappedResultsData = {
  overview: { applications: number; companies: number; interviews: number; offers: number };
  funnelData: Array<{ stage: string; count: number; percentage: number; barClass: string }>;
  biggestDropOff: string;
  momentumData: Array<{ week: string; applications: number; replies: number }>;
  bestWeek: string;
  slowestWeek: string;
  responseData: Array<{ range: string; count: number }>;
  avgResponseTime: string;
  medianResponseTime: string;
  sourcesData: Array<{ platform: string; count: number; interviews: number }>;
  timingData: {
    byDayOfWeek: Array<{ day: string; applications: number; responses: number; responseRate: number }>;
    byTimeOfDay: Array<{ time: string; label: string; applications: number; responses: number; responseRate: number }>;
    bestDay: string;
    bestDayRate: number;
    worstDay: string;
    worstDayRate: number;
    bestTime: string;
    bestTimeRate: number;
    insight: string;
  };
  ghostData: {
    totalGhosted: number;
    ghostRate: number;
    avgDaysBeforeGhost: number;
    byStage: Array<{ stage: string; count: number; percentage: number }>;
    topGhostingCompanies: Array<{ company: string; daysWaiting: number }>;
    stillWaiting: number;
    insight: string;
  };
  personalities: Array<{ type: string; title: string; description: string; stat: string; gradient: string }>;
  recommendations: Array<{ title: string; insight: string; action: string; gradient: string }>;
  confidence?: { level: 'high' | 'medium' | 'low'; messages: string[]; needsReview: number };
};

const sectionClass = 'relative border-t border-white/[0.065] px-4 py-24 sm:px-6 sm:py-32';
const innerClass = 'mx-auto w-full max-w-6xl';
const surfaceClass = 'rounded-lg border border-white/[0.09] bg-white/[0.035] backdrop-blur-xl';
const funnelAccents = [
  'border-blue-400/20 bg-blue-400/[0.045]',
  'border-violet-400/20 bg-violet-400/[0.045]',
  'border-amber-300/20 bg-amber-300/[0.04]',
  'border-emerald-400/20 bg-emerald-400/[0.045]',
];

export default function WrappedResultsExperience({
  data,
  useDemo,
  onModeChange,
  onShare,
}: {
  data: WrappedResultsData;
  useDemo: boolean;
  onModeChange: (demo: boolean) => void;
  onShare: () => void;
}) {
  const responseRate = data.overview.applications > 0
    ? Math.round((data.overview.interviews / data.overview.applications) * 100)
    : 0;
  const offerRate = data.overview.interviews > 0
    ? Math.round((data.overview.offers / data.overview.interviews) * 100)
    : 0;
  const momentumData = data.momentumData.length
    ? data.momentumData
    : [{ week: 'No activity', applications: 0, replies: 0 }];
  const sources = data.sourcesData.map((source) => ({
    ...source,
    rate: source.count > 0 ? Math.round((source.interviews / source.count) * 100) : 0,
  }));
  const primaryPersonality = data.personalities[0];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#05070d] text-white">
      <header className="fixed left-0 right-0 top-3 z-50 px-3 sm:px-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-lg border border-white/10 bg-[#080a12]/88 px-3 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:px-4">
          <Link href="/" className="flex items-center gap-3" aria-label="Basafy home">
            <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 via-violet-400 to-emerald-400 p-[2px]">
              <img src="/basafy-icon.png" alt="" className="h-full w-full rounded-[6px]" />
            </span>
            <span className="hidden text-sm font-semibold sm:inline">Basafy Wrapped</span>
          </Link>
          <div className="hidden w-72 lg:block"><WrappedProgress current={3} /></div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-lg border border-white/8 bg-white/[0.035] p-1 text-[10px] font-semibold">
              <button type="button" onClick={() => onModeChange(true)} className={`rounded-md px-3 py-1.5 ${useDemo ? 'bg-white/12 text-white' : 'text-white/35'}`}>Demo</button>
              <button type="button" onClick={() => onModeChange(false)} className={`rounded-md px-3 py-1.5 ${!useDemo ? 'bg-white/12 text-white' : 'text-white/35'}`}>Live</button>
            </div>
            <button type="button" onClick={onShare} title="Share results" aria-label="Share results" className="flex h-9 w-9 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/[0.07] hover:text-white">
              <Share2 className="h-4 w-4" />
            </button>
            <Link href="/" title="Close Wrapped" aria-label="Close Wrapped" className="flex h-9 w-9 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/[0.07] hover:text-white">
              <X className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>
      {data.confidence?.messages?.length ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-24 sm:px-6">
          <div className="border-l-2 border-amber-300/70 bg-amber-300/[0.055] px-4 py-3 text-sm text-amber-50/80">
            {data.confidence.messages.join(' ')}
          </div>
        </div>
      ) : null}

      <section className="relative flex min-h-screen items-center overflow-hidden px-4 pb-20 pt-32 sm:px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_26%,rgba(59,130,246,0.13),transparent_30%),radial-gradient(circle_at_18%_75%,rgba(52,211,153,0.07),transparent_28%)]" />
        <div className={`${innerClass} relative`}>
          <div className="grid items-end gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}>
              <p className="text-xs font-semibold uppercase text-blue-200/65">Your job-search operating report</p>
              <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.98] sm:text-7xl">Clarity, from every signal in your inbox.</h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/45">A focused view of your pipeline, response patterns, strongest channels, and next actions.</p>
            </motion.div>
            <div className="grid grid-cols-2 border-y border-white/8">
              <Metric value={data.overview.applications} label="Applications" accent="text-blue-300" delay={0.5} duration={2600} />
              <Metric value={data.overview.companies} label="Companies" accent="text-violet-300" delay={1.15} duration={2600} />
              <Metric value={data.overview.interviews} label="Interviews" accent="text-amber-200" delay={1.8} duration={2400} />
              <Metric value={data.overview.offers} label="Offers" accent="text-emerald-300" delay={2.45} duration={2200} />
            </div>
          </div>
          <div className="mt-20 flex items-center gap-3 text-xs text-white/30"><ArrowDown className="h-4 w-4" /> Explore your report</div>
        </div>
      </section>

      <section id="pipeline" className={`${sectionClass} bg-[radial-gradient(circle_at_88%_18%,rgba(59,130,246,0.09),transparent_30%)]`}>
        <div className={innerClass}>
          <SectionHeading index="01" label="Pipeline" title="Where momentum converts." description={data.biggestDropOff} accent="text-blue-300" />
          <div className="mt-14 grid gap-3 md:grid-cols-4">
            {data.funnelData.map((stage, index) => (
              <motion.div key={stage.stage} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }} className={`${surfaceClass} ${funnelAccents[index % funnelAccents.length]} relative overflow-hidden p-5`}>
                <div className="absolute inset-x-0 top-0 h-1 bg-white/[0.05]"><div className="h-full bg-gradient-to-r from-blue-500 via-violet-400 to-emerald-400" style={{ width: `${stage.percentage}%` }} /></div>
                <div className="flex items-start justify-between"><span className="text-sm text-white/45">{stage.stage}</span><span className="text-xs text-white/25">{stage.percentage}%</span></div>
                <AnimatedNumber value={stage.count} delay={index * 0.1} className="mt-10 block text-5xl font-semibold" />
                {index < data.funnelData.length - 1 && <ArrowRight className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 text-white/20 md:block" />}
              </motion.div>
            ))}
          </div>
          <div className="mt-8 grid gap-6 border-y border-white/8 py-6 sm:grid-cols-3">
            <InlineMetric label="Interview rate" value={responseRate} suffix="%" />
            <InlineMetric label="Offer conversion" value={offerRate} suffix="%" delay={0.12} />
            <InlineMetric label="Largest change" value={data.biggestDropOff} compact />
          </div>
        </div>
      </section>

      <section id="momentum" className={`${sectionClass} bg-[radial-gradient(circle_at_12%_30%,rgba(139,92,246,0.09),transparent_28%)]`}>
        <div className={innerClass}>
          <SectionHeading index="02" label="Momentum" title="Your search, week by week." description={`Best period: ${data.bestWeek}`} accent="text-violet-300" />
          <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className={`${surfaceClass} min-w-0 border-violet-400/15 p-4 sm:p-6`}>
              <div className="mb-8 flex items-center justify-between"><p className="text-sm font-semibold">Applications and replies</p><Activity className="h-4 w-4 text-blue-300" /></div>
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={momentumData} margin={{ left: -20, right: 12 }}>
                  <defs><linearGradient id="newApps" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.34} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,.35)', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,.3)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0b0e17', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="applications" stroke="#60a5fa" strokeWidth={2.5} fill="url(#newApps)" />
                  <Area type="monotone" dataKey="replies" stroke="#34d399" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="border-y border-white/8">
              <SideMetric icon={TrendingUp} label="Best week" value={data.bestWeek} />
              <SideMetric icon={Target} label="Slower week" value={data.slowestWeek} />
              <SideMetric icon={Award} label="Search identity" value={primaryPersonality?.title ?? 'Building momentum'} />
            </div>
          </div>
        </div>
      </section>

      <section id="performance" className={`${sectionClass} bg-[radial-gradient(circle_at_86%_70%,rgba(52,211,153,0.075),transparent_28%)]`}>
        <div className={innerClass}>
          <SectionHeading index="03" label="Performance" title="How quickly the market responds." description="Response speed and source quality, side by side." accent="text-emerald-300" />
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <div className={`${surfaceClass} min-w-0 border-violet-400/15 p-5 sm:p-6`}>
              <div className="flex items-end justify-between"><div><p className="text-xs text-white/35">Average response</p><p className="mt-2 text-4xl font-semibold">{data.avgResponseTime}</p></div><Clock3 className="h-5 w-5 text-violet-300" /></div>
              <div className="mt-8"><ResponsiveContainer width="100%" height={260}><BarChart data={data.responseData}><CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" /><XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,.35)', fontSize: 11 }} /><YAxis hide /><Tooltip contentStyle={{ background: '#0b0e17', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8 }} /><Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              <p className="mt-3 border-t border-white/8 pt-4 text-xs text-white/35">Median response: <span className="text-white/70">{data.medianResponseTime}</span></p>
            </div>
            <div className={`${surfaceClass} border-emerald-400/15 p-5 sm:p-6`}>
              <div className="flex items-center justify-between"><p className="text-sm font-semibold">Source efficiency</p><BarChart3 className="h-4 w-4 text-emerald-300" /></div>
              <div className="mt-7 space-y-5">{sources.slice(0, 6).map((source) => <SourceRow key={source.platform} {...source} />)}</div>
            </div>
          </div>
        </div>
      </section>

      <section id="timing" className={`${sectionClass} bg-[radial-gradient(circle_at_18%_70%,rgba(251,191,36,0.065),transparent_28%)]`}>
        <div className={innerClass}>
          <SectionHeading index="04" label="Timing" title={data.timingData.insight} description={`${data.timingData.bestDay} · ${data.timingData.bestTime}`} accent="text-amber-200" />
          <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_340px]">
            <div>
              <p className="mb-5 text-xs font-semibold uppercase text-white/30">Response rate by day</p>
              <div className="grid grid-cols-7 gap-2">{data.timingData.byDayOfWeek.map((day) => <DayCell key={day.day} {...day} />)}</div>
            </div>
            <div className="border-y border-white/8">{data.timingData.byTimeOfDay.map((slot) => <TimeRow key={slot.time} {...slot} />)}</div>
          </div>
        </div>
      </section>

      <section id="actions" className={`${sectionClass} bg-[radial-gradient(circle_at_82%_28%,rgba(244,114,182,0.065),transparent_28%)]`}>
        <div className={innerClass}>
          <SectionHeading index="05" label="Next actions" title="Turn stalled applications into decisions." description={data.ghostData.insight} accent="text-pink-300" />
          <div className="mt-14 grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="grid grid-cols-2 border-y border-white/8">
              <Metric value={data.ghostData.totalGhosted} label="Stalled" accent="text-pink-300" />
              <Metric value={data.ghostData.ghostRate} suffix="%" label="Stall rate" accent="text-violet-300" delay={0.08} />
              <Metric value={data.ghostData.avgDaysBeforeGhost} label="Avg. days" accent="text-amber-200" />
              <Metric value={data.ghostData.stillWaiting} label="Still waiting" accent="text-blue-300" />
            </div>
            <div className="border-y border-white/8">
              {data.recommendations.map((recommendation, index) => (
                <div key={recommendation.title} className="flex gap-5 border-b border-white/8 py-5 last:border-b-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs text-white/45">{index + 1}</span>
                  <div><p className="font-semibold">{recommendation.title}</p><p className="mt-1 text-sm text-white/40">{recommendation.insight}</p><p className="mt-3 text-xs font-semibold text-blue-300">{recommendation.action}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="mobile" className={`${sectionClass} overflow-hidden bg-[radial-gradient(circle_at_78%_44%,rgba(59,130,246,0.13),transparent_30%),radial-gradient(circle_at_18%_72%,rgba(52,211,153,0.08),transparent_28%)]`}>
        <div className={`${innerClass} grid items-center gap-12 lg:grid-cols-[1fr_0.8fr]`}>
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-200/65">Keep the signal live</p>
            <h2 className="mt-5 max-w-2xl text-5xl font-semibold leading-[1.02] sm:text-6xl">Your next move should not wait for another report.</h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/45">Basafy keeps applications, reminders, interviews, and progress current from your phone.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-black transition hover:bg-white/90"><Download className="h-4 w-4" /> Download on App Store</a>
              <button type="button" onClick={onShare} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-6 text-sm text-white/70 hover:bg-white/[0.07]"><Share2 className="h-4 w-4" /> Share report</button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/35"><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-300" /> Read-only Gmail</span><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-300" /> Smart reminders</span><span className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-300" /> Live pipeline</span></div>
            <div className="mt-9 inline-flex items-center gap-4 rounded-lg border border-blue-300/15 bg-blue-400/[0.055] p-3 backdrop-blur-xl">
              <div className="rounded-md bg-white p-2 shadow-[0_12px_35px_rgba(0,0,0,0.3)]">
                <QRCodeSVG value={APP_STORE_URL} size={104} level="H" marginSize={2} bgColor="#ffffff" fgColor="#05070d" title="Basafy App Store QR code" />
              </div>
              <div className="max-w-[180px]">
                <QrCode className="h-4 w-4 text-blue-300" />
                <p className="mt-3 text-sm font-semibold">Scan to download</p>
                <p className="mt-1 text-xs leading-5 text-white/35">Open Basafy directly in Apple&apos;s App Store.</p>
              </div>
            </div>
          </div>
          <div className="relative mx-auto h-[560px] w-full max-w-[330px]">
            <img src="/graphics/basafy-feature-phones/generated/basafy-feature-insights-phone-normalized.png" alt="Basafy insights on iPhone" className="h-full w-full object-contain drop-shadow-[0_40px_70px_rgba(0,0,0,.65)]" />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8 px-6 py-8 text-xs text-white/35"><div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 sm:flex-row"><span>© 2026 Basafy</span><div className="flex gap-5"><Link href="/privacy" className="hover:text-white">Privacy</Link><Link href="/support" className="hover:text-white">Support</Link></div></div></footer>
    </main>
  );
}

function SectionHeading({ index, label, title, description, accent = 'text-blue-300' }: { index: string; label: string; title: string; description: string; accent?: string }) {
  return <div className="grid gap-6 lg:grid-cols-[180px_1fr]"><div className={`flex items-center gap-3 text-xs ${accent}`}><span>{index}</span><span className="h-px w-8 bg-current opacity-45" />{label}</div><div><h2 className="max-w-4xl text-4xl font-semibold leading-[1.04] sm:text-6xl">{title}</h2><p className="mt-5 max-w-2xl text-sm leading-6 text-white/40">{description}</p></div></div>;
}

function Metric({ value, label, accent = 'text-white', suffix = '', delay = 0, duration = 1500 }: { value: number; label: string; accent?: string; suffix?: string; delay?: number; duration?: number }) {
  return <div className="border-b border-r border-white/8 p-5 sm:p-6"><AnimatedNumber value={value} suffix={suffix} delay={delay} duration={duration} className={`block text-4xl font-semibold sm:text-5xl ${accent}`} /><p className="mt-2 text-xs text-white/35">{label}</p></div>;
}

function InlineMetric({ label, value, compact = false, suffix = '', delay = 0 }: { label: string; value: number | string; compact?: boolean; suffix?: string; delay?: number }) {
  return <div><p className="text-xs text-white/30">{label}</p>{typeof value === 'number' ? <AnimatedNumber value={value} suffix={suffix} delay={delay} className={`mt-2 block font-semibold ${compact ? 'text-base' : 'text-3xl'}`} /> : <p className={`mt-2 font-semibold ${compact ? 'text-base' : 'text-3xl'}`}>{value}</p>}</div>;
}

function SideMetric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return <div className="flex items-start gap-4 border-b border-white/8 py-6 last:border-b-0"><Icon className="mt-1 h-4 w-4 text-blue-300" /><div><p className="text-xs text-white/30">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div></div>;
}

function SourceRow({ platform, count, interviews, rate }: { platform: string; count: number; interviews: number; rate: number }) {
  return <div><div className="mb-2 flex items-center justify-between text-xs"><span className="text-white/65">{platform}</span><span className="flex items-center text-white/30"><AnimatedNumber value={interviews} />/<AnimatedNumber value={count} /><span className="mx-1">·</span><AnimatedNumber value={rate} suffix="%" /></span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]"><motion.div initial={{ width: 0 }} whileInView={{ width: `${rate}%` }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400" /></div></div>;
}

function DayCell({ day, applications, responseRate }: { day: string; applications: number; responses: number; responseRate: number }) {
  return <div className="rounded-lg border border-white/8 p-3 text-center" style={{ background: `rgba(59,130,246,${0.035 + responseRate / 250})` }}><p className="text-[10px] text-white/35">{day}</p><AnimatedNumber value={responseRate} suffix="%" className="mt-4 block text-xl font-semibold" /><p className="mt-1 flex justify-center gap-1 text-[10px] text-white/25"><AnimatedNumber value={applications} /> apps</p></div>;
}

function TimeRow({ time, label, responseRate }: { time: string; label: string; applications: number; responses: number; responseRate: number }) {
  return <div className="flex items-center justify-between border-b border-white/8 py-5 last:border-b-0"><div><p className="text-sm font-semibold">{time}</p><p className="mt-1 text-xs text-white/30">{label}</p></div><AnimatedNumber value={responseRate} suffix="%" className="text-2xl font-semibold text-emerald-300" /></div>;
}

function AnimatedNumber({
  value,
  suffix = '',
  delay = 0,
  duration = 1500,
  className = '',
}: {
  value: number;
  suffix?: string;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.65 });
  const reduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(reduceMotion ? value : 0);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!isInView) return;
    if (reduceMotion) {
      setDisplayValue(value);
      setComplete(true);
      return;
    }

    setDisplayValue(0);
    setComplete(false);

    let frame = 0;
    const startsAt = performance.now() + delay * 1000;

    const update = (now: number) => {
      if (now < startsAt) {
        frame = window.requestAnimationFrame(update);
        return;
      }

      const progress = Math.min((now - startsAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.round(value * eased));

      if (progress < 1) {
        frame = window.requestAnimationFrame(update);
      } else {
        setComplete(true);
      }
    };

    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [delay, duration, isInView, reduceMotion, value]);

  return (
    <motion.span
      ref={ref}
      className={className}
      animate={complete && !reduceMotion ? { scale: [1, 1.13, 0.98, 1], y: [0, -2, 0, 0] } : undefined}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      {displayValue.toLocaleString()}{suffix}
    </motion.span>
  );
}
