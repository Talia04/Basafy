import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FloatingNav from '../../components/main/FloatingNav';
import { useTheme, Palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';
import Svg, {
  Path,
  Defs,
  Line,
  LinearGradient as SvgGradient,
  Stop,
  Circle,
} from 'react-native-svg';
import EmptyState from '../../components/common/EmptyState';
import { InsightsOverviewSkeleton } from '../../components/common/SkeletonLoader';
import { lightImpact } from '../../lib/haptics';

// ============================================================================
// Types
// ============================================================================

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
  onOpenApplication?: (application: {
    id: string;
    company: string | null;
    role: string | null;
    status: string | null;
    source_type?: string | null;
  }) => void;
  unreadCount?: number;
};

const TIME_RANGES = ['7D', '30D', '90D', 'All'];

type SummaryData = {
  total_applications: number;
  stage_applied: number;
  stage_assessment: number;
  stage_interview: number;
  stage_offer: number;
  stage_rejected: number;
  stage_archived: number;
  response_rate: number | null;
  avg_response_days: number | null;
  open_tasks: number;
  stalled_count: number;
};

type StalledApp = {
  application_id: string;
  company: string | null;
  role_title: string | null;
  status?: string | null;
  days_stalled: number;
};

type WeeklyTrendRow = {
  week_start: string;
  replies: number;
};

type WeeklyApplicationsRow = {
  week_start: string;
  applications: number;
};

type PeakWeekSummary = {
  label: string;
  value: number;
};

// ============================================================================
// Main Screen
// ============================================================================

