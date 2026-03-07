import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Alert,
  Animated,
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
  days_stalled: number;
};

type WeeklyTrendRow = {
  week_start: string;
  replies: number;
};

// ============================================================================
// Main Screen
// ============================================================================

export default function InsightsScreen({ activeTab = 'insights', onNavigate, unreadCount = 0 }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [range, setRange] = useState('30D');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [stalledApps, setStalledApps] = useState<StalledApp[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrendRow[]>([]);
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
    const [summaryRes, stalledRes, trendRes] = await Promise.all([
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
        body: `${summary.stalled_count} application${summary.stalled_count > 1 ? 's' : ''} with no activity in 14+ days.`,
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
            <HeroStat value={String(total)} label="Applied" color="#94A3B8" />
            <HeroStat value={responseRate != null ? `${responseRate}%` : '--'} label="Response" color="#4A8CFF" />
            <HeroStat value={interviewRate != null ? `${interviewRate}%` : '--'} label="Interview" color="#5AEFD5" />
            <HeroStat value={offerRate != null ? `${offerRate}%` : '--'} label="Offer" color="#F7C873" />
          </View>
        )}

        {/* ── Conversion funnel ── */}
        {!loading && !error && summary && total > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Conversion Funnel</Text>
            <Text style={styles.sectionBody}>Where your applications end up, as a share of total.</Text>
            <FunnelChart summary={summary} />
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

        {/* ── Ghosted / stalled ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Ghosted Applications</Text>
          <Text style={styles.sectionBody}>No activity in 14+ days. A follow-up can revive momentum.</Text>
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
                  <View style={styles.stalledIcon}>
                    <Ionicons name="time-outline" size={16} color="#FF7B7B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stalledTitle}>{app.company ?? 'Unknown company'}</Text>
                    <Text style={styles.stalledSubtitle}>
                      {app.role_title ?? 'Unknown role'} · {app.days_stalled}d stalled
                    </Text>
                  </View>
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
  key: keyof SummaryData;
  label: string;
  solidColor: string;
  gradientColors: [string, string];
};

const FUNNEL_STAGES: FunnelStage[] = [
  {
    key: 'stage_applied',
    label: 'Applied',
    solidColor: '#94A3B8',
    gradientColors: ['#94A3B8', '#64748B'],
  },
  {
    key: 'stage_assessment',
    label: 'Assessment',
    solidColor: '#5AEFD5',
    gradientColors: ['#5AEFD5', '#2DD4BF'],
  },
  {
    key: 'stage_interview',
    label: 'Interview',
    solidColor: '#4A8CFF',
    gradientColors: ['#4A8CFF', '#2563EB'],
  },
  {
    key: 'stage_offer',
    label: 'Offer',
    solidColor: '#F7C873',
    gradientColors: ['#F7C873', '#F59E0B'],
  },
  {
    key: 'stage_rejected',
    label: 'Rejected',
    solidColor: '#FF7B7B',
    gradientColors: ['#FF7B7B', '#EF4444'],
  },
];

const FunnelChart = ({ summary }: { summary: SummaryData }) => {
  const { styles } = useStyles();
  const total = Math.max(summary.total_applications, 1);

  return (
    <View style={styles.funnelWrap}>
      {FUNNEL_STAGES.map((stage) => {
        const count = (summary[stage.key] as number) ?? 0;
        const pct = Math.round((count / total) * 100);
        // Minimum visual bar width of 4% so 0-count rows are clearly empty
        const barPct = count > 0 ? Math.max(pct, 4) : 0;

        return (
          <View key={stage.key} style={styles.funnelRow}>
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

const SparklineChart = ({ data }: { data: WeeklyTrendRow[] }) => {
  const { styles, palette } = useStyles();
  const [containerWidth, setContainerWidth] = useState(0);

  const PAD_H = 8;
  const PAD_V = 14;
  const CHART_H = 90;
  const SVG_H = CHART_H + PAD_V * 2;

  const maxVal = useMemo(() => Math.max(...data.map((d) => d.replies), 1), [data]);
  const n = data.length;

  const pts = useMemo(() => {
    if (!containerWidth || n === 0) return [];
    const w = containerWidth - PAD_H * 2;
    return data.map((d, i) => ({
      x: PAD_H + (n === 1 ? w / 2 : (i / (n - 1)) * w),
      y: PAD_V + CHART_H - (d.replies / maxVal) * CHART_H,
      value: d.replies,
      label: formatWeekLabel(d.week_start),
    }));
  }, [containerWidth, data, maxVal, n]);

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
  const labelIndices = useMemo(() => {
    if (pts.length <= 5) return pts.map((_, i) => i);
    const step = Math.ceil(pts.length / 5);
    const indices: number[] = [];
    for (let i = 0; i < pts.length; i += step) indices.push(i);
    if (indices[indices.length - 1] !== pts.length - 1) indices.push(pts.length - 1);
    return indices;
  }, [pts]);

  const lastPt = pts[pts.length - 1];

  return (
    <View style={styles.sparkWrap} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {containerWidth > 0 && pts.length >= 2 ? (
        <>
          <Svg width={containerWidth} height={SVG_H}>
            <Defs>
              <SvgGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#5AEFD5" stopOpacity="0.35" />
                <Stop offset="0.6" stopColor="#5AEFD5" stopOpacity="0.08" />
                <Stop offset="1" stopColor="#5AEFD5" stopOpacity="0" />
              </SvgGradient>
            </Defs>
            {/* Area fill */}
            <Path d={areaPath} fill="url(#areaGrad)" />
            {/* Line */}
            <Path
              d={linePath}
              stroke="#5AEFD5"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Latest point pulse */}
            {lastPt ? (
              <>
                <Circle cx={lastPt.x} cy={lastPt.y} r={8} fill="#5AEFD5" opacity={0.15} />
                <Circle cx={lastPt.x} cy={lastPt.y} r={4.5} fill="#5AEFD5" />
                <Circle cx={lastPt.x} cy={lastPt.y} r={2.5} fill="#0F1628" />
              </>
            ) : null}
          </Svg>
          {/* Week labels below the SVG */}
          <View style={[styles.sparkLabels, { width: containerWidth }]}>
            {labelIndices.map((idx) => {
              const pt = pts[idx];
              return (
                <Text
                  key={idx}
                  style={[
                    styles.sparkLabel,
                    {
                      position: 'absolute',
                      left: pt.x - 16,
                      width: 32,
                      textAlign: 'center',
                    },
                  ]}
                >
                  {pt.label}
                </Text>
              );
            })}
          </View>
        </>
      ) : null}
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
    sectionBody: {
      color: palette.muted,
      fontSize: 13,
      lineHeight: 19,
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
      height: 20,
      position: 'relative',
      marginTop: 4,
    },
    sparkLabel: {
      color: palette.muted,
      fontSize: 10,
      fontWeight: '500',
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
