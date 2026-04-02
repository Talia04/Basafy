import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloatingNav from '../../components/main/FloatingNav';
import { ActivityIndicator, Alert, Animated, Linking, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@backend/supabase/client';
import { useTheme, Palette } from '../../theme/palette';
import EmptyState from '../../components/common/EmptyState';
import Constants from 'expo-constants';
import { connectGmailWithGoogleNative } from '../../lib/googleNativeAuth';
import {
  clearDemoModeFlag,
  fetchGmailConnection,
  hasCompletedGmailOnboarding,
  getDemoModeFlag,
  markGmailOnboardingSeen,
  persistGmailConnectionWithAuthCode,
  setDemoModeFlag,
  syncMockInbox,
} from '../../lib/gmailIntegration';
import { useGmailSyncState } from '../../lib/useGmailSyncState';
import { useGmailBackfill } from '../../lib/GmailBackfillContext';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
  onOpenApplication?: (applicationId: string) => void;
  unreadCount?: number;
};

export default function MainScreen({ activeTab = 'home', onNavigate, onOpenApplication, unreadCount = 0 }: Props) {
  const { palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  const [metricsData, setMetricsData] = useState({
    total_active_applications: 0,
    interviews_next_7_days: 0,
    open_tasks: 0,
    success_rate: 0,
    avg_response_days: null as number | null,
  });
  const [insightsSummary, setInsightsSummary] = useState<{
    response_rate: number | null;
    avg_response_days: number | null;
    stalled_count: number;
    total_applications: number;
  } | null>(null);
  const [upcoming, setUpcoming] = useState<
    Array<{
      id: string | null;
      application_id: string | null;
      title: string | null;
      event_type: string | null;
      company: string | null;
      role_title: string | null;
      provider: string | null;
      meeting_link: string | null;
      start_at: string | null;
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
  const [bannerHidden, setBannerHidden] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [startingDemo, setStartingDemo] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [hasGmailOnboarding, setHasGmailOnboarding] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);
  const isExpoGo = Constants.appOwnership === 'expo';

  const { start: startBackfill } = useGmailBackfill();
  const { phase: gmailSyncState, setPhase: setGmailSyncState, refresh: refreshSyncState } =
    useGmailSyncState(userId);

  const resetHomeState = () => {
    setMetricsData({
      total_active_applications: 0,
      interviews_next_7_days: 0,
      open_tasks: 0,
      success_rate: 0,
      avg_response_days: null,
    });
    setInsightsSummary(null);
    setUpcoming([]);
    setTaskCountsByApp({});
    setTasks([]);
    setBannerHidden(false);
    setConnectingGmail(false);
    setStartingDemo(false);
    setHasGmailOnboarding(false);
    setGmailConnected(false);
    setUserId(null);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    const syncUserState = async (
      user: (typeof supabase.auth.getUser) extends () => Promise<{ data: { user: infer U } }> ? U : any,
    ) => {
      if (!active) return;
      if (!user) {
        currentUserIdRef.current = null;
        setUserId(null);
        setUserName('');
        setIsDemoMode(false);
        setHasGmailOnboarding(false);
        setGmailConnected(false);
        return;
      }
      currentUserIdRef.current = user.id ?? null;
      setUserId(user.id ?? null);
      const identity = user?.identities?.[0]?.identity_data as { full_name?: string; name?: string } | undefined;
      const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || identity?.full_name || identity?.name;
      setUserName(fullName || '');
      const demoFlag = await getDemoModeFlag(user.id);
      if (!active) return;
      setIsDemoMode(demoFlag);
      if ((user as any)?.user_metadata?.is_mock && !demoFlag) {
        try {
          await supabase.auth.updateUser({ data: { is_mock: false } });
        } catch {
          // ignore demo cleanup errors
        }
      }
      try {
        const [completed, connection] = await Promise.all([
          hasCompletedGmailOnboarding(),
          fetchGmailConnection(),
        ]);
        if (!active) return;
        setHasGmailOnboarding(completed);
        setGmailConnected(Boolean(connection?.refresh_token || connection?.email));
      } catch {
        if (!active) return;
        setHasGmailOnboarding(false);
        setGmailConnected(false);
      }
    };

    const loadUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.warn('Failed to fetch user data:', error.message);
          return;
        }
        await syncUserState(data.user);
      } catch (err) {
        console.warn('Error loading user name:', err);
      }
    };

    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      void syncUserState(session?.user ?? null);
      if (event === 'SIGNED_OUT') {
        if (currentUserIdRef.current) {
          void clearDemoModeFlag(currentUserIdRef.current);
        }
        resetHomeState();
        return;
      }
      if (event === 'SIGNED_IN') {
        loadHomeData();
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);


  const loadHomeData = React.useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background === true;
    if (!background) {
      setLoading(true);
    }
    setError(null);
    const [
      metricsResult,
      upcomingResult,
      tasksResult,
      insightsResult,
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
        .rpc('get_insights_summary', {
          p_start_at: new Date(2000, 0, 1).toISOString(),
          p_end_at: new Date().toISOString(),
        })
        .single(),
    ]);
    if (!mountedRef.current) return;
    if (metricsResult.error || upcomingResult.error || tasksResult.error) {
      setError('Unable to load your dashboard.');
    }
    if (!insightsResult.error && insightsResult.data) {
      setInsightsSummary({
        response_rate: insightsResult.data.response_rate ?? null,
        avg_response_days: insightsResult.data.avg_response_days ?? null,
        stalled_count: insightsResult.data.stalled_count ?? 0,
        total_applications: insightsResult.data.total_applications ?? 0,
      });
    } else {
      setInsightsSummary(null);
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
      const upcomingItems = upcomingResult.data.map((item) => ({
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
        const counts = (taskRows || []).reduce<Record<string, number>>(
          (acc, row) => {
            if (row.application_id) {
              acc[row.application_id] = (acc[row.application_id] || 0) + 1;
            }
            return acc;
          },
          {}
        );
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
    if (!background) {
      setLoading(false);
    }
  }, []);

  const scheduleHomeRefresh = React.useCallback(() => {
    if (homeRefreshDebounceRef.current) {
      clearTimeout(homeRefreshDebounceRef.current);
    }
    homeRefreshDebounceRef.current = setTimeout(() => {
      homeRefreshDebounceRef.current = null;
      if (mountedRef.current) {
        void loadHomeData({ background: true });
      }
    }, 900);
  }, [loadHomeData]);

  useEffect(() => {
    mountedRef.current = true;
    void loadHomeData();
    return () => {
      mountedRef.current = false;
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (homeRefreshDebounceRef.current) clearTimeout(homeRefreshDebounceRef.current);
    };
  }, [loadHomeData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHomeData();
    setRefreshing(false);
  };

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
    if (!userId) return;
    const channel = supabase
      .channel(`home-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `user_id=eq.${userId}`,
        },
        scheduleHomeRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`,
        },
        scheduleHomeRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${userId}`,
        },
        scheduleHomeRefresh,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (homeRefreshDebounceRef.current) {
        clearTimeout(homeRefreshDebounceRef.current);
        homeRefreshDebounceRef.current = null;
      }
    };
  }, [userId, scheduleHomeRefresh]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: loading ? 0 : 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, loading]);

  const summaryStats = useMemo(
    () => [
      { label: 'Applications Active', value: metricsData.total_active_applications, icon: 'briefcase-outline', accent: palette.accentBlue },
      { label: 'Interviews This Week', value: metricsData.interviews_next_7_days, icon: 'calendar-outline', accent: palette.accentGreen },
      { label: 'Pending Actions', value: metricsData.open_tasks, icon: 'alert-circle-outline', accent: '#F59E0B' },
    ],
    [metricsData, palette.accentBlue, palette.accentGreen]
  );

  type InsightsStat = {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
  };

  const insightsSnapshot = useMemo<InsightsStat[] | null>(() => {
    if (!insightsSummary || insightsSummary.total_applications === 0) return null;
    const responseRate = insightsSummary.response_rate != null
      ? `${Math.round(insightsSummary.response_rate * 100)}%`
      : '--';
    const avgResponse = insightsSummary.avg_response_days != null
      ? `${Math.max(0, insightsSummary.avg_response_days).toFixed(1)}d`
      : '--';
    return [
      { label: 'Response rate', value: responseRate, icon: 'swap-horizontal-outline' },
      { label: 'Avg response', value: avgResponse, icon: 'timer-outline' },
      { label: 'Ghosted apps', value: `${insightsSummary.stalled_count}`, icon: 'alert-circle-outline' },
    ];
  }, [insightsSummary]);

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

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  const updateTask = async (taskId: string, title: string, description: string | null) => {
    const { error } = await supabase.from('tasks').update({ title, description }).eq('id', taskId);
    if (!error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, title, description } : t))
      );
    }
  };

  const handleConnectGmail = async () => {
    if (connectingGmail) return;
    setConnectingGmail(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.access_token) {
        Alert.alert('Not signed in', 'Please sign in to connect Gmail.');
        return;
      }
      if (isExpoGo) {
        Alert.alert('Use a development build', 'Gmail connect needs a development or production build.');
        return;
      }
      const nativeResult = await connectGmailWithGoogleNative();
      const nextSession = (await supabase.auth.getSession()).data.session;
      if (!nextSession?.access_token) {
        Alert.alert('Not signed in', 'Please sign in to connect Gmail.');
        return;
      }
      setGmailSyncState({
        status: 'phase1_running',
        progress: null,
        lastDeepCount: null,
        summary: 'Starting Gmail sync…',
        isRunning: true,
        isComplete: false,
        hasFailed: false,
      });
      setBannerHidden(false);
      await persistGmailConnectionWithAuthCode(
        nextSession,
        nativeResult.serverAuthCode,
        nextSession.access_token,
      );
      if (nextSession.user?.id) {
        await setDemoModeFlag(nextSession.user.id, false);
      }
      await supabase.auth.updateUser({ data: { is_mock: false } });
      setIsDemoMode(false);
      setHasGmailOnboarding(true);
      setGmailConnected(true);
      await markGmailOnboardingSeen(nextSession);
      await loadHomeData();
      await refreshSyncState();
      // Fire-and-forget: auto-import last 3 months via shared context.
      // Progress is shown in the global BackfillProgressBanner (App.tsx).
      startBackfill('3');
      onNavigate?.('applications');
    } catch {
      Alert.alert('Gmail connect failed', 'Unable to connect Gmail right now. Please try again.');
    } finally {
      setConnectingGmail(false);
    }
  };

  const handleStartDemo = async () => {
    if (startingDemo || isDemoMode) return;
    setStartingDemo(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.access_token) {
        Alert.alert('Not signed in', 'Please sign in to start demo mode.');
        return;
      }
      if (session.user?.id) {
        await setDemoModeFlag(session.user.id, true);
      }
      setIsDemoMode(true);
      await syncMockInbox(session);
      await markGmailOnboardingSeen(session);
      setHasGmailOnboarding(true);
      await loadHomeData();
      await refreshSyncState();
      Alert.alert('Demo mode ready', 'We loaded a sample inbox so you can explore Basafy.');
    } catch {
      Alert.alert('Demo mode failed', 'Unable to start demo mode right now.');
    } finally {
      setStartingDemo(false);
    }
  };

  const showGettingStarted =
    !hasGmailOnboarding &&
    !gmailConnected &&
    metricsData.total_active_applications === 0 &&
    tasks.length === 0 &&
    upcoming.length === 0;
  const isHomeEmpty =
    metricsData.total_active_applications === 0 &&
    tasks.length === 0 &&
    upcoming.length === 0;
  const showImportPrompt =
    !showGettingStarted &&
    gmailConnected &&
    isHomeEmpty;

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
          <SyncBanner
            state={gmailSyncState}
            hidden={bannerHidden}
            onPress={() => {
              setBannerHidden(true);
              onNavigate?.('profile');
            }}
          />
          <GreetingCard userName={userName} />
          {showGettingStarted && (
            <GettingStartedCard
              onConnect={handleConnectGmail}
              onDemo={handleStartDemo}
              connecting={connectingGmail}
              demoing={startingDemo}
              isDemoMode={isDemoMode}
              isExpoGo={isExpoGo}
            />
          )}
          {showImportPrompt && (
            <ImportPromptCard
              isRunning={gmailSyncState.isRunning}
              onPrimary={() => {
                if (gmailSyncState.isRunning) {
                  onNavigate?.('applications');
                  return;
                }
                setGmailSyncState((prev) => ({
                  ...prev,
                  status: 'phase1_running',
                  summary: 'Importing more from Gmail…',
                  isRunning: true,
                  isComplete: false,
                  hasFailed: false,
                }));
                setBannerHidden(false);
                startBackfill('3');
                onNavigate?.('applications');
              }}
            />
          )}
          {insightsSnapshot && (
            <InsightsSummaryCard
              stats={insightsSnapshot}
              onPress={() => onNavigate?.('insights')}
            />
          )}
          <MetricsStack summaryStats={summaryStats} />
          <UpcomingSection upcoming={upcoming} taskCountsByApp={taskCountsByApp} />
          <TasksSection
            tasks={tasks}
            onToggle={toggleTaskStatus}
            togglingTaskId={togglingTaskId}
            onDelete={deleteTask}
            onUpdate={updateTask}
            onOpenApplication={(applicationId) => {
              if (onOpenApplication) onOpenApplication(applicationId);
              else onNavigate?.('applications');
            }}
          />
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
  const { palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
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
        {isRunning && !isFailed ? (
          <ActivityIndicator size="small" color={palette.success} />
        ) : (
          <Ionicons
            name={isFailed ? 'alert-circle-outline' : 'checkmark-circle-outline'}
            size={18}
            color={isFailed ? '#FF7B7B' : palette.success}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.syncBannerTitle}>{title}</Text>
        <Text style={styles.syncBannerSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.muted} />
    </TouchableOpacity>
  );
};

const GreetingCard = ({ userName }: { userName?: string }) => {
  const { palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const firstName = userName?.split(' ')[0] || 'there';
  const hours = new Date().getHours();
  const greeting = hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroHeader}>
        <View>
          <Text style={styles.greetingLabel}>{greeting},</Text>
          <Text style={styles.greetingTitle}>{firstName} 👋</Text>
        </View>
        <LinearGradient colors={['#2563EB', '#14B8A6']} style={styles.heroAvatar} />
      </View>
      <Text style={styles.greetingSubtitle}>Here&apos;s your job search at a glance.</Text>
    </View>
  );
};

const InsightsSummaryCard = ({
  stats,
  onPress,
}: {
  stats: Array<{ label: string; value: string; icon: keyof typeof Ionicons.glyphMap }>;
  onPress?: () => void;
}) => {
  const { palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  return (
    <TouchableOpacity style={styles.insightsSummaryCard} activeOpacity={0.85} onPress={onPress}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="analytics-outline" size={16} color={palette.accentBlue} />
        <Text style={styles.sectionTitle}>Insights snapshot</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={styles.insightsPeriodLabel}>All time</Text>
        <Ionicons name="chevron-forward" size={16} color={palette.muted} />
      </View>
    </View>
    <View style={styles.insightsSummaryRow}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.insightsSummaryItem}>
          <View style={styles.insightsSummaryIcon}>
            <Ionicons name={stat.icon} size={14} color={palette.accentBlue} />
          </View>
          <Text style={styles.insightsSummaryValue}>{stat.value}</Text>
          <Text style={styles.insightsSummaryLabel}>{stat.label}</Text>
        </View>
      ))}
    </View>
  </TouchableOpacity>
  );
};

const GettingStartedCard = ({
  onConnect,
  onDemo,
  connecting,
  demoing,
  isDemoMode,
  isExpoGo,
}: {
  onConnect: () => void;
  onDemo: () => void;
  connecting: boolean;
  demoing: boolean;
  isDemoMode: boolean;
  isExpoGo: boolean;
}) => {
  const { palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  return (
  <View style={[styles.glassCard, styles.gettingStartedCard]}>
    <View style={styles.gettingHeader}>
      <View>
        <Text style={styles.gettingTitle}>Get started with Basafy</Text>
        <Text style={styles.gettingSubtitle}>Track applications, interviews, and follow-ups in one place.</Text>
      </View>
      {isDemoMode && (
        <View style={styles.demoBadge}>
          <Ionicons name="flask-outline" size={12} color={palette.invertedText} />
          <Text style={styles.demoBadgeText}>Demo mode</Text>
        </View>
      )}
    </View>

    <View style={styles.bulletList}>
      <View style={styles.bulletRow}>
        <Text style={styles.bulletDot}>•</Text>
        <Text style={styles.bulletText}>Auto-build your pipeline from Gmail updates</Text>
      </View>
      <View style={styles.bulletRow}>
        <Text style={styles.bulletDot}>•</Text>
        <Text style={styles.bulletText}>See interviews and tasks without manual tracking</Text>
      </View>
      <View style={styles.bulletRow}>
        <Text style={styles.bulletDot}>•</Text>
        <Text style={styles.bulletText}>Get reminders and insights as you apply</Text>
      </View>
    </View>

    <Text style={styles.helperText}>
      We use Gmail to detect application emails and interview invites. We only read job-related messages and you can disconnect anytime.
    </Text>
    {isExpoGo && (
      <Text style={styles.helperText}>Gmail connect requires a development or production build.</Text>
    )}

    <View style={styles.ctaRow}>
      <TouchableOpacity
        style={[styles.primaryButton, (connecting || demoing) && styles.buttonDisabled]}
        activeOpacity={0.85}
        onPress={onConnect}
        disabled={connecting || demoing}
      >
        {connecting ? (
          <ActivityIndicator color={palette.invertedText} />
        ) : (
          <Text style={styles.primaryButtonText}>Connect Gmail</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.secondaryButton, (demoing || isDemoMode) && styles.buttonDisabled]}
        activeOpacity={0.85}
        onPress={onDemo}
        disabled={demoing || isDemoMode}
      >
        {demoing ? (
          <ActivityIndicator color={palette.accentBlue} />
        ) : (
          <Text style={styles.secondaryButtonText}>{isDemoMode ? 'Demo ready' : 'Try demo mode'}</Text>
        )}
      </TouchableOpacity>
    </View>
  </View>
  );
};

const ImportPromptCard = ({
  isRunning,
  onPrimary,
}: {
  isRunning: boolean;
  onPrimary: () => void;
}) => {
  const { palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  return (
  <View style={[styles.glassCard, styles.importPromptCard]}>
    <View style={styles.gettingHeader}>
      <View>
        <Text style={styles.gettingTitle}>
          {isRunning ? 'Importing from Gmail' : 'Your pipeline is still empty'}
        </Text>
        <Text style={styles.gettingSubtitle}>
          {isRunning
            ? 'Applications will appear here as each Gmail page finishes importing.'
            : 'Start a Gmail import and we will stream applications into your list as they land.'}
        </Text>
      </View>
    </View>
    <TouchableOpacity
      style={styles.primaryButton}
      activeOpacity={0.85}
      onPress={onPrimary}
    >
      <Text style={styles.primaryButtonText}>
        {isRunning ? 'View Applications' : 'Start Gmail Import'}
      </Text>
    </TouchableOpacity>
  </View>
  );
};

const MetricsStack = ({ summaryStats }: { summaryStats: Array<{ label: string; value: number; icon: string; accent: string }> }) => {
  const { palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const primary = summaryStats.slice(0, 2);
  const secondary = summaryStats.slice(2);
  return (
    <View style={styles.statsWrap}>
      <View style={styles.statsRow}>
        {primary.map((item, index) => (
          <View
            key={item.label}
            style={[
              styles.statCard,
              {
                borderColor:
                  index === 0
                    ? `${palette.accentBlue}88`
                    : `${palette.accentGreen}88`,
              },
            ]}
          >
            <Text style={[styles.statValue, index === 0 ? styles.statValueBlue : styles.statValueGreen]}>
              {item.value}
            </Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
      {secondary.map((item) => (
        <View key={item.label} style={styles.statCardSlim}>
          <Text style={styles.statValueMuted}>{item.value}</Text>
          <Text style={styles.statLabelMuted}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
};

const UpcomingSection = ({
  upcoming,
  taskCountsByApp,
}: {
  upcoming: Array<{
    id: string | null;
    application_id: string | null;
    title: string | null;
    event_type: string | null;
    company: string | null;
    role_title: string | null;
    provider: string | null;
    meeting_link: string | null;
    start_at: string | null;
    source_type: string | null;
  }>;
  taskCountsByApp: Record<string, number>;
}) => {
  const { palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  return (
  <View style={styles.glassCard}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name="calendar-outline" size={16} color={palette.accentBlue} />
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
            <LinearGradient colors={[palette.accentBlue, palette.accentGreen]} style={styles.eventBorder} />
            <View style={styles.eventHeader}>
              <Text style={styles.eventCompany}>{item.company || item.title || 'Upcoming event'}</Text>
              <View style={styles.eventIcon}>
                <Ionicons name="videocam-outline" size={16} color={palette.accentBlue} />
              </View>
            </View>
            <Text style={styles.eventRole}>
              {item.role_title || (item.event_type ? formatEventType(item.event_type) : 'Event')}
            </Text>
            <View style={styles.eventMetaRow}>
              <EventMeta icon="calendar-outline" text={item.start_at ? formatEventDate(item.start_at) : '—'} />
              <EventMeta icon="time-outline" text={item.start_at ? formatEventTime(item.start_at) : '—'} />
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
            </View>
          </View>
        );
      })
    )}
  </View>
  );
};

const EventMeta = ({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) => {
  const { palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  return (
    <View style={styles.eventMeta}>
      <Ionicons name={icon} size={14} color={palette.muted} />
      <Text style={styles.eventMetaText}>{text}</Text>
    </View>
  );
};

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


type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  status: string;
  application: { id: string; company: string | null; role_title: string | null; role: string | null } | null;
};

const TasksSection = ({
  tasks,
  onToggle,
  togglingTaskId,
  onDelete,
  onUpdate,
  onOpenApplication,
}: {
  tasks: TaskItem[];
  onToggle: (taskId: string, nextStatus: string) => void;
  togglingTaskId: string | null;
  onDelete?: (taskId: string) => void;
  onUpdate?: (taskId: string, title: string, description: string | null) => void;
  onOpenApplication?: (applicationId: string) => void;
}) => {
  const { palette, isDark } = useTheme();
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const pendingCount = tasks.filter((t) => t.status === 'open').length;
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  return (
    <View style={styles.glassCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="notifications-outline" size={16} color="#A855F7" />
          <Text style={styles.sectionTitle}>Upcoming Tasks</Text>
        </View>
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
            const dueTime = task.due_at ? formatEventTime(task.due_at) : null;
            const company = task.application?.company || 'Unknown company';
            const role = task.application?.role_title || task.application?.role || 'Role pending';
            const isDone = task.status === 'done';
            return (
              <TouchableOpacity
                key={task.id}
                style={[
                  styles.taskCard,
                  overdue ? styles.taskCardOverdue : null,
                  isDone ? styles.taskCardDone : null,
                ]}
                activeOpacity={0.85}
                onPress={() => setSelectedTask(task)}
                disabled={togglingTaskId === task.id}
              >
                <View style={styles.taskCardHeader}>
                  <View style={[styles.duePill, overdue ? styles.duePillOverdue : null]}>
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={overdue ? '#FF7B7B' : 'rgba(255,255,255,0.8)'}
                    />
                    <Text style={[styles.duePillText, overdue ? styles.duePillTextOverdue : null]}>
                      {dueLabel}{dueTime ? ` • ${dueTime}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, isDone ? styles.statusPillDone : styles.statusPillOpen]}>
                    <Text style={styles.statusPillText}>{isDone ? 'Completed' : 'Pending'}</Text>
                  </View>
                </View>
                <View style={styles.taskCardBody}>
                  <View style={[styles.checkCircle, isDone && styles.checkCircleDone]}>
                    {isDone && <Ionicons name="checkmark" size={14} color={palette.text} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>
                      {task.title}
                    </Text>
                    <Text style={styles.taskMeta}>{company} • {role}</Text>
                    {task.description ? (
                      <Text style={styles.taskDescription} numberOfLines={2}>
                        {task.description}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.taskCardFooter}>
                  <Text style={styles.taskFooterNote}>{overdue ? 'Overdue action' : 'Tap for details'}</Text>
                  <ScalePressable
                    style={isDone ? styles.taskActionSecondary : styles.taskActionPrimary}
                    onPress={() => onToggle(task.id, isDone ? 'open' : 'done')}
                    disabled={togglingTaskId === task.id}
                  >
                    <Text style={isDone ? styles.taskActionSecondaryText : styles.taskActionPrimaryText}>
                      {togglingTaskId === task.id ? 'Updating…' : isDone ? 'Reopen' : 'Complete'}
                    </Text>
                  </ScalePressable>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <Modal
        visible={!!selectedTask}
        transparent
        animationType="slide"
        onRequestClose={() => { setSelectedTask(null); setEditMode(false); }}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(10,13,22,0.92)' }}>
          {selectedTask && (
            <View style={[styles.glassCard, { width: '88%' }]}>
              {/* Header row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={styles.sectionTitle}>Action Item</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditTitle(selectedTask.title);
                      setEditDescription(selectedTask.description ?? '');
                      setEditMode(true);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="pencil-outline" size={18} color={palette.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete', style: 'destructive',
                          onPress: () => {
                            onDelete?.(selectedTask.id);
                            setSelectedTask(null);
                            setEditMode(false);
                          },
                        },
                      ]);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF7B7B" />
                  </TouchableOpacity>
                </View>
              </View>

              {editMode ? (
                <>
                  <TextInput
                    style={[styles.taskTitle, { borderBottomWidth: 1, borderColor: palette.muted, marginBottom: 8, color: palette.text }]}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Task title"
                    placeholderTextColor={palette.muted}
                  />
                  <TextInput
                    style={[styles.taskMeta, { borderBottomWidth: 1, borderColor: palette.muted, marginBottom: 8, color: palette.text, minHeight: 40 }]}
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder="Description (optional)"
                    placeholderTextColor={palette.muted}
                    multiline
                  />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <ScalePressable
                      style={styles.primaryChip}
                      onPress={() => {
                        if (editTitle.trim()) {
                          onUpdate?.(selectedTask.id, editTitle.trim(), editDescription.trim() || null);
                          setSelectedTask((prev) => prev ? { ...prev, title: editTitle.trim(), description: editDescription.trim() || null } : null);
                        }
                        setEditMode(false);
                      }}
                    >
                      <Text style={styles.primaryChipText}>Save</Text>
                    </ScalePressable>
                    <ScalePressable style={styles.secondaryChip} onPress={() => setEditMode(false)}>
                      <Text style={styles.secondaryChipText}>Cancel</Text>
                    </ScalePressable>
                  </View>
                </>
              ) : (
                <>
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
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
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
                    {selectedTask.application?.id && onOpenApplication && (
                      <ScalePressable
                        style={styles.secondaryChip}
                        onPress={() => {
                          onOpenApplication(selectedTask.application!.id);
                          setSelectedTask(null);
                        }}
                      >
                        <Text style={styles.secondaryChipText}>View App</Text>
                      </ScalePressable>
                    )}
                    <ScalePressable style={styles.secondaryChip} onPress={() => setSelectedTask(null)}>
                      <Text style={styles.secondaryChipText}>Close</Text>
                    </ScalePressable>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};


const createStyles = (palette: Palette, isDark: boolean) => {
  const glassCard = isDark ? 'rgba(255,255,255,0.03)' : palette.surface;
  const glassCardSoft = isDark ? 'rgba(255,255,255,0.02)' : palette.surfaceMuted;
  const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : palette.overlayBorder;
  const glassBorderSoft = isDark ? 'rgba(255,255,255,0.05)' : palette.overlayBorder;
  const chipBackground = isDark ? 'rgba(255,255,255,0.08)' : palette.surfaceMuted;
  const chipText = isDark ? 'rgba(255,255,255,0.8)' : palette.text;
  const mutedText = isDark ? 'rgba(255,255,255,0.65)' : palette.muted;

  return StyleSheet.create({
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
  syncBannerError: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderColor: 'rgba(249, 115, 22, 0.35)',
  },
  notificationFab: {
    position: 'absolute',
    right: 16,
    width: 57,
    height: 57,
    borderRadius: 18,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.overlayBorderStrong,
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
    backgroundColor: palette.surface,
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
    borderRadius: 26,
    padding: 18,
    borderWidth: 0,
    // Use a fun gradient background for cards (applied in JSX)
    shadowColor: palette.accentBlue,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    marginBottom: 8,
  },
  heroCard: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 10,
    // Gradient background applied in JSX
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
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
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  greetingSubtitle: {
    color: palette.muted,
  },
  heroAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.accentGradient[2],
    borderWidth: 2,
    borderColor: palette.accentPink,
    shadowColor: palette.accentPurple,
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  gettingStartedCard: {
    gap: 12,
  },
  importPromptCard: {
    gap: 14,
  },
  gettingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  gettingTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  gettingSubtitle: {
    color: palette.muted,
    marginTop: 4,
    fontSize: 13,
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.accentGreen,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  demoBadgeText: {
    color: palette.invertedText,
    fontWeight: '800',
    fontSize: 11,
  },
  bulletList: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  bulletText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  helperText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: palette.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    shadowColor: palette.accentPurple,
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  primaryButtonText: {
    color: palette.invertedText,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: palette.accentGradient[1],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    shadowColor: palette.accentPurple,
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  secondaryButtonText: {
    color: palette.invertedText,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statsWrap: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    backgroundColor: palette.card,
    borderWidth: 2,
    borderColor: palette.overlayBorderStrong,
    marginBottom: 0,
    marginRight: 0,
    shadowColor: isDark ? '#000' : '#94A3B8',
    shadowOpacity: isDark ? 0.10 : 0.08,
    shadowRadius: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  statValueBlue: {
    color: palette.accentBlue,
    fontWeight: '800',
    fontSize: 28,
    textShadowColor: isDark ? 'rgba(96,168,250,0.18)' : 'rgba(29,79,215,0.12)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statValueGreen: {
    color: palette.accentGreen,
    fontWeight: '800',
    fontSize: 28,
    textShadowColor: isDark ? 'rgba(34,211,238,0.18)' : 'rgba(15,138,114,0.12)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statLabel: {
    color: mutedText,
    fontWeight: '600',
    marginTop: 6,
    fontSize: 16,
  },
  statCardSlim: {
    backgroundColor: glassCardSoft,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: glassBorderSoft,
  },
  statValueMuted: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  statLabelMuted: {
    color: palette.muted,
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    backgroundColor: palette.card,
    borderColor: palette.overlayBorderStrong,
    shadowColor: isDark ? '#000' : '#94A3B8',
    shadowOpacity: isDark ? 0.10 : 0.08,
    shadowRadius: 8,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: palette.surface,
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
    backgroundColor: palette.surface,
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
    backgroundColor: palette.accentSurface,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.overlayBorderStrong,
  },
  insightsCallToActionText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  insightsSummaryCard: {
    backgroundColor: glassCard,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: glassBorder,
    gap: 12,
  },
  insightsSummaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  insightsSummaryItem: {
    flex: 1,
    backgroundColor: glassCardSoft,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: glassBorderSoft,
    alignItems: 'center',
    gap: 4,
  },
  insightsSummaryIcon: {
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: 'rgba(74,140,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsSummaryValue: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  insightsSummaryLabel: {
    color: palette.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  insightsPeriodLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  eventCard: {
    backgroundColor: glassCardSoft,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: glassBorderSoft,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: isDark ? '#000' : '#94A3B8',
    shadowOpacity: isDark ? 0.35 : 0.12,
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
    backgroundColor: palette.surface,
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
    color: palette.muted,
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
    color: palette.accentBlue,
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
    color: palette.invertedText,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryChip: {
    backgroundColor: palette.surface,
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
    backgroundColor: glassCard,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: glassBorder,
    gap: 14,
  },
  taskCardOverdue: {
    borderColor: 'rgba(255,123,123,0.35)',
  },
  taskCardDone: {
    opacity: 0.75,
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskCardBody: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  taskCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    color: palette.muted,
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    color: mutedText,
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  taskDescription: {
    color: palette.text,
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  taskDetail: {
    color: palette.text,
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
    color: palette.muted,
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
  duePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: chipBackground,
    borderWidth: 1,
    borderColor: palette.overlayBorderStrong,
  },
  duePillOverdue: {
    backgroundColor: 'rgba(255,123,123,0.15)',
    borderColor: 'rgba(255,123,123,0.4)',
  },
  duePillText: {
    color: chipText,
    fontSize: 12,
    fontWeight: '700',
  },
  duePillTextOverdue: {
    color: '#FF7B7B',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillOpen: {
    backgroundColor: 'rgba(74,140,255,0.16)',
    borderColor: 'rgba(74,140,255,0.5)',
  },
  statusPillDone: {
    backgroundColor: 'rgba(90,239,213,0.16)',
    borderColor: 'rgba(90,239,213,0.5)',
  },
  statusPillText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  taskFooterNote: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  taskActionPrimary: {
    backgroundColor: palette.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  taskActionPrimaryText: {
    color: palette.invertedText,
    fontSize: 12,
    fontWeight: '800',
  },
  taskActionSecondary: {
    backgroundColor: chipBackground,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  taskActionSecondaryText: {
    color: chipText,
    fontSize: 12,
    fontWeight: '700',
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: palette.overlayBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceMuted,
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
    borderColor: palette.overlayBorderStrong,
    shadowColor: isDark ? '#000' : '#94A3B8',
    shadowOpacity: isDark ? 0.3 : 0.16,
    shadowRadius: 18,
    gap: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  navLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  navLabelActive: {
    color: palette.primary,
  },
  });
};
