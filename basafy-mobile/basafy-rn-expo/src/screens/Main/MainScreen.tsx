import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloatingNav from '../../components/main/FloatingNav';
import { ActivityIndicator, Animated, Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@backend/supabase/client';
import { palette } from '../../theme/palette';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
};

export default function MainScreen({ activeTab = 'home', onNavigate }: Props) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [metricsData, setMetricsData] = useState({
    total_active_applications: 0,
    interviews_next_7_days: 0,
    open_tasks: 0,
    success_rate: 0,
    avg_response_days: null as number | null,
  });
  const [upcoming, setUpcoming] = useState<
    Array<{
      id: string;
      title: string | null;
      event_type: string;
      company: string | null;
      role_title: string | null;
      provider: string | null;
      meeting_link: string | null;
      start_at: string;
      source_type: string | null;
    }>
  >([]);
  const [tasks, setTasks] = useState<
    Array<{
      id: string;
      title: string;
      due_at: string | null;
      status: string;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    const loadUserName = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.warn('Failed to fetch user data:', error.message);
          return;
        }
        const user = data.user;
        const identity = user?.identities?.[0]?.identity_data as { full_name?: string; name?: string } | undefined;
        const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || identity?.full_name || identity?.name;
        if (fullName) {
          setUserName(fullName);
        }
      } catch (err) {
        console.warn('Error loading user name:', err);
      }
    };
    loadUserName();
  }, []);

  const loadHomeData = async () => {
      setLoading(true);
      setError(null);
      const [metricsResult, upcomingResult, tasksResult] = await Promise.all([
        supabase.from('v_home_metrics').select('*').maybeSingle(),
        supabase.from('v_home_upcoming_events').select('*').order('start_at', { ascending: true }).limit(5),
        supabase
          .from('tasks')
          .select('id,title,due_at,status')
          .eq('status', 'open')
          .order('due_at', { ascending: true, nullsFirst: false }),
      ]);
      if (!mountedRef.current) return;
      if (metricsResult.error || upcomingResult.error || tasksResult.error) {
        setError('Unable to load your dashboard.');
      }
      if (!metricsResult.error && metricsResult.data) {
        setMetricsData({
          total_active_applications: metricsResult.data.total_active_applications ?? 0,
          interviews_next_7_days: metricsResult.data.interviews_next_7_days ?? 0,
          open_tasks: metricsResult.data.open_tasks ?? 0,
          success_rate: metricsResult.data.success_rate ?? 0,
          avg_response_days: metricsResult.data.avg_response_days ?? null,
        });
      }
      if (!upcomingResult.error && Array.isArray(upcomingResult.data)) {
        setUpcoming(
          upcomingResult.data.map((item: any) => ({
            id: item.id,
            title: item.title ?? null,
            event_type: item.event_type ?? 'event',
            company: item.company ?? null,
            role_title: item.role_title ?? null,
            provider: item.provider ?? null,
            meeting_link: item.meeting_link ?? null,
            start_at: item.start_at,
            source_type: item.source_type ?? null,
          }))
        );
      } else {
        setUpcoming([]);
      }
      if (!tasksResult.error && Array.isArray(tasksResult.data)) {
        setTasks(
          tasksResult.data.map((item: any) => ({
            id: item.id,
            title: item.title,
            due_at: item.due_at ?? null,
            status: item.status,
          }))
        );
      } else {
        setTasks([]);
      }
      setLoading(false);
    };
  useEffect(() => {
    mountedRef.current = true;
    loadHomeData();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: loading ? 0 : 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, loading]);

  const summaryStats = useMemo(
    () => [
      { label: 'Applications Active', value: metricsData.total_active_applications, icon: 'briefcase-outline', accent: '#4A8CFF' },
      { label: 'Interviews This Week', value: metricsData.interviews_next_7_days, icon: 'calendar-outline', accent: '#5AEFD5' },
      { label: 'Pending Actions', value: metricsData.open_tasks, icon: 'alert-circle-outline', accent: '#F59E0B' },
    ],
    [metricsData]
  );

  const metrics = useMemo(
    () => [
      { label: 'Success Rate', value: `${Math.round((metricsData.success_rate || 0) * 100)}%`, icon: 'trending-up-outline' },
      {
        label: 'Avg Response',
        value: metricsData.avg_response_days ? `${metricsData.avg_response_days.toFixed(1)} days` : '--',
        icon: 'time-outline',
      },
    ],
    [metricsData]
  );

  const toggleTaskStatus = async (taskId: string, nextStatus: string) => {
    setTogglingTaskId(taskId);
    const { error } = await supabase.from('tasks').update({ status: nextStatus }).eq('id', taskId);
    if (!error) {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task))
      );
    }
    setTogglingTaskId(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.loadingText}>Loading your dashboard…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={() => loadHomeData()}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          style={{ opacity: fadeAnim }}
        >
          <GreetingCard userName={userName} />
          <MetricsStack summaryStats={summaryStats} />
          <MetricsRow metrics={metrics} />
          <InsightsPreview onPress={() => onNavigate?.('insights')} />
          <UpcomingSection upcoming={upcoming} />
          <TasksSection tasks={tasks} onToggle={toggleTaskStatus} togglingTaskId={togglingTaskId} />
        </Animated.ScrollView>
      )}
      <FloatingNav activeTab={activeTab} onNavigate={onNavigate} bottomInset={insets.bottom} />
    </SafeAreaView>
  );
}

