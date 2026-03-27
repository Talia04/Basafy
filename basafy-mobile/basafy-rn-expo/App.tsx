import React, { useEffect, useState } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, queryPersistOptions, clearStaleDateCache } from './src/lib/queryClient';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import SignInScreen from './src/screens/Auth/SignInScreen';
import SignUpScreen from './src/screens/Auth/SignUpScreen';
import MainScreen from './src/screens/Main/MainScreen';
import ProfileScreen from './src/screens/Profile/ProfileScreen';
import ApplicationsScreen, { Application } from './src/screens/Applications/ApplicationsScreen';
import ApplicationDetailScreen from './src/screens/Applications/ApplicationDetailScreen';
import PipelineScreen from './src/screens/Pipeline/PipelineScreen';
import CalendarScreen from './src/screens/Calendar/CalendarScreen';
import InsightsScreen from './src/screens/Insights/InsightsScreen';
import NotificationsScreen from './src/screens/Notifications/NotificationsScreen';
import NotificationSettingsScreen from './src/screens/Notifications/NotificationSettingsScreen';
import ReviewImportedJobsScreen from './src/screens/ReviewImportedJobsScreen';
import OnboardingFlow from './src/screens/Onboarding/OnboardingFlow';
import AccountReadyScreen from './src/screens/Onboarding/AccountReadyScreen';
import GmailConnectScreen from './src/screens/Onboarding/GmailConnectScreen';
import SetupCompleteScreen from './src/screens/Onboarding/SetupCompleteScreen';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { AppState, AppStateStatus, StyleSheet, ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '@backend/supabase/client';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncGmailApplications } from './src/lib/gmailIntegration';
import { GmailBackfillProvider, useGmailBackfill } from './src/lib/GmailBackfillContext';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications, upsertPushToken } from './src/lib/pushNotifications';
import { AppProvider, useApp } from './src/lib/AppContext';
import { ToastContainer } from './src/components/common/Toast';
import { defineBackgroundSyncTask, registerBackgroundSync, setBackgroundSyncAppState } from './src/lib/backgroundSync';
import { scheduleAllReminders } from './src/lib/localReminders';
import { setupGmailWatch, renewWatchIfNeeded } from './src/lib/gmailWatch';
import { hideSplashScreen } from './src/lib/splashScreen';
import { recordAppOpen, maybeRequestReview } from './src/lib/appReview';
import { ThemeProvider } from './src/theme/palette';
import AnimatedSplash from './src/components/splash/AnimatedSplash';

// Define background sync task at top level (required by expo-task-manager)
defineBackgroundSyncTask();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});


type FlowStep =
  | 'loading'
  | 'welcome'
  | 'signin'
  | 'signup'
  | 'account-ready'
  | 'gmail-connect'
  | 'review-imported-jobs'
  | 'setup-complete'
  | 'main';
type TabKey = 'home' | 'profile' | 'pipeline' | 'calendar' | 'applications' | 'insights' | 'notifications' | 'notification-settings';
const APP_SHELL_BACKGROUND = '#0A0E1A';

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: APP_SHELL_BACKGROUND,
  },
  tabShell: {
    flex: 1,
    backgroundColor: APP_SHELL_BACKGROUND,
  },
  tabScene: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: APP_SHELL_BACKGROUND,
  },
  overlayScene: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: APP_SHELL_BACKGROUND,
  },
});

