import React, { useState } from 'react';
import OnboardingFlow from './src/screens/Onboarding/OnboardingFlow';
import SignInScreen from './src/screens/Auth/SignInScreen';
import SignUpScreen from './src/screens/Auth/SignUpScreen';
import MainScreen from './src/screens/Main/MainScreen';

type FlowStep = 'onboarding' | 'signin' | 'signup' | 'main';

export default function App() {
  const [step, setStep] = useState<FlowStep>('onboarding');

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
        onSignupComplete={() => setStep('main')}
      />
    );
  }

  return <MainScreen />;
}