const GreetingCard = ({ userName }: { userName?: string }) => {
  const displayName = userName || 'there';
  return (
    <LinearGradient colors={['rgba(74,140,255,0.18)', 'rgba(15,22,40,0.1)']} style={styles.glassCard}>
      <View style={styles.greetingRow}>
        <Ionicons name="sparkles" size={20} color="#5AEFD5" />
        <Text style={styles.greetingLabel}>Good afternoon</Text>
      </View>
      <Text style={styles.greetingTitle}>Hi {displayName} 👋</Text>
      <Text style={styles.greetingSubtitle}>Here&apos;s your job search at a glance.</Text>
    </LinearGradient>
  );
};

const MetricsStack = ({ summaryStats }: { summaryStats: Array<{ label: string; value: number; icon: string; accent: string }> }) => (
  <View style={[styles.glassCard, { gap: 12 }]}>
    {summaryStats.map((item) => (
      <View key={item.label} style={styles.metricStackCard}>
        <View style={styles.metricStackIcon}>
          <Ionicons name={item.icon as any} size={18} color={item.accent} />
        </View>
        <View style={styles.metricStackText}>
          <Text style={styles.metricStackLabel}>{item.label}</Text>
          <Text style={styles.metricStackValue}>{item.value}</Text>
        </View>
      </View>
    ))}
  </View>
);

const MetricsRow = ({ metrics }: { metrics: Array<{ label: string; value: string; icon: string }> }) => (
  <View style={styles.metricRow}>
    {metrics.map((item) => (
      <View key={item.label} style={styles.metricCard}>
        <View style={styles.metricIcon}>
          <Ionicons name={item.icon as any} size={16} color="#9CC6FF" />
        </View>
        <Text style={styles.metricLabel}>{item.label}</Text>
        <Text style={styles.metricValue}>{item.value}</Text>
      </View>
    ))}
  </View>
);

const InsightsPreview = ({ onPress }: { onPress?: () => void }) => (
  <View style={styles.glassCard}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="analytics-outline" size={16} color="#9CC6FF" />
        <Text style={styles.sectionTitle}>Insights</Text>
      </View>
    </View>
    <TouchableOpacity style={styles.insightsCallToAction} activeOpacity={0.85} onPress={onPress}>
      <Ionicons name="bar-chart-outline" size={24} color="#9CC6FF" />
      <Text style={styles.insightsCallToActionText}>View detailed analytics and trends</Text>
      <Ionicons name="arrow-forward" size={18} color="#9CC6FF" />
    </TouchableOpacity>
  </View>
);

const UpcomingSection = ({
  upcoming,
}: {
  upcoming: Array<{
    id: string;
    title: string | null;
    event_type: string;
    company: string | null;
    role_title: string | null;
    provider: string | null;
    meeting_link: string | null;
    start_at: string;
    source_type: string | null;
  }>;
}) => (
  <View style={styles.glassCard}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="calendar-outline" size={16} color="#9CC6FF" />
        <Text style={styles.sectionTitle}>Coming Up</Text>
      </View>
    </View>
    {upcoming.length === 0 ? (
      <Text style={styles.emptyText}>
        No upcoming interviews yet. We will pull them in as soon as recruiters email you.
      </Text>
    ) : (
      upcoming.map((item) => (
        <View key={item.id} style={styles.eventCard}>
          <LinearGradient colors={['#4A8CFF', '#5AEFD5']} style={styles.eventBorder} />
          <View style={styles.eventHeader}>
            <Text style={styles.eventCompany}>{item.company || item.title || 'Upcoming event'}</Text>
            <View style={styles.eventIcon}>
              <Ionicons name="videocam-outline" size={16} color="#BFD7FF" />
            </View>
          </View>
          <Text style={styles.eventRole}>
            {item.role_title || formatEventType(item.event_type)}
          </Text>
          <View style={styles.eventMetaRow}>
            <EventMeta icon="calendar-outline" text={formatEventDate(item.start_at)} />
            <EventMeta icon="time-outline" text={formatEventTime(item.start_at)} />
          </View>
          <Text style={styles.eventPlatform}>
            Platform: {item.provider ? formatProvider(item.provider) : 'TBD'}
          </Text>
          {item.source_type === 'gmail' && <Text style={styles.fromEmailLabel}>From email</Text>}
          <View style={styles.eventActions}>
            <ScalePressable style={styles.primaryChip} onPress={() => handleJoin(item.meeting_link)}>
              <Text style={styles.primaryChipText}>Join</Text>
            </ScalePressable>
            <ScalePressable style={styles.secondaryChip}>
              <Text style={styles.secondaryChipText}>Prepare</Text>
            </ScalePressable>
          </View>
        </View>
      ))
    )}
  </View>
);