function BackfillProgressBanner({ topInset }: { topInset: number }) {
  const { running, pagesProcessed, done, stop } = useGmailBackfill();
  if (!running && !done) return null;
  const emailsScanned = pagesProcessed * 40;
  // Indeterminate fill that grows to max 90% while running, then 100% when done.
  const fillPct = done ? 100 : Math.min(10 + pagesProcessed * 7, 90);
  return (
    <View
      style={{
        paddingTop: Math.max(topInset, 8),
        paddingHorizontal: 16,
        paddingBottom: 10,
        backgroundColor: 'rgba(10,14,26,0.96)',
        borderBottomWidth: 1,
        borderColor: 'rgba(90,239,213,0.2)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {running ? (
          <ActivityIndicator size="small" color="#5AEFD5" />
        ) : (
          <Text style={{ fontSize: 14 }}>✓</Text>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#E6EDFF', fontWeight: '700', fontSize: 13 }}>
            {done ? 'Gmail import complete' : 'Importing Gmail emails…'}
          </Text>
          <Text style={{ color: 'rgba(230,237,255,0.6)', fontSize: 11 }}>
            {done
              ? `${emailsScanned} emails scanned`
              : emailsScanned > 0
                ? `${emailsScanned} emails scanned so far`
                : 'Starting…'}
          </Text>
        </View>
        {running && (
          <TouchableOpacity
            onPress={stop}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'rgba(230,237,255,0.7)', fontSize: 14, lineHeight: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Progress bar */}
      <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <View
          style={{
            height: 3,
            width: `${fillPct}%`,
            backgroundColor: done ? '#5AEFD5' : '#4A8CFF',
            borderRadius: 2,
          }}
        />
      </View>
    </View>
  );
}

function AppContent() {
  const { toasts, dismissToast } = useApp();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<FlowStep>('loading');
  const [tab, setTab] = useState<TabKey>('home');
  // Track which tabs have ever been visited so we never unmount them (keep-alive).
  const [mountedTabs, setMountedTabs] = useState<Set<TabKey>>(new Set(['home']));
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const { start: startBackfill } = useGmailBackfill();
  const [gmailSkipped, setGmailSkipped] = useState(false);
  const lastUserId = React.useRef<string | null>(null);
  const autoSyncInFlight = React.useRef(false);
  const MIN_FOREGROUND_SYNC_HOURS = 6;
  // Once the user completes Gmail onboarding in-session, skip re-showing even if the profile flag lags.
  const gmailCompletedSession = React.useRef(false);
  // Pending notification data from cold launch tap
  const pendingNotification = React.useRef<{ entity_type?: string; entity_id?: string } | null>(null);

  useEffect(() => {
    Font.loadAsync(Ionicons.font).then(() => {
      setFontsLoaded(true);
    });

    // Check if app was launched from a notification tap (cold start)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data as
          | { entity_type?: string; entity_id?: string }
          | undefined;
        if (data) {
          pendingNotification.current = data;
        }
      }
    });
  }, []);

  useEffect(() => {
    const normalizeState = (state: AppStateStatus): 'active' | 'background' | 'inactive' => {
      if (state === 'active') return 'active';
      if (state === 'background') return 'background';
      return 'inactive';
    };

    setBackgroundSyncAppState(normalizeState(AppState.currentState)).catch(() => {});
    const sub = AppState.addEventListener('change', (nextState) => {
      setBackgroundSyncAppState(normalizeState(nextState)).catch(() => {});
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      hideSplashScreen(3000);
    }
  }, [fontsLoaded]);

  const loadSessionAndProfile = React.useCallback(async () => {
    if (loadingProfile) return;
    setLoadingProfile(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user) {
        lastUserId.current = null;
        gmailCompletedSession.current = false;
        setGmailSkipped(false);
        setStep('welcome');
        return;
      }
      lastUserId.current = session.user.id;
      if (gmailCompletedSession.current) {
        setStep('main');
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('has_seen_gmail_onboarding')
        .eq('id', session.user.id)
        .maybeSingle();
      let seen = error ? false : (data as any)?.has_seen_gmail_onboarding === true;
      if (!seen) {
        const { data: connection } = await supabase
          .from('gmail_connections')
          .select('id, refresh_token')
          .eq('user_id', session.user.id)
          .eq('provider', 'google')
          .maybeSingle();
        if (connection) {
          seen = true;
          gmailCompletedSession.current = true;
          void supabase
            .from('profiles')
            .update({ has_seen_gmail_onboarding: true })
            .eq('id', session.user.id);
        }
      }
      setStep(seen ? 'main' : 'gmail-connect');
    } catch {
      setStep('welcome');
    } finally {
      setLoadingProfile(false);
    }
  }, [loadingProfile]);

  useEffect(() => {
    loadSessionAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event: string, session: typeof supabase.auth.getSession extends (...args: any[]) => Promise<{ data: { session: infer S } }> ? S | null : any) => {
        const userId = session?.user?.id ?? null;
        if (userId && userId !== lastUserId.current) {
          lastUserId.current = userId;
          setStep('loading');
          setTab('home');
          loadSessionAndProfile();
        } else if (!userId) {
          lastUserId.current = null;
          setTab('home');
          setGmailSkipped(false);
          setStep('welcome');
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [loadSessionAndProfile]);

  useEffect(() => {
    const runAutoSync = async () => {
      if (step !== 'main') return;
      if (autoSyncInFlight.current) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const userId = session?.user?.id;
      if (!session?.access_token || !userId) return;

      const storageKey = `basafy:auto-gmail-sync:${userId}`;
      const { data: gmailConnection } = await supabase
        .from('gmail_connections')
        .select('last_synced_at')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .maybeSingle();
      if (!gmailConnection) return;

      let localSyncMs: number | null = null;
      const lastSyncIso = await AsyncStorage.getItem(storageKey);
      if (lastSyncIso) {
        const last = new Date(lastSyncIso);
        if (!Number.isNaN(last.getTime())) {
          localSyncMs = last.getTime();
        }
      }
      let serverSyncMs: number | null = null;
      if (gmailConnection.last_synced_at) {
        const serverLast = new Date(gmailConnection.last_synced_at);
        if (!Number.isNaN(serverLast.getTime())) {
          serverSyncMs = serverLast.getTime();
          if (!localSyncMs || serverSyncMs > localSyncMs) {
            await AsyncStorage.setItem(storageKey, serverLast.toISOString());
          }
        }
      }
      const latestSyncMs =
        localSyncMs && serverSyncMs
          ? Math.max(localSyncMs, serverSyncMs)
          : localSyncMs ?? serverSyncMs;
      if (latestSyncMs) {
        const hoursSince = (Date.now() - latestSyncMs) / (1000 * 60 * 60);
        if (hoursSince < MIN_FOREGROUND_SYNC_HOURS) return;
      }

      autoSyncInFlight.current = true;
      setAutoSyncing(true);
      try {
        await syncGmailApplications(session);
        await syncGmailApplications(session, { enrichOnly: true, maxMessages: 80 });
        await AsyncStorage.setItem(storageKey, new Date().toISOString());
        // Refresh all screens and reschedule local reminders after sync
        queryClient.invalidateQueries({ queryKey: ['applications'] });
        queryClient.invalidateQueries({ queryKey: ['pipeline'] });
        scheduleAllReminders().catch(() => {});
      } catch {
        // Silent fail; user can manually sync from Profile.
      } finally {
        autoSyncInFlight.current = false;
        setAutoSyncing(false);
      }
    };
    runAutoSync();
  }, [step]);

  // Register background sync when user is authenticated
  useEffect(() => {
    if (step === 'main') {
      // Register push notifications and save token to DB
      registerForPushNotifications().then((result) => {
        if (result.ok && result.token) {
          upsertPushToken(result.token, true).catch(() => {});
        }
      }).catch(() => {});

      // Schedule local reminders for upcoming events and tasks
      scheduleAllReminders().catch(() => {});

      // Register background sync for periodic Gmail syncing
      registerBackgroundSync(30).catch((err) => {
        console.warn('[App] Failed to register background sync:', err);
      });

      // Renew Gmail push watch if it's expiring soon
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          renewWatchIfNeeded(data.session).catch(() => {/* silent — non-critical */});
        }
      });

      // Record app open for review prompt system
      recordAppOpen();

      // After a short delay, check if we should prompt for a review
      const reviewTimer = setTimeout(() => {
        maybeRequestReview();
      }, 4000); // 4s delay so the user settles in first

      // Process pending notification from cold launch tap
      if (pendingNotification.current) {
        const data = pendingNotification.current;
        pendingNotification.current = null;
        if (data.entity_type === 'application' && data.entity_id) {
          openApplicationById(data.entity_id);
        } else if ((data as any).type === 'background_sync_complete' || data.entity_type === 'background_sync') {
          navigate('home');
        } else if (data.entity_type === 'event' || data.entity_type === 'task') {
          navigate('calendar');
        } else {
          navigate('notifications');
        }
        refreshUnreadNotifications();
      }

      return () => clearTimeout(reviewTimer);
    }
  }, [step]);

  const refreshUnreadNotifications = React.useCallback(async () => {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);
    setUnreadNotifications(count ?? 0);
  }, []);

  useEffect(() => {
    refreshUnreadNotifications();
    const interval = setInterval(() => {
      refreshUnreadNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, [refreshUnreadNotifications]);

  // Lazy-mount + keep-alive navigation: mount once, then switch instantly.
  const navigate = React.useCallback((key: string) => {
    const newTab = key as TabKey;
    setMountedTabs(prev => {
      if (prev.has(newTab)) return prev;
      const next = new Set(prev);
      next.add(newTab);
      return next;
    });
    setTab(newTab);
  }, []);

  const openApplicationOverlay = React.useCallback((application: Application) => {
    setSelectedApplication(application);
  }, []);

  const openApplicationById = async (applicationId: string) => {
    const { data, error } = await supabase
      .from('applications')
      .select('id, company, role, status, source_type, is_hidden')
      .eq('id', applicationId)
      .maybeSingle();
    if (error || !data) {
      return;
    }
    openApplicationOverlay({
      id: data.id,
      company: data.company,
      role: data.role,
      status: data.status,
      source_type: data.source_type ?? null,
      is_hidden: data.is_hidden ?? false,
      is_starred: false,
    });
  };

  // Refresh unread count when a notification arrives in foreground
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      refreshUnreadNotifications();
    });
    return () => subscription.remove();
  }, [refreshUnreadNotifications]);

  // Handle notification taps — route to the relevant screen
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | { entity_type?: string; entity_id?: string }
          | undefined;

        // Only navigate if user is authenticated (on main flow)
        if (step !== 'main') return;

        if (data?.entity_type === 'application' && data.entity_id) {
          openApplicationById(data.entity_id);
        } else if ((data as any)?.type === 'background_sync_complete' || data?.entity_type === 'background_sync') {
          navigate('home');
        } else if (data?.entity_type === 'event' || data?.entity_type === 'task') {
          navigate('calendar');
        } else {
          navigate('notifications');
        }

        // Refresh unread count
        refreshUnreadNotifications();
      },
    );

    return () => subscription.remove();
  }, [step, refreshUnreadNotifications]);

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <AnimatedSplash />
      </SafeAreaProvider>
    );
  }

  const renderContent = () => {
    if (step === 'loading') {
      return (
        <View style={[styles.appShell, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator />
        </View>
      );
    }

    if (step === 'welcome') {
      return (
        <OnboardingFlow
          onComplete={() => setStep('signup')}
          onSignIn={() => setStep('signin')}
          renderCompletedFallback={false}
        />
      );
    }

    if (step === 'signin') {
      return (
        <SignInScreen
          onSwitchToSignUp={() => setStep('signup')}
          onAuthenticated={() => {
            gmailCompletedSession.current = false;
            setStep('loading');
            loadSessionAndProfile();
          }}
        />
      );
    }

    if (step === 'signup') {
      return (
        <SignUpScreen
          onSwitchToSignIn={() => setStep('signin')}
          onSignupComplete={() => {
            gmailCompletedSession.current = false;
            setStep('account-ready');
          }}
        />
      );
    }

    if (step === 'account-ready') {
      return <AccountReadyScreen onContinue={() => setStep('gmail-connect')} />;
    }

    if (step === 'gmail-connect') {
      return (
        <GmailConnectScreen
          onSkip={() => {
            gmailCompletedSession.current = true;
            setGmailSkipped(true);
            setStep('setup-complete');
          }}
          onConnected={() => {
            gmailCompletedSession.current = true;
            setGmailSkipped(false);
            setStep('setup-complete');
            // Set up Gmail push watch now that OAuth is complete
            supabase.auth.getSession().then(({ data }) => {
              if (data.session) setupGmailWatch(data.session).catch(() => {});
            });
          }}
        />
      );
    }

    if (step === 'review-imported-jobs') {
      return <ReviewImportedJobsScreen onExit={() => setStep('setup-complete')} />;
    }

    if (step === 'setup-complete') {
      return (
        <SetupCompleteScreen
          gmailSkipped={gmailSkipped}
          onGoHome={() => setStep('main')}
          onAddManual={() => {
            navigate('applications');
            setStep('main');
          }}
        />
      );
    }

    // ── Main tabs: lazy-mount + keep-alive ──────────────────────────────────
    // Each tab is mounted on first visit and kept alive (hidden via display:none)
    // on subsequent visits — no re-mount, no loading flicker, instant switches.
    return (
      <View style={styles.tabShell}>
        <View style={styles.tabShell}>

          {mountedTabs.has('home') && (
            <View style={[styles.tabScene, { display: tab === 'home' ? 'flex' : 'none' }]}>
              <MainScreen activeTab={tab} onNavigate={navigate} onOpenApplication={openApplicationById} unreadCount={unreadNotifications} />
            </View>
          )}

          {mountedTabs.has('profile') && (
            <View style={[styles.tabScene, { display: tab === 'profile' ? 'flex' : 'none' }]}>
              <ProfileScreen
                activeTab={tab}
                onNavigate={navigate}
                unreadCount={unreadNotifications}
                onLogout={async () => {
                  // Wipe auth token one more time in case signOut race condition
                  try { await AsyncStorage.removeItem('basafy-auth-token'); } catch {}
                  // Clear all app caches so the next user starts completely fresh
                  try { await AsyncStorage.removeItem('basafy:react-query-cache'); } catch {}
                  try { await AsyncStorage.removeItem('basafy:backfill-persist'); } catch {}
                  queryClient.clear();
                  // Reset internal refs
                  lastUserId.current = null;
                  gmailCompletedSession.current = false;
                  // Tear down all keep-alive tabs
                  setMountedTabs(new Set(['home']));
                  setSelectedApplication(null);
                  setUnreadNotifications(0);
                  setGmailSkipped(false);
                  setTab('home');
                  setStep('welcome');
                }}
                onGmailSyncComplete={() => setStep('review-imported-jobs')}
              />
            </View>
          )}

          {mountedTabs.has('notifications') && (
            <View style={[styles.tabScene, { display: tab === 'notifications' ? 'flex' : 'none' }]}>
              <NotificationsScreen
                activeTab={tab}
                onNavigate={navigate}
                onOpenApplication={openApplicationById}
                unreadCount={unreadNotifications}
                onNotificationsChanged={refreshUnreadNotifications}
              />
            </View>
          )}

          {mountedTabs.has('applications') && (
            <View style={[styles.tabScene, { display: tab === 'applications' ? 'flex' : 'none' }]}>
              <ApplicationsScreen
                activeTab={tab}
                onNavigate={navigate}
                onOpenApplication={openApplicationOverlay}
                unreadCount={unreadNotifications}
              />
            </View>
          )}

          {mountedTabs.has('pipeline') && (
            <View style={[styles.tabScene, { display: tab === 'pipeline' ? 'flex' : 'none' }]}>
              <PipelineScreen
                activeTab={tab}
                onNavigate={navigate}
                unreadCount={unreadNotifications}
                onOpenApplication={(application) => {
                  openApplicationOverlay({
                    id: application.id,
                    company: application.company,
                    role: application.role,
                    status: application.status,
                    source_type: application.source_type ?? null,
                    is_hidden: false,
                    is_starred: false,
                  });
                }}
              />
            </View>
          )}

          {mountedTabs.has('calendar') && (
            <View style={[styles.tabScene, { display: tab === 'calendar' ? 'flex' : 'none' }]}>
              <CalendarScreen
                activeTab={tab}
                onNavigate={navigate}
                unreadCount={unreadNotifications}
                onOpenApplication={(application) => {
                  openApplicationOverlay({
                    id: application.id,
                    company: application.company,
                    role: application.role,
                    status: application.status,
                    source_type: application.source_type ?? null,
                    is_hidden: false,
                    is_starred: false,
                  });
                }}
              />
            </View>
          )}

          {mountedTabs.has('insights') && (
            <View style={[styles.tabScene, { display: tab === 'insights' ? 'flex' : 'none' }]}>
              <InsightsScreen
                activeTab={tab}
                onNavigate={navigate}
                onOpenApplication={(application) => openApplicationById(application.id)}
                unreadCount={unreadNotifications}
              />
            </View>
          )}

          {/* notification-settings is a pushed sub-screen — not kept alive */}
          {tab === 'notification-settings' && (
            <View style={styles.overlayScene}>
              <NotificationSettingsScreen activeTab="profile" onNavigate={navigate} unreadCount={unreadNotifications} />
            </View>
          )}

          {/* Application detail: full-screen overlay on top of the applications tab */}
          {selectedApplication && (
            <View style={styles.overlayScene}>
              <ApplicationDetailScreen
                application={selectedApplication}
                onBack={() => setSelectedApplication(null)}
              />
            </View>
          )}

        </View>
      </View>
    );
  };

  return (
    <ErrorBoundary>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <View style={styles.appShell}>
        <BackfillProgressBanner topInset={insets.top} />
        {renderContent()}
        {showAnimatedSplash && (
          <AnimatedSplash onFinish={() => setShowAnimatedSplash(false)} />
        )}
      </View>
    </ErrorBoundary>
  );
}

export default function App() {
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    clearStaleDateCache().then(() => {
      queryClient.clear();
      setCacheReady(true);
    });
  }, []);

  if (!cacheReady) {
    return <View style={styles.appShell} />;
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={queryPersistOptions}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppProvider>
            <GmailBackfillProvider>
              <AppContent />
            </GmailBackfillProvider>
          </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}
