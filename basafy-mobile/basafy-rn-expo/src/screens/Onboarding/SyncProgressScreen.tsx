import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@backend/supabase/client';
import { syncGmailApplications } from '../../lib/gmailIntegration';
import { palette } from '../../theme/palette';

type SyncStatus =
  | 'not_started'
  | 'phase1_running'
  | 'phase1_done'
  | 'deep_running'
  | 'deep_done'
  | 'failed';

type Props = {
  onContinue: () => void;
  onReview: () => void;
};

export default function SyncProgressScreen({ onContinue, onReview }: Props) {
  const [status, setStatus] = useState<SyncStatus>('not_started');
  const [progress, setProgress] = useState<number | null>(null);
  const [phase1Count, setPhase1Count] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const startSync = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session?.access_token) {
          throw new Error('Not authenticated.');
        }
        await syncGmailApplications(session);
      } catch (err: any) {
        if (active) {
          setErrorMessage(err?.message || 'Unable to start Gmail sync.');
          setStatus('failed');
        }
      } finally {
        if (active) {
          setSyncing(false);
        }
      }
    };
    startSync();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchState = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return;
      const { data, error } = await supabase
        .from('gmail_sync_state')
        .select('initial_import_status, initial_import_progress, last_phase1_result_count, last_sync_summary')
        .eq('user_id', userId)
        .maybeSingle();
      if (!active) return;
      if (error) return;
      if (data) {
        setStatus((data as any)?.initial_import_status || 'not_started');
        const nextProgress = typeof (data as any)?.initial_import_progress === 'number'
          ? (data as any).initial_import_progress
          : null;
        setProgress(nextProgress);
        setPhase1Count(Number((data as any)?.last_phase1_result_count ?? 0));
        setSummary((data as any)?.last_sync_summary ?? null);
      }
    };

    fetchState();
    interval = setInterval(fetchState, 3000);
    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  const phase1Done = status === 'phase1_done' || status === 'deep_running' || status === 'deep_done';
  const deepDone = status === 'deep_done';
  const canReview = phase1Done;

  const stepper = useMemo(() => {
    const steps = [
      { title: 'Looking for job emails', active: status === 'phase1_running', done: phase1Done },
      { title: 'Creating your applications', active: phase1Done && !deepDone, done: deepDone },
      { title: 'Building your calendar', active: status === 'deep_running', done: deepDone },
    ];
    return steps;
  }, [status, phase1Done, deepDone]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0B1124', '#111B33']} style={styles.background} />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="sync-outline" size={26} color="#5AEFD5" />
        </View>
        <Text style={styles.title}>Syncing your Gmail</Text>
        <Text style={styles.subtitle}>
          We pull recent job emails first. You can keep going while the full import finishes.
        </Text>

        <View style={styles.stepperCard}>
          {stepper.map((step, index) => (
            <View key={step.title} style={styles.stepRow}>
              <View
                style={[
                  styles.stepIcon,
                  step.done && styles.stepIconDone,
                  step.active && styles.stepIconActive,
                ]}
              >
                <Ionicons
                  name={step.done ? 'checkmark' : 'ellipse'}
                  size={step.done ? 14 : 10}
                  color={step.done ? '#0A0E1A' : step.active ? '#5AEFD5' : 'rgba(255,255,255,0.3)'}
                />
              </View>
              <Text style={[styles.stepText, step.done && styles.stepTextDone]}>{step.title}</Text>
              {index < stepper.length - 1 && <View style={styles.stepLine} />}
            </View>
          ))}
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(100, progress ?? 10)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {progress !== null ? `${progress}% complete` : syncing ? 'Starting sync…' : 'Syncing…'}
          </Text>
          {!!phase1Count && (
            <Text style={styles.progressHint}>Imported {phase1Count} applications in phase 1</Text>
          )}
          {summary && <Text style={styles.progressHint}>{summary}</Text>}
          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onContinue} activeOpacity={0.9}>
            <Text style={styles.secondaryButtonText}>Continue in background</Text>
          </TouchableOpacity>
          {canReview && (
            <TouchableOpacity style={styles.primaryButton} onPress={onReview} activeOpacity={0.9}>
              <Text style={styles.primaryButtonText}>Review imports</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
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
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    fontSize: 15,
    color: palette.muted,
    lineHeight: 22,
  },
  stepperCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconActive: {
    borderWidth: 1,
    borderColor: 'rgba(90,239,213,0.6)',
  },
  stepIconDone: {
    backgroundColor: '#5AEFD5',
  },
  stepText: {
    color: palette.text,
    fontSize: 14,
    flex: 1,
  },
  stepTextDone: {
    color: '#D4FFE9',
  },
  stepLine: {
    position: 'absolute',
    left: 11,
    top: 24,
    width: 2,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressWrap: {
    gap: 6,
  },
  progressBar: {
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5AEFD5',
  },
  progressText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  progressHint: {
    color: palette.muted,
    fontSize: 12,
  },
  errorText: {
    color: '#FF9B9B',
    fontSize: 12,
  },
  actions: {
    marginTop: 10,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#5AEFD5',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0A0E1A',
    fontWeight: '800',
    fontSize: 15,
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
});
