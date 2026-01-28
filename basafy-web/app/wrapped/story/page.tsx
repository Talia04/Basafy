'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
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
import { Button } from '../../../components/ui/button';

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
    { platform: 'Direct Email', count: 10, interviews: 0 },
    { platform: 'Other', count: 10, interviews: 0 }
  ],
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
    subtitle: 'What sources work for you',
    hint: 'ATS platforms & sources',
    type: 'sources'
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

export default function WrappedStoryPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [useDemo, setUseDemo] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);
  const [liveStoryData, setLiveStoryData] = useState<StoryData | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end']
  });
  const headerOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);

  const storyData = useDemo ? demoStoryData : liveStoryData;
  const resolvedStoryData = storyData ?? demoStoryData;
  const liveStatusMessage = !useDemo
    ? liveError
      ? `Live data unavailable: ${liveError}. Showing demo data for now.`
      : liveLoading
        ? 'Fetching live data...'
        : null
    : null;
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
    : demoStoryData.momentumData;
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
  const responseChartData = resolvedStoryData.responseData.map((entry, index) => ({
    ...entry,
    color: `hsl(var(--chart-${(index % 4) + 1}))`
  }));
  const sourcesWithRates = resolvedStoryData.sourcesData.map((source, index) => ({
    ...source,
    color:
      source.platform.toLowerCase() === 'other'
        ? 'hsl(var(--muted-foreground))'
        : `hsl(var(--chart-${(index % 5) + 1}))`,
    rate: source.count > 0 ? Math.round((source.interviews / source.count) * 100) : 0
  }));
  const topSource = sourcesWithRates[0] ?? {
    platform: 'Top platform',
    count: 0,
    interviews: 0,
    color: 'hsl(var(--chart-1))',
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

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('story-scroll');
    return () => {
      root.classList.remove('story-scroll');
    };
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem('basafy-story-data');
    if (stored === 'demo') {
      setUseDemo(true);
    } else if (stored === 'live') {
      setUseDemo(false);
    }
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem('basafy-story-data', useDemo ? 'demo' : 'live');
  }, [useDemo, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated || useDemo || liveStoryData) return;
    if (!supabase) {
      setLiveError('Missing Supabase environment variables.');
      return;
    }

    const supabaseClient = supabase;

    let isCurrent = true;

    const loadLiveData = async () => {
      setLiveLoading(true);
      setLiveError(null);

      try {
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !sessionData.session) {
          throw new Error('Missing authenticated session.');
        }

        const endAt = new Date();
        const startAt = new Date(endAt);
        startAt.setDate(endAt.getDate() - 90);
        const range = {
          p_start_at: startAt.toISOString(),
          p_end_at: endAt.toISOString()
        };

        const { data: sankeyData, error: sankeyError } = await supabaseClient.rpc('get_insights_sankey', range);
        if (sankeyError) {
          throw sankeyError;
        }

        const { data: weeklyTrend, error: weeklyError } = await supabaseClient.rpc('get_insights_weekly_trend', range);
        if (weeklyError) {
          throw weeklyError;
        }

        const nodes = Array.isArray((sankeyData as any)?.nodes)
          ? ((sankeyData as any).nodes as Array<{ id?: string; count?: number }>)
          : [];
        const nodeCounts = nodes.reduce((acc, node) => {
          const id = typeof node?.id === 'string' ? node.id : '';
          const count = Number(node?.count ?? 0);
          if (id) {
            acc[id] = Number.isFinite(count) ? count : 0;
          }
          return acc;
        }, {} as Record<string, number>);

        const appliedCount = nodeCounts.applied ?? 0;
        const assessmentCount = nodeCounts.assessment ?? 0;
        const interviewCount = nodeCounts.interview ?? 0;
        const offerCount = nodeCounts.offer ?? 0;

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

        const { data: applications, error: appsError } = await supabaseClient
          .from('applications')
          .select('id, company, applied_at, created_at, source_type')
          .or(`applied_at.gte.${startAt.toISOString()},created_at.gte.${startAt.toISOString()}`);

        if (appsError) {
          throw appsError;
        }

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

        const weeklyReplies = new Map<string, number>();
        (weeklyTrend ?? []).forEach((row: any) => {
          if (!row?.week_start) return;
          const key = toKey(new Date(row.week_start));
          const replies = Number(row.replies ?? 0);
          weeklyReplies.set(key, Number.isFinite(replies) ? replies : 0);
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
        const appsInRange: Array<{ id: string; appliedAt: Date; sourceType: string | null }> = [];
        (applications ?? []).forEach((row) => {
          const effectiveDate = row.applied_at ?? row.created_at;
          if (!effectiveDate) return;
          const parsed = new Date(effectiveDate);
          if (Number.isNaN(parsed.getTime())) return;
          if (parsed < startAt || parsed >= endAt) return;
          const company = row.company?.trim();
          if (company) uniqueCompanies.add(company);

          const weekKey = toKey(toWeekStart(parsed));
          const entry = weeks.get(weekKey);
          if (entry) {
            entry.applications += 1;
          }

          if (row.id) {
            appsInRange.push({
              id: row.id,
              appliedAt: parsed,
              sourceType: row.source_type ?? null
            });
          }
        });

        const liveOverview = {
          applications: appliedCount,
          companies: uniqueCompanies.size,
          interviews: interviewCount,
          offers: offerCount
        };

        const responseBuckets = [0, 0, 0, 0];
        const responseTimes: number[] = [];
        if (appsInRange.length) {
          const firstEvents = new Map<string, Date>();
          const chunkSize = 500;
          for (let i = 0; i < appsInRange.length; i += chunkSize) {
            const chunkIds = appsInRange.slice(i, i + chunkSize).map((app) => app.id);
            const { data: events, error: eventsError } = await supabaseClient
              .from('events')
              .select('application_id, start_at')
              .in('application_id', chunkIds)
              .gte('start_at', startAt.toISOString())
              .lt('start_at', endAt.toISOString());

            if (eventsError) {
              throw eventsError;
            }

            (events ?? []).forEach((event) => {
              if (!event.application_id || !event.start_at) return;
              const eventDate = new Date(event.start_at);
              if (Number.isNaN(eventDate.getTime())) return;
              const existing = firstEvents.get(event.application_id);
              if (!existing || eventDate < existing) {
                firstEvents.set(event.application_id, eventDate);
              }
            });
          }

          appsInRange.forEach((app) => {
            const firstEvent = firstEvents.get(app.id);
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
        }

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

        const { data: sourceEffectiveness, error: sourceError } = await supabaseClient.rpc(
          'get_insights_source_effectiveness',
          range
        );
        if (sourceError) {
          throw sourceError;
        }

        const sourceCounts = appsInRange.reduce((acc, app) => {
          const key = app.sourceType?.trim() || 'Other';
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const interviewsBySource = (sourceEffectiveness ?? []).reduce(
          (acc: Record<string, number>, row: { source_type?: string | null; interviews?: number | null }) => {
          const key = row?.source_type?.trim() || 'Other';
          const count = Number(row?.interviews ?? 0);
          acc[key] = Number.isFinite(count) ? count : 0;
          return acc;
          },
          {} as Record<string, number>
        );

        const toTitleCase = (value: string) =>
          value
            .replace(/_/g, ' ')
            .replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1));

        const sourcesData = Object.entries(sourceCounts)
          .map(([sourceType, count]) => ({
            platform: toTitleCase(sourceType),
            count,
            interviews: interviewsBySource[sourceType] ?? 0
          }))
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
            ? demoStoryData.personalities
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
        setLiveStoryData({
          ...demoStoryData,
          overview: liveOverview,
          funnelData,
          biggestDropOff,
          momentumData: momentumData.length ? momentumData : demoStoryData.momentumData,
          responseData,
          avgResponseTime: formatDays(avgResponseDays, 1),
          medianResponseTime: formatDays(medianResponseDays, 0),
          sourcesData: sourcesData.length ? sourcesData : demoStoryData.sourcesData,
          personalities,
          recommendations
        });
      } catch (err) {
        if (!isCurrent) return;
        setLiveError(err instanceof Error ? err.message : 'Unable to load live data.');
      } finally {
        if (isCurrent) {
          setLiveLoading(false);
        }
      }
    };

    loadLiveData();

    return () => {
      isCurrent = false;
    };
  }, [hasHydrated, useDemo, liveStoryData]);

  return (
    <main ref={containerRef} className="relative bg-background scroll-snap-container">
      <motion.header
        style={{ opacity: headerOpacity }}
        className="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/80 px-6 py-4 backdrop-blur-lg"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-chart-1 to-chart-2 p-[2px]">
              <img
                src="/basafy-icon.png"
                alt="Basafy"
                className="h-full w-full rounded-[10px]"
              />
            </div>
            <span className="text-xl font-bold">Basafy Wrapped</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border border-border/70 bg-background/40 p-1 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => setUseDemo(true)}
                aria-pressed={useDemo}
                className={`rounded-full px-3 py-1 transition ${
                  useDemo ? 'bg-gradient-to-r from-chart-1 to-chart-2 text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Demo
              </button>
              <button
                type="button"
                onClick={() => setUseDemo(false)}
                aria-pressed={!useDemo}
                className={`rounded-full px-3 py-1 transition ${
                  !useDemo ? 'bg-gradient-to-r from-chart-1 to-chart-2 text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Live
              </button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Link
              href="/"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </motion.header>

      <ScrollProgress />
      <MotionToggle />

      {liveStatusMessage && (
        <div className="mx-auto mt-16 max-w-7xl px-6 text-center text-xs text-muted-foreground">
          {liveStatusMessage}
        </div>
      )}

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} data={shareData} />

      {chapters.map((chapter, index) => (
        <section
          key={chapter.title}
          className="story-section scroll-snap-section relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-20"
        >
            {chapter.type === 'overview' ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-background via-chart-1/5 to-background" />
                <div className="relative z-10 w-full max-w-5xl">
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
                      icon={<FileIcon className="h-6 w-6" />}
                    />
                    <StatCard
                      label="Companies"
                      value={resolvedStoryData.overview.companies}
                      tooltip="Unique companies you've applied to"
                      gradient="from-chart-2 to-chart-3"
                      delay={0.3}
                      icon={<BuildingIcon className="h-6 w-6" />}
                    />
                    <StatCard
                      label="Interviews"
                      value={resolvedStoryData.overview.interviews}
                      tooltip="Interview invitations received"
                      gradient="from-chart-3 to-chart-4"
                      delay={0.4}
                      icon={<CalendarIcon className="h-6 w-6" />}
                    />
                    <StatCard
                      label="Offers"
                      value={resolvedStoryData.overview.offers}
                      tooltip="Job offers received"
                      gradient="from-chart-4 to-chart-5"
                      delay={0.5}
                      icon={<AwardIcon className="h-6 w-6" />}
                    />
                  </div>
                </div>
              </>
            ) : chapter.type === 'funnel' ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-background via-chart-2/5 to-background" />
                <div className="relative z-10 w-full max-w-4xl">
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

                  <div className="p-8 bg-card/50 backdrop-blur-xl border-border/50 rounded-3xl border">
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
                      45 rejections • Keep going, you're making progress!
                    </motion.div>
                  </div>
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
                <div className="relative z-10 w-full max-w-6xl">
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
                                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.6} />
                                <stop offset="50%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
                              </linearGradient>
                              <linearGradient id="repliesArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6} />
                                <stop offset="50%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.1} />
                            <XAxis
                              dataKey="week"
                              stroke="hsl(var(--foreground))"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              stroke="hsl(var(--foreground))"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                              type="monotone"
                              dataKey="applications"
                              stroke="hsl(var(--chart-1))"
                              strokeWidth={3}
                              fill="url(#applicationsArea)"
                              dot={<CustomDot />}
                              activeDot={{ r: 8, strokeWidth: 3, stroke: 'hsl(var(--background))' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="replies"
                              stroke="hsl(var(--chart-2))"
                              strokeWidth={3}
                              fill="url(#repliesArea)"
                              dot={{ fill: 'hsl(var(--chart-2))', r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                              activeDot={{ r: 8, strokeWidth: 3, stroke: 'hsl(var(--background))' }}
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
                <div className="relative z-10 w-full max-w-5xl">
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
                        <BarChart data={responseChartData}>
                          <defs>
                            {responseChartData.map((entry, chartIndex) => (
                              <linearGradient key={entry.range} id={`responseGradient${chartIndex}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.1} />
                          <XAxis
                            dataKey="range"
                            stroke="hsl(var(--foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke="hsl(var(--foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            content={<ResponseTooltip />}
                            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                          />
                          <Bar dataKey="count" radius={[12, 12, 0, 0]}>
                            {responseChartData.map((entry, chartIndex) => (
                              <Cell key={entry.range} fill={`url(#responseGradient${chartIndex})`} />
                            ))}
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
                      <div className="mb-2 flex items-center justify-center gap-2 text-chart-3">
                        <Clock className="h-5 w-5" />
                        <span className="text-sm font-semibold">Timing tip</span>
                      </div>
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
                <div className="relative z-10 w-full max-w-5xl">
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
                        <BarChart data={sourcesWithRates} layout="vertical" margin={{ left: 20 }}>
                          <defs>
                            {sourcesWithRates.map((entry, chartIndex) => (
                              <linearGradient key={entry.platform} id={`sourceGradient${chartIndex}`} x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor={entry.color} stopOpacity={0.8} />
                                <stop offset="100%" stopColor={entry.color} stopOpacity={1} />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.1} />
                          <XAxis
                            type="number"
                            stroke="hsl(var(--foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            dataKey="platform"
                            type="category"
                            stroke="hsl(var(--foreground))"
                            fontSize={13}
                            width={110}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip content={<SourcesTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }} />
                          <Bar dataKey="count" radius={[0, 12, 12, 0]}>
                            {sourcesWithRates.map((entry, chartIndex) => (
                              <Cell key={entry.platform} fill={`url(#sourceGradient${chartIndex})`} />
                            ))}
                            <LabelList dataKey="count" position="right" fill="hsl(var(--foreground))" fontSize={12} fontWeight={600} />
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
                            <span className="font-semibold text-chart-2">{runnerUpSource.platform}</span> delivered the highest interview rates at{' '}
                            <span className="font-semibold">{topSource.rate}%</span> and{' '}
                            <span className="font-semibold">{runnerUpSource.rate}%</span>.
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
            ) : chapter.type === 'highlights' ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
                <div className="relative z-10 w-full max-w-4xl">
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
                          <button
                            onClick={() => setShareOpen(true)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-5 py-2 text-xs font-semibold text-white transition hover:bg-white/30"
                          >
                            <Share2 className="h-4 w-4" />
                            Share Your Card
                          </button>
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
                    <div className="flex flex-wrap items-center justify-center gap-4">
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
                <div className="relative z-10 w-full max-w-5xl">
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
                      These insights are based on your current job search pattern. Track your progress continuously with the Basafy
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
                <div className="relative z-10 w-full max-w-4xl">
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
                      <button className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-chart-1 to-chart-2 px-6 py-4 text-base font-semibold text-white transition hover:opacity-90">
                        <Smartphone className="mr-2 h-5 w-5" />
                        Download on App Store
                      </button>
                      <button className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-chart-3 to-chart-4 px-6 py-4 text-base font-semibold text-white transition hover:opacity-90">
                        <Smartphone className="mr-2 h-5 w-5" />
                        Get it on Google Play
                      </button>
                      <button className="flex w-full items-center justify-center rounded-full border border-border px-6 py-4 text-base font-semibold text-foreground">
                        <Mail className="mr-2 h-5 w-5" />
                        Email me the link
                      </button>
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
      <div className="p-8 bg-card/50 backdrop-blur-xl border-border/50 hover:border-border transition-all group relative overflow-hidden rounded-3xl border">
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
      </div>
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
        fill="hsl(var(--chart-1))"
        stroke="hsl(var(--background))"
        strokeWidth={3}
        initial={{ scale: 0 }}
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={15}
        fill="hsl(var(--chart-1))"
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
              <span className="text-sm font-semibold">Best Week</span>
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
  const color = payload[0]?.payload?.color ?? 'hsl(var(--chart-2))';
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
            <stop offset="0%" stopColor="hsl(var(--chart-1))" />
            <stop offset="100%" stopColor="hsl(var(--chart-2))" />
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