export default function InsightsScreen({ activeTab = 'insights', onNavigate, onOpenApplication, unreadCount = 0 }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [range, setRange] = useState('30D');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [stalledApps, setStalledApps] = useState<StalledApp[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrendRow[]>([]);
  const [weeklyApplications, setWeeklyApplications] = useState<WeeklyApplicationsRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);

  const rangeParams = useMemo(() => {
    const endAt = new Date();
    if (range === 'All') {
      return { startAt: new Date(2000, 0, 1).toISOString(), endAt: endAt.toISOString() };
    }
    const days = range === '7D' ? 7 : range === '90D' ? 90 : 30;
    const startAt = new Date(endAt.getTime() - days * 24 * 60 * 60 * 1000);
    return { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
  }, [range]);

  const rangeLabel = range === 'All' ? 'all time' : range === '7D' ? 'last 7 days' : range === '90D' ? 'last 90 days' : 'last 30 days';

  const fetchData = async (mounted = true) => {
    setLoading(true);
    setError(null);
    const [summaryRes, stalledRes, trendRes, appsTrendRes] = await Promise.all([
      supabase
        .rpc('get_insights_summary', { p_start_at: rangeParams.startAt, p_end_at: rangeParams.endAt })
        .single(),
      supabase.rpc('get_insights_stalled_apps', {
        p_start_at: rangeParams.startAt,
        p_end_at: rangeParams.endAt,
        p_limit: 5,
      }),
      supabase.rpc('get_insights_weekly_trend', {
        p_start_at: rangeParams.startAt,
        p_end_at: rangeParams.endAt,
      }),
      supabase.rpc('get_insights_weekly_applications', {
        p_start_at: rangeParams.startAt,
        p_end_at: rangeParams.endAt,
      }),
    ]);
    if (!mounted) return;
    if (summaryRes.error) {
      setError('Unable to load insights right now.');
      setSummary(null);
    } else {
      setSummary(summaryRes.data as SummaryData);
    }
    setStalledApps((stalledRes.data as StalledApp[]) ?? []);
    setWeeklyTrend((trendRes.data as WeeklyTrendRow[]) ?? []);
    setWeeklyApplications((appsTrendRes.data as WeeklyApplicationsRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    fetchData(mounted);
    return () => { mounted = false; };
  }, [rangeParams]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: loading ? 0.65 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [loading]);

  const handleCreateFollowUp = async (app: StalledApp) => {
    setCreatingTaskId(app.application_id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { setCreatingTaskId(null); return; }
    const { error: insertError } = await supabase.from('tasks').insert({
      user_id: user.id,
      application_id: app.application_id,
      title: `Follow up with ${app.company ?? 'recruiter'}`,
      status: 'open',
      origin: 'manual',
    });
    if (insertError) {
      Alert.alert('Could not create task', 'Unable to create a follow-up right now.');
    } else {
      await fetchData();
    }
    setCreatingTaskId(null);
  };

  const handleRefresh = async () => {
    lightImpact();
    setRefreshing(true);
    try { await fetchData(); } finally { setRefreshing(false); }
  };

  const weeklySeries = useMemo(() =>
    [...weeklyTrend]
      .sort((a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime())
      .slice(-12),
    [weeklyTrend]
  );

  const weeklyAppsSeries = useMemo(() =>
    [...weeklyApplications]
      .sort((a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime()),
    [weeklyApplications]
  );

  const bestAppsWeek = useMemo<PeakWeekSummary | null>(() => {
    if (!weeklyAppsSeries.length) return null;
    const best = weeklyAppsSeries.reduce((winner, week) => {
      if (week.applications > winner.applications) return week;
      if (week.applications === winner.applications && new Date(week.week_start).getTime() > new Date(winner.week_start).getTime()) {
        return week;
      }
      return winner;
    });
    return {
      label: formatWeekTooltipLabel(best.week_start),
      value: best.applications,
    };
  }, [weeklyAppsSeries]);

  const bestActivityWeek = useMemo<PeakWeekSummary | null>(() => {
    if (!weeklySeries.length) return null;
    const best = weeklySeries.reduce((winner, week) => {
      if (week.replies > winner.replies) return week;
      if (week.replies === winner.replies && new Date(week.week_start).getTime() > new Date(winner.week_start).getTime()) {
        return week;
      }
      return winner;
    });
    return {
      label: formatWeekTooltipLabel(best.week_start),
      value: best.replies,
    };
  }, [weeklySeries]);

  const recommendations = useMemo(() => {
    if (!summary) return [];
    const recs: Array<{
      icon: keyof typeof Ionicons.glyphMap;
      title: string;
      body: string;
      actionLabel?: string;
      action?: () => void;
    }> = [];

    if (summary.total_applications === 0) {
      recs.push({
        icon: 'briefcase-outline',
        title: 'Add your first application',
        body: 'Once you add applications, Basafy will start surfacing insights and follow-ups.',
        actionLabel: 'Open pipeline',
        action: () => onNavigate?.('applications'),
      });
      recs.push({
        icon: 'mail-outline',
        title: 'Connect Gmail for auto-tracking',
        body: 'Basafy can detect job-related emails and build your pipeline automatically.',
        actionLabel: 'Go to Profile',
        action: () => onNavigate?.('profile'),
      });
      return recs;
    }
    if (summary.stalled_count > 0) {
      recs.push({
        icon: 'alert-circle-outline',
        title: 'Follow up on ghosted applications',
        body: `${summary.stalled_count} application${summary.stalled_count > 1 ? 's' : ''} with 60+ days of no response or updates.`,
      });
    }
    if (summary.open_tasks > 0) {
      recs.push({
        icon: 'checkbox-outline',
        title: 'Clear your action items',
        body: `${summary.open_tasks} task${summary.open_tasks > 1 ? 's' : ''} waiting for action.`,
        actionLabel: 'Go to Home',
        action: () => onNavigate?.('home'),
      });
    }
    if (summary.response_rate != null && summary.response_rate < 0.2 && summary.total_applications >= 5) {
      recs.push({
        icon: 'trending-up-outline',
        title: 'Improve your response rate',
        body: 'Target roles that better match your profile to increase replies.',
      });
    }
    if (summary.stage_interview > 0 && summary.stage_offer === 0) {
      recs.push({
        icon: 'mic-outline',
        title: 'Prep for upcoming interviews',
        body: 'Review notes and set a prep task for each interview on your calendar.',
      });
    }
    if (recs.length === 0) {
      recs.push({
        icon: 'checkmark-circle-outline',
        title: 'You are on track',
        body: 'Keep the momentum going. Basafy will surface new insights as data grows.',
      });
    }
    return recs.slice(0, 3);
  }, [summary, onNavigate]);

  const total = summary?.total_applications ?? 0;
  const responseRate = total > 0 ? Math.round((summary?.response_rate ?? 0) * 100) : null;
  const interviewRate = total > 0 ? Math.round(((summary?.stage_interview ?? 0) / total) * 100) : null;
  const offerRate = total > 0 ? Math.round(((summary?.stage_offer ?? 0) / total) * 100) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.primary}
            colors={[palette.primary]}
            progressBackgroundColor={palette.card}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Insights</Text>
              <Text style={styles.subtitle}>Your job search, by the numbers.</Text>
            </View>
            <Ionicons name="analytics" size={22} color="#5AEFD5" />
          </View>
          <View style={styles.rangeRow}>
            {TIME_RANGES.map((item) => {
              const active = item === range;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.rangePill, active && styles.rangePillActive]}
                  activeOpacity={0.8}
                  onPress={() => setRange(item)}
                >
                  <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Hero stats ── */}
        {loading ? (
          <View style={styles.sectionCard}><InsightsOverviewSkeleton /></View>
        ) : error ? (
          <View style={styles.sectionCard}>
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>Couldn't load insights.</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => fetchData()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : total === 0 ? (
          <View style={styles.sectionCard}>
            <EmptyState
              icon="analytics-outline"
              title="No data yet"
              message="Connect Gmail or add applications to unlock insights."
            />
          </View>
        ) : (
          <View style={styles.heroRow}>
            <HeroStat value={String(summary?.stage_applied ?? 0)} label="Applied" color="#94A3B8" />
            <HeroStat value={responseRate != null ? `${responseRate}%` : '--'} label="Response" color="#4A8CFF" />
            <HeroStat value={interviewRate != null ? `${interviewRate}%` : '--'} label="Interview" color="#5AEFD5" />
            <HeroStat value={offerRate != null ? `${offerRate}%` : '--'} label="Offer" color="#F7C873" />
          </View>
        )}

        {/* ── Conversion funnel ── */}
        {!loading && !error && summary && total > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pipeline Breakdown</Text>
            <Text style={styles.sectionBody}>Current distribution by stage for {rangeLabel}.</Text>
            <FunnelChart summary={summary} />
          </View>
        ) : null}

        {/* ── Weekly applications momentum ── */}
        {!loading && !error && weeklyAppsSeries.length > 0 ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Weekly Applications</Text>
              <Text style={styles.sectionHintBlue}>
                {weeklyAppsSeries[weeklyAppsSeries.length - 1]?.applications ?? 0} this week
              </Text>
            </View>
            <Text style={styles.sectionBody}>New applications per week over {rangeLabel}.</Text>
            <WeeklyApplicationsChart data={weeklyAppsSeries} />
          </View>
        ) : null}

        {/* ── Weekly activity sparkline ── */}
        {!loading && !error && weeklySeries.length >= 2 ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Weekly Activity</Text>
              <Text style={styles.sectionHintGreen}>
                {weeklySeries[weeklySeries.length - 1]?.replies ?? 0} this week
              </Text>
            </View>
            <Text style={styles.sectionBody}>Interview and reply activity over {rangeLabel}.</Text>
            <SparklineChart data={weeklySeries} />
          </View>
        ) : null}

        {!loading && !error && (bestAppsWeek || bestActivityWeek) ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Peak Weeks</Text>
              <Text style={styles.sectionHintMuted}>{rangeLabel}</Text>
            </View>
            <Text style={styles.sectionBody}>Your strongest weeks in this selected period.</Text>
            <View style={styles.peakWeeksRow}>
              <View style={[styles.peakWeekCard, styles.peakWeekCardBlue]}>
                <View style={styles.peakWeekIconWrap}>
                  <Ionicons name="briefcase-outline" size={16} color="#85B0FF" />
                </View>
                <Text style={styles.peakWeekLabel}>Best apps week</Text>
                <Text style={styles.peakWeekValue}>{bestAppsWeek?.value ?? 0}</Text>
                <Text style={styles.peakWeekMeta}>{bestAppsWeek?.label ?? '--'}</Text>
              </View>
              <View style={[styles.peakWeekCard, styles.peakWeekCardGreen]}>
                <View style={styles.peakWeekIconWrap}>
                  <Ionicons name="pulse-outline" size={16} color="#84FFEB" />
                </View>
                <Text style={styles.peakWeekLabel}>Best activity week</Text>
                <Text style={styles.peakWeekValue}>{bestActivityWeek?.value ?? 0}</Text>
                <Text style={styles.peakWeekMeta}>{bestActivityWeek?.label ?? '--'}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Ghosted / stalled ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Ghosted Applications</Text>
          <Text style={styles.sectionBody}>Applications older than 60 days with no response or updates at all.</Text>
          {loading ? (
            <Text style={styles.sectionBody}>Loading…</Text>
          ) : stalledApps.length === 0 ? (
            <Text style={[styles.sectionBody, { color: '#5AEFD5' }]}>
              No ghosted applications right now. Keep it up.
            </Text>
          ) : (
            <View style={styles.stalledList}>
              {stalledApps.map((app) => (
                <View key={app.application_id} style={styles.stalledCard}>
                  <Pressable
                    style={styles.stalledContentPressable}
                    onPress={() =>
                      onOpenApplication?.({
                        id: app.application_id,
                        company: app.company,
                        role: app.role_title,
                        status: app.status ?? 'applied',
                        source_type: 'manual',
                      })
                    }
                    disabled={!onOpenApplication}
                  >
                    <View style={styles.stalledIcon}>
                      <Ionicons name="time-outline" size={16} color="#FF7B7B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stalledTitle}>{app.company ?? 'Unknown company'}</Text>
                      <Text style={styles.stalledSubtitle}>
                        {app.role_title ?? 'Unknown role'} · {app.days_stalled}d with no response
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="rgba(230,237,255,0.45)" />
                  </Pressable>
                  <TouchableOpacity
                    style={styles.followUpButton}
                    activeOpacity={0.85}
                    disabled={creatingTaskId === app.application_id}
                    onPress={() => handleCreateFollowUp(app)}
                  >
                    <Text style={styles.followUpButtonText}>
                      {creatingTaskId === app.application_id ? 'Adding…' : 'Follow up'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Recommendations ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          {loading ? (
            <Text style={styles.sectionBody}>Loading…</Text>
          ) : (
            <View style={styles.recoList}>
              {recommendations.map((rec, index) => (
                <View key={`${rec.title}-${index}`} style={styles.recoCard}>
                  <View style={styles.recoRow}>
                    <View style={styles.recoIcon}>
                      <Ionicons name={rec.icon} size={16} color="#F7C873" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recoTitle}>{rec.title}</Text>
                      <Text style={styles.recoText}>{rec.body}</Text>
                    </View>
                  </View>
                  {rec.actionLabel ? (
                    <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={rec.action}>
                      <Text style={styles.primaryButtonText}>{rec.actionLabel}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <FloatingNav activeTab={activeTab} onNavigate={onNavigate} bottomInset={insets.bottom} unreadCount={unreadCount} />
    </SafeAreaView>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function useStyles() {
  const { palette } = useTheme();
  return { styles: createStyles(palette), palette };
}

// ── HeroStat ──────────────────────────────────────────────────────────────────

const HeroStat = ({ value, label, color }: { value: string; label: string; color: string }) => {
  const { styles } = useStyles();
  return (
    <View style={[styles.heroCard, { borderTopColor: color }]}>
      <Text style={[styles.heroValue, { color }]}>{value}</Text>
      <Text style={styles.heroLabel}>{label}</Text>
    </View>
  );
};

// ── FunnelChart ───────────────────────────────────────────────────────────────

type FunnelStage = {
  label: string;
  getValue: (s: SummaryData) => number;
  solidColor: string;
  gradientColors: [string, string];
};

const FUNNEL_STAGES: FunnelStage[] = [
  {
    label: 'Applied',
    getValue: (s) => s.stage_applied ?? 0,
    solidColor: '#94A3B8',
    gradientColors: ['#94A3B8', '#64748B'],
  },
  {
    label: 'Assessment',
    getValue: (s) => s.stage_assessment ?? 0,
    solidColor: '#4A8CFF',
    gradientColors: ['#4A8CFF', '#2563EB'],
  },
  {
    label: 'Interview',
    getValue: (s) => s.stage_interview ?? 0,
    solidColor: '#5AEFD5',
    gradientColors: ['#5AEFD5', '#2DD4BF'],
  },
  {
    label: 'Offer',
    getValue: (s) => s.stage_offer ?? 0,
    solidColor: '#F7C873',
    gradientColors: ['#F7C873', '#F59E0B'],
  },
  {
    label: 'Rejected',
    getValue: (s) => s.stage_rejected ?? 0,
    solidColor: '#FF7B7B',
    gradientColors: ['#FF7B7B', '#F87171'],
  },
];

const FunnelChart = ({ summary }: { summary: SummaryData }) => {
  const { styles } = useStyles();
  const total = Math.max(summary.total_applications, 1);

  return (
    <View style={styles.funnelWrap}>
      {FUNNEL_STAGES.map((stage) => {
        const count = stage.getValue(summary);
        // Bar width is always relative to total_applications so bars narrow as they descend
        const barPct = count > 0 ? Math.max((count / total) * 100, 4) : 0;
        const pct = Math.round((count / total) * 100);

        return (
          <View key={stage.label} style={styles.funnelRow}>
            <View style={styles.funnelLabelWrap}>
              <View style={[styles.funnelDot, { backgroundColor: stage.solidColor }]} />
              <Text style={styles.funnelLabel}>{stage.label}</Text>
            </View>
            <View style={styles.funnelBarTrack}>
              {count > 0 ? (
                <LinearGradient
                  colors={stage.gradientColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.funnelBarFill, { width: `${barPct}%` }]}
                />
              ) : (
                <View style={styles.funnelBarEmpty} />
              )}
            </View>
            <View style={styles.funnelMeta}>
              <Text style={[styles.funnelCount, count > 0 ? { color: stage.solidColor } : styles.funnelCountZero]}>
                {count}
              </Text>
              {count > 0 ? (
                <Text style={styles.funnelPct}>{pct}%</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ── SparklineChart ────────────────────────────────────────────────────────────

const formatWeekLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const formatWeekTooltipLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getChartLabelIndices = (length: number, maxLabels = 5) => {
  if (length <= maxLabels) return Array.from({ length }, (_, i) => i);
  const step = Math.ceil(length / maxLabels);
  const indices: number[] = [];
  for (let i = 0; i < length; i += step) indices.push(i);
  if (indices[indices.length - 1] !== length - 1) indices.push(length - 1);
  return indices;
};

const getNearestChartPointIndex = <T extends { x: number }>(
  pts: T[],
  x: number,
  minX: number,
  maxX: number
) => {
  if (!pts.length) return null;
  const clamped = Math.max(minX, Math.min(x, maxX));
  let nearest = 0;
  let minDistance = Number.POSITIVE_INFINITY;
  pts.forEach((pt, idx) => {
    const distance = Math.abs(pt.x - clamped);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = idx;
    }
  });
  return nearest;
};

const ChartScrollIndicator = ({
  viewportWidth,
  contentWidth,
  scrollX,
  thumbColors,
  styles,
}: {
  viewportWidth: number;
  contentWidth: number;
  scrollX: number;
  thumbColors: [string, string];
  styles: ReturnType<typeof createStyles>;
}) => {
  if (viewportWidth <= 0 || contentWidth <= 0) return null;
  const trackWidth = viewportWidth;
  const visibleRatio = Math.min(1, viewportWidth / contentWidth);
  const thumbWidth = Math.max(trackWidth * visibleRatio, 32);
  const maxOffset = Math.max(contentWidth - viewportWidth, 1);
  const travel = Math.max(trackWidth - thumbWidth, 0);
  const thumbOffset = travel * Math.min(Math.max(scrollX / maxOffset, 0), 1);

  return (
    <View style={[styles.chartScrollbarTrack, { width: trackWidth }]}>
      <LinearGradient
        colors={thumbColors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[
          styles.chartScrollbarThumb,
          {
            width: thumbWidth,
            transform: [{ translateX: thumbOffset }],
            opacity: visibleRatio < 1 ? 0.95 : 0.45,
          },
        ]}
      >
        <View style={styles.chartScrollbarThumbShine} />
      </LinearGradient>
    </View>
  );
};

const SparklineChart = ({ data }: { data: WeeklyTrendRow[] }) => {
  const { styles } = useStyles();
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const PAD_H = 8;
  const PAD_V = 14;
  const CHART_H = 90;
  const SVG_H = CHART_H + PAD_V * 2;
  const POINT_GAP = 48;

  const maxVal = useMemo(() => Math.max(...data.map((d) => d.replies), 1), [data]);
  const n = data.length;
  const contentWidth = Math.max(viewportWidth, PAD_H * 2 + Math.max(0, n - 1) * POINT_GAP);

  const pts = useMemo(() => {
    if (!contentWidth || n === 0) return [];
    const w = contentWidth - PAD_H * 2;
    return data.map((d, i) => ({
      x: PAD_H + (n === 1 ? w / 2 : (i / (n - 1)) * w),
      y: PAD_V + CHART_H - (d.replies / maxVal) * CHART_H,
      value: d.replies,
      axisLabel: formatWeekLabel(d.week_start),
      tooltipLabel: formatWeekTooltipLabel(d.week_start),
    }));
  }, [contentWidth, data, maxVal, n]);

  // Smooth cubic bezier path through points
  const linePath = useMemo(() => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const cx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
      d += ` C ${cx},${pts[i - 1].y.toFixed(1)} ${cx},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
    }
    return d;
  }, [pts]);

  const areaPath = useMemo(() => {
    if (pts.length < 2) return '';
    const bottom = (PAD_V + CHART_H).toFixed(1);
    let d = `M ${pts[0].x.toFixed(1)},${bottom} L ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const cx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
      d += ` C ${cx},${pts[i - 1].y.toFixed(1)} ${cx},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
    }
    d += ` L ${pts[pts.length - 1].x.toFixed(1)},${bottom} Z`;
    return d;
  }, [pts]);

  // Pick at most 5 evenly-spaced labels to avoid crowding
  const labelIndices = useMemo(() => getChartLabelIndices(pts.length), [pts.length]);

  useEffect(() => {
    setActiveIdx((current) => {
      if (!pts.length) return null;
      if (current == null) return pts.length - 1;
      return Math.min(current, pts.length - 1);
    });
  }, [pts.length]);

  const activePt = activeIdx != null ? pts[activeIdx] : null;
  const handleDragTouch = (x: number) => {
    const next = getNearestChartPointIndex(pts, x, PAD_H, contentWidth - PAD_H);
    if (next != null) setActiveIdx(next);
  };
  const canStartDrag = (x: number, y: number) =>
    !!activePt && Math.abs(x - activePt.x) <= 26 && Math.abs(y - activePt.y) <= 26;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => canStartDrag(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onStartShouldSetPanResponderCapture: (e) => canStartDrag(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onMoveShouldSetPanResponder: (e) => canStartDrag(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onMoveShouldSetPanResponderCapture: (e) => canStartDrag(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onPanResponderGrant: (e) => {
          setDragging(true);
          handleDragTouch(e.nativeEvent.locationX);
        },
        onPanResponderMove: (e) => handleDragTouch(e.nativeEvent.locationX),
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
      }),
    [activePt, contentWidth, pts]
  );

  return (
    <View style={styles.sparkWrap} onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}>
      {viewportWidth > 0 && pts.length >= 2 ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!dragging}
            contentContainerStyle={{ paddingRight: 6 }}
            onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
          >
            <View style={{ width: contentWidth }} {...panResponder.panHandlers}>
              <Svg width={contentWidth} height={SVG_H}>
                <Defs>
                  <SvgGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#5AEFD5" stopOpacity="0.35" />
                    <Stop offset="0.6" stopColor="#5AEFD5" stopOpacity="0.08" />
                    <Stop offset="1" stopColor="#5AEFD5" stopOpacity="0" />
                  </SvgGradient>
                </Defs>
                {[0.2, 0.5, 0.8].map((stop, idx) => (
                  <Line
                    key={`spark-grid-${idx}`}
                    x1={PAD_H}
                    x2={contentWidth - PAD_H}
                    y1={PAD_V + CHART_H * stop}
                    y2={PAD_V + CHART_H * stop}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={1}
                    strokeDasharray="3 5"
                  />
                ))}
                <Path d={areaPath} fill="url(#areaGrad)" />
                <Path
                  d={linePath}
                  stroke="#5AEFD5"
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {pts.map((pt, idx) => (
                  <Circle
                    key={`spark-pt-${idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={idx === activeIdx ? 3.6 : 2.8}
                    fill={idx === activeIdx ? '#DFFFF8' : '#7BEEE0'}
                    opacity={idx === activeIdx ? 1 : 0.82}
                  />
                ))}
                {activePt ? (
                  <>
                    <Path
                      d={`M ${activePt.x} ${PAD_V} L ${activePt.x} ${PAD_V + CHART_H}`}
                      stroke={dragging ? 'rgba(90,239,213,0.42)' : 'rgba(90,239,213,0.26)'}
                      strokeWidth={dragging ? 1.4 : 1}
                    />
                    <Circle cx={activePt.x} cy={activePt.y} r={dragging ? 14 : 12} fill="#5AEFD5" opacity={0.1} />
                    <Circle cx={activePt.x} cy={activePt.y} r={dragging ? 9 : 8} fill="#5AEFD5" opacity={0.18} />
                    <Circle cx={activePt.x} cy={activePt.y} r={dragging ? 5.5 : 5} fill="#5AEFD5" />
                    <Circle cx={activePt.x} cy={activePt.y} r={2.5} fill="#F4FFFC" opacity={0.95} />
                    <Circle cx={activePt.x} cy={activePt.y} r={dragging ? 10 : 9} fill="none" stroke="rgba(244,255,252,0.34)" strokeWidth={1} />
                  </>
                ) : null}
              </Svg>
              {pts.map((pt, idx) => (
                <Pressable
                  key={`spark-touch-${idx}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Weekly activity for ${pt.tooltipLabel}: ${pt.value}`}
                  hitSlop={8}
                  onPress={() => setActiveIdx(idx)}
                  style={[
                    styles.chartPointTarget,
                    {
                      left: pt.x - 18,
                      top: pt.y - 18,
                    },
                  ]}
                />
              ))}
              {activePt ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.sparkTooltip,
                    {
                      left: Math.min(Math.max(activePt.x - 34, 6), contentWidth - 74),
                      top: 8,
                    },
                  ]}
                >
                  <View style={[styles.chartTooltipAccent, styles.sparkTooltipAccent]} />
                  <Text style={styles.sparkTooltipValue}>{activePt.value}</Text>
                  <Text style={styles.sparkTooltipLabel}>{activePt.tooltipLabel}</Text>
                </View>
              ) : null}
              <View style={[styles.sparkLabels, { width: contentWidth }]}>
                {labelIndices.map((idx) => {
                  const pt = pts[idx];
                  const isActive = idx === activeIdx;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.chartAxisLabelChip,
                        styles.sparkAxisLabelChip,
                        {
                          left: pt.x - 22,
                        },
                        isActive && styles.sparkAxisLabelChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chartAxisLabelText,
                          styles.sparkAxisLabelText,
                          isActive && styles.sparkAxisLabelTextActive,
                        ]}
                      >
                        {pt.axisLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
          <ChartScrollIndicator
            viewportWidth={viewportWidth}
            contentWidth={contentWidth}
            scrollX={scrollX}
            thumbColors={['rgba(132,255,235,0.95)', 'rgba(90,239,213,0.78)']}
            styles={styles}
          />
        </>
      ) : null}
    </View>
  );
};

// ── WeeklyApplicationsChart ───────────────────────────────────────────────────

const WeeklyApplicationsChart = ({ data }: { data: WeeklyApplicationsRow[] }) => {
  const { styles } = useStyles();
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const maxVal = useMemo(() => Math.max(...data.map((d) => d.applications), 1), [data]);

  const PAD_H = 12;
  const PAD_V = 16;
  const CHART_H = 120;
  const SVG_H = CHART_H + PAD_V * 2;
  const POINT_GAP = 44;
  const n = data.length;
  const contentWidth = Math.max(viewportWidth, PAD_H * 2 + Math.max(0, n - 1) * POINT_GAP);

  const pts = useMemo(() => {
    if (!contentWidth || n === 0) return [];
    const w = contentWidth - PAD_H * 2;
    return data.map((d, i) => ({
      x: PAD_H + (n === 1 ? w / 2 : (i / (n - 1)) * w),
      y: PAD_V + CHART_H - (d.applications / maxVal) * CHART_H,
      value: d.applications,
      axisLabel: formatWeekLabel(d.week_start),
      tooltipLabel: formatWeekTooltipLabel(d.week_start),
      iso: d.week_start,
    }));
  }, [contentWidth, data, maxVal, n]);

  const linePath = useMemo(() => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const cx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
      d += ` C ${cx},${pts[i - 1].y.toFixed(1)} ${cx},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
    }
    return d;
  }, [pts]);

  const areaPath = useMemo(() => {
    if (pts.length < 2) return '';
    const bottom = (PAD_V + CHART_H).toFixed(1);
    let d = `M ${pts[0].x.toFixed(1)},${bottom} L ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const cx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
      d += ` C ${cx},${pts[i - 1].y.toFixed(1)} ${cx},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
    }
    d += ` L ${pts[pts.length - 1].x.toFixed(1)},${bottom} Z`;
    return d;
  }, [pts]);

  const labelIndices = useMemo(() => getChartLabelIndices(pts.length), [pts.length]);

  useEffect(() => {
    setActiveIdx((current) => {
      if (!pts.length) return null;
      if (current == null) return pts.length - 1;
      return Math.min(current, pts.length - 1);
    });
  }, [pts.length]);

  const activePt = activeIdx != null ? pts[activeIdx] : null;
  const handleDragTouch = (x: number) => {
    const next = getNearestChartPointIndex(pts, x, PAD_H, contentWidth - PAD_H);
    if (next != null) setActiveIdx(next);
  };
  const canStartDrag = (x: number, y: number) =>
    !!activePt && Math.abs(x - activePt.x) <= 26 && Math.abs(y - activePt.y) <= 26;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => canStartDrag(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onStartShouldSetPanResponderCapture: (e) => canStartDrag(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onMoveShouldSetPanResponder: (e) => canStartDrag(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onMoveShouldSetPanResponderCapture: (e) => canStartDrag(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onPanResponderGrant: (e) => {
          setDragging(true);
          handleDragTouch(e.nativeEvent.locationX);
        },
        onPanResponderMove: (e) => handleDragTouch(e.nativeEvent.locationX),
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false),
      }),
    [activePt, contentWidth, pts]
  );

  return (
    <View
      style={styles.weeklyAppsChartWrap}
      onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!dragging}
        contentContainerStyle={{ paddingRight: 6 }}
        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
      >
        <View style={{ width: contentWidth }} {...panResponder.panHandlers}>
          {contentWidth > 0 && pts.length >= 2 ? (
            <>
              <Svg width={contentWidth} height={SVG_H}>
                <Defs>
                  <SvgGradient id="appsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#4A8CFF" stopOpacity="0.35" />
                    <Stop offset="0.65" stopColor="#4A8CFF" stopOpacity="0.08" />
                    <Stop offset="1" stopColor="#4A8CFF" stopOpacity="0" />
                  </SvgGradient>
                </Defs>
                {[0.18, 0.48, 0.78].map((stop, idx) => (
                  <Line
                    key={`apps-grid-${idx}`}
                    x1={PAD_H}
                    x2={contentWidth - PAD_H}
                    y1={PAD_V + CHART_H * stop}
                    y2={PAD_V + CHART_H * stop}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={1}
                    strokeDasharray="3 5"
                  />
                ))}
                <Path d={areaPath} fill="url(#appsAreaGrad)" />
                <Path
                  d={linePath}
                  stroke="#4A8CFF"
                  strokeWidth={2.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {pts.map((pt, idx) => (
                  <Circle
                    key={`pt-${idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={3}
                    fill="#4A8CFF"
                    opacity={0.9}
                  />
                ))}
                {activePt ? (
                  <>
                    <Path
                      d={`M ${activePt.x} ${PAD_V} L ${activePt.x} ${PAD_V + CHART_H}`}
                      stroke={dragging ? 'rgba(74,140,255,0.52)' : 'rgba(74,140,255,0.34)'}
                      strokeWidth={dragging ? 1.4 : 1}
                    />
                    <Circle cx={activePt.x} cy={activePt.y} r={dragging ? 14 : 12} fill="#4A8CFF" opacity={0.1} />
                    <Circle cx={activePt.x} cy={activePt.y} r={dragging ? 9 : 8} fill="#4A8CFF" opacity={0.2} />
                    <Circle cx={activePt.x} cy={activePt.y} r={dragging ? 5.5 : 5} fill="#4A8CFF" />
                    <Circle cx={activePt.x} cy={activePt.y} r={2.5} fill="#F7FBFF" opacity={0.96} />
                    <Circle cx={activePt.x} cy={activePt.y} r={dragging ? 10 : 9} fill="none" stroke="rgba(247,251,255,0.34)" strokeWidth={1} />
                  </>
                ) : null}
              </Svg>
              {pts.map((pt, idx) => (
                <Pressable
                  key={`apps-touch-${idx}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Weekly applications for ${pt.tooltipLabel}: ${pt.value}`}
                  hitSlop={10}
                  onPress={() => setActiveIdx(idx)}
                  style={[
                    styles.chartPointTarget,
                    {
                      left: pt.x - 18,
                      top: pt.y - 18,
                    },
                  ]}
                />
              ))}
              <View style={[styles.weeklyAppsLabels, { width: contentWidth }]}>
                {labelIndices.map((idx) => {
                  const pt = pts[idx];
                  const isActive = idx === activeIdx;
                  return (
                    <View
                      key={`lbl-${idx}`}
                      style={[
                        styles.chartAxisLabelChip,
                        styles.weeklyAppsAxisLabelChip,
                        {
                          left: pt.x - 22,
                        },
                        isActive && styles.weeklyAppsAxisLabelChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chartAxisLabelText,
                          styles.weeklyAppsAxisLabelText,
                          isActive && styles.weeklyAppsAxisLabelTextActive,
                        ]}
                      >
                        {pt.axisLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {activePt ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.weeklyAppsTooltip,
                    {
                      left: Math.min(Math.max(activePt.x - 34, 6), contentWidth - 74),
                      top: 8,
                    },
                  ]}
                >
                  <View style={[styles.chartTooltipAccent, styles.weeklyAppsTooltipAccent]} />
                  <Text style={styles.weeklyAppsTooltipValue}>{activePt.value}</Text>
                  <Text style={styles.weeklyAppsTooltipLabel}>{activePt.tooltipLabel}</Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
      <ChartScrollIndicator
        viewportWidth={viewportWidth}
        contentWidth={contentWidth}
        scrollX={scrollX}
        thumbColors={['rgba(133,176,255,0.98)', 'rgba(74,140,255,0.8)']}
        styles={styles}
      />
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: palette.background,
    },
    scrollContent: {
      padding: 18,
      paddingBottom: 120,
      gap: 14,
    },

    // Header
    headerCard: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 26,
      padding: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      gap: 14,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      color: palette.text,
      fontSize: 26,
      fontWeight: '800',
    },
    subtitle: {
      color: palette.muted,
      marginTop: 4,
      fontSize: 13,
    },
    rangeRow: {
      flexDirection: 'row',
      gap: 8,
    },
    rangePill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    rangePillActive: {
      backgroundColor: 'rgba(74,140,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(74,140,255,0.45)',
    },
    rangeText: {
      color: '#8EA2C3',
      fontWeight: '700',
      fontSize: 13,
    },
    rangeTextActive: {
      color: '#E4EDFF',
    },

    // Hero stat cards
    heroRow: {
      flexDirection: 'row',
      gap: 10,
    },
    heroCard: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.07)',
      borderTopWidth: 3,
      alignItems: 'center',
      gap: 5,
    },
    heroValue: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    heroLabel: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Section card
    sectionCard: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      gap: 10,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      color: palette.text,
      fontSize: 17,
      fontWeight: '700',
    },
    sectionHintGreen: {
      color: '#5AEFD5',
      fontSize: 13,
      fontWeight: '700',
    },
    sectionHintBlue: {
      color: '#4A8CFF',
      fontSize: 13,
      fontWeight: '700',
    },
    sectionHintMuted: {
      color: 'rgba(228,237,255,0.62)',
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    sectionBody: {
      color: palette.muted,
      fontSize: 13,
      lineHeight: 19,
    },
    peakWeeksRow: {
      flexDirection: 'row',
      gap: 10,
    },
    peakWeekCard: {
      flex: 1,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      overflow: 'hidden',
    },
    peakWeekCardBlue: {
      backgroundColor: 'rgba(74,140,255,0.09)',
      borderColor: 'rgba(74,140,255,0.18)',
    },
    peakWeekCardGreen: {
      backgroundColor: 'rgba(90,239,213,0.08)',
      borderColor: 'rgba(90,239,213,0.16)',
    },
    peakWeekIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    peakWeekLabel: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    peakWeekValue: {
      color: palette.text,
      fontSize: 24,
      fontWeight: '800',
      marginTop: 8,
    },
    peakWeekMeta: {
      color: 'rgba(228,237,255,0.7)',
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },

    // Error
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    errorText: {
      color: '#FF7B7B',
      fontSize: 13,
    },
    retryButton: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    retryButtonText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
    },

    // Funnel
    funnelWrap: {
      gap: 11,
      marginTop: 4,
    },
    funnelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    funnelLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      width: 90,
    },
    funnelDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    funnelLabel: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    funnelBarTrack: {
      flex: 1,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.05)',
      overflow: 'hidden',
    },
    funnelBarFill: {
      height: 22,
      borderRadius: 11,
    },
    funnelBarEmpty: {
      height: 22,
      width: '4%',
      borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    funnelMeta: {
      width: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 5,
    },
    funnelCount: {
      fontSize: 14,
      fontWeight: '800',
    },
    funnelCountZero: {
      color: 'rgba(255,255,255,0.2)',
    },
    funnelPct: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '500',
    },

    // Sparkline
    sparkWrap: {
      marginTop: 4,
    },
    sparkLabels: {
      height: 30,
      position: 'relative',
      marginTop: 6,
    },
    sparkLabel: {
      color: palette.muted,
      fontSize: 10,
      fontWeight: '500',
    },
    sparkTooltip: {
      position: 'absolute',
      paddingHorizontal: 9,
      paddingTop: 9,
      paddingBottom: 7,
      borderRadius: 12,
      backgroundColor: 'rgba(10,18,33,0.92)',
      borderWidth: 1,
      borderColor: 'rgba(90,239,213,0.3)',
      alignItems: 'center',
      width: 68,
      shadowColor: '#5AEFD5',
      shadowOpacity: 0.18,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    sparkTooltipValue: {
      color: '#E7FFF8',
      fontSize: 13,
      fontWeight: '800',
    },
    sparkTooltipLabel: {
      color: '#9ADFD2',
      fontSize: 9,
      fontWeight: '600',
      marginTop: 1,
    },
    chartPointTarget: {
      position: 'absolute',
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'transparent',
    },
    chartAxisLabelChip: {
      position: 'absolute',
      top: 0,
      width: 44,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      shadowColor: '#000000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    chartAxisLabelText: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    sparkAxisLabelChip: {
      backgroundColor: 'rgba(90,239,213,0.06)',
      borderColor: 'rgba(90,239,213,0.12)',
    },
    sparkAxisLabelChipActive: {
      backgroundColor: 'rgba(90,239,213,0.17)',
      borderColor: 'rgba(90,239,213,0.28)',
      shadowColor: '#5AEFD5',
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    sparkAxisLabelText: {
      color: '#7FD9CB',
    },
    sparkAxisLabelTextActive: {
      color: '#E7FFF8',
    },
    chartScrollbarTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.05)',
      overflow: 'hidden',
      marginTop: 10,
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.04)',
    },
    chartScrollbarThumb: {
      height: '100%',
      borderRadius: 999,
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    chartScrollbarThumbShine: {
      height: 2,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.4)',
      opacity: 0.75,
    },
    chartTooltipAccent: {
      width: 22,
      height: 3,
      borderRadius: 999,
      marginBottom: 6,
    },
    sparkTooltipAccent: {
      backgroundColor: 'rgba(90,239,213,0.8)',
    },

    // Weekly applications chart
    weeklyAppsChartWrap: {
      marginTop: 6,
      position: 'relative',
    },
    weeklyAppsLabels: {
      height: 30,
      position: 'relative',
      marginTop: 6,
    },
    weeklyAppsLabel: {
      color: palette.muted,
      fontSize: 10,
      fontWeight: '500',
    },
    weeklyAppsTooltip: {
      position: 'absolute',
      paddingHorizontal: 9,
      paddingTop: 9,
      paddingBottom: 7,
      borderRadius: 12,
      backgroundColor: 'rgba(10,18,33,0.92)',
      borderWidth: 1,
      borderColor: 'rgba(74,140,255,0.34)',
      alignItems: 'center',
      width: 68,
      shadowColor: '#4A8CFF',
      shadowOpacity: 0.2,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    weeklyAppsTooltipValue: {
      color: '#E4EDFF',
      fontSize: 13,
      fontWeight: '800',
    },
    weeklyAppsTooltipLabel: {
      color: '#8EA2C3',
      fontSize: 9,
      fontWeight: '600',
      marginTop: 1,
    },
    weeklyAppsAxisLabelChip: {
      backgroundColor: 'rgba(74,140,255,0.07)',
      borderColor: 'rgba(74,140,255,0.14)',
    },
    weeklyAppsAxisLabelChipActive: {
      backgroundColor: 'rgba(74,140,255,0.18)',
      borderColor: 'rgba(74,140,255,0.28)',
      shadowColor: '#4A8CFF',
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    weeklyAppsAxisLabelText: {
      color: '#90B5FF',
    },
    weeklyAppsAxisLabelTextActive: {
      color: '#E4EDFF',
    },
    weeklyAppsTooltipAccent: {
      backgroundColor: 'rgba(133,176,255,0.82)',
    },

    // Stalled apps
    stalledList: {
      gap: 10,
    },
    stalledCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: 'rgba(255,123,123,0.06)',
      borderRadius: 16,
      padding: 13,
      borderWidth: 1,
      borderColor: 'rgba(255,123,123,0.14)',
    },
    stalledContentPressable: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    stalledIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: 'rgba(255,123,123,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stalledTitle: {
      color: palette.text,
      fontWeight: '700',
      fontSize: 14,
    },
    stalledSubtitle: {
      color: palette.muted,
      fontSize: 12,
      marginTop: 2,
    },
    followUpButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    followUpButtonText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: '700',
    },

    // Recommendations
    recoList: {
      gap: 10,
    },
    recoCard: {
      backgroundColor: 'rgba(255,255,255,0.025)',
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
      gap: 10,
    },
    recoRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    recoIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: 'rgba(247,200,115,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    recoTitle: {
      color: palette.text,
      fontWeight: '700',
      fontSize: 14,
      marginBottom: 3,
    },
    recoText: {
      color: palette.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    primaryButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: '#4A8CFF',
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
  });
