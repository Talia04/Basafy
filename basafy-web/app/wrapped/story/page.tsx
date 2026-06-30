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
  const momentumScore = 85;
  const streak = baseMomentumData.length;
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
          throw new Error('Missing authenticated session.');
        }

        const endAt = new Date();
        const startAt = new Date(endAt);
        startAt.setMonth(endAt.getMonth() - 6); // 6 months back
        const range = {
          p_start_at: startAt.toISOString(),
          p_end_at: endAt.toISOString()
        };

        // Fetch ALL applications (no date filter in query - filter client-side)
        const { data: allApplications, error: appsError } = await supabaseClient
          .from('applications')
          .select('id, company, role, status, applied_at, created_at, portal_domain, source_type');

        if (appsError) {
          throw appsError;
        }

        // Filter applications to the date range client-side
        const applications = (allApplications ?? []).filter(app => {
          const effectiveDate = app.applied_at ?? app.created_at;
          if (!effectiveDate) return true; // Include apps without dates
          const date = new Date(effectiveDate);
          return date >= startAt && date < endAt;
        });

        // Fetch events for these applications
        const appIds = applications.map(a => a.id);
        let events: any[] = [];
        if (appIds.length > 0) {
          const { data: eventsData, error: eventsError } = await supabaseClient
            .from('events')
            .select('id, application_id, event_type, start_at')
            .in('application_id', appIds);

          if (!eventsError) {
            events = eventsData ?? [];
          }
        }

        // Calculate funnel counts from direct data - use all filtered applications
        const appsInRange = applications;

        const appliedCount = appsInRange.length;

        // Count by checking both events and status
        const eventsByApp = events.reduce((acc, e) => {
          if (!acc[e.application_id]) acc[e.application_id] = [];
          acc[e.application_id].push(e);
          return acc;
        }, {} as Record<string, any[]>);

        let assessmentCount = 0;
        let interviewCount = 0;
        let offerCount = 0;

        appsInRange.forEach(app => {
          const appEvents = eventsByApp[app.id] ?? [];
          const status = (app.status ?? '').toLowerCase();

          const hasAssessment = appEvents.some((e: any) => e.event_type === 'assessment') || status === 'assessment';
          const hasInterview = appEvents.some((e: any) => e.event_type === 'interview') || status === 'interview' || status === 'offer';
          const hasOffer = status === 'offer';

          if (hasAssessment) assessmentCount++;
          if (hasInterview) interviewCount++;
          if (hasOffer) offerCount++;
        });

        const funnelData = [
          {
            stage: 'Applied',
            count: appliedCount,
            percentage: appliedCount ? 100 : 0,
            barClass: 'bg-chart-1'
          },
          {
            stage: 'Assessment',
            count: assessmentCount,
            percentage: appliedCount ? Math.round((assessmentCount / appliedCount) * 100) : 0,
            barClass: 'bg-chart-2'
          },
          {
            stage: 'Interview',
            count: interviewCount,
            percentage: appliedCount ? Math.round((interviewCount / appliedCount) * 100) : 0,
            barClass: 'bg-chart-3'
          },
          {
            stage: 'Offer',
            count: offerCount,
            percentage: appliedCount ? Math.round((offerCount / appliedCount) * 100) : 0,
            barClass: 'bg-chart-4'
          }
        ];

        const dropCandidates = [
          { from: 'Applied', to: 'Assessment', prev: appliedCount, next: assessmentCount },
          { from: 'Assessment', to: 'Interview', prev: assessmentCount, next: interviewCount },
          { from: 'Interview', to: 'Offer', prev: interviewCount, next: offerCount }
        ];

        let biggestDropOff = 'Not enough data yet';
        let biggestDrop = -1;
        dropCandidates.forEach((candidate) => {
          if (candidate.prev <= 0) return;
          const drop = Math.max(0, Math.round(((candidate.prev - candidate.next) / candidate.prev) * 100));
          if (drop > biggestDrop) {
            biggestDrop = drop;
            biggestDropOff = `${candidate.from} → ${candidate.to} (${drop}% drop)`;
          }
        });

        // Use the applications data we already fetched for momentum calculations
        const toWeekStart = (date: Date) => {
          const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
          const day = normalized.getUTCDay();
          const diff = (day + 6) % 7;
          normalized.setUTCDate(normalized.getUTCDate() - diff);
          return normalized;
        };

        const toKey = (date: Date) => date.toISOString().slice(0, 10);
        const formatLabel = (date: Date) =>
          date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

        // Count events by week for "replies" (any event response)
        const weeklyReplies = new Map<string, number>();
        events.forEach((event: any) => {
          if (!event?.start_at) return;
          const eventDate = new Date(event.start_at);
          if (eventDate < startAt || eventDate >= endAt) return;
          const key = toKey(toWeekStart(eventDate));
          weeklyReplies.set(key, (weeklyReplies.get(key) ?? 0) + 1);
        });

        const weeks = new Map<string, { weekStart: Date; applications: number; replies: number }>();
        const startWeek = toWeekStart(startAt);
        const endWeek = toWeekStart(endAt);
        for (let cursor = new Date(startWeek); cursor <= endWeek; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
          const key = toKey(cursor);
          weeks.set(key, {
            weekStart: new Date(cursor),
            applications: 0,
            replies: weeklyReplies.get(key) ?? 0
          });
        }

        const uniqueCompanies = new Set<string>();
        appsInRange.forEach((app) => {
          const effectiveDate = app.applied_at ?? app.created_at;
          if (!effectiveDate) return;
          const parsed = new Date(effectiveDate);
          const company = app.company?.trim();
          if (company) uniqueCompanies.add(company);

          const weekKey = toKey(toWeekStart(parsed));
          const entry = weeks.get(weekKey);
          if (entry) {
            entry.applications += 1;
          }
        });

        // For response time calculations, use the appsInRange we already calculated
        const appsForResponseTime = appsInRange.map(app => ({
          id: app.id,
          appliedAt: new Date(app.applied_at ?? app.created_at)
        }));
        const liveOverview = {
          applications: appliedCount,
          companies: uniqueCompanies.size,
          interviews: interviewCount,
          offers: offerCount
        };

        // Calculate response times using the events we already fetched
        const responseBuckets = [0, 0, 0, 0];
        const responseTimes: number[] = [];

        // Group events by application to find first event
        const firstEventByApp = new Map<string, Date>();
        events.forEach((event: any) => {
          if (!event.application_id || !event.start_at) return;
          const eventDate = new Date(event.start_at);
          if (Number.isNaN(eventDate.getTime())) return;
          const existing = firstEventByApp.get(event.application_id);
          if (!existing || eventDate < existing) {
            firstEventByApp.set(event.application_id, eventDate);
          }
        });

        appsForResponseTime.forEach((app) => {
          const firstEvent = firstEventByApp.get(app.id);
          if (!firstEvent) return;
          const diffDays = Math.max(0, (firstEvent.getTime() - app.appliedAt.getTime()) / (1000 * 60 * 60 * 24));
          responseTimes.push(diffDays);
          if (diffDays <= 3) {
            responseBuckets[0] += 1;
          } else if (diffDays <= 7) {
            responseBuckets[1] += 1;
          } else if (diffDays <= 14) {
            responseBuckets[2] += 1;
          } else {
            responseBuckets[3] += 1;
          }
        });

        const avgResponseDays = responseTimes.length
          ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length
          : null;
        const sortedResponses = responseTimes.slice().sort((a, b) => a - b);
        const medianResponseDays = sortedResponses.length
          ? sortedResponses.length % 2 === 1
            ? sortedResponses[Math.floor(sortedResponses.length / 2)]
            : (sortedResponses[sortedResponses.length / 2 - 1] + sortedResponses[sortedResponses.length / 2]) / 2
          : null;
        const formatDays = (value: number | null, decimals = 0) => {
          if (value === null || !Number.isFinite(value)) return '—';
          const rounded = decimals > 0 ? value.toFixed(decimals) : `${Math.round(value)}`;
          const numeric = Number(rounded);
          const label = numeric === 1 ? 'day' : 'days';
          return `${rounded} ${label}`;
        };

        const responseData = [
          { range: '0-3 days', count: responseBuckets[0] },
          { range: '4-7 days', count: responseBuckets[1] },
          { range: '8-14 days', count: responseBuckets[2] },
          { range: '15+ days', count: responseBuckets[3] }
        ];

        // Calculate source effectiveness directly from applications data
        const getPlatformName = (portalDomain: string | null, sourceType: string | null): string => {
          if (!portalDomain) return sourceType ? sourceType.charAt(0).toUpperCase() + sourceType.slice(1) : 'Direct/Email';
          const domain = portalDomain.toLowerCase();
          if (domain.includes('greenhouse')) return 'Greenhouse';
          if (domain.includes('lever')) return 'Lever';
          if (domain.includes('workday') || domain.includes('myworkday')) return 'Workday';
          if (domain.includes('ashby')) return 'Ashby';
          if (domain.includes('icims')) return 'iCIMS';
          if (domain.includes('smartrecruiters')) return 'SmartRecruiters';
          if (domain.includes('taleo')) return 'Taleo';
          if (domain.includes('jobvite')) return 'Jobvite';
          if (domain.includes('bamboohr')) return 'BambooHR';
          if (domain.includes('linkedin')) return 'LinkedIn';
          if (domain.includes('indeed')) return 'Indeed';
          if (domain.includes('wellfound') || domain.includes('angel.co')) return 'Wellfound';
          if (domain.includes('dover')) return 'Dover';
          if (domain.includes('rippling')) return 'Rippling';
          return 'Other ATS';
        };

        const sourceStats = new Map<string, { count: number; interviews: number }>();
        appsInRange.forEach(app => {
          const platform = getPlatformName(app.portal_domain, app.source_type);
          const stats = sourceStats.get(platform) ?? { count: 0, interviews: 0 };
          stats.count++;

          const appEvents = eventsByApp[app.id] ?? [];
          const status = (app.status ?? '').toLowerCase();
          const hasInterview = appEvents.some((e: any) => e.event_type === 'interview') || status === 'interview' || status === 'offer';
          if (hasInterview) stats.interviews++;

          sourceStats.set(platform, stats);
        });

        const sourcesData = Array.from(sourceStats.entries())
          .map(([platform, stats]) => ({
            platform,
            count: stats.count,
            interviews: stats.interviews
          }))
          .filter(s => s.count > 0)
          .sort((a, b) => b.count - a.count);

        const momentumData = Array.from(weeks.values())
          .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
          .map((entry) => ({
            week: formatLabel(entry.weekStart),
            applications: entry.applications,
            replies: entry.replies
          }));

        const averagePerWeek = momentumData.length
          ? Math.round(appliedCount / momentumData.length)
          : 0;
        const interviewRate = appliedCount > 0 ? Math.round((interviewCount / appliedCount) * 100) : 0;
        const uniqueSourcesCount = sourcesData.length;
        const personalities =
          appliedCount === 0
            ? [{
                type: 'explorer',
                title: 'Your story starts here',
                description: 'No applications were detected in this period',
                stat: '0 applications in 90 days',
                gradient: 'from-chart-1 to-chart-2'
              }]
            : (() => {
              const catalog = {
                sprinter: {
                  type: 'sprinter',
                  title: 'The Sprinter',
                  description: 'High volume, high energy',
                  stat: `${appliedCount} applications in 90 days`,
                  gradient: 'from-chart-1 to-chart-2'
                },
                strategist: {
                  type: 'strategist',
                  title: 'The Strategist',
                  description: 'Quality over quantity',
                  stat: `${interviewRate}% interview rate`,
                  gradient: 'from-chart-3 to-chart-4'
                },
                explorer: {
                  type: 'explorer',
                  title: 'The Explorer',
                  description: 'Broad search approach',
                  stat: `${uniqueCompanies.size} companies, ${uniqueSourcesCount} sources`,
                  gradient: 'from-chart-5 to-chart-1'
                }
              };
              const scores = {
                sprinter: averagePerWeek * 2 + appliedCount / 5,
                strategist: interviewRate * 2,
                explorer: uniqueCompanies.size / 2 + uniqueSourcesCount * 3
              };
              const primaryType = (Object.keys(scores) as Array<keyof typeof scores>).reduce(
                (best, key) => (scores[key] > scores[best] ? key : best),
                'sprinter'
              );
              const orderedTypes = [primaryType, 'sprinter', 'strategist', 'explorer'].filter(
                (value, index, self) => self.indexOf(value) === index
              ) as Array<keyof typeof catalog>;
              return orderedTypes.map((type) => catalog[type]);
            })();

        const { data: stalledApps, error: stalledError } = await supabaseClient.rpc('get_insights_stalled_apps', {
          ...range,
          p_limit: 5
        });
        if (stalledError) {
          throw stalledError;
        }

        const stalledList = Array.isArray(stalledApps) ? stalledApps : [];
        const stalledCount = stalledList.length;
        const stalledNames = stalledList
          .map((row: any) => row?.company)
          .filter(Boolean)
          .slice(0, 2);

        const topSourceName = sourcesData[0]?.platform ?? 'top platforms';
        const followUpInsight =
          stalledCount > 0
            ? `${stalledCount} applications pending for 14+ days`
            : 'Check in on any applications without updates';
        const followUpAction =
          stalledNames.length > 0
            ? `Follow up with ${stalledNames.join(' & ')}`
            : 'Send polite check-in emails';

        const sourceInsight =
          sourcesData.length > 0
            ? `${topSourceName} is your top-performing source`
            : 'Focus on sources with higher conversion';

        const prepInsight =
          interviewCount > 0
            ? `You have ${interviewCount} interview${interviewCount === 1 ? '' : 's'} coming up`
            : 'Set up time blocks for interview prep';

        const recommendations = [
          {
            title: 'Follow up on stalled applications',
            insight: followUpInsight,
            action: followUpAction,
            gradient: 'from-chart-1 to-chart-2'
          },
          {
            title: 'Apply more to your best sources',
            insight: sourceInsight,
            action: 'Double down on winning platforms',
            gradient: 'from-chart-3 to-chart-4'
          },
          {
            title: 'Schedule time blocks for interview prep',
            insight: prepInsight,
            action: 'Create interview prep tasks',
            gradient: 'from-chart-5 to-chart-1'
          }
        ];

        if (!isCurrent) return;
        // Compute bestWeek / slowestWeek from live momentum data
        const liveBestWeek = momentumData.length
          ? (() => {
              const best = momentumData.reduce((a, b) => (b.applications > a.applications ? b : a), momentumData[0]);
              return `${best.week} (${best.applications} applications)`;
            })()
          : 'Not enough data';
        const liveSlowestWeek = momentumData.length
          ? (() => {
              const worst = momentumData.reduce((a, b) => (b.applications < a.applications ? b : a), momentumData[0]);
              return `${worst.week} (${worst.applications} applications)`;
            })()
          : 'Not enough data';

        // Build timing data from applications (day-of-week and time-of-day)
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayBuckets = dayNames.map(() => ({ applications: 0, responses: 0 }));
        const timeBuckets = [
          { applications: 0, responses: 0 }, // Morning 6-12
          { applications: 0, responses: 0 }, // Afternoon 12-18
          { applications: 0, responses: 0 }  // Evening 18-24
        ];

        appsInRange.forEach(app => {
          const effectiveDate = app.applied_at ?? app.created_at;
          if (!effectiveDate) return;
          const d = new Date(effectiveDate);
          dayBuckets[d.getDay()].applications++;
          const hour = d.getHours();
          if (hour >= 6 && hour < 12) timeBuckets[0].applications++;
          else if (hour >= 12 && hour < 18) timeBuckets[1].applications++;
          else timeBuckets[2].applications++;
        });

        // Count responses per day/time using events
        events.forEach((event: any) => {
          if (!event.start_at) return;
          const d = new Date(event.start_at);
          dayBuckets[d.getDay()].responses++;
          const hour = d.getHours();
          if (hour >= 6 && hour < 12) timeBuckets[0].responses++;
          else if (hour >= 12 && hour < 18) timeBuckets[1].responses++;
          else timeBuckets[2].responses++;
        });

        const byDayOfWeek = dayBuckets.map((b, i) => ({
          day: dayNames[i],
          applications: b.applications,
          responses: b.responses,
          responseRate: b.applications > 0 ? Math.round((b.responses / b.applications) * 100) : 0
        }));

        const timeLabels = [
          { time: 'Morning', label: '6am-12pm' },
          { time: 'Afternoon', label: '12pm-6pm' },
          { time: 'Evening', label: '6pm-12am' }
        ];
        const byTimeOfDay = timeBuckets.map((b, i) => ({
          ...timeLabels[i],
          applications: b.applications,
          responses: b.responses,
          responseRate: b.applications > 0 ? Math.round((b.responses / b.applications) * 100) : 0
        }));

        const bestDayEntry = byDayOfWeek.reduce((a, b) => (b.responseRate > a.responseRate ? b : a), byDayOfWeek[0]);
        const worstDayEntry = byDayOfWeek.reduce((a, b) => (b.responseRate < a.responseRate ? b : a), byDayOfWeek[0]);
        const bestTimeEntry = byTimeOfDay.reduce((a, b) => (b.responseRate > a.responseRate ? b : a), byTimeOfDay[0]);

        const liveTimingData = {
          byDayOfWeek,
          byTimeOfDay,
          bestDay: bestDayEntry.day,
          bestDayRate: bestDayEntry.responseRate,
          worstDay: worstDayEntry.day,
          worstDayRate: worstDayEntry.responseRate,
          bestTime: bestTimeEntry.time,
          bestTimeRate: bestTimeEntry.responseRate,
          insight: bestDayEntry.responseRate > 0
            ? `You get the best response rate when you apply on ${bestDayEntry.day} ${bestTimeEntry.time.toLowerCase()}s`
            : 'Apply more to see timing insights'
        };

        // Build ghost data from applications without events after 14+ days
        const now = new Date();
        let totalGhosted = 0;
        const ghostByStage = { afterApply: 0, afterAssessment: 0, afterInterview: 0 };
        const ghostCompanies: { company: string; daysWaiting: number }[] = [];
        let stillWaiting = 0;

        appsInRange.forEach(app => {
          const effectiveDate = app.applied_at ?? app.created_at;
          if (!effectiveDate) return;
          const appDate = new Date(effectiveDate);
          const daysSince = (now.getTime() - appDate.getTime()) / (1000 * 60 * 60 * 24);
          const appEvents = eventsByApp[app.id] ?? [];
          const status = (app.status ?? '').toLowerCase();

          // Ghosted = no events, no interview/offer, and it's been 14+ days
          if (appEvents.length === 0 && status !== 'interview' && status !== 'offer' && daysSince >= 14) {
            totalGhosted++;
            ghostByStage.afterApply++;
            if (app.company) {
              ghostCompanies.push({ company: app.company, daysWaiting: Math.round(daysSince) });
            }
            if (status !== 'rejected') stillWaiting++;
          } else if (daysSince >= 14 && status === 'assessment' && !appEvents.some((e: any) => e.event_type === 'interview')) {
            totalGhosted++;
            ghostByStage.afterAssessment++;
          }
        });

        const ghostRate = appliedCount > 0 ? Math.round((totalGhosted / appliedCount) * 100) : 0;
        const topGhostingCompanies = ghostCompanies
          .sort((a, b) => b.daysWaiting - a.daysWaiting)
          .slice(0, 3);

        const liveGhostData = {
          totalGhosted,
          ghostRate,
          avgDaysBeforeGhost: topGhostingCompanies.length
            ? Math.round(topGhostingCompanies.reduce((s, c) => s + c.daysWaiting, 0) / topGhostingCompanies.length)
            : 0,
          byStage: [
            { stage: 'After Apply', count: ghostByStage.afterApply, percentage: totalGhosted > 0 ? Math.round((ghostByStage.afterApply / totalGhosted) * 100) : 0 },
            { stage: 'After Assessment', count: ghostByStage.afterAssessment, percentage: totalGhosted > 0 ? Math.round((ghostByStage.afterAssessment / totalGhosted) * 100) : 0 },
            { stage: 'After Interview', count: ghostByStage.afterInterview, percentage: totalGhosted > 0 ? Math.round((ghostByStage.afterInterview / totalGhosted) * 100) : 0 }
          ],
          topGhostingCompanies,
          stillWaiting,
          insight: totalGhosted > 0
            ? `${totalGhosted} applications went silent — following up can recover 15-20%`
            : 'No ghosted applications detected yet'
        };

        setLiveStoryData({
          overview: liveOverview,
          funnelData,
          biggestDropOff,
          bestWeek: liveBestWeek,
          slowestWeek: liveSlowestWeek,
          momentumData,
          responseData,
          avgResponseTime: formatDays(avgResponseDays, 1),
          medianResponseTime: formatDays(medianResponseDays, 0),
          sourcesData,
          timingData: liveTimingData,
          ghostData: liveGhostData,
          personalities,
          recommendations
        });
      } catch (err) {
        if (!isCurrent) return;
        setLiveError(err instanceof Error ? err.message : 'Unable to load live data.');
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
        <div className="mx-auto w-full max-w-lg rounded-lg border border-white/10 bg-white/[0.045] p-8 text-center backdrop-blur-xl">
          <h1 className="text-3xl font-semibold">Live results could not load</h1>
          <p className="mt-3 text-sm leading-6 text-white/45">{liveError}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button type="button" className="rounded-lg bg-white text-black hover:bg-white/90" onClick={() => { setLiveError(null); setLiveReloadKey((key) => key + 1); }}>
              Try again
            </Button>
            <Button type="button" variant="outline" className="rounded-lg border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => setUseDemo(true)}>
              View sample data
            </Button>
          </div>
        </div>
      </WrappedShell>
    );
  }

  return (
    <main className="relative bg-background scroll-snap-container">
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
          className="story-section scroll-snap-section relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-20"
        >
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

                <Card className="p-8 bg-card/50 backdrop-blur-xl border-border/50">
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
              <motion.div
                className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-chart-1/20 blur-3xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 8, repeat: Infinity }}
              />
              <motion.div
                className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-chart-2/20 blur-3xl"
                animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
                transition={{ duration: 8, repeat: Infinity, delay: 1 }}
              />
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
                  <Card className="md:col-span-2 bg-gradient-to-br from-card/80 to-card/40 p-6 backdrop-blur-xl border-chart-1/20 shadow-2xl">
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
                      <Card className="flex flex-col items-center bg-gradient-to-br from-card/80 to-card/40 p-6 backdrop-blur-xl border-chart-1/20 shadow-2xl">
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
                      <Card className="bg-gradient-to-br from-chart-3/20 to-chart-3/5 p-6 backdrop-blur-xl border-chart-3/30 shadow-xl">
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
                      <Card className="bg-gradient-to-br from-chart-1/20 to-chart-1/5 p-6 backdrop-blur-xl border-chart-1/30 shadow-xl">
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
                  <Card className="bg-gradient-to-r from-chart-5/10 via-chart-3/10 to-chart-1/10 p-6 backdrop-blur-xl border border-chart-3/20">
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
              <div className="absolute right-1/4 top-1/3 h-96 w-96 rounded-full bg-chart-2/20 blur-3xl" />
              <div className="absolute bottom-1/3 left-1/4 h-96 w-96 rounded-full bg-chart-3/20 blur-3xl" />
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

                <Card className="bg-gradient-to-br from-card/80 to-card/40 p-8 backdrop-blur-xl border-chart-2/20 shadow-2xl">
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
                    <span className="mb-2 inline-block text-2xl">⏰</span>
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
              <div className="absolute right-1/3 top-1/4 h-96 w-96 rounded-full bg-chart-1/20 blur-3xl" />
              <div className="absolute bottom-1/4 left-1/3 h-96 w-96 rounded-full bg-chart-5/20 blur-3xl" />
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

                <Card className="bg-gradient-to-br from-card/80 to-card/40 p-8 backdrop-blur-xl border-chart-5/20 shadow-2xl">
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
                        <h4 className="mb-2 font-semibold text-chart-1">📊 Key insight</h4>
                        <p className="mb-3 text-sm text-foreground/80">
                          <span className="font-semibold text-chart-1">{topSource.platform}</span> and{' '}
                          <span className="font-semibold text-chart-2">{runnerUpSource.platform}</span> yielded the highest interview rates at{' '}
                          <span className="font-semibold">{topSource.rate}%</span> and{' '}
                          <span className="font-semibold">{runnerUpSource.rate}%</span> respectively.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          💡 Consider focusing more effort on companies using these platforms for better results.
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
              <div className="absolute right-1/4 top-1/3 h-96 w-96 rounded-full bg-chart-4/20 blur-3xl" />
              <div className="absolute bottom-1/3 left-1/4 h-96 w-96 rounded-full bg-chart-1/20 blur-3xl" />
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

                <Card className="bg-gradient-to-br from-card/80 to-card/40 p-8 backdrop-blur-xl border-chart-4/20 shadow-2xl">
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
                        <h4 className="mb-2 font-semibold text-chart-4">⏰ Timing tip</h4>
                        <p className="mb-3 text-sm text-foreground/80">
                          Recruiters typically review applications at the start of their workday. Applying{' '}
                          <span className="font-semibold text-chart-4">{resolvedStoryData.timingData.bestTime.toLowerCase()}</span> on{' '}
                          <span className="font-semibold text-chart-1">{resolvedStoryData.timingData.bestDay}s</span> puts your application at the top of their inbox.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          💡 Schedule your applications to send during peak response windows.
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
              <div className="absolute right-1/3 top-1/4 h-96 w-96 rounded-full bg-chart-3/10 blur-3xl" />
              <div className="absolute bottom-1/4 left-1/3 h-96 w-96 rounded-full bg-muted/20 blur-3xl" />
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

                <Card className="bg-gradient-to-br from-card/80 to-card/40 p-8 backdrop-blur-xl border-chart-3/20 shadow-2xl">
                  {/* Big ghost emoji header */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="mb-8 text-center"
                  >
                    <motion.span
                      className="text-8xl inline-block"
                      animate={{ y: [0, -10, 0], opacity: [1, 0.7, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      👻
                    </motion.span>
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
                            <span className="text-lg">👻</span>
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
                        <h4 className="mb-2 font-semibold text-chart-3">👻 Ghost reality check</h4>
                        <p className="mb-3 text-sm text-foreground/80">
                          {resolvedStoryData.ghostData.insight}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          💡 A polite follow-up 2 weeks after applying can sometimes resurrect ghosted applications.
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
                        <Card className="group border-border/50 bg-card/50 p-6 backdrop-blur-xl transition-all hover:border-border">
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
                            <button className="rounded-lg bg-gradient-to-r from-chart-1 to-chart-2 px-6 py-2 font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                              Do this in Basafy
                            </button>
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
                    💡 These insights are based on your current job search pattern. Track your progress continuously with the Basafy
                    mobile app.
                  </p>
                </motion.div>
              </div>
            </>
          ) : chapter.type === 'cta' ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-background via-chart-1/10 to-background" />
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-chart-1/20 blur-3xl" />
                <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-chart-2/20 blur-3xl" />
              </div>
              <div className="relative z-10 w-full max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true, amount: 0.3 }}
                  onAnimationComplete={() => fireConfetti()}
                  className="mb-16 text-center"
                >
                  <div className="mb-6 text-6xl">🎉</div>
                  <h2 className="mb-4 text-5xl font-bold md:text-6xl">{chapter.title}</h2>
                  <p className="text-xl text-muted-foreground">{chapter.subtitle}</p>
                </motion.div>

                <Card className="border-2 border-chart-1/20 bg-card/50 p-12 backdrop-blur-xl">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                    className="mb-12 flex items-center justify-center"
                  >
                    <div className="relative">
                      <div className="flex h-96 w-64 items-center justify-center rounded-3xl bg-gradient-to-br from-chart-1 to-chart-2 shadow-2xl">
                        <Smartphone className="h-32 w-32 text-white" />
                      </div>
                      <div className="absolute -right-4 -top-4 flex h-16 w-16 items-center justify-center rounded-full bg-chart-1 text-white shadow-lg">
                        <CheckCircle2 className="h-8 w-8" />
                      </div>
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
                    <Button
                      size="lg"
                      type="button"
                      onClick={() => openMobileLink(playStoreUrl)}
                      className="w-full bg-gradient-to-r from-chart-3 to-chart-4 py-6 text-lg hover:opacity-90"
                    >
                      <Smartphone className="mr-2 h-5 w-5" />
                      {playStoreUrl ? 'Get it on Google Play' : 'Request Android App Link'}
                    </Button>
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
            <div className="relative w-full max-w-5xl rounded-[36px] border border-border/40 bg-card/50 px-10 py-16 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="absolute inset-0 -z-10 bg-gradient-to-b from-chart-1/10 via-transparent to-chart-2/10 opacity-80" />
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Chapter {index + 1}</p>
                <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{chapter.title}</h1>
                <p className="mt-4 text-base text-muted-foreground">{chapter.subtitle}</p>
                <div className="mt-8 rounded-2xl border border-border/50 bg-background/40 px-6 py-5 text-sm text-muted-foreground">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Placeholder</p>
                  <p className="mt-2">{chapter.hint}</p>
                </div>
              </div>
            </div>
          )}
        </section>
      ))}

      <footer className="border-t border-border/50 px-6 py-8">
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
      <Card className="p-8 bg-card/50 backdrop-blur-xl border-border/50 hover:border-border transition-all group relative overflow-hidden">
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
              <span className="text-sm font-semibold">Best Week! 🎉</span>
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
