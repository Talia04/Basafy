import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingFlow from './src/screens/Onboarding/OnboardingFlow';
import SignInScreen from './src/screens/Auth/SignInScreen';
import SignUpScreen from './src/screens/Auth/SignUpScreen';
import MainScreen from './src/screens/Main/MainScreen';
import ProfileScreen from './src/screens/Profile/ProfileScreen';
import GmailImportOnboarding from './src/screens/Onboarding/GmailImportOnboarding';

type FlowStep = 'onboarding' | 'signin' | 'signup' | 'gmail-onboarding' | 'main';
type TabKey = 'home' | 'profile' | 'pipeline' | 'calendar' | 'insights';

export default function App() {
  const [step, setStep] = useState<FlowStep>('onboarding');
  const [tab, setTab] = useState<TabKey>('home');

  if (step === 'onboarding') {
    return <OnboardingFlow onComplete={() => setStep('signin')} renderCompletedFallback={false} />;
  }

  if (step === 'signin') {
    return (
      <SignInScreen
        onSwitchToSignUp={() => setStep('signup')}
        onAuthenticated={() => setStep('main')}
      />
    );
  }

  if (step === 'signup') {
    return (
      <SignUpScreen
        onSwitchToSignIn={() => setStep('signin')}
        onSignupComplete={() => setStep('gmail-onboarding')}
      />
    );
  }

  if (step === 'gmail-onboarding') {
    return (
      <SafeAreaProvider>
        <GmailImportOnboarding onSkip={() => setStep('main')} onConnected={() => setStep('main')} />
      </SafeAreaProvider>
    );
  }

  const renderTab = () => {
    if (tab === 'profile') {
      return (
        <ProfileScreen
          activeTab={tab}
          onNavigate={(key: string) => setTab(key as TabKey)}
          onLogout={() => {
            setTab('home');
            setStep('signin');
          }}
        />
      );
    }
    return <MainScreen activeTab={tab} onNavigate={(key: string) => setTab(key as TabKey)} />;
  };

  return (
    <SafeAreaProvider>
      {renderTab()}
    </SafeAreaProvider>
  );
}
