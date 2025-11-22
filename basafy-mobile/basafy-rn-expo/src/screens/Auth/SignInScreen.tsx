import React, { useState } from 'react';
import { Alert, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AuthButton from '../../components/auth/AuthButton';
import TextField from '../../components/auth/TextField';
import { authStyles } from '../../theme/authStyles';
import { signInWithEmail } from '@backend/auth';

type Props = {
  onSwitchToSignUp?: () => void;
  onAuthenticated?: () => void;
};

export default function SignInScreen({ onSwitchToSignUp, onAuthenticated }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

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

        <TouchableOpacity style={authStyles.oauthButton}>
          <Ionicons name="logo-google" size={18} color="#fff" />
          <Text style={authStyles.oauthText}>Continue with Google</Text>
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
    </SafeAreaView>
  );
}
