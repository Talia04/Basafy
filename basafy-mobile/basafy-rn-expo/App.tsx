import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import GmailImportOnboarding from './src/screens/Onboarding/GmailImportOnboarding';
import ReviewImportedJobsScreen from './src/screens/ReviewImportedJobsScreen';
import WelcomeScreen from './src/screens/Onboarding/WelcomeScreen';
import AccountReadyScreen from './src/screens/Onboarding/AccountReadyScreen';
import GmailConnectScreen from './src/screens/Onboarding/GmailConnectScreen';
import SyncProgressScreen from './src/screens/Onboarding/SyncProgressScreen';
import SetupCompleteScreen from './src/screens/Onboarding/SetupCompleteScreen';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { supabase } from '@backend/supabase/client';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncGmailApplications } from './src/lib/gmailIntegration';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});


type FlowStep =
  | 'loading'
  | 'welcome'
  | 'signin'
  | 'signup'
  | 'account-ready'
  | 'gmail-connect'
  | 'sync-progress'
  | 'review-imported-jobs'
  | 'setup-complete'
  | 'main';
type TabKey = 'home' | 'profile' | 'pipeline' | 'calendar' | 'applications' | 'insights' | 'notifications' | 'notification-settings';

export default function App() {
  const [step, setStep] = useState<FlowStep>('loading');
  const [tab, setTab] = useState<TabKey>('home');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [gmailSkipped, setGmailSkipped] = useState(false);
  const lastUserId = React.useRef<string | null>(null);
  const autoSyncInFlight = React.useRef(false);
  // Once the user completes Gmail onboarding in-session, skip re-showing even if the profile flag lags.
  const gmailCompletedSession = React.useRef(false);

  useEffect(() => {
    Font.loadAsync(Ionicons.font).then(() => setFontsLoaded(true));
  }, []);

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
      const seen = error ? false : (data as any)?.has_seen_gmail_onboarding === true;
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
      const lastSyncIso = await AsyncStorage.getItem(storageKey);
      if (lastSyncIso) {
        const last = new Date(lastSyncIso);
        if (!Number.isNaN(last.getTime())) {
          const hoursSince = (Date.now() - last.getTime()) / (1000 * 60 * 60);
          if (hoursSince < 2) return;
        }
      }

      autoSyncInFlight.current = true;
      setAutoSyncing(true);
      try {
        await syncGmailApplications(session);
        await syncGmailApplications(session, { enrichOnly: true, maxMessages: 80 });
        await AsyncStorage.setItem(storageKey, new Date().toISOString());
      } catch {
        // Silent fail; user can manually sync from Profile.
      } finally {
        autoSyncInFlight.current = false;
        setAutoSyncing(false);
      }
    };
    runAutoSync();
  }, [step]);

  useEffect(() => {
    if (tab !== 'applications') {
      setSelectedApplication(null);
    }
  }, [tab]);

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

  const openApplicationById = async (applicationId: string) => {
    const { data, error } = await supabase
      .from('applications')
      .select('id, company, role, status, source_type, is_hidden')
      .eq('id', applicationId)
      .maybeSingle();
    if (error || !data) {
      setTab('applications');
      return;
    }
    setSelectedApplication({
      id: data.id,
      company: data.company,
      role: data.role,
      status: data.status,
      source_type: data.source_type ?? null,
      is_hidden: data.is_hidden ?? false,
    });
    setTab('applications');
  };

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      </SafeAreaProvider>
    );
  }

  const renderContent = () => {
    if (step === 'loading') {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      );
    }

    if (step === 'welcome') {
      return (
        <WelcomeScreen
          onContinue={() => setStep('signup')}
          onSignIn={() => setStep('signin')}
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
            setStep('sync-progress');
          }}
        />
      );
    }

    if (step === 'sync-progress') {
      return (
        <SyncProgressScreen
          onContinue={() => {
            gmailCompletedSession.current = true;
            setStep('setup-complete');
          }}
          onReview={() => {
            gmailCompletedSession.current = true;
            setStep('review-imported-jobs');
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
            setTab('applications');
            setStep('main');
          }}
        />
      );
    }

    if (tab === 'profile') {
      return (
        <ProfileScreen
          activeTab={tab}
          onNavigate={(key: string) => setTab(key as TabKey)}
          unreadCount={unreadNotifications}
          onLogout={() => {
            setTab('home');
            setStep('welcome');
          }}
          onGmailSyncComplete={() => setStep('review-imported-jobs')}
        />
      );
    }
    if (tab === 'notifications') {
      return (
        <NotificationsScreen
          activeTab={tab}
          onNavigate={(key: string) => setTab(key as TabKey)}
          onOpenApplication={openApplicationById}
          unreadCount={unreadNotifications}
          onNotificationsChanged={refreshUnreadNotifications}
        />
      );
    }
    if (tab === 'notification-settings') {
      return (
        <NotificationSettingsScreen
          activeTab="profile"
          onNavigate={(key: string) => setTab(key as TabKey)}
          unreadCount={unreadNotifications}
        />
      );
    }
    if (tab === 'applications') {
      if (selectedApplication) {
        return (
          <ApplicationDetailScreen
            application={selectedApplication}
            onBack={() => setSelectedApplication(null)}
          />
        );
      }
      return (
        <ApplicationsScreen
          activeTab={tab}
          onNavigate={(key: string) => setTab(key as TabKey)}
          onOpenApplication={setSelectedApplication}
          unreadCount={unreadNotifications}
        />
      );
    }
    if (tab === 'pipeline') {
      return (
        <PipelineScreen
          activeTab={tab}
          onNavigate={(key: string) => setTab(key as TabKey)}
          unreadCount={unreadNotifications}
          onOpenApplication={(application) => {
            setSelectedApplication({
              id: application.id,
              company: application.company,
              role: application.role,
              status: application.status,
              source_type: application.source_type ?? null,
              is_hidden: false,
            });
            setTab('applications');
          }}
        />
      );
    }
    if (tab === 'calendar') {
      return (
        <CalendarScreen
          activeTab={tab}
          onNavigate={(key: string) => setTab(key as TabKey)}
          unreadCount={unreadNotifications}
          onOpenApplication={(application) => {
            setSelectedApplication({
              id: application.id,
              company: application.company,
              role: application.role,
              status: application.status,
              source_type: application.source_type ?? null,
              is_hidden: false,
            });
            setTab('applications');
          }}
        />
      );
    }
    if (tab === 'insights') {
      return (
        <InsightsScreen
          activeTab={tab}
          onNavigate={(key: string) => setTab(key as TabKey)}
          unreadCount={unreadNotifications}
        />
      );
    }
    // Fallback: render MainScreen for all other cases
    return (
      <MainScreen
        activeTab={tab}
        onNavigate={(key: string) => setTab(key as TabKey)}
        unreadCount={unreadNotifications}
      />
    );
  };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        {renderContent()}
        {autoSyncing && (
          <View
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 28,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: 'rgba(20,26,40,0.92)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <ActivityIndicator size="small" color="#9CC6FF" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#E6EDFF', fontWeight: '700' }}>Syncing Gmail</Text>
              <Text style={{ color: 'rgba(230,237,255,0.7)', fontSize: 12 }}>Updating tasks and events…</Text>
            </View>
          </View>
        )}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
