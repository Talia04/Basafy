import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingFlow from './src/screens/Onboarding/OnboardingFlow';
import SignInScreen from './src/screens/Auth/SignInScreen';
import SignUpScreen from './src/screens/Auth/SignUpScreen';
import MainScreen from './src/screens/Main/MainScreen';
import ProfileScreen from './src/screens/Profile/ProfileScreen';
import ApplicationsScreen, { Application } from './src/screens/Applications/ApplicationsScreen';
import ApplicationDetailScreen from './src/screens/Applications/ApplicationDetailScreen';
import PipelineScreen from './src/screens/Pipeline/PipelineScreen';
import CalendarScreen from './src/screens/Calendar/CalendarScreen';
import InsightsScreen from './src/screens/Insights/InsightsScreen';
import GmailImportOnboarding from './src/screens/Onboarding/GmailImportOnboarding';
import ReviewImportedJobsScreen from './src/screens/ReviewImportedJobsScreen';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { supabase } from '@backend/supabase/client';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncGmailApplications } from './src/lib/gmailIntegration';


type FlowStep = 'loading' | 'onboarding' | 'signin' | 'signup' | 'gmail-onboarding' | 'review-imported-jobs' | 'main';
type TabKey = 'home' | 'profile' | 'pipeline' | 'calendar' | 'applications' | 'insights';

export default function App() {
  const [step, setStep] = useState<FlowStep>('loading');
  const [tab, setTab] = useState<TabKey>('home');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
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
        setStep('onboarding');
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
      setStep(seen ? 'main' : 'gmail-onboarding');
    } catch {
      setStep('onboarding');
    } finally {
      setLoadingProfile(false);
    }
  }, [loadingProfile]);

  useEffect(() => {
    loadSessionAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      if (userId && userId !== lastUserId.current) {
        lastUserId.current = userId;
        setStep('loading');
        setTab('home');
        loadSessionAndProfile();
      } else if (!userId) {
        lastUserId.current = null;
        setTab('home');
        setStep('signin');
      }
    });

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

    if (step === 'onboarding') {
      return <OnboardingFlow onComplete={() => setStep('signin')} renderCompletedFallback={false} />;
    }

    if (step === 'signin') {
      return (
        <SignInScreen
          onSwitchToSignUp={() => setStep('signup')}
          onAuthenticated={() => {
            setStep('review-imported-jobs');
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
            setStep('review-imported-jobs');
          }}
        />
      );
    }

  if (step === 'gmail-onboarding') {
    return (
      <GmailImportOnboarding
        onSkip={() => {
          gmailCompletedSession.current = true;
          setStep('main');
        }}
        onConnected={() => {
          gmailCompletedSession.current = true;
          setStep('review-imported-jobs');
        }}
      />
    );
  }

  if (step === 'review-imported-jobs') {
    return <ReviewImportedJobsScreen onExit={() => setStep('main')} />;
  }

    if (tab === 'profile') {
      return (
        <ProfileScreen
          activeTab={tab}
          onNavigate={(key: string) => setTab(key as TabKey)}
          onLogout={() => {
            setTab('home');
            setStep('signin');
          }}
          onGmailSyncComplete={() => setStep('review-imported-jobs')}
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
        />
      );
    }
    if (tab === 'pipeline') {
      return (
        <PipelineScreen
          activeTab={tab}
          onNavigate={(key: string) => setTab(key as TabKey)}
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
      return <InsightsScreen activeTab={tab} onNavigate={(key: string) => setTab(key as TabKey)} />;
    }
    // Fallback: render MainScreen for all other cases
    return <MainScreen activeTab={tab} onNavigate={(key: string) => setTab(key as TabKey)} />;
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
