'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import Link from 'next/link';
import ScrollProgress from '../../../components/ScrollProgress';
import ShareModal from '../../../components/ShareModal';
import { Card } from '../../../components/ui/card';
import MotionToggle from '../../../components/MotionToggle';
import {
  Activity,
  Award,
  ArrowRight,
  Calendar,
  Clock,
  Compass,
  Download,
  Flame,
  Globe,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  Share2,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { APP_STORE_URL } from '../../../lib/appLinks';
import { Button } from '../../../components/ui/button';
import WrappedShell, { WrappedProgress } from '../../../components/wrapped/WrappedShell';
import WrappedResultsExperience from '../../../components/wrapped/WrappedResultsExperience';
import { ErrorState } from '../../../components/error/ErrorState';

const demoStoryData = {
  overview: {
    applications: 89,
    companies: 42,
    interviews: 12,
    offers: 3
  },
  funnelData: [
    { stage: 'Applied', count: 89, percentage: 100, barClass: 'bg-chart-1' },
    { stage: 'Assessment', count: 34, percentage: 38, barClass: 'bg-chart-2' },
    { stage: 'Interview', count: 12, percentage: 13, barClass: 'bg-chart-3' },
    { stage: 'Offer', count: 3, percentage: 3, barClass: 'bg-chart-4' }
  ],
  biggestDropOff: 'Applied → Assessment (62% drop)',
  momentumData: [
    { week: 'Week 1', applications: 8, replies: 2 },
    { week: 'Week 2', applications: 15, replies: 5 },
    { week: 'Week 3', applications: 22, replies: 8 },
    { week: 'Week 4', applications: 18, replies: 6 },
    { week: 'Week 5', applications: 12, replies: 4 },
    { week: 'Week 6', applications: 14, replies: 7 }
  ],
  bestWeek: 'Week 3 (22 applications)',
  slowestWeek: 'Week 1 (8 applications)',
  responseData: [
    { range: '0-3 days', count: 15 },
    { range: '4-7 days', count: 22 },
    { range: '8-14 days', count: 18 },
    { range: '15+ days', count: 8 }
  ],
  avgResponseTime: '7.2 days',
  medianResponseTime: '6 days',
  sourcesData: [
    { platform: 'Greenhouse', count: 24, interviews: 6 },
    { platform: 'Lever', count: 18, interviews: 4 },
    { platform: 'Workday', count: 15, interviews: 2 },
    { platform: 'LinkedIn', count: 12, interviews: 0 },
    { platform: 'Direct/Email', count: 10, interviews: 0 },
    { platform: 'Other ATS', count: 10, interviews: 0 }
  ],
  timingData: {
    byDayOfWeek: [
      { day: 'Mon', applications: 18, responses: 7, responseRate: 39 },
      { day: 'Tue', applications: 22, responses: 11, responseRate: 50 },
      { day: 'Wed', applications: 16, responses: 6, responseRate: 38 },
      { day: 'Thu', applications: 14, responses: 4, responseRate: 29 },
      { day: 'Fri', applications: 12, responses: 3, responseRate: 25 },
      { day: 'Sat', applications: 4, responses: 1, responseRate: 25 },
      { day: 'Sun', applications: 3, responses: 0, responseRate: 0 }
    ],
    byTimeOfDay: [
      { time: 'Morning', label: '6am-12pm', applications: 34, responses: 15, responseRate: 44 },
      { time: 'Afternoon', label: '12pm-6pm', applications: 38, responses: 12, responseRate: 32 },
      { time: 'Evening', label: '6pm-12am', applications: 17, responses: 5, responseRate: 29 }
    ],
    bestDay: 'Tuesday',
    bestDayRate: 50,
    worstDay: 'Sunday',
    worstDayRate: 0,
    bestTime: 'Morning',
    bestTimeRate: 44,
    insight: "You get 2x more responses when you apply on Tuesday mornings"
  },
  ghostData: {
    totalGhosted: 32,
    ghostRate: 36,
    avgDaysBeforeGhost: 21,
    byStage: [
      { stage: 'After Apply', count: 24, percentage: 75 },
      { stage: 'After Assessment', count: 5, percentage: 16 },
      { stage: 'After Interview', count: 3, percentage: 9 }
    ],
    topGhostingCompanies: [
      { company: 'Big Tech Co', daysWaiting: 45 },
      { company: 'Startup Inc', daysWaiting: 38 },
      { company: 'Finance Corp', daysWaiting: 32 }
    ],
    stillWaiting: 8,
    insight: "32 applications went silent — that's normal, but following up can recover 15-20%"
  },
  personalities: [
    {
      type: 'sprinter',
      title: 'The Sprinter',
      description: 'High volume, high energy',
      stat: '89 applications in 6 weeks',
      gradient: 'from-chart-1 to-chart-2'
    },
    {
      type: 'strategist',
      title: 'The Strategist',
      description: 'Quality over quantity',
      stat: '13% interview rate',
      gradient: 'from-chart-3 to-chart-4'
    },
    {
      type: 'explorer',
      title: 'The Explorer',
      description: 'Diverse industries',
      stat: '8 different sectors',
      gradient: 'from-chart-5 to-chart-1'
    }
  ],
  recommendations: [
    {
      title: 'Follow up on stalled applications',
      insight: '15 applications pending for 14+ days',
      action: 'Send polite check-in emails',
      gradient: 'from-chart-1 to-chart-2'
    },
    {
      title: 'Apply more to sources with higher conversion',
      insight: 'Greenhouse has 25% interview rate vs 8% overall',
      action: 'Focus on Greenhouse-powered companies',
      gradient: 'from-chart-3 to-chart-4'
    },
    {
      title: 'Schedule time blocks for interview prep',
      insight: 'You have 3 upcoming interviews',
      action: 'Block 2 hours daily for preparation',
      gradient: 'from-chart-5 to-chart-1'
    }
  ]
};

const emptyMomentumData = [{ week: 'No activity yet', applications: 0, replies: 0 }];

type StoryData = typeof demoStoryData;

const chapters = [
  {
    title: 'Your season in jobs',
    subtitle: "Here's your job search at a glance",
    hint: 'Applications • Companies • Interviews • Offers',
    type: 'overview'
  },
  {
    title: 'Your funnel',
    subtitle: 'Where your applications flow',
    hint: 'Applied → Assessment → Interview → Offer',
    type: 'funnel'
  },
  {
    title: 'Momentum',
    subtitle: 'Your job search velocity',
    hint: 'Weekly applications + replies',
    type: 'momentum'
  },
  {
    title: 'Response time',
    subtitle: 'How fast companies reply to you',
    hint: '0-3 days • 4-7 days • 8-14 days',
    type: 'response'
  },
  {
    title: 'Where interviews come from',
    subtitle: 'What sources work best for you',
    hint: 'ATS platforms & sources',
    type: 'sources'
  },
  {
    title: 'Best time to apply',
    subtitle: 'When your applications get noticed',
    hint: 'Day of week • Time of day',
    type: 'timing'
  },
  {
    title: 'The ghost report',
    subtitle: 'Applications that went silent',
    hint: 'Ghost rate • Still waiting',
    type: 'ghost'
  },
  {
    title: 'Your highlights',
    subtitle: 'Your job search signature',
    hint: 'Signature card + share',
    type: 'highlights'
  },
  {
    title: 'Next best moves',
    subtitle: 'Try these next',
    hint: 'Actionable recommendations',
    type: 'next-steps'
  },
  {
    title: 'Want Basafy to track this automatically?',
    subtitle: 'Get continuous insights with the mobile app',
    hint: 'App Store • Google Play',
    type: 'cta'
  }
];

const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL || APP_STORE_URL;
const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL;
const mobileLinkEmail = 'mailto:support@basafy.com?subject=Basafy%20mobile%20app%20link';

export default function WrappedStoryPage() {
  const [shareOpen, setShareOpen] = useState(false);
  const [useDemo, setUseDemo] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);
  const [hoveredResponseBar, setHoveredResponseBar] = useState<number | null>(null);
  const [hoveredSourceBar, setHoveredSourceBar] = useState<number | null>(null);
  const [liveStoryData, setLiveStoryData] = useState<StoryData | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveReloadKey, setLiveReloadKey] = useState(0);
  const [hasConfettiFired, setHasConfettiFired] = useState(false);

  // Confetti celebration function
  const fireConfetti = useCallback(() => {
    if (hasConfettiFired) return;
    setHasConfettiFired(true);

    // Fire multiple bursts for a grand celebration
    const duration = 3000;
    const end = Date.now() + duration;

    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#22c55e', '#eab308'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: colors
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();

    // Big burst in the center
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors: colors
      });
    }, 500);
  }, [hasConfettiFired]);

  const storyData = useDemo ? demoStoryData : liveStoryData;
  const resolvedStoryData = storyData ?? demoStoryData;

  const primaryPersonality = resolvedStoryData.personalities[0];
  const personalityIconMap = {
    sprinter: Zap,
    strategist: Target,
    explorer: Compass
  } as const;
  const PrimaryPersonalityIcon =
    personalityIconMap[primaryPersonality.type as keyof typeof personalityIconMap] ?? Zap;
  const baseMomentumData = resolvedStoryData.momentumData.length
    ? resolvedStoryData.momentumData
    : emptyMomentumData;
  const bestWeekEntry = baseMomentumData.reduce(
    (best, item) => (item.applications > best.applications ? item : best),
    baseMomentumData[0]
  );
  const momentumData = baseMomentumData.map((item) => ({
    ...item,
    milestone: item.week === bestWeekEntry.week
  }));
  const totalApplications = baseMomentumData.reduce((sum, item) => sum + item.applications, 0);
  const avgPerWeek = Math.round(totalApplications / baseMomentumData.length);
  const streak = baseMomentumData.length;
  const momentumScore = Math.min(
    100,
    Math.round(Math.min(avgPerWeek / 15, 1) * 65 + Math.min(streak / 6, 1) * 35)
  );
  const momentumStats = [
    {
      label: 'Total Apps',
      value: totalApplications,
      icon: Activity,
      gradient: 'from-chart-1/20 to-chart-1/5',
      border: 'border-chart-1/30',
      text: 'text-chart-1',
      glow: 'bg-chart-1/10'
    },
    {
      label: 'Avg/Week',
      value: avgPerWeek,
      icon: Target,
      gradient: 'from-chart-2/20 to-chart-2/5',
      border: 'border-chart-2/30',
      text: 'text-chart-2',
      glow: 'bg-chart-2/10'
    },
    {
      label: 'Week Streak',
      value: streak,
      icon: Flame,
      gradient: 'from-chart-3/20 to-chart-3/5',
      border: 'border-chart-3/30',
      text: 'text-chart-3',
      glow: 'bg-chart-3/10'
    },
    {
      label: 'Best Week',
      value: bestWeekEntry?.applications ?? 0,
      icon: Award,
      gradient: 'from-chart-4/20 to-chart-4/5',
      border: 'border-chart-4/30',
      text: 'text-chart-4',
      glow: 'bg-chart-4/10'
    }
  ];
  // Vibrant chart colors that work in SVG gradients
  const chartColors = [
    '#6366f1', // Indigo/purple (chart-1)
    '#22d3ee', // Cyan/teal (chart-2)  
    '#f59e0b', // Amber/orange (chart-3)
    '#a855f7', // Purple (chart-4)
    '#ef4444', // Red (chart-5)
  ];
  const responseChartData = resolvedStoryData.responseData.map((entry, index) => ({
    ...entry,
    color: chartColors[index % chartColors.length]
  }));
  const sourcesWithRates = resolvedStoryData.sourcesData.map((source, index) => ({
    ...source,
    color:
      source.platform.toLowerCase() === 'other ats' || source.platform.toLowerCase() === 'direct/email'
        ? '#9ca3af' // Gray for generic sources
        : chartColors[index % chartColors.length],
    rate: source.count > 0 ? Math.round((source.interviews / source.count) * 100) : 0
  }));
  const topSource = sourcesWithRates[0] ?? {
    platform: 'Top platform',
    count: 0,
    interviews: 0,
    color: chartColors[0],
    rate: 0
  };
  const runnerUpSource = sourcesWithRates[1] ?? topSource;
  const shareData = {
    title: primaryPersonality.title,
    stat: primaryPersonality.stat,
    applications: resolvedStoryData.overview.applications,
    interviews: resolvedStoryData.overview.interviews,
    offers: resolvedStoryData.overview.offers
  };
  const openMobileLink = (url?: string) => {
    window.location.href = url || mobileLinkEmail;
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('story-scroll');
    return () => {
      root.classList.remove('story-scroll');
    };
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const stored = window.localStorage.getItem('basafy-story-data');
      const requestedMode = new URLSearchParams(window.location.search).get('mode');

      if (requestedMode === 'demo') {
        setUseDemo(true);
        setHasHydrated(true);
        return;
      }

      // If no preference stored, check if user has a session and default to live
      if (!stored) {
        if (!supabase) {
          setUseDemo(true);
        } else {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            setUseDemo(false); // Default to live if authenticated
          } else {
            setUseDemo(true); // Default to demo if not authenticated
          }
        }
      } else if (stored === 'demo') {
        setUseDemo(true);
      } else if (stored === 'live') {
        setUseDemo(false);
      } else {
        setUseDemo(true);
      }
      setHasHydrated(true);
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem('basafy-story-data', useDemo ? 'demo' : 'live');
  }, [useDemo, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated || !window.location.hash) return;

    const frame = window.requestAnimationFrame(() => {
      document.querySelector(window.location.hash)?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasHydrated]);

  useEffect(() => {
    if (!hasHydrated || useDemo) {
      return;
    }
    // Always reload when switching to live mode
    if (!supabase) {
      setLiveError('Missing Supabase environment variables.');
      return;
    }

    const supabaseClient = supabase;

    let isCurrent = true;

    const loadLiveData = async () => {
      setLiveError(null);

      try {
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !sessionData.session) {
          throw new Error("Missing authenticated session.");
        }

        const reportId = window.localStorage.getItem("basafy-wrapped-report-id");
        let reportQuery = supabaseClient
          .from("wrapped_reports")
          .select("id, report_payload, confidence_summary, generated_at");
        reportQuery = reportId
          ? reportQuery.eq("id", reportId)
          : reportQuery.order("generated_at", { ascending: false }).limit(1);
        const { data: reports, error: reportError } = await reportQuery;
        if (reportError) throw reportError;
        const report = Array.isArray(reports) ? reports[0] : reports;
        if (!report?.report_payload) {
          throw new Error("No grounded Wrapped report is available for this sync.");
        }
        if (!isCurrent) return;
        setLiveStoryData(report.report_payload as StoryData);
      } catch (err) {
        if (!isCurrent) return;
        setLiveError(err instanceof Error ? err.message : "Unable to load live data.");
      }
    };

    loadLiveData();

    return () => {
      isCurrent = false;
    };
  }, [hasHydrated, useDemo, liveReloadKey]);

  const waitingForLiveData = !hasHydrated || (!useDemo && !liveStoryData && !liveError);

  if (waitingForLiveData) {
    return (
      <WrappedShell current={3} width="max-w-4xl">
        <div className="mx-auto w-full max-w-xl text-center">
          <div className="relative mx-auto mb-8 flex h-28 w-28 items-center justify-center">
            <motion.span
              className="absolute inset-0 rounded-full border border-blue-400/25"
              animate={{ scale: [0.82, 1.2], opacity: [0.75, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            />
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-blue-400/25 bg-blue-400/10">
              <Activity className="h-8 w-8 text-blue-200" />
            </div>
          </div>
          <p className="text-xs font-semibold uppercase text-blue-200/65">Finalizing your recap</p>
          <h1 className="mt-3 text-4xl font-semibold">Preparing your live results</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/45">Loading the applications and events created by your Gmail sync.</p>
          <div className="mx-auto mt-8 h-1 max-w-sm overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div className="h-full w-1/3 bg-gradient-to-r from-blue-500 via-violet-400 to-emerald-400" animate={{ x: ['-110%', '310%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
          </div>
        </div>
      </WrappedShell>
    );
  }

  if (!useDemo && liveError) {
    return (
      <WrappedShell current={3} width="max-w-4xl">
        <ErrorState
          kind="report"
          title="Live results could not load"
          message={liveError}
          primaryAction={{ label: 'Try again', onClick: () => { setLiveError(null); setLiveReloadKey((key) => key + 1); } }}
          secondaryAction={{ label: 'View sample data', onClick: () => setUseDemo(true) }}
        />
      </WrappedShell>
    );
  }

  return (
    <>
      <WrappedResultsExperience
        key={useDemo ? 'demo-results' : 'live-results'}
        data={resolvedStoryData}
        useDemo={useDemo}
        onModeChange={setUseDemo}
        onShare={() => setShareOpen(true)}
      />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} data={shareData} />
    </>
  );

  /* Legacy chapter markup retained temporarily for data-visual comparison. */
  return (
    <main className="wrapped-story relative bg-[#05070d] scroll-snap-container">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed left-0 right-0 top-3 z-50 px-3 sm:px-5"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-lg border border-white/10 bg-[#080a12]/82 px-3 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:px-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 via-violet-400 to-emerald-400 p-[2px]">
              <img
                src="/basafy-icon.png"
                alt="Basafy"
                className="h-full w-full rounded-[6px]"
              />
            </div>
            <span className="hidden text-sm font-semibold sm:inline">Basafy Wrapped</span>
          </div>
          <div className="hidden w-72 lg:block"><WrappedProgress current={3} /></div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-white/8 bg-white/[0.035] p-1 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => setUseDemo(true)}
                aria-pressed={useDemo}
                className={`rounded-md px-3 py-1 transition ${useDemo ? 'bg-white/12 text-white' : 'text-white/40 hover:text-white'
                  }`}
              >
                Demo
              </button>
              <button
                type="button"
                onClick={() => setUseDemo(false)}
                aria-pressed={!useDemo}
                className={`rounded-md px-3 py-1 transition ${!useDemo ? 'bg-white/12 text-white' : 'text-white/40 hover:text-white'
                  }`}
              >
                Live
              </button>
            </div>
            <Button
              type="button"
              variant="ghost"
              title="Share results"
              aria-label="Share results"
              className="h-9 rounded-lg px-2 text-xs text-white/45 hover:bg-white/[0.07] hover:text-white sm:px-3"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              title="Download results"
              aria-label="Download results"
              className="h-9 rounded-lg px-2 text-xs text-white/45 hover:bg-white/[0.07] hover:text-white sm:px-3"
              onClick={() => setShareOpen(true)}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Link
              href="/"
              title="Close Wrapped"
              aria-label="Close Wrapped"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/[0.07] hover:text-white"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </motion.header>

      <ScrollProgress />
      <MotionToggle />

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} data={shareData} />

      {chapters.map((chapter, index) => (
        <section
          key={chapter.title}
          id={`chapter-${index + 1}`}
          className="wrapped-story-section story-section scroll-snap-section relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-28 sm:px-6"
        >
          <div className="pointer-events-none absolute left-4 top-24 z-20 flex items-center gap-3 text-[10px] font-semibold uppercase text-white/30 sm:left-8">
            <span className="text-white/65">{String(index + 1).padStart(2, '0')}</span>
            <span className="h-px w-8 bg-white/15" />
            <span>{chapter.title}</span>
          </div>
          {chapter.type === 'overview' ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-background via-chart-1/5 to-background" />
              <div className="relative z-10 w-full max-w-5xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true, amount: 0.3 }}
                  className="text-center mb-16"
                >
                  <h2 className="text-5xl md:text-6xl font-bold mb-4">{chapter.title}</h2>
                  <p className="text-xl text-muted-foreground">{chapter.subtitle}</p>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-6">
                  <StatCard
                    label="Applications"
                    value={resolvedStoryData.overview.applications}
                    tooltip="Total applications detected from your emails"
                    gradient="from-chart-1 to-chart-2"
                    delay={0.2}
                    icon={<FileIcon className="h-8 w-8" />}
                  />
                  <StatCard
                    label="Companies"
                    value={resolvedStoryData.overview.companies}
                    tooltip="Unique companies you've applied to"
                    gradient="from-chart-2 to-chart-3"
                    delay={0.3}
                    icon={<BuildingIcon className="h-8 w-8" />}
                  />
                  <StatCard
                    label="Interviews"
                    value={resolvedStoryData.overview.interviews}
                    tooltip="Interview invitations received"
                    gradient="from-chart-3 to-chart-4"
                    delay={0.4}
                    icon={<CalendarIcon className="h-8 w-8" />}
                  />
                  <StatCard
                    label="Offers"
                    value={resolvedStoryData.overview.offers}
                    tooltip="Job offers received"
                    gradient="from-chart-4 to-chart-5"
                    delay={0.5}
                    icon={<AwardIcon className="h-8 w-8" />}
                  />
                </div>
              </div>
            </>
          ) : chapter.type === 'funnel' ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-background via-chart-2/5 to-background" />
              <div className="relative z-10 w-full max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true, amount: 0.3 }}
                  className="text-center mb-16"
                >
                  <h2 className="text-5xl md:text-6xl font-bold mb-4">{chapter.title}</h2>
                  <p className="text-xl text-muted-foreground">{chapter.subtitle}</p>
                </motion.div>

                <Card className="story-card p-8 bg-card/50 backdrop-blur-xl border-border/50">
                  <div className="space-y-4 mb-8">
                    {resolvedStoryData.funnelData.map((stage, stageIndex) => (
                      <motion.div
                        key={stage.stage}
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: stageIndex * 0.1 }}
                        viewport={{ once: true, amount: 0.3 }}
                        className="relative"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold">{stage.stage}</span>
                              <span className="text-sm text-muted-foreground">
                                {stage.count} ({stage.percentage}%)
                              </span>
                            </div>
                            <div className="h-12 rounded-lg overflow-hidden bg-muted/30 relative">
                              <motion.div
                                initial={{ width: 0 }}
                                whileInView={{ width: `${stage.percentage}%` }}
                                transition={{ duration: 1, delay: stageIndex * 0.1 + 0.3, ease: 'easeOut' }}
                                viewport={{ once: true }}
                                className={`h-full ${stage.barClass} flex items-center justify-end pr-4`}
                              >
                                <span className="text-white font-bold text-sm">{stage.count}</span>
                              </motion.div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    viewport={{ once: true }}
                    className="p-6 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-chart-1/10">
                        <TrendIcon className="w-5 h-5 text-chart-1" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Biggest drop-off</h4>
                        <p className="text-sm text-muted-foreground">{resolvedStoryData.biggestDropOff}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Consider following up on pending applications and tailoring your approach for better conversion.
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                    viewport={{ once: true }}
                    className="mt-6 text-center text-sm text-muted-foreground"
                  >
                    {resolvedStoryData.overview.applications - resolvedStoryData.overview.interviews - resolvedStoryData.overview.offers > 0
                      ? `${resolvedStoryData.overview.applications - resolvedStoryData.overview.interviews - resolvedStoryData.overview.offers} still pending or rejected • `
                      : ''}
                    Keep going, you&apos;re making progress!
                  </motion.div>
                </Card>
              </div>
            </>
          ) : chapter.type === 'momentum' ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-background via-chart-2/10 to-background" />
              <div className="relative z-10 w-full max-w-6xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true, amount: 0.3 }}
                  className="mb-12 text-center"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', duration: 1, delay: 0.2 }}
                    className="relative mb-6 inline-flex rounded-full bg-gradient-to-br from-chart-1/30 to-chart-2/30 p-4"
                  >
                    <Zap className="h-10 w-10 text-chart-1" />
                    <motion.div
                      className="absolute inset-0 rounded-full bg-chart-1/20"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </motion.div>
                  <h2 className="mb-4 text-5xl font-bold text-transparent md:text-7xl bg-gradient-to-r from-chart-1 via-chart-2 to-chart-1 bg-clip-text">
                    {chapter.title}
                  </h2>
                  <p className="text-xl text-muted-foreground">{chapter.subtitle}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  viewport={{ once: true }}
                  className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4"
                >
                  {momentumStats.map((stat, statIndex) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, delay: statIndex * 0.1 }}
                      viewport={{ once: true }}
                      onHoverStart={() => setHoveredStat(stat.label)}
                      onHoverEnd={() => setHoveredStat(null)}
                      className={`group relative cursor-pointer overflow-hidden rounded-xl border bg-gradient-to-br ${stat.gradient} ${stat.border} p-4 transition-all`}
                    >
                      <motion.div
                        className={`absolute inset-0 ${stat.glow} opacity-0 transition-opacity group-hover:opacity-100`}
                        layoutId={`stat-bg-${stat.label}`}
                      />
                      <div className="relative z-10">
                        <stat.icon className={`mb-2 h-5 w-5 ${stat.text}`} />
                        <div className={`mb-1 text-3xl font-bold ${stat.text}`}>
                          {hoveredStat === stat.label ? (
                            <motion.span initial={{ scale: 1.2 }} animate={{ scale: 1 }}>
                              {stat.value}
                            </motion.span>
                          ) : (
                            stat.value
                          )}
                        </div>
                        <div className="text-xs text-foreground/60">{stat.label}</div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                <div className="grid gap-6 md:grid-cols-3">
                  <Card className="story-card md:col-span-2 bg-gradient-to-br from-card/80 to-card/40 p-6 backdrop-blur-xl border-chart-1/20 shadow-2xl">
                    <motion.div
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      transition={{ duration: 0.8 }}
                      viewport={{ once: true }}
                    >
                      <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-xl font-semibold">Weekly Activity</h3>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-chart-1" />
                            <span className="text-muted-foreground">Applications</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-chart-2" />
                            <span className="text-muted-foreground">Replies</span>
                          </div>
                        </div>
                      </div>

                      <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={momentumData}>
                          <defs>
                            <linearGradient id="applicationsArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                              <stop offset="50%" stopColor="#6366f1" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="repliesArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.6} />
                              <stop offset="50%" stopColor="#22d3ee" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                          <XAxis
                            dataKey="week"
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af' }}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af' }}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="applications"
                            stroke="#6366f1"
                            strokeWidth={3}
                            fill="url(#applicationsArea)"
                            dot={<CustomDot />}
                            activeDot={{ r: 8, strokeWidth: 3, stroke: '#1e1e2e' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="replies"
                            stroke="#22d3ee"
                            strokeWidth={3}
                            fill="url(#repliesArea)"
                            dot={{ fill: '#22d3ee', r: 5, strokeWidth: 2, stroke: '#1e1e2e' }}
                            activeDot={{ r: 8, strokeWidth: 3, stroke: '#1e1e2e' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </motion.div>
                  </Card>

                  <div className="space-y-6">
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6 }}
                      viewport={{ once: true }}
                    >
                      <Card className="story-card flex flex-col items-center bg-gradient-to-br from-card/80 to-card/40 p-6 backdrop-blur-xl border-chart-1/20 shadow-2xl">
                        <RadialProgress score={momentumScore} label="Score" />
                        <div className="mt-4 text-center">
                          <h4 className="mb-1 text-sm font-semibold text-muted-foreground">Momentum Score</h4>
                          <p className="text-xs text-foreground/60">Based on consistency & volume</p>
                        </div>
                      </Card>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      viewport={{ once: true }}
                    >
                      <Card className="story-card bg-gradient-to-br from-chart-3/20 to-chart-3/5 p-6 backdrop-blur-xl border-chart-3/30 shadow-xl">
                        <div className="mb-3 flex items-center gap-3">
                          <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <Flame className="h-8 w-8 text-chart-3" />
                          </motion.div>
                          <div>
                            <div className="text-3xl font-bold text-chart-3">{streak}</div>
                            <div className="text-xs text-foreground/70">Week Streak</div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">You've been consistent for {streak} weeks.</p>
                      </Card>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                      viewport={{ once: true }}
                    >
                      <Card className="story-card bg-gradient-to-br from-chart-1/20 to-chart-1/5 p-6 backdrop-blur-xl border-chart-1/30 shadow-xl">
                        <div className="mb-3 flex items-center gap-3">
                          <div className="rounded-lg bg-chart-1/30 p-2">
                            <TrendingUp className="h-6 w-6 text-chart-1" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-chart-1">Peak Week</div>
                            <div className="text-xs text-foreground/70">{bestWeekEntry.week}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="rounded bg-chart-1/10 p-2">
                            <div className="text-xl font-bold text-chart-1">{bestWeekEntry.applications ?? 0}</div>
                            <div className="text-xs text-foreground/60">Apps</div>
                          </div>
                          <div className="rounded bg-chart-2/10 p-2">
                            <div className="text-xl font-bold text-chart-2">{bestWeekEntry.replies ?? 0}</div>
                            <div className="text-xs text-foreground/60">Replies</div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  viewport={{ once: true }}
                  className="mt-6"
                >
                  <Card className="story-card bg-gradient-to-r from-chart-5/10 via-chart-3/10 to-chart-1/10 p-6 backdrop-blur-xl border border-chart-3/20">
                    <div className="flex items-start gap-4">
                      <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-3/20 text-chart-3"
                      >
                        <Zap className="h-5 w-5" />
                      </motion.div>
                      <div>
                        <h4 className="mb-2 font-semibold text-chart-3">Pro Tip</h4>
                        <p className="text-sm text-foreground/80">
                          Your best week had{' '}
                          <span className="font-bold text-chart-1">{bestWeekEntry.applications ?? 0} applications</span> and got{' '}
                          <span className="font-bold text-chart-2">{bestWeekEntry.replies ?? 0} replies</span>. Consistent weekly applications
                          (10-15) tend to yield better results than sporadic bursts.
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </div>
            </>
          ) : chapter.type === 'response' ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-background via-chart-3/10 to-background" />
              <div className="relative z-10 w-full max-w-5xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true, amount: 0.3 }}
                  className="mb-16 text-center"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mb-6 inline-flex rounded-full bg-gradient-to-br from-chart-2/20 to-chart-3/20 p-4"
                  >
                    <Clock className="h-8 w-8 text-chart-2" />
                  </motion.div>
                  <h2 className="mb-4 text-5xl font-bold text-transparent md:text-6xl bg-gradient-to-r from-chart-2 to-chart-3 bg-clip-text">
                    {chapter.title}
                  </h2>
                  <p className="text-xl text-muted-foreground">{chapter.subtitle}</p>
                </motion.div>

                <Card className="story-card bg-gradient-to-br from-card/80 to-card/40 p-8 backdrop-blur-xl border-chart-2/20 shadow-2xl">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                    className="mb-8"
                  >
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        data={responseChartData}
                        onMouseMove={(state) => {
                          if (state?.activeTooltipIndex !== undefined) {
                            setHoveredResponseBar(state.activeTooltipIndex);
                          }
                        }}
                        onMouseLeave={() => setHoveredResponseBar(null)}
                      >
                        <defs>
                          {responseChartData.map((entry, chartIndex) => (
                            <linearGradient key={`response-grad-${entry.range}`} id={`responseGradient${chartIndex}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                              <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                            </linearGradient>
                          ))}
                          {responseChartData.map((entry, chartIndex) => (
                            <linearGradient key={`response-hover-${entry.range}`} id={`responseGradientHover${chartIndex}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                              <stop offset="50%" stopColor={entry.color} stopOpacity={1} />
                              <stop offset="100%" stopColor={entry.color} stopOpacity={0.85} />
                            </linearGradient>
                          ))}
                          <filter id="responseGlow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                            <feMerge>
                              <feMergeNode in="coloredBlur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                        <XAxis
                          dataKey="range"
                          stroke="#9ca3af"
                          tick={{ fill: '#9ca3af' }}
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#9ca3af"
                          tick={{ fill: '#9ca3af' }}
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          content={<ResponseTooltip />}
                          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.15 }}
                        />
                        <Bar
                          dataKey="count"
                          radius={[12, 12, 0, 0]}
                          animationDuration={800}
                          animationEasing="ease-out"
                        >
                          {responseChartData.map((entry, chartIndex) => (
                            <Cell
                              key={entry.range}
                              fill={hoveredResponseBar === chartIndex ? `url(#responseGradientHover${chartIndex})` : `url(#responseGradient${chartIndex})`}
                              style={{
                                filter: hoveredResponseBar === chartIndex ? 'url(#responseGlow)' : 'none',
                                transform: hoveredResponseBar === chartIndex ? 'scaleY(1.02)' : 'scaleY(1)',
                                transformOrigin: 'bottom',
                                transition: 'all 0.2s ease-out'
                              }}
                            />
                          ))}
                          <LabelList
                            dataKey="count"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, value, index } = props;
                              const isHovered = hoveredResponseBar === index;
                              const colors = ['#6366f1', '#22d3ee', '#f59e0b', '#a855f7'];
                              return (
                                <text
                                  x={x + width / 2}
                                  y={y - 8}
                                  fill={colors[index % 4]}
                                  textAnchor="middle"
                                  fontSize={isHovered ? 15 : 13}
                                  fontWeight={isHovered ? 700 : 600}
                                  style={{ transition: 'all 0.2s ease-out' }}
                                >
                                  {value}
                                </text>
                              );
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                      viewport={{ once: true }}
                      className="rounded-xl border border-chart-2/30 bg-gradient-to-br from-chart-2/20 to-chart-2/5 p-6 text-center transition-all hover:border-chart-2/50"
                    >
                      <div className="mb-4 inline-flex rounded-full bg-chart-2/30 p-3">
                        <Zap className="h-6 w-6 text-chart-2" />
                      </div>
                      <div className="mb-2 text-4xl font-bold text-chart-2">{resolvedStoryData.avgResponseTime}</div>
                      <div className="text-sm text-foreground/70">Average response time</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                      viewport={{ once: true }}
                      className="rounded-xl border border-chart-3/30 bg-gradient-to-br from-chart-3/20 to-chart-3/5 p-6 text-center transition-all hover:border-chart-3/50"
                    >
                      <div className="mb-4 inline-flex rounded-full bg-chart-3/30 p-3">
                        <TrendingDown className="h-6 w-6 text-chart-3" />
                      </div>
                      <div className="mb-2 text-4xl font-bold text-chart-3">{resolvedStoryData.medianResponseTime}</div>
                      <div className="text-sm text-foreground/70">Median response time</div>
                      <div className="mt-1 text-xs text-muted-foreground">(better indicator)</div>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    viewport={{ once: true }}
                    className="mt-6 rounded-xl border border-chart-4/20 bg-gradient-to-r from-chart-4/10 to-chart-5/10 p-5 text-center"
                  >
                    <Clock className="mx-auto mb-3 h-5 w-5 text-chart-4" />
                    <p className="text-sm text-foreground/70">
                      Most companies respond within 4-7 days. If you haven't heard back in 2 weeks, consider a polite
                      follow-up.
                    </p>
                  </motion.div>
                </Card>
              </div>
            </>
          ) : chapter.type === 'sources' ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-background via-chart-5/10 to-background" />
              <div className="relative z-10 w-full max-w-5xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true, amount: 0.3 }}
                  className="mb-16 text-center"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: 360 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                    className="mb-6 inline-flex rounded-full bg-gradient-to-br from-chart-5/20 to-chart-1/20 p-4"
                  >
                    <Globe className="h-8 w-8 text-chart-5" />
                  </motion.div>
                  <h2 className="mb-4 text-5xl font-bold text-transparent md:text-6xl bg-gradient-to-r from-chart-5 via-chart-1 to-chart-2 bg-clip-text">
                    {chapter.title}
                  </h2>
                  <p className="text-xl text-muted-foreground">{chapter.subtitle}</p>
                </motion.div>

                <Card className="story-card bg-gradient-to-br from-card/80 to-card/40 p-8 backdrop-blur-xl border-chart-5/20 shadow-2xl">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                    className="mb-8"
                  >
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart
                        data={sourcesWithRates}
                        layout="vertical"
                        margin={{ left: 20 }}
                        onMouseMove={(state) => {
                          if (state?.activeTooltipIndex !== undefined) {
                            setHoveredSourceBar(state.activeTooltipIndex);
                          }
                        }}
                        onMouseLeave={() => setHoveredSourceBar(null)}
                      >
                        <defs>
                          {sourcesWithRates.map((entry, chartIndex) => (
                            <linearGradient key={`source-grad-${entry.platform}`} id={`sourceGradient${chartIndex}`} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={entry.color} stopOpacity={0.8} />
                              <stop offset="100%" stopColor={entry.color} stopOpacity={1} />
                            </linearGradient>
                          ))}
                          {sourcesWithRates.map((entry, chartIndex) => (
                            <linearGradient key={`source-hover-${entry.platform}`} id={`sourceGradientHover${chartIndex}`} x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                              <stop offset="100%" stopColor={entry.color} stopOpacity={1} />
                            </linearGradient>
                          ))}
                          <filter id="sourceGlow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                              <feMergeNode in="coloredBlur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                        <XAxis
                          type="number"
                          stroke="#9ca3af"
                          tick={{ fill: '#9ca3af' }}
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          dataKey="platform"
                          type="category"
                          stroke="#9ca3af"
                          tick={{ fill: '#9ca3af' }}
                          fontSize={13}
                          width={100}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<SourcesTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.15 }} />
                        <Bar
                          dataKey="count"
                          radius={[0, 12, 12, 0]}
                          animationDuration={800}
                          animationEasing="ease-out"
                        >
                          {sourcesWithRates.map((entry, chartIndex) => (
                            <Cell
                              key={entry.platform}
                              fill={hoveredSourceBar === chartIndex ? `url(#sourceGradientHover${chartIndex})` : `url(#sourceGradient${chartIndex})`}
                              style={{
                                filter: hoveredSourceBar === chartIndex ? 'url(#sourceGlow)' : 'none',
                                transform: hoveredSourceBar === chartIndex ? 'scaleX(1.02)' : 'scaleX(1)',
                                transformOrigin: 'left',
                                transition: 'all 0.2s ease-out'
                              }}
                            />
                          ))}
                          <LabelList
                            dataKey="count"
                            position="right"
                            content={(props: any) => {
                              const { x, y, width, height, value, index } = props;
                              const isHovered = hoveredSourceBar === index;
                              const colors = ['#6366f1', '#22d3ee', '#f59e0b', '#a855f7', '#ef4444'];
                              return (
                                <text
                                  x={x + width + 8}
                                  y={y + height / 2 + 4}
                                  fill={colors[index % 5]}
                                  fontSize={isHovered ? 14 : 12}
                                  fontWeight={isHovered ? 700 : 600}
                                  style={{ transition: 'all 0.2s ease-out' }}
                                >
                                  {value}
                                </text>
                              );
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.div>

                  <div className="mb-6 grid gap-4 md:grid-cols-3">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                      viewport={{ once: true }}
                      className="rounded-xl border border-chart-1/30 bg-gradient-to-br from-chart-1/20 to-chart-1/5 p-5 text-center"
                    >
                      <div className="mb-3 inline-flex rounded-lg bg-chart-1/30 p-2.5">
                        <Award className="h-5 w-5 text-chart-1" />
                      </div>
                      <div className="mb-1 text-2xl font-bold text-chart-1">{topSource.platform}</div>
                      <div className="text-xs text-foreground/70">Top performing platform</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.4 }}
                      viewport={{ once: true }}
                      className="rounded-xl border border-chart-2/30 bg-gradient-to-br from-chart-2/20 to-chart-2/5 p-5 text-center"
                    >
                      <div className="mb-3 inline-flex rounded-lg bg-chart-2/30 p-2.5">
                        <Target className="h-5 w-5 text-chart-2" />
                      </div>
                      <div className="mb-1 text-2xl font-bold text-chart-2">{topSource.rate}%</div>
                      <div className="text-xs text-foreground/70">Interview success rate</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      viewport={{ once: true }}
                      className="rounded-xl border border-chart-3/30 bg-gradient-to-br from-chart-3/20 to-chart-3/5 p-5 text-center"
                    >
                      <div className="mb-3 inline-flex rounded-lg bg-chart-3/30 p-2.5">
                        <Globe className="h-5 w-5 text-chart-3" />
                      </div>
                      <div className="mb-1 text-2xl font-bold text-chart-3">{sourcesWithRates.length}</div>
                      <div className="text-xs text-foreground/70">Unique platforms</div>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    viewport={{ once: true }}
                    className="rounded-xl border border-chart-1/20 bg-gradient-to-r from-chart-5/10 via-chart-1/10 to-chart-2/10 p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 rounded-lg bg-chart-1/20 p-2.5">
                        <Target className="h-5 w-5 text-chart-1" />
                      </div>
                      <div>
                        <h4 className="mb-2 font-semibold text-chart-1">Key insight</h4>
                        <p className="mb-3 text-sm text-foreground/80">
                          <span className="font-semibold text-chart-1">{topSource.platform}</span> and{' '}
                          <span className="font-semibold text-chart-2">{runnerUpSource.platform}</span> yielded the highest interview rates at{' '}
                          <span className="font-semibold">{topSource.rate}%</span> and{' '}
                          <span className="font-semibold">{runnerUpSource.rate}%</span> respectively.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Consider focusing more effort on companies using these platforms for better results.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </Card>
              </div>
            </>
          ) : chapter.type === 'timing' ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-background via-chart-4/10 to-background" />
              <div className="relative z-10 w-full max-w-5xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true, amount: 0.3 }}
                  className="mb-16 text-center"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mb-6 inline-flex rounded-full bg-gradient-to-br from-chart-4/20 to-chart-1/20 p-4"
                  >
                    <Calendar className="h-8 w-8 text-chart-4" />
                  </motion.div>
                  <h2 className="mb-4 text-5xl font-bold text-transparent md:text-6xl bg-gradient-to-r from-chart-4 to-chart-1 bg-clip-text">
                    {chapter.title}
                  </h2>
                  <p className="text-xl text-muted-foreground">{chapter.subtitle}</p>
                </motion.div>

                <Card className="story-card bg-gradient-to-br from-card/80 to-card/40 p-8 backdrop-blur-xl border-chart-4/20 shadow-2xl">
                  {/* Big insight callout */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="mb-8 rounded-2xl border-2 border-chart-4/30 bg-gradient-to-r from-chart-4/20 via-chart-1/10 to-chart-4/20 p-6 text-center"
                  >
                    <motion.p
                      className="text-2xl md:text-3xl font-bold text-transparent bg-gradient-to-r from-chart-4 to-chart-1 bg-clip-text"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      viewport={{ once: true }}
                    >
                      {resolvedStoryData.timingData.insight}
                    </motion.p>
                  </motion.div>

                  {/* Day of week chart */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    viewport={{ once: true }}
                    className="mb-8"
                  >
                    <h3 className="mb-4 text-lg font-semibold text-foreground/90">Response rate by day</h3>
                    <div className="grid grid-cols-7 gap-2">
                      {resolvedStoryData.timingData.byDayOfWeek.map((day, index) => {
                        const isMax = day.day === resolvedStoryData.timingData.bestDay;
                        const heightPercent = Math.max(day.responseRate, 5);
                        return (
                          <motion.div
                            key={day.day}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.1 * index }}
                            viewport={{ once: true }}
                            className="flex flex-col items-center"
                          >
                            <div className="relative h-32 w-full flex items-end justify-center mb-2">
                              <motion.div
                                initial={{ height: 0 }}
                                whileInView={{ height: `${heightPercent}%` }}
                                transition={{ duration: 0.6, delay: 0.2 + 0.1 * index }}
                                viewport={{ once: true }}
                                className={`w-full max-w-[40px] rounded-t-lg ${isMax
                                  ? 'bg-gradient-to-t from-chart-4 to-chart-1 shadow-lg shadow-chart-4/30'
                                  : 'bg-gradient-to-t from-chart-4/40 to-chart-4/60'
                                  }`}
                              />
                              {isMax && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0 }}
                                  whileInView={{ opacity: 1, scale: 1 }}
                                  transition={{ duration: 0.3, delay: 0.8 }}
                                  viewport={{ once: true }}
                                  className="absolute -top-6 left-1/2 -translate-x-1/2"
                                >
                                  <span className="text-lg">🏆</span>
                                </motion.div>
                              )}
                            </div>
                            <span className={`text-xs font-medium ${isMax ? 'text-chart-4' : 'text-muted-foreground'}`}>
                              {day.day}
                            </span>
                            <span className={`text-xs ${isMax ? 'text-chart-4 font-bold' : 'text-muted-foreground/70'}`}>
                              {day.responseRate}%
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* Time of day breakdown */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    viewport={{ once: true }}
                    className="mb-8"
                  >
                    <h3 className="mb-4 text-lg font-semibold text-foreground/90">Response rate by time of day</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      {resolvedStoryData.timingData.byTimeOfDay.map((timeSlot, index) => {
                        const isMax = timeSlot.time === resolvedStoryData.timingData.bestTime;
                        const icons = ['🌅', '☀️', '🌙'];
                        return (
                          <motion.div
                            key={timeSlot.time}
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 * index }}
                            viewport={{ once: true }}
                            className={`rounded-xl border p-5 text-center transition-all ${isMax
                              ? 'border-chart-4/50 bg-gradient-to-br from-chart-4/20 to-chart-1/10 shadow-lg'
                              : 'border-border/50 bg-card/50'
                              }`}
                          >
                            <div className="text-3xl mb-2">{icons[index]}</div>
                            <div className={`text-xl font-bold mb-1 ${isMax ? 'text-chart-4' : 'text-foreground'}`}>
                              {timeSlot.time}
                            </div>
                            <div className="text-xs text-muted-foreground mb-3">{timeSlot.label}</div>
                            <div className={`text-3xl font-bold ${isMax ? 'text-chart-4' : 'text-foreground/80'}`}>
                              {timeSlot.responseRate}%
                            </div>
                            <div className="text-xs text-muted-foreground">response rate</div>
                            {isMax && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                viewport={{ once: true }}
                                className="mt-3 text-xs font-medium text-chart-4"
                              >
                                ✨ Best time
                              </motion.div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* Stats summary */}
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      viewport={{ once: true }}
                      className="rounded-xl border border-chart-1/30 bg-gradient-to-br from-chart-1/20 to-chart-1/5 p-5"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="rounded-lg bg-chart-1/30 p-2">
                          <TrendingUp className="h-5 w-5 text-chart-1" />
                        </div>
                        <span className="text-sm font-medium text-foreground/70">Best performing</span>
                      </div>
                      <div className="text-2xl font-bold text-chart-1">
                        {resolvedStoryData.timingData.bestDay} {resolvedStoryData.timingData.bestTime}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {resolvedStoryData.timingData.bestDayRate}% response rate
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                      viewport={{ once: true }}
                      className="rounded-xl border border-chart-3/30 bg-gradient-to-br from-chart-3/20 to-chart-3/5 p-5"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="rounded-lg bg-chart-3/30 p-2">
                          <TrendingDown className="h-5 w-5 text-chart-3" />
                        </div>
                        <span className="text-sm font-medium text-foreground/70">Avoid applying on</span>
                      </div>
                      <div className="text-2xl font-bold text-chart-3">
                        {resolvedStoryData.timingData.worstDay}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {resolvedStoryData.timingData.worstDayRate}% response rate
                      </div>
                    </motion.div>
                  </div>

                  {/* Pro tip */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.7 }}
                    viewport={{ once: true }}
                    className="rounded-xl border border-chart-4/20 bg-gradient-to-r from-chart-4/10 to-chart-1/10 p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 rounded-lg bg-chart-4/20 p-2.5">
                        <Zap className="h-5 w-5 text-chart-4" />
                      </div>
                      <div>
                        <h4 className="mb-2 font-semibold text-chart-4">Timing tip</h4>
                        <p className="mb-3 text-sm text-foreground/80">
                          Recruiters typically review applications at the start of their workday. Applying{' '}
                          <span className="font-semibold text-chart-4">{resolvedStoryData.timingData.bestTime.toLowerCase()}</span> on{' '}
                          <span className="font-semibold text-chart-1">{resolvedStoryData.timingData.bestDay}s</span> puts your application at the top of their inbox.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Schedule your applications to send during peak response windows.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </Card>
              </div>
            </>
          ) : chapter.type === 'ghost' ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-background via-chart-3/5 to-background" />
              <div className="relative z-10 w-full max-w-5xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true, amount: 0.3 }}
                  className="mb-16 text-center"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mb-6 inline-flex rounded-full bg-gradient-to-br from-chart-3/20 to-muted/30 p-4"
                  >
                    <MessageSquare className="h-8 w-8 text-chart-3" />
                  </motion.div>
                  <h2 className="mb-4 text-5xl font-bold text-transparent md:text-6xl bg-gradient-to-r from-chart-3 to-muted-foreground bg-clip-text">
                    {chapter.title}
                  </h2>
                  <p className="text-xl text-muted-foreground">{chapter.subtitle}</p>
                </motion.div>

                <Card className="story-card bg-gradient-to-br from-card/80 to-card/40 p-8 backdrop-blur-xl border-chart-3/20 shadow-2xl">
                  {/* Ghosting status */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="mb-8 text-center"
                  >
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-chart-3/25 bg-chart-3/10 text-chart-3">
                      <MessageSquare className="h-7 w-7" />
                    </div>
                  </motion.div>

                  {/* Main stats */}
                  <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      viewport={{ once: true }}
                      className="rounded-xl border border-chart-3/30 bg-gradient-to-br from-chart-3/20 to-chart-3/5 p-6 text-center"
                    >
                      <div className="text-5xl font-bold text-chart-3 mb-2">
                        {resolvedStoryData.ghostData.totalGhosted}
                      </div>
                      <div className="text-sm text-foreground/70">Applications ghosted</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                      viewport={{ once: true }}
                      className="rounded-xl border border-muted/50 bg-gradient-to-br from-muted/30 to-muted/10 p-6 text-center"
                    >
                      <div className="text-5xl font-bold text-muted-foreground mb-2">
                        {resolvedStoryData.ghostData.ghostRate}%
                      </div>
                      <div className="text-sm text-foreground/70">Ghost rate</div>
                      <div className="text-xs text-muted-foreground mt-1">(industry avg: 40-50%)</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.4 }}
                      viewport={{ once: true }}
                      className="rounded-xl border border-chart-4/30 bg-gradient-to-br from-chart-4/20 to-chart-4/5 p-6 text-center"
                    >
                      <div className="text-5xl font-bold text-chart-4 mb-2">
                        {resolvedStoryData.ghostData.avgDaysBeforeGhost}
                      </div>
                      <div className="text-sm text-foreground/70">Days avg before ghost</div>
                    </motion.div>
                  </div>

                  {/* When do ghosts happen */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    viewport={{ once: true }}
                    className="mb-8"
                  >
                    <h3 className="mb-4 text-lg font-semibold text-foreground/90">When ghosting happens</h3>
                    <div className="space-y-3">
                      {resolvedStoryData.ghostData.byStage.map((stage, index) => (
                        <motion.div
                          key={stage.stage}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.1 * index }}
                          viewport={{ once: true }}
                          className="flex items-center gap-4"
                        >
                          <div className="w-32 text-sm text-foreground/70 shrink-0">{stage.stage}</div>
                          <div className="flex-1 h-8 bg-muted/20 rounded-lg overflow-hidden relative">
                            <motion.div
                              initial={{ width: 0 }}
                              whileInView={{ width: `${stage.percentage}%` }}
                              transition={{ duration: 0.6, delay: 0.3 + 0.1 * index }}
                              viewport={{ once: true }}
                              className="h-full bg-gradient-to-r from-chart-3/60 to-chart-3 rounded-lg"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium">
                              {stage.count} ({stage.percentage}%)
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Still waiting */}
                  {resolvedStoryData.ghostData.stillWaiting > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      viewport={{ once: true }}
                      className="mb-8 rounded-xl border-2 border-dashed border-chart-2/30 bg-chart-2/5 p-6 text-center"
                    >
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <motion.div
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <Clock className="h-6 w-6 text-chart-2" />
                        </motion.div>
                        <span className="text-2xl font-bold text-chart-2">
                          {resolvedStoryData.ghostData.stillWaiting} applications
                        </span>
                      </div>
                      <p className="text-sm text-foreground/70">
                        Still waiting for a response (14+ days)
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Consider sending a follow-up email to these
                      </p>
                    </motion.div>
                  )}

                  {/* Longest waiting */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    viewport={{ once: true }}
                    className="mb-6"
                  >
                    <h3 className="mb-4 text-lg font-semibold text-foreground/90">Longest waiting</h3>
                    <div className="grid gap-3">
                      {resolvedStoryData.ghostData.topGhostingCompanies.map((company, index) => (
                        <motion.div
                          key={company.company}
                          initial={{ opacity: 0, x: 20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.1 * index }}
                          viewport={{ once: true }}
                          className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50"
                        >
                          <div className="flex items-center gap-3">
                            <MessageSquare className="h-4 w-4 text-chart-3" />
                            <span className="font-medium">{company.company}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-chart-3 font-bold">{company.daysWaiting} days</span>
                            <span className="text-muted-foreground text-sm ml-1">waiting</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Insight */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.7 }}
                    viewport={{ once: true }}
                    className="rounded-xl border border-chart-3/20 bg-gradient-to-r from-chart-3/10 to-chart-2/10 p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 rounded-lg bg-chart-3/20 p-2.5">
                        <MessageSquare className="h-5 w-5 text-chart-3" />
                      </div>
                      <div>
                        <h4 className="mb-2 font-semibold text-chart-3">Response reality check</h4>
                        <p className="mb-3 text-sm text-foreground/80">
                          {resolvedStoryData.ghostData.insight}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          A polite follow-up two weeks after applying can sometimes restart the conversation.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </Card>
              </div>
            </>
          ) : chapter.type === 'highlights' ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
              <div className="relative z-10 w-full max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true, amount: 0.3 }}
                  className="mb-16 text-center"
                >
                  <h2 className="mb-4 text-5xl font-bold md:text-6xl">{chapter.title}</h2>
                  <p className="text-xl text-muted-foreground">{chapter.subtitle}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true }}
                >
                  <Card
                    className={`relative overflow-hidden bg-gradient-to-br ${primaryPersonality.gradient} p-12 text-white`}
                  >
                    <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

                    <div className="relative z-10">
                      <div className="mb-6 flex items-center justify-center">
                        <div className="rounded-full bg-white/20 p-4 backdrop-blur-sm">
                          <PrimaryPersonalityIcon className="h-12 w-12" />
                        </div>
                      </div>

                      <h3 className="mb-3 text-center text-4xl font-bold">{primaryPersonality.title}</h3>
                      <p className="mb-2 text-center text-xl text-white/90">{primaryPersonality.description}</p>
                      <p className="mb-8 text-center text-3xl font-bold">{primaryPersonality.stat}</p>

                      <div className="flex items-center justify-center gap-3">
                        <Button
                          onClick={() => setShareOpen(true)}
                          variant="secondary"
                          className="border-white/30 bg-white/20 text-white hover:bg-white/30"
                        >
                          <Share2 className="h-4 w-4" />
                          Share Your Card
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  viewport={{ once: true }}
                  className="mt-8 text-center"
                >
                  <p className="mb-4 text-sm text-muted-foreground">Other job search personalities we detected</p>
                  <div className="flex items-center justify-center gap-4">
                    {resolvedStoryData.personalities
                      .filter((personality) => personality.type !== primaryPersonality.type)
                      .map((personality) => {
                        const PersonalityIcon =
                          personalityIconMap[personality.type as keyof typeof personalityIconMap] ?? Compass;
                        return (
                          <div
                            key={personality.type}
                            className="rounded-lg border border-border/50 bg-muted/50 p-3"
                          >
                            <div className="scale-75 text-muted-foreground">
                              <PersonalityIcon className="h-10 w-10" />
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">{personality.title}</div>
                          </div>
                        );
                      })}
                  </div>
                </motion.div>
              </div>
            </>
          ) : chapter.type === 'next-steps' ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-background via-accent/30 to-background" />
              <div className="relative z-10 w-full max-w-5xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true, amount: 0.3 }}
                  className="mb-16 text-center"
                >
                  <h2 className="mb-4 text-5xl font-bold md:text-6xl">{chapter.title}</h2>
                  <p className="text-xl text-muted-foreground">{chapter.subtitle}</p>
                </motion.div>

                <div className="space-y-6">
                  {resolvedStoryData.recommendations.map((rec, recIndex) => {
                    const icon =
                      recIndex === 0 ? (
                        <MessageSquare className="h-6 w-6" />
                      ) : recIndex === 1 ? (
                        <Target className="h-6 w-6" />
                      ) : (
                        <Calendar className="h-6 w-6" />
                      );

                    return (
                      <motion.div
                        key={rec.title}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: recIndex * 0.15 }}
                        viewport={{ once: true, amount: 0.3 }}
                      >
                        <Card className="story-card group border-border/50 bg-card/50 p-6 backdrop-blur-xl transition-all hover:border-border">
                          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                            <div className="flex items-start gap-6">
                              <div className={`rounded-xl bg-gradient-to-br ${rec.gradient} p-4 text-white`}>
                                {icon}
                              </div>
                              <div className="flex-1">
                                <h3 className="mb-2 text-xl font-semibold">{rec.title}</h3>
                                <p className="mb-3 text-muted-foreground">{rec.insight}</p>
                                <div className="flex items-center gap-2 text-sm font-medium text-chart-1">
                                  <span>{rec.action}</span>
                                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  viewport={{ once: true }}
                  className="mt-12 rounded-lg bg-muted/50 p-6 text-center"
                >
                  <p className="text-muted-foreground">
                    These insights are based on your current job search pattern. Track your progress continuously with the Basafy
                    mobile app.
                  </p>
                </motion.div>
              </div>
            </>
          ) : chapter.type === 'cta' ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-background via-chart-1/10 to-background" />
              <div className="relative z-10 w-full max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true, amount: 0.3 }}
                  onAnimationComplete={() => fireConfetti()}
                  className="mb-16 text-center"
                >
                  <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h2 className="mb-4 text-5xl font-bold md:text-6xl">{chapter.title}</h2>
                  <p className="text-xl text-muted-foreground">{chapter.subtitle}</p>
                </motion.div>

                <Card className="story-card border-2 border-chart-1/20 bg-card/50 p-6 backdrop-blur-xl sm:p-10">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                    className="mb-12 flex items-center justify-center"
                  >
                    <div className="relative h-[420px] w-full max-w-[270px]">
                      <img
                        src="/graphics/basafy-feature-phones/generated/basafy-feature-insights-phone-normalized.png"
                        alt="Basafy insights on iPhone"
                        className="h-full w-full object-contain drop-shadow-[0_32px_55px_rgba(0,0,0,0.55)]"
                      />
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    viewport={{ once: true }}
                    className="mx-auto max-w-md space-y-4"
                  >
                    <a
                      href={appStoreUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-chart-1 to-chart-2 px-6 py-6 text-lg font-medium transition-all hover:opacity-90"
                    >
                      <Smartphone className="mr-2 h-5 w-5" />
                      Download on App Store
                    </a>
                    {playStoreUrl && (
                      <Button
                        size="lg"
                        type="button"
                        onClick={() => openMobileLink(playStoreUrl)}
                        className="w-full bg-gradient-to-r from-chart-3 to-chart-4 py-6 text-lg hover:opacity-90"
                      >
                        <Smartphone className="mr-2 h-5 w-5" />
                        Get it on Google Play
                      </Button>
                    )}
                    <Button
                      size="lg"
                      type="button"
                      variant="outline"
                      onClick={() => openMobileLink()}
                      className="w-full py-6 text-lg"
                    >
                      <Mail className="mr-2 h-5 w-5" />
                      Email me the link
                    </Button>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    viewport={{ once: true }}
                    className="mt-12 grid gap-6 md:grid-cols-3"
                  >
                    <FeatureItem text="Auto-sync with Gmail" icon={<CheckCircle2 className="h-5 w-5" />} />
                    <FeatureItem text="Real-time tracking" icon={<CheckCircle2 className="h-5 w-5" />} />
                    <FeatureItem text="Interview reminders" icon={<CheckCircle2 className="h-5 w-5" />} />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.7 }}
                    viewport={{ once: true }}
                    className="mt-8 text-center"
                  >
                    <p className="text-sm text-muted-foreground">
                      Basafy is read-only and you can disconnect anytime.{' '}
                      <Link className="text-chart-1 hover:underline" href="/privacy">
                        Privacy Policy
                      </Link>
                    </p>
                  </motion.div>
                </Card>

                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.9 }}
                  viewport={{ once: true }}
                  className="mt-8 text-center"
                >
                  <Link
                    href="/"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    ← Back to Home
                  </Link>
                </motion.div>
              </div>
            </>
          ) : (
            <div className="story-card relative w-full max-w-5xl rounded-lg border border-border/40 bg-card/50 px-10 py-16 backdrop-blur-xl">
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-chart-1/10 via-transparent to-chart-2/10 opacity-80" />
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Chapter {index + 1}</p>
                <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{chapter.title}</h1>
                <p className="mt-4 text-base text-muted-foreground">{chapter.subtitle}</p>
                <p className="mt-8 border-t border-white/8 pt-6 text-sm text-muted-foreground">{chapter.hint}</p>
              </div>
            </div>
          )}
        </section>
      ))}

      <footer className="border-t border-white/8 bg-[#05070d] px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-chart-1 to-chart-2 p-[1px]">
              <img
                src="/basafy-icon.png"
                alt="Basafy"
                className="h-full w-full rounded-[5px]"
              />
            </div>
            <span>© 2026 Basafy</span>
          </div>
          <div className="flex items-center gap-6">
            <Link className="hover:text-foreground" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="hover:text-foreground" href="/support">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function StatCard({
  label,
  value,
  tooltip,
  gradient,
  delay,
  icon
}: {
  label: string;
  value: number;
  tooltip: string;
  gradient: string;
  delay: number;
  icon: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={{ scale: 1.05 }}
    >
      <Card className="story-card p-8 bg-card/50 backdrop-blur-xl border-border/50 hover:border-border transition-all group relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />

        <div className="relative">
          <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${gradient} mb-4`}>
            <div className="text-white">{icon}</div>
          </div>
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            transition={{ delay: delay + 0.2, type: 'spring', stiffness: 200 }}
            viewport={{ once: true }}
            className="text-6xl font-bold mb-2 bg-gradient-to-br bg-clip-text text-transparent"
            style={{
              backgroundImage:
                'linear-gradient(to bottom right, var(--foreground), var(--muted-foreground))'
            }}
          >
            {value.toLocaleString()}
          </motion.div>
          <h3 className="text-xl font-semibold text-muted-foreground">{label}</h3>
          <p className="text-sm text-muted-foreground/60 mt-2">{tooltip}</p>
        </div>
      </Card>
    </motion.div>
  );
}

function FunnelRow({
  stage,
  count,
  percentage,
  barClass
}: {
  stage: string;
  count: number;
  percentage: number;
  barClass: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/40 px-5 py-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{stage}</span>
        <span>
          {count} ({percentage}%)
        </span>
      </div>
      <div className="mt-3 h-3 w-full rounded-full bg-muted/60">
        <div
          className={`h-3 rounded-full ${barClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function CustomDot(props: { cx?: number; cy?: number; payload?: { milestone?: boolean } }) {
  const { cx, cy, payload } = props;
  if (!payload?.milestone || cx === undefined || cy === undefined) return null;

  return (
    <g>
      <motion.circle
        cx={cx}
        cy={cy}
        r={8}
        fill="#6366f1"
        stroke="#1e1e2e"
        strokeWidth={3}
        initial={{ scale: 0 }}
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={15}
        fill="#6366f1"
        opacity={0.3}
        initial={{ scale: 0 }}
        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </g>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value?: number; payload?: any }> }) {
  if (!active || !payload?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-chart-1/30 bg-card/95 p-4 shadow-2xl backdrop-blur-xl"
    >
      <p className="mb-3 text-lg font-bold">{payload[0]?.payload?.week}</p>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-chart-1" />
          <span className="text-sm text-muted-foreground">Applications:</span>
          <span className="ml-auto font-bold text-chart-1">{payload[0]?.value ?? 0}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-chart-2" />
          <span className="text-sm text-muted-foreground">Replies:</span>
          <span className="ml-auto font-bold text-chart-2">{payload[1]?.value ?? 0}</span>
        </div>
        {payload[0]?.payload?.milestone && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="flex items-center gap-2 text-chart-1">
              <Award className="h-4 w-4" />
              <span className="text-sm font-semibold">Best week</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ResponseTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { range?: string; color?: string } }>;
}) {
  if (!active || !payload?.length) return null;

  const range = payload[0]?.payload?.range;
  const color = payload[0]?.payload?.color ?? '#22d3ee';
  const value = payload[0]?.value ?? 0;

  return (
    <div className="rounded-lg border border-chart-2/30 bg-card/95 p-4 shadow-xl backdrop-blur-xl">
      <p className="mb-1 font-semibold">{range}</p>
      <div className="flex items-center gap-2 text-sm">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-muted-foreground">Companies:</span>
        <span className="font-semibold">{value}</span>
      </div>
    </div>
  );
}

function SourcesTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload?: { platform?: string; count?: number; interviews?: number; rate?: number; color?: string } }>;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="rounded-lg border border-chart-1/30 bg-card/95 p-4 shadow-xl backdrop-blur-xl">
      <p className="mb-2 font-semibold">{data.platform}</p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Applications:</span>
          <span className="font-semibold">{data.count ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Interviews:</span>
          <span className="font-semibold text-chart-1">{data.interviews ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Success rate:</span>
          <span className="font-semibold text-chart-2">{data.rate ?? 0}%</span>
        </div>
      </div>
    </div>
  );
}

function RadialProgress({ score, label }: { score: number; label: string }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative h-40 w-40">
      <svg className="h-full w-full -rotate-90">
        <circle
          cx="80"
          cy="80"
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth="12"
          fill="none"
          opacity="0.2"
        />
        <motion.circle
          cx="80"
          cy="80"
          r={radius}
          stroke="url(#radialGradient)"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="radialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-4xl font-bold text-transparent bg-gradient-to-r from-chart-1 to-chart-2 bg-clip-text"
        >
          {score}
        </motion.div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function TrendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M14 8h7v7" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M5 12l4 4L19 6" />
    </svg>
  );
}

function FeatureItem({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="text-chart-1">{icon ?? <CheckIcon className="h-4 w-4" />}</div>
      <span>{text}</span>
    </div>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5-6z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 9h2" />
      <path d="M9 13h2" />
      <path d="M9 17h2" />
      <path d="M13 9h2" />
      <path d="M13 13h2" />
      <path d="M13 17h2" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 11h18" />
    </svg>
  );
}

function AwardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M8 14l-2 7 6-3 6 3-2-7" />
    </svg>
  );
}
