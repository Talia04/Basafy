import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';
import type { Session } from '@supabase/supabase-js';
import { hasCompletedGmailOnboarding, markGmailOnboardingSeen, persistGmailConnection } from '../../lib/gmailIntegration';
import StatusModal from '../../components/common/StatusModal';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  onConnected?: (session: Session) => void;
  onSkip: () => void;
};

export default function GmailImportOnboarding({ onConnected, onSkip }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [handledSessionId, setHandledSessionId] = useState<string | null>(null);
  const [statusVisible, setStatusVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const isExpoGo = Constants.appOwnership === 'expo';
  const redirectTo =
    (isExpoGo ? process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URI : null) ||
    AuthSession.makeRedirectUri({
      scheme: 'basafy',
      path: 'auth/callback',
    });

  useEffect(() => {
    hasCompletedGmailOnboarding().then((done) => {
      if (done) {
        onSkip();
      }
    });
  }, [onSkip]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        handleSession(data.session);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        handleSession(session);
      } else if (event === 'SIGNED_OUT') {
        setStatus('idle');
        setMessage(null);
        setHandledSessionId(null);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSession = async (session: Session) => {
    if (handledSessionId === session.access_token) return;
    setHandledSessionId(session.access_token);
    setStatus('loading');
    setMessage('Saving Gmail connection…');
    setStatusVisible(true);
    setStatusMessage('Saving Gmail connection…');
    try {
      const email = await persistGmailConnection(session);
      setStatus('success');
      setMessage(`Connected as ${email ?? session.user.email ?? 'your account'}`);
      setStatusMessage(`Connected as ${email ?? session.user.email ?? 'your account'}`);
      onConnected?.(session);
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Unable to save Gmail connection.');
      setStatusMessage(err?.message || 'Unable to save Gmail connection.');
      setHandledSessionId(null);
    }
  };

  const handleConnect = async () => {
    setStatus('loading');
    setMessage('Opening Google to connect Gmail…');
    setStatusVisible(true);
    setStatusMessage('Connecting to Google…');
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'email profile https://www.googleapis.com/auth/gmail.readonly',
          queryParams: { prompt: 'consent' },
          redirectTo,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
          preferEphemeralSession: true,
        });

        if (result.type === 'success' && result.url) {
          const { access_token, refresh_token } = getTokensFromUrl(result.url);
          const authCode = getParam(result.url, 'code');
          if (authCode) {
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
            if (exchangeError) {
              throw exchangeError;
            }
            if (exchangeData?.session) {
              await handleSession(exchangeData.session);
              return;
            }
          }
          if (access_token && refresh_token) {
            const { data: sessionData, error: setError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (setError) {
              throw setError;
            }
            if (sessionData?.session) {
              await handleSession(sessionData.session);
              return;
            }
          }
          // If no code found, fall back to fetching current session
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            await handleSession(sessionData.session);
            return;
          }
          throw new Error('No auth code returned from Google redirect.');
        } else if (result.type === 'dismiss') {
          setStatus('idle');
          setMessage('Sign-in cancelled.');
        } else {
          throw new Error('Auth session did not complete.');
        }
      } else {
        setStatus('error');
        setMessage('No OAuth URL returned. Please try again.');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Unable to start Google sign-in.');
    }
    setTimeout(() => setStatusVisible(false), 2200);
  };

  const handleSkip = async () => {
    setStatus('loading');
    setMessage('Skipping Gmail for now…');
    try {
      await markGmailOnboardingSeen();
      onSkip();
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Unable to skip right now.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#0F1628', '#0B1224']} style={styles.background} />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="mail-unread-outline" size={28} color="#5AEFD5" />
        </View>
        <Text style={styles.title}>Import your job emails from Gmail</Text>
        <Text style={styles.subtitle}>
          Basafy can scan your inbox for applications and interview emails to keep your pipeline
          updated automatically. Connect Gmail to start syncing.
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryButton, status === 'loading' && styles.disabled]}
            activeOpacity={0.9}
            onPress={handleConnect}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <ActivityIndicator color="#0A0E1A" />
            ) : (
              <Text style={styles.primaryButtonText}>Connect Gmail</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9} onPress={() => handleSkip()}>
            <Text style={styles.secondaryButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>

        {message && (
          <View style={[styles.statusPill, status === 'error' ? styles.errorPill : styles.successPill]}>
            <Ionicons
              name={status === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
              size={16}
              color={status === 'error' ? '#FF7B7B' : '#0A0E1A'}
            />
            <Text
              style={[
                styles.statusText,
                status === 'error' ? styles.statusTextError : styles.statusTextSuccess,
              ]}
            >
              {message}
            </Text>
          </View>
        )}
      </View>
      <StatusModal visible={statusVisible} message={statusMessage || message || ''} />
    </SafeAreaView>
  );
}

function getParam(url: string, param: string) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get(param);
  } catch {
    return null;
  }
}

function getTokensFromUrl(url: string) {
  try {
    const hash = url.split('#')[1];
    if (!hash) return { access_token: null, refresh_token: null };
    const params = new URLSearchParams(hash);
    return {
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token'),
    };
  } catch {
    return { access_token: null, refresh_token: null };
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 18,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    fontSize: 16,
    color: palette.muted,
    lineHeight: 22,
  },
  actions: {
    marginTop: 6,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#5AEFD5',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#5AEFD5',
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
  primaryButtonText: {
    color: '#0A0E1A',
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryButtonText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.7,
  },
  statusPill: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 13,
  },
  successPill: {
    backgroundColor: '#5AEFD5',
  },
  errorPill: {
    backgroundColor: 'rgba(255,123,123,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,123,123,0.6)',
  },
  statusTextSuccess: {
    color: '#0A0E1A',
  },
  statusTextError: {
    color: '#FFB0B0',
  },
});
