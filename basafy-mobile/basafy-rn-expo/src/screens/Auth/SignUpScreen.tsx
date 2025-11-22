import React, { useState } from 'react';
import { Alert, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Checkbox from 'expo-checkbox';
import { authStyles } from '../../theme/authStyles';
import TextField from '../../components/auth/TextField';
import AuthButton from '../../components/auth/AuthButton';
import { signUpWithEmail } from '@backend/auth';

type Props = {
  onSwitchToSignIn?: () => void;
  onSignupComplete?: () => void;
};

export default function SignUpScreen({ onSwitchToSignIn, onSignupComplete }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

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

  return (
    <SafeAreaView style={authStyles.container}>
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
            I agree to the <Text style={authStyles.link}>Terms of Service</Text> and{' '}
            <Text style={authStyles.link}>Privacy Policy</Text>
          </Text>
        </View>

        <AuthButton title="Create Account" onPress={handleSubmit} loading={loading} />

        <View style={authStyles.oauthSeparator}>
          <Text style={authStyles.oauthSeparatorText}>OR</Text>
        </View>

        <TouchableOpacity style={authStyles.oauthButton}>
          <Ionicons name="logo-google" size={18} color="#fff" />
          <Text style={authStyles.oauthText}>Continue with Google</Text>
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
    </SafeAreaView>
  );
}
