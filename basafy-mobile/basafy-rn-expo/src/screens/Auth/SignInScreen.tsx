import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import AuthButton from '../../components/auth/AuthButton';
import TextField from '../../components/auth/TextField';
import { createAuthStyles } from '../../theme/authStyles';
import { useTheme } from '../../theme/palette';
import { sendPasswordResetEmail, signInWithEmail } from '@backend/auth';
import { signInWithGoogleNative } from '../../lib/googleNativeAuth';
import { isAppleSignInAvailable, signInWithAppleNative } from '../../lib/appleNativeAuth';
import StatusModal from '../../components/common/StatusModal';

type Props = {
  onSwitchToSignUp?: () => void;
  onAuthenticated?: () => void;
};

export default function SignInScreen({ onSwitchToSignUp, onAuthenticated }: Props) {
  const { palette } = useTheme();
  const authStyles = createAuthStyles(palette);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [statusVisible, setStatusVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    try {
      setLoading(true);
      await signInWithEmail({ email, password });
      onAuthenticated?.();
    } catch (error: any) {
      Alert.alert('Sign in error', 'Unable to sign in. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Reset password', 'Enter your email address above to receive a reset link.');
      return;
    }
    try {
      await sendPasswordResetEmail(trimmedEmail);
      Alert.alert('Check your email', 'We sent you a password reset link.');
    } catch (error: any) {
      Alert.alert('Reset failed', 'Unable to send reset email. Please try again later.');
    }
  };

  return (
    <SafeAreaView style={authStyles.container}>
      <LinearGradient
        colors={['#0A0E1A', '#121B34', '#0A0E1A']}
        style={StyleSheet.absoluteFillObject}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 24}
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
            <Text style={authStyles.heading}>Welcome back</Text>
            <Text style={authStyles.subheading}>Sign in to continue your job search</Text>

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

            <View style={authStyles.helperRow}>
              <View />
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={authStyles.forgot}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <AuthButton title="Sign In" onPress={handleSubmit} loading={loading} />

            <View style={authStyles.oauthSeparator}>
              <Text style={authStyles.oauthSeparatorText}>OR</Text>
            </View>

            {appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={16}
                style={authStyles.appleButton}
                onPress={async () => {
                  if (appleLoading) return;
                  try {
                    setAppleLoading(true);
                    setStatusVisible(true);
                    setStatusMessage('Connecting to Apple…');
                    const result = await signInWithAppleNative();
                    if (result?.data?.session) {
                      setStatusMessage('Signed in with Apple!');
                      onAuthenticated?.();
                    } else {
                      setStatusMessage('Apple sign-in did not return a session.');
                    }
                  } catch (err: any) {
                    const friendly =
                      err?.message === 'Apple sign-in was cancelled.'
                        ? err.message
                        : 'Apple sign-in failed. Please try again.';
                    setStatusMessage(friendly);
                  } finally {
                    setAppleLoading(false);
                    setTimeout(() => setStatusVisible(false), 1200);
                  }
                }}
              />
            )}

            <TouchableOpacity
              style={authStyles.oauthButton}
              onPress={async () => {
                try {
                  setGoogleLoading(true);
                  setStatusVisible(true);
                  setStatusMessage('Connecting to Google…');
                  const result = await signInWithGoogleNative();
                  if (result?.session) {
                    setStatusMessage('Signed in with Google!');
                    onAuthenticated?.();
                  } else {
                    setStatusMessage('Google sign-in did not return a session.');
                  }
                } catch (err: any) {
                  setStatusMessage('Google sign-in failed. Please try again.');
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

            <Text style={authStyles.footerText}>
              Don&apos;t have an account?{' '}
              <Text style={authStyles.footerLink} onPress={onSwitchToSignUp}>
                Sign up
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <StatusModal visible={statusVisible} message={statusMessage} />
    </SafeAreaView>
  );
}
