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
import {
  hasCompletedGmailOnboarding,
  markGmailOnboardingSeen,
  persistGmailConnection,
  syncGmailApplications,
} from '../../lib/gmailIntegration';
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
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const latestProviderRefreshToken = React.useRef<string | null>(null);
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

  const handleSession = async (session: Session, authTokenOverride?: string | null) => {
    if (handledSessionId === session.access_token) return;
    setHandledSessionId(session.access_token);
    setStatus('loading');
    setMessage('Saving Gmail connection…');
    setStatusVisible(true);
    setStatusMessage('Saving Gmail connection…');
    try {
      const email = await persistGmailConnection(
        session,
        latestProviderRefreshToken.current ||
          // fallback to provider_refresh_token from session if present
          (session as any)?.provider_refresh_token ||
          (session as any)?.provider_token ||
          null,
        authTokenOverride,
      );
      setStatus('success');
      setMessage(`Connected as ${email ?? session.user.email ?? 'your account'}`);
      setStatusMessage(`Connected as ${email ?? session.user.email ?? 'your account'}`);
      setLastSession(session);
      // start sync automatically
      setStatusVisible(true);
      setStatusMessage('Importing your job applications…');
      try {
        const syncResult = await syncGmailApplications(session);
        const importedCount = syncResult?.processed ?? 0;
        setStatusMessage(`Imported ${importedCount} messages from Gmail`);
        setTimeout(() => {
          setStatusVisible(false);
          onConnected?.(session);
        }, 600);
      } catch (syncErr: any) {
        const errMessage = syncErr?.message || 'Import failed. You can re-sync from Profile later.';
        setStatusMessage(errMessage);
        // allow user to continue even if sync failed
        setTimeout(() => {
          setStatusVisible(false);
          onConnected?.(session);
        }, 800);
      }
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
    const { data: originalSessionData } = await supabase.auth.getSession();
    const originalSession = originalSessionData.session;
    const originalToken = originalSession?.access_token || null;
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'email profile https://www.googleapis.com/auth/gmail.readonly',
          queryParams: { prompt: 'consent', access_type: 'offline' },
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
          const { access_token, refresh_token, provider_refresh_token } = getTokensFromUrl(result.url);
          if (provider_refresh_token || refresh_token) {
            latestProviderRefreshToken.current = provider_refresh_token ?? refresh_token ?? null;
          }

          const authCode = getParam(result.url, 'code');
          if (authCode) {
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
            if (exchangeError) {
              throw exchangeError;
            }
            if (exchangeData?.session) {
              const providerRefresh = (exchangeData.session as any)?.provider_refresh_token;
              if (providerRefresh) {
                latestProviderRefreshToken.current = providerRefresh;
              }
              await handleSession(exchangeData.session, exchangeData.session.access_token);
              return;
            }
          }

          let sessionToUse = originalSession;
          let tokenToUse: string | null = originalToken;

          if (!sessionToUse && access_token && refresh_token) {
            const { data: sessionData, error: setError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (setError) {
              throw setError;
            }
            if (sessionData?.session) {
              sessionToUse = sessionData.session;
              tokenToUse = sessionData.session.access_token;
            }
          }

          if (!sessionToUse) {
            const { data: fallback } = await supabase.auth.getSession();
            sessionToUse = fallback.session;
            tokenToUse = fallback.session?.access_token || tokenToUse;
          }

          if (!sessionToUse || !tokenToUse) {
            throw new Error('No active user session found to attach Gmail connection.');
          }

          await handleSession(sessionToUse, tokenToUse);
          return;
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
    if (!hash) return { access_token: null, refresh_token: null, provider_refresh_token: null };
    const params = new URLSearchParams(hash);
    return {
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token'),
      provider_refresh_token: params.get('provider_refresh_token'),
    };
  } catch {
    return { access_token: null, refresh_token: null, provider_refresh_token: null };
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0D1426',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalBody: {
    color: palette.muted,
    lineHeight: 20,
  },
  modalFooter: {
    marginTop: 4,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#5AEFD5',
  },
  modalButtonText: {
    color: '#0A0E1A',
    fontWeight: '800',
    fontSize: 15,
  },
});
