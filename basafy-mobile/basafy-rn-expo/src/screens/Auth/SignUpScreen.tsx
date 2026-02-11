import React, { useState } from 'react';
import { Alert, Linking, Text, TouchableOpacity, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Checkbox from 'expo-checkbox';
import { createAuthStyles } from '../../theme/authStyles';
import { useTheme } from '../../theme/palette';
import TextField from '../../components/auth/TextField';
import AuthButton from '../../components/auth/AuthButton';
import { signUpWithEmail } from '@backend/auth';
import { signInWithGoogleNative } from '../../lib/googleNativeAuth';
import StatusModal from '../../components/common/StatusModal';

type Props = {
  onSwitchToSignIn?: () => void;
  onSignupComplete?: () => void;
};

export default function SignUpScreen({ onSwitchToSignIn, onSignupComplete }: Props) {
  const { palette } = useTheme();
  const authStyles = createAuthStyles(palette);
  const legalBaseUrl = 'https://basafy.com';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [statusVisible, setStatusVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const insets = useSafeAreaInsets();

  const handleSubmit = async () => {
    if (!accepted) {
      Alert.alert('Please accept the Terms of Service and Privacy Policy.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match');
      return;
    }
    try {
      setLoading(true);
      await signUpWithEmail({ email, password, fullName });
      Alert.alert('Check your email to verify your account.');
      onSignupComplete?.();
    } catch (error: any) {
      Alert.alert('Sign up error', error?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const openLegal = async (path: string) => {
    const url = `${legalBaseUrl}${path}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Unable to open link', 'Please try again later.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link', 'Please try again later.');
    }
  };

  return (
    <SafeAreaView style={authStyles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 32}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 48 }}
        >
          <View style={authStyles.card}>
            <View style={authStyles.iconWrapper}>
              <LinearGradient colors={['#4A8CFF', '#5AEFD5']} style={{ padding: 12, borderRadius: 18 }}>
                <Ionicons name="sparkles" size={28} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={authStyles.heading}>Create your account</Text>
            <Text style={authStyles.subheading}>Start tracking your job search journey</Text>

            <TextField
              label="Full Name"
              placeholder="John Doe"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              icon="person-outline"
            />
            <TextField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              icon="mail-outline"
            />
            <TextField
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secure}
              icon="lock-closed-outline"
              rightIcon={secure ? 'eye-off-outline' : 'eye-outline'}
              onPressRightIcon={() => setSecure((s) => !s)}
            />
            <TextField
              label="Confirm Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={secure}
              icon="lock-closed-outline"
              rightIcon={secure ? 'eye-off-outline' : 'eye-outline'}
              onPressRightIcon={() => setSecure((s) => !s)}
            />

            <View style={authStyles.checkboxRow}>
              <Checkbox value={accepted} onValueChange={setAccepted} color={accepted ? '#4A8CFF' : undefined} />
              <Text style={authStyles.termsText}>
                I agree to the{' '}
                <Text style={authStyles.link} onPress={() => openLegal('/terms')}>
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text style={authStyles.link} onPress={() => openLegal('/privacy')}>
                  Privacy Policy
                </Text>
              </Text>
            </View>

            <AuthButton title="Create Account" onPress={handleSubmit} loading={loading} />

            <View style={authStyles.oauthSeparator}>
              <Text style={authStyles.oauthSeparatorText}>OR</Text>
            </View>

            <TouchableOpacity
              style={authStyles.oauthButton}
              onPress={async () => {
                try {
                  setGoogleLoading(true);
                  setStatusVisible(true);
                  setStatusMessage('Connecting to Google (read-only Gmail)…');
                  const result = await signInWithGoogleNative();
                  if (result?.session) {
                    setStatusMessage('Signed up with Google!');
                    onSignupComplete?.();
                  } else {
                    setStatusMessage('Google sign-up did not return a session.');
                  }
                } catch (err: any) {
                  setStatusMessage(
                    err?.message ||
                    'Google sign-up failed. Please ensure Gmail permissions are granted and try again.',
                  );
                } finally {
                  setGoogleLoading(false);
                  setTimeout(() => setStatusVisible(false), 1200);
                }
              }}
              disabled={googleLoading}
            >
              <Ionicons name="logo-google" size={18} color="#fff" />
              <Text style={authStyles.oauthText}>{googleLoading ? 'Connecting…' : 'Continue with Google'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={authStyles.oauthButton}>
              <Ionicons name="logo-github" size={18} color="#fff" />
              <Text style={authStyles.oauthText}>Continue with GitHub</Text>
            </TouchableOpacity>

            <Text style={authStyles.footerText}>
              Already have an account?{' '}
              <Text style={authStyles.footerLink} onPress={onSwitchToSignIn}>
                Sign in
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <StatusModal visible={statusVisible} message={statusMessage} />
    </SafeAreaView>
  );
}
