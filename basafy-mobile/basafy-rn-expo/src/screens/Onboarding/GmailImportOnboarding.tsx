import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';
import type { Session } from '@supabase/supabase-js';
import {
  hasCompletedGmailOnboarding,
  markGmailOnboardingSeen,
  persistGmailConnection,
  persistGmailConnectionWithAuthCode,
  syncGmailApplications,
} from '../../lib/gmailIntegration';
import { connectGmailWithGoogleNative } from '../../lib/googleNativeAuth';
import StatusModal from '../../components/common/StatusModal';

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
  const latestProviderRefreshToken = React.useRef<string | null>(null);
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    hasCompletedGmailOnboarding().then((done) => {
      if (done) {
        onSkip();
      }
    });
  }, [onSkip]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (data.session?.user) {
        handleSession(data.session);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
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
    const refreshToken =
      latestProviderRefreshToken.current ||
      // fallback to provider_refresh_token from session if present
      (session as any)?.provider_refresh_token ||
      (session as any)?.provider_token ||
      null;
    if (!refreshToken) {
      setStatus('idle');
      setMessage(null);
      setStatusVisible(false);
      return;
    }
    if (handledSessionId === session.access_token) return;
    setHandledSessionId(session.access_token);
    setStatus('loading');
    setMessage('Saving Gmail connection…');
    setStatusVisible(true);
    setStatusMessage('Saving Gmail connection…');
    try {
      const seedResult = await persistGmailConnection(
        session,
        refreshToken,
        authTokenOverride,
      );
      setStatus('success');
      const connectedEmail = seedResult?.email ?? session.user.email ?? 'your account';
      setMessage(`Connected as ${connectedEmail}`);
      setStatusMessage(`Connected as ${connectedEmail}`);
      if (!seedResult?.has_refresh_token) {
        setStatusMessage('Connected, but Gmail did not return a refresh token. Please reconnect.');
        setTimeout(() => {
          setStatusVisible(false);
          onConnected?.(session);
        }, 800);
        return;
      }
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
      const friendly =
        err?.message ||
        'Unable to connect to Gmail. Please confirm Gmail permission and try again. You can skip and connect later.';
      setStatus('error');
      setMessage(friendly);
      setStatusMessage(friendly);
      setHandledSessionId(null);
    }
  };

  const handleConnect = async () => {
    setStatus('loading');
    setMessage('Opening Google to connect Gmail…');
    setStatusVisible(true);
    setStatusMessage('Connecting to Google… This can take a moment.');
    try {
      // Always use native Google sign-in on dev/prod builds.
      // Note: Expo Go does not support native modules; use a dev client or production build.
      if (isExpoGo) {
        throw new Error('Gmail connect needs a development build. Please run with a dev client or production build.');
      }
      const nativeResult = await connectGmailWithGoogleNative();
      console.log('gmail oauth native result', {
        serverAuthCodePresent: !!nativeResult?.serverAuthCode,
        email: nativeResult?.email ?? null,
      });
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) {
        throw new Error('Not authenticated.');
      }
      const seedResult = await persistGmailConnectionWithAuthCode(
        session,
        nativeResult.serverAuthCode,
        session.access_token,
      );
      const connectedEmail = seedResult?.email ?? session.user.email ?? 'your account';
      setStatus('success');
      setMessage(`Connected as ${connectedEmail}`);
      setStatusMessage(`Connected as ${connectedEmail}`);
      if (!seedResult?.has_refresh_token) {
        setStatusMessage('Connected, but Gmail did not return a refresh token. Please reconnect.');
        setTimeout(() => {
          setStatusVisible(false);
          onConnected?.(session);
        }, 800);
        return;
      }
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
        const errMessage =
          syncErr?.message || 'Import failed. You can re-sync from Settings > Gmail later.';
        setStatusMessage(errMessage);
        setTimeout(() => {
          setStatusVisible(false);
          onConnected?.(session);
        }, 800);
      }
      return;
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Unable to start Google sign-in.');
      setStatusMessage(err?.message || 'Unable to start Google sign-in.');
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
          Read-only access. We only scan job-related emails (applications, interviews) to keep your pipeline updated.
          Manage or disconnect anytime in Settings.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoItem}>• Read-only Gmail access</Text>
          <Text style={styles.infoItem}>• Focused on job applications & interview threads</Text>
          <Text style={styles.infoItem}>• You can re-sync or disconnect later</Text>
        </View>
        {isExpoGo && (
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle-outline" size={16} color="#9CC6FF" />
            <Text style={styles.noticeText}>
              Gmail connect needs a development build. Expo Go won&apos;t support the Google native flow.
            </Text>
          </View>
        )}

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
          <TouchableOpacity
            style={[styles.secondaryButton, status === 'loading' && styles.disabled]}
            activeOpacity={0.9}
            onPress={() => handleSkip()}
            disabled={status === 'loading'}
          >
            <Text style={styles.secondaryButtonText}>Skip for now (you can connect later)</Text>
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
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  infoItem: {
    color: palette.muted,
    fontSize: 13,
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
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  noticeText: {
    color: palette.muted,
    fontSize: 12,
    flex: 1,
  },
  debugPill: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  debugText: {
    color: '#B8C6FF',
    fontSize: 12,
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
