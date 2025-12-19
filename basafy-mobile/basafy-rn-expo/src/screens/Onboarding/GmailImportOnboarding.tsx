import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';
import type { Session } from '@supabase/supabase-js';

type Props = {
  onConnected?: (session: Session) => void;
  onSkip: () => void;
};

export default function GmailImportOnboarding({ onConnected, onSkip }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setStatus('success');
        setMessage(`Signed in as ${data.session.user.email ?? 'your account'}`);
        onConnected?.(data.session);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setStatus('success');
        setMessage(`Signed in as ${session.user.email ?? 'your account'}`);
        onConnected?.(session);
      } else if (event === 'SIGNED_OUT') {
        setStatus('idle');
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, [onConnected]);

  const handleConnect = async () => {
    setStatus('loading');
    setMessage('Opening Google to connect Gmail…');
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'email profile https://www.googleapis.com/auth/gmail.readonly',
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        await Linking.openURL(data.url);
      } else {
        setStatus('error');
        setMessage('No OAuth URL returned. Please try again.');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Unable to start Google sign-in.');
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
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9} onPress={onSkip}>
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
