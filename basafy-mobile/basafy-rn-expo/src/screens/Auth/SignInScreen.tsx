import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AuthButton from '../../components/auth/AuthButton';
import TextField from '../../components/auth/TextField';
import { createAuthStyles } from '../../theme/authStyles';
import { useTheme } from '../../theme/palette';
import { signInWithEmail } from '@backend/auth';
import { signInWithGoogleNative } from '../../lib/googleNativeAuth';
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [statusVisible, setStatusVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const insets = useSafeAreaInsets();

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await signInWithEmail({ email, password });
      Alert.alert('Signed in!', 'You are now logged in.');
      onAuthenticated?.();
    } catch (error: any) {
      Alert.alert('Sign in error', error?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={authStyles.container}>
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
              <Text style={authStyles.forgot}>Forgot password?</Text>
            </View>

            <AuthButton title="Sign In" onPress={handleSubmit} loading={loading} />

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
                    setStatusMessage('Signed in with Google!');
                    onAuthenticated?.();
                  } else {
                    setStatusMessage('Google sign-in did not return a session.');
                  }
                } catch (err: any) {
                  setStatusMessage(
                    err?.message ||
                    'Google sign-in failed. Please ensure Gmail permissions are granted and try again.',
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
