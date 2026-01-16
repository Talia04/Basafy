import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloatingNav from '../../components/main/FloatingNav';
import { ActivityIndicator, Animated, Linking, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@backend/supabase/client';
import { palette } from '../../theme/palette';
import EmptyState from '../../components/common/EmptyState';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
  unreadCount?: number;
};

export default function MainScreen({ activeTab = 'home', onNavigate, unreadCount = 0 }: Props) {
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
      application_id: string | null;
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
  const [taskCountsByApp, setTaskCountsByApp] = useState<Record<string, number>>({});
  const [tasks, setTasks] = useState<
    Array<{
      id: string;
      title: string;
      description: string | null;
      due_at: string | null;
      status: string;
      application: {
        id: string;
        company: string | null;
        role_title: string | null;
        role: string | null;
      } | null;
      created_at: string;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const [syncBanner, setSyncBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [gmailSyncState, setGmailSyncState] = useState<{
    status: string | null;
    progress: number | null;
    lastDeepCount: number | null;
    summary: string | null;
  }>({ status: null, progress: null, lastDeepCount: null, summary: null });
  const [bannerHidden, setBannerHidden] = useState(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const loadSyncState = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      const { data: syncState } = await supabase
        .from('gmail_sync_state')
        .select('initial_import_status, initial_import_progress, last_deep_result_count, last_sync_summary')
        .eq('user_id', userId)
        .maybeSingle();
      let nextState = {
        status: (syncState as any)?.initial_import_status ?? null,
        progress:
          typeof (syncState as any)?.initial_import_progress === 'number'
            ? (syncState as any).initial_import_progress
            : null,
        lastDeepCount:
          typeof (syncState as any)?.last_deep_result_count === 'number'
            ? (syncState as any).last_deep_result_count
            : null,
        summary: (syncState as any)?.last_sync_summary ?? null,
      };
      if (!nextState.status) {
        const { data: latestLog } = await supabase
          .from('gmail_sync_logs')
          .select('status, sync_type, applications_created, applications_updated')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestLog) {
          const logStatus = (latestLog as any).status;
          const syncType = (latestLog as any).sync_type;
          const isFull = syncType === 'full';
          const isIncremental = syncType === 'incremental';
          if (isFull || isIncremental) {
            const statusMap = logStatus === 'running'
              ? 'phase1_running'
              : logStatus === 'error'
                ? 'failed'
                : isFull
                  ? 'deep_done'
                  : 'phase1_done';
            nextState = {
              status: statusMap,
              progress: null,
              lastDeepCount: (latestLog as any).applications_created ?? null,
              summary:
                logStatus === 'error'
                  ? 'Gmail sync failed.'
                  : (latestLog as any).applications_created
                    ? `Imported ${(latestLog as any).applications_created} applications.`
                    : 'Gmail sync complete.',
            };
          }
        }
      }
      if (!mountedRef.current) return;
      setGmailSyncState(nextState);
    } catch {
      // ignore banner fetch failures
    }
  };

  const loadHomeData = async () => {
    setLoading(true);
    setError(null);
    const [
      metricsResult,
      upcomingResult,
      tasksResult,
      syncResult
    ] = await Promise.all([
      supabase.from('v_home_metrics').select('*').maybeSingle(),
      supabase.from('v_home_upcoming_events').select('*').order('start_at', { ascending: true }).limit(5),
      supabase
        .from('tasks')
        .select('id,title,description,due_at,status,created_at,application:applications(id,company,role_title,role)')
        .in('status', ['open', 'done'])
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('gmail_sync_logs')
        .select(
          'status, applications_created, applications_updated, job_email_events_created, job_email_events_updated, error_message, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
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
      const upcomingItems = upcomingResult.data.map((item: any) => ({
        id: item.id,
        application_id: item.application_id ?? null,
        title: item.title ?? null,
        event_type: item.event_type ?? 'event',
        company: item.company ?? null,
        role_title: item.role_title ?? null,
        provider: item.provider ?? null,
        meeting_link: item.meeting_link ?? null,
        start_at: item.start_at,
        source_type: item.source_type ?? null,
      }));
      setUpcoming(upcomingItems);
      const appIds = upcomingItems.map((item) => item.application_id).filter(Boolean) as string[];
      if (appIds.length > 0) {
        const { data: taskRows } = await supabase
          .from('tasks')
          .select('application_id')
          .eq('status', 'open')
          .in('application_id', appIds);
        const counts = (taskRows || []).reduce<Record<string, number>>((acc, row: any) => {
          if (row.application_id) {
            acc[row.application_id] = (acc[row.application_id] || 0) + 1;
          }
          return acc;
        }, {});
        setTaskCountsByApp(counts);
      } else {
        setTaskCountsByApp({});
      }
    } else {
      setUpcoming([]);
      setTaskCountsByApp({});
    }
    if (!tasksResult.error && Array.isArray(tasksResult.data)) {
      setTasks(
        tasksResult.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description ?? null,
          due_at: item.due_at ?? null,
          status: item.status,
          application: item.application ?? null,
          created_at: item.created_at,
        }))
      );
    } else {
      setTasks([]);
    }
    if (!syncResult.error && syncResult.data) {
      const status = syncResult.data.status;
      if (status === 'error') {
        setSyncBanner({ type: 'error', message: 'Sync failed. Tap to review Gmail connection.' });
      } else {
        const created = syncResult.data.applications_created ?? 0;
        const updated = syncResult.data.applications_updated ?? 0;
        if (created > 0 || updated > 0) {
          setSyncBanner({
            type: 'success',
            message: `Sync complete. ${created} new ${created === 1 ? 'job' : 'jobs'}${updated > 0 ? ` • ${updated} updated` : ''}`,
          });
        } else {
          setSyncBanner({ type: 'success', message: 'Sync complete. No new updates.' });
        }
      }
    } else {
      setSyncBanner(null);
    }
    setLoading(false);
  };
  useEffect(() => {
    mountedRef.current = true;
    loadHomeData();
    loadSyncState();
    return () => {
      mountedRef.current = false;
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!gmailSyncState.status) return;
    setBannerHidden(false);
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = setTimeout(() => {
      setBannerHidden(true);
    }, 12_000);
  }, [gmailSyncState.status, gmailSyncState.summary]);

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
    const { error } = await supabase
      .from('tasks')
      .update({ status: nextStatus, completed_at: nextStatus === 'done' ? new Date().toISOString() : null })
      .eq('id', taskId);
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
          <SyncBanner
            state={gmailSyncState}
            hidden={bannerHidden}
            onPress={() => {
              setBannerHidden(true);
              onNavigate?.('profile');
            }}
          />
          <GreetingCard userName={userName} />
          {syncBanner && (
            <SyncBannerSimple
              type={syncBanner.type}
              message={syncBanner.message}
              onPress={() => onNavigate?.(syncBanner.type === 'error' ? 'profile' : 'applications')}
            />
          )}
          <MetricsStack summaryStats={summaryStats} />
          <MetricsRow metrics={metrics} />
          <InsightsPreview onPress={() => onNavigate?.('insights')} />
          <UpcomingSection upcoming={upcoming} taskCountsByApp={taskCountsByApp} />
          <TasksSection tasks={tasks} onToggle={toggleTaskStatus} togglingTaskId={togglingTaskId} />
        </Animated.ScrollView>
      )}
      {unreadCount > 0 && (
        <TouchableOpacity
          style={[styles.notificationFab, { top: Math.max(insets.top, 8) }]}
          activeOpacity={0.85}
          onPress={() => onNavigate?.('notifications')}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={18} color="#F4F6FA" />
          <View style={styles.badgeBubble}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        </TouchableOpacity>
      )}
      <FloatingNav activeTab={activeTab} onNavigate={onNavigate} bottomInset={insets.bottom} />
    </SafeAreaView>
  );
}