const EventMeta = ({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) => (
  <View style={styles.eventMeta}>
    <Ionicons name={icon} size={14} color="#A3B0C0" />
    <Text style={styles.eventMetaText}>{text}</Text>
  </View>
);

const ScalePressable = ({
  children,
  style,
  onPress,
  disabled,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  disabled?: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
};

const formatEventType = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatProvider = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatEventDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleDateString();
};

const formatEventTime = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '--'
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const handleJoin = async (meetingLink: string | null) => {
  if (!meetingLink) return;
  try {
    await Linking.openURL(meetingLink);
  } catch {
    // ignore for now
  }
};

const formatDueLabel = (iso: string | null) => {
  if (!iso) return 'No due date';
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return 'No due date';
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays} days`;
};

const isOverdue = (iso: string | null) => {
  if (!iso) return false;
  const due = new Date(iso);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
};

const TasksSection = ({
  tasks,
  onToggle,
  togglingTaskId,
}: {
  tasks: Array<{ id: string; title: string; due_at: string | null; status: string }>;
  onToggle: (taskId: string, nextStatus: string) => void;
  togglingTaskId: string | null;
}) => {
  const pendingCount = tasks.filter((t) => t.status === 'open').length;

  return (
    <View style={styles.glassCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tasks</Text>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{pendingCount} pending</Text>
        </View>
      </View>
      {tasks.length === 0 ? (
        <Text style={styles.emptyText}>You are all caught up.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {tasks.map((task) => {
            const dueLabel = formatDueLabel(task.due_at);
            const overdue = isOverdue(task.due_at);
            return (
              <TouchableOpacity
                key={task.id}
                style={styles.taskCard}
                activeOpacity={0.85}
                onPress={() => onToggle(task.id, task.status === 'open' ? 'done' : 'open')}
                disabled={togglingTaskId === task.id}
              >
                <View style={styles.taskRow}>
                  <View
                    style={[
                      styles.checkCircle,
                      task.status === 'done' && styles.checkCircleDone,
                    ]}
                  >
                    {task.status === 'done' && <Ionicons name="checkmark" size={14} color={palette.text} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, task.status === 'done' && styles.taskTitleDone]}>
                      {task.title}
                    </Text>
                    <Text style={[styles.taskSubtitle, overdue ? styles.taskSubtitleOverdue : null]}>
                      {dueLabel}
                    </Text>
                  </View>
                  {overdue && (
                    <View style={styles.overdueChip}>
                      <Text style={styles.overdueChipText}>Overdue</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 120,
    gap: 14,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 13,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  errorTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    color: palette.muted,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: palette.primary,
  },
  retryButtonText: {
    color: palette.text,
    fontWeight: '700',
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  greetingLabel: {
    color: palette.muted,
    fontWeight: '700',
  },
  greetingTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  greetingSubtitle: {
    color: palette.muted,
  },
  metricStackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metricStackIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricStackText: {
    flex: 1,
  },
  metricStackLabel: {
    color: palette.muted,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricStackValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    color: palette.muted,
    fontWeight: '700',
  },
  metricValue: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sectionBadgeText: {
    color: palette.muted,
    fontWeight: '700',
  },
  insightsCallToAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(156,198,255,0.08)',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(156,198,255,0.15)',
  },
  insightsCallToActionText: {
    color: '#C9DCFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  eventCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  eventBorder: {
    height: 3,
    borderRadius: 10,
    marginBottom: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventCompany: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  eventRole: {
    color: palette.muted,
    marginBottom: 10,
  },
  eventIcon: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 8,
    borderRadius: 12,
  },
  eventMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventMetaText: {
    color: palette.muted,
  },
  eventPlatform: {
    color: palette.muted,
    marginBottom: 10,
  },
  fromEmailLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 8,
  },
  eventActions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryChip: {
    backgroundColor: palette.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryChipText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryChipText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  taskCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  taskRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  taskTitle: {
    color: palette.text,
    fontWeight: '800',
  },
  taskTitleOverdue: {
    color: '#FF7B7B',
  },
  taskTitleDone: {
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'line-through',
  },
  taskSubtitle: {
    color: palette.muted,
    marginTop: 4,
  },
  taskSubtitleOverdue: {
    color: '#FF7B7B',
  },
  taskSubtitleDone: {
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'line-through',
  },
  overdueChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,123,123,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,123,123,0.5)',
  },
  overdueChipText: {
    color: '#FF7B7B',
    fontSize: 11,
    fontWeight: '700',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  checkCircleDone: {
    backgroundColor: '#4A8CFF',
    borderColor: '#4A8CFF',
  },
  emptyText: {
    color: palette.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  navWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: 'center',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    gap: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  navLabel: {
    color: '#8EA2C3',
    fontSize: 12,
    fontWeight: '700',
  },
  navLabelActive: {
    color: palette.primary,
  },
});
