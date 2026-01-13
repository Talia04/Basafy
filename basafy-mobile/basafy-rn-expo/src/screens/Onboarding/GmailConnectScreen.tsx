import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';
import { connectGmailWithGoogleNative } from '../../lib/googleNativeAuth';
import {
  markGmailOnboardingSeen,
  persistGmailConnection,
  persistGmailConnectionWithAuthCode,
} from '../../lib/gmailIntegration';
import StatusModal from '../../components/common/StatusModal';

type Props = {
  onConnected: () => void;
  onSkip: () => void;
};

export default function GmailConnectScreen({ onConnected, onSkip }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [statusVisible, setStatusVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [detailsVisible, setDetailsVisible] = useState(false);
  const isExpoGo = Constants.appOwnership === 'expo';

  const handleConnect = async () => {
    setStatus('loading');
    setMessage(null);
    setStatusVisible(true);
    setStatusMessage('Connecting to Google…');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const refreshToken =
        (session as any)?.provider_refresh_token ||
        (session as any)?.provider_token ||
        null;
      if (session?.access_token && refreshToken) {
        const seedResult = await persistGmailConnection(session, refreshToken, session.access_token);
        const connectedEmail = seedResult?.email ?? session.user.email ?? 'your account';
        setStatus('success');
        setMessage(`Connected as ${connectedEmail}`);
        setStatusMessage(`Connected as ${connectedEmail}`);
        setTimeout(() => {
          setStatusVisible(false);
          onConnected();
        }, 500);
        return;
      }
      if (isExpoGo) {
        throw new Error('Gmail connect needs a development build. Please use a dev client or production build.');
      }
      const nativeResult = await connectGmailWithGoogleNative();
      const nextSession = (await supabase.auth.getSession()).data.session;
      if (!nextSession?.access_token) {
        throw new Error('Not authenticated.');
      }
      const seedResult = await persistGmailConnectionWithAuthCode(
        nextSession,
        nativeResult.serverAuthCode,
        nextSession.access_token,
      );
      const connectedEmail = seedResult?.email ?? nextSession.user.email ?? 'your account';
      setStatus('success');
      setMessage(`Connected as ${connectedEmail}`);
      setStatusMessage(`Connected as ${connectedEmail}`);
      setTimeout(() => {
        setStatusVisible(false);
        onConnected();
      }, 500);
    } catch (err: any) {
      setStatus('error');
      const friendly =
        err?.message ||
        'Unable to connect to Gmail. Please confirm Gmail permission and try again. You can skip and connect later.';
      setMessage(friendly);
      setStatusMessage(friendly);
      setTimeout(() => setStatusVisible(false), 1200);
    }
  };

  const handleSkip = async () => {
    setStatus('loading');
    setMessage(null);
    setStatusVisible(true);
    setStatusMessage('Skipping Gmail for now…');
    try {
      await markGmailOnboardingSeen();
      setStatusVisible(false);
      onSkip();
    } catch (err: any) {
      setStatus('error');
      const friendly = err?.message || 'Unable to skip right now.';
      setMessage(friendly);
      setStatusMessage(friendly);
      setTimeout(() => setStatusVisible(false), 1200);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0F1628', '#0B1224']} style={styles.background} />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="mail-unread-outline" size={28} color="#5AEFD5" />
        </View>
        <Text style={styles.title}>Connect Gmail to import jobs</Text>
        <Text style={styles.subtitle}>
          We will scan for job emails and build your pipeline. Gmail access is read-only and can be disconnected anytime.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoItem}>• Read-only access</Text>
          <Text style={styles.infoItem}>• We never send emails</Text>
          <Text style={styles.infoItem}>• Disconnect anytime</Text>
        </View>

        {isExpoGo && (
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle-outline" size={16} color="#9CC6FF" />
            <Text style={styles.noticeText}>
              Gmail connect needs a development build. Expo Go won&apos;t support the Google native flow.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.linkButton} onPress={() => setDetailsVisible(true)}>
          <Text style={styles.linkText}>What exactly do you access?</Text>
        </TouchableOpacity>

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
            onPress={handleSkip}
            disabled={status === 'loading'}
          >
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
      <Modal visible={detailsVisible} transparent animationType="slide" onRequestClose={() => setDetailsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gmail access</Text>
              <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                <Ionicons name="close" size={20} color={palette.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBody}>
              We request read-only permission to scan your inbox for job-related emails. Basafy never sends emails and
              does not modify your mailbox. You can revoke access anytime in Settings.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={() => setDetailsVisible(false)}
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  linkButton: {
    alignItems: 'flex-start',
  },
  linkText: {
    color: '#9CC6FF',
    fontWeight: '700',
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