const SyncBanner = ({
  state,
  hidden,
  onPress,
}: {
  state: { status: string | null; progress: number | null; lastDeepCount: number | null; summary: string | null };
  hidden: boolean;
  onPress?: () => void;
}) => {
  if (hidden) return null;
  if (!state.status) return null;
  if (!['phase1_running', 'phase1_done', 'deep_running', 'deep_done', 'failed'].includes(state.status)) return null;
  const isPhase1 = state.status === 'phase1_running' || state.status === 'phase1_done';
  const isRunning = state.status === 'deep_running' || state.status === 'phase1_running';
  const isFailed = state.status === 'failed';
  const title = isFailed
    ? 'Gmail import failed'
    : isRunning
      ? isPhase1
        ? 'Gmail sync running'
        : 'Gmail import running'
      : isPhase1
        ? 'Gmail sync complete'
        : 'Gmail import complete';
  const subtitle =
    state.summary ||
    (isRunning
      ? state.progress !== null
        ? `${isPhase1 ? 'Sync' : 'Deep sync'} ${state.progress}% complete`
        : `${isPhase1 ? 'Sync' : 'Deep sync'} in progress`
      : state.lastDeepCount
        ? `Added ${state.lastDeepCount} applications`
        : 'Your Gmail import finished');
  return (
    <TouchableOpacity
      style={[styles.syncBanner, isFailed && styles.syncBannerError]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.syncBannerIcon}>
        <Ionicons
          name={isFailed ? 'alert-circle-outline' : isRunning ? 'sync-outline' : 'checkmark-circle-outline'}
          size={18}
          color={isFailed ? '#FF7B7B' : '#5AEFD5'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.syncBannerTitle}>{title}</Text>
        <Text style={styles.syncBannerSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8EA2C3" />
    </TouchableOpacity>
  );
};

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

const SyncBannerSimple = ({
  type,
  message,
  onPress,
}: {
  type: 'success' | 'error';
  message: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    style={[styles.syncBanner, type === 'error' ? styles.syncBannerError : styles.syncBannerSuccess]}
    activeOpacity={0.85}
    onPress={onPress}
  >
    <Ionicons
      name={type === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
      size={18}
      color={type === 'error' ? '#F97316' : '#5AEFD5'}
    />
    <Text style={styles.syncBannerText}>{message}</Text>
    <Ionicons name="chevron-forward" size={16} color={palette.muted} />
  </TouchableOpacity>
);

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
  taskCountsByApp,
}: {
  upcoming: Array<{
    id: string;
    application_id: string | null;
    title: string | null;
    event_type: string;
    company: string | null;
    role_title: string | null;
    provider: string | null;
    meeting_link: string | null;
    start_at: string;
    source_type: string | null;
  }>;
  taskCountsByApp: Record<string, number>;
}) => (
  <View style={styles.glassCard}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="calendar-outline" size={16} color="#9CC6FF" />
        <Text style={styles.sectionTitle}>Coming Up</Text>
      </View>
    </View>
    {upcoming.length === 0 ? (
      <EmptyState
        icon="calendar-outline"
        title="No upcoming interviews yet"
        message="When emails land, we will add interviews here. You can also add events manually."
      />
    ) : (
      upcoming.map((item) => {
        const taskCount = item.application_id ? taskCountsByApp[item.application_id] : 0;
        return (
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
            {taskCount ? (
              <View style={styles.taskBadge}>
                <Text style={styles.taskBadgeText}>{taskCount} task{taskCount > 1 ? 's' : ''}</Text>
              </View>
            ) : null}
            <View style={styles.eventActions}>
              <ScalePressable style={styles.primaryChip} onPress={() => handleJoin(item.meeting_link)}>
                <Text style={styles.primaryChipText}>Join</Text>
              </ScalePressable>
              <ScalePressable style={styles.secondaryChip}>
                <Text style={styles.secondaryChipText}>Prepare</Text>
              </ScalePressable>
            </View>
          </View>
        );
      })
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
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    due_at: string | null;
    status: string;
    application: { id: string; company: string | null; role_title: string | null; role: string | null } | null;
  }>;
  onToggle: (taskId: string, nextStatus: string) => void;
  togglingTaskId: string | null;
}) => {
  const pendingCount = tasks.filter((t) => t.status === 'open').length;
  const [selectedTask, setSelectedTask] = useState<null | {
    id: string;
    title: string;
    description: string | null;
    due_at: string | null;
    status: string;
    application: { id: string; company: string | null; role_title: string | null; role: string | null } | null;
  }>(null);

  return (
    <View style={styles.glassCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Action Items</Text>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{pendingCount} pending</Text>
        </View>
      </View>
      {tasks.length === 0 ? (
        <Text style={styles.emptyText}>No action items yet. Add a follow-up or connect Gmail to auto-create tasks.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {tasks.map((task) => {
            const dueLabel = formatDueLabel(task.due_at);
            const overdue = isOverdue(task.due_at);
            const company = task.application?.company || 'Unknown company';
            const role = task.application?.role_title || task.application?.role || 'Role pending';
            return (
              <TouchableOpacity
                key={task.id}
                style={styles.taskCard}
                activeOpacity={0.85}
                onPress={() => setSelectedTask(task)}
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
                    <Text style={styles.taskMeta}>{company} • {role}</Text>
                    <Text
                      style={[
                        styles.taskSubtitle,
                        overdue ? styles.taskSubtitleOverdue : null,
                        task.status === 'done' ? styles.taskSubtitleDone : null,
                      ]}
                    >
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
      <Modal visible={!!selectedTask} transparent animationType="slide" onRequestClose={() => setSelectedTask(null)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#181C24' }}>
          {selectedTask && (
            <View style={[styles.glassCard, { width: '85%' }]}>
              <Text style={styles.sectionTitle}>Action Item Details</Text>
              <Text style={[styles.taskTitle, selectedTask.status === 'done' && styles.taskTitleDone]}>
                {selectedTask.title}
              </Text>
              <Text style={styles.taskMeta}>
                {(selectedTask.application?.company || 'Unknown company')} • {(selectedTask.application?.role_title || selectedTask.application?.role || 'Role pending')}
              </Text>
              {selectedTask.description ? (
                <Text style={styles.taskDetail}>{selectedTask.description}</Text>
              ) : null}
              <Text style={styles.taskSubtitle}>Due: {formatDueLabel(selectedTask.due_at)}</Text>
              <Text style={styles.taskSubtitle}>Status: {selectedTask.status === 'open' ? 'Pending' : 'Completed'}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
                <ScalePressable
                  style={styles.primaryChip}
                  onPress={() => {
                    onToggle(selectedTask.id, selectedTask.status === 'open' ? 'done' : 'open');
                    setSelectedTask(null);
                  }}
                >
                  <Text style={styles.primaryChipText}>
                    {selectedTask.status === 'open' ? 'Mark Complete' : 'Reopen'}
                  </Text>
                </ScalePressable>
                <ScalePressable style={styles.secondaryChip} onPress={() => setSelectedTask(null)}>
                  <Text style={styles.secondaryChipText}>Close</Text>
                </ScalePressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
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
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  syncBannerSuccess: {
    backgroundColor: 'rgba(90, 239, 213, 0.12)',
    borderColor: 'rgba(90, 239, 213, 0.35)',
  },
  syncBannerError: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderColor: 'rgba(249, 115, 22, 0.35)',
  },
  syncBannerText: {
    flex: 1,
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  notificationFab: {
    position: 'absolute',
    right: 16,
    width: 57,
    height: 57,
    borderRadius: 18,
    backgroundColor: '#0F1628',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  badgeBubble: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 10,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 4,
    paddingVertical: 0,
  },

  syncBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(10,14,26,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBannerTitle: {
    color: palette.text,
    fontWeight: '800',
  },
  syncBannerSubtitle: {
    color: palette.muted,
    marginTop: 2,
    fontSize: 12,
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
  taskBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74,140,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  taskBadgeText: {
    color: '#C9DCFF',
    fontSize: 12,
    fontWeight: '700',
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
  taskMeta: {
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  taskDetail: {
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    lineHeight: 18,
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
