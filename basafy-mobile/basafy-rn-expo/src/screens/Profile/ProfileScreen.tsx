import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, Palette, ThemeMode } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';
import { selectionChanged, warningNotification, successNotification } from '../../lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloatingNav from '../../components/main/FloatingNav';
import {
  fetchGmailConnection,
  resetGmailApplications,
  syncGmailApplications,
  scheduleDeferredGmailSync,
  persistGmailConnectionWithAuthCode,
  isMockReviewer,
  syncMockInbox,
} from '../../lib/gmailIntegration';
import { connectGmailWithGoogleNative } from '../../lib/googleNativeAuth';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
  onLogout?: () => Promise<void> | void;
  onGmailSyncComplete?: () => void;
  unreadCount?: number;
};

export default function ProfileScreen({
  activeTab = 'profile',
  onNavigate,
  onLogout,
  onGmailSyncComplete,
  unreadCount,
}: Props) {
  const { palette, mode, setMode } = useTheme();
  const styles = createStyles(palette);

  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [syncingGmailFull, setSyncingGmailFull] = useState(false);
  const [syncingGmailEnrich, setSyncingGmailEnrich] = useState(false);
  const [resettingGmail, setResettingGmail] = useState(false);
  const [reconnectingGmail, setReconnectingGmail] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [resettingOnboarding, setResettingOnboarding] = useState(false);
  const [clearingPipeline, setClearingPipeline] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [hasGmailRefreshToken, setHasGmailRefreshToken] = useState(true);
  const [gmailBackfillPageToken, setGmailBackfillPageToken] = useState<string | null>(null);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [gmailLastSyncedAt, setGmailLastSyncedAt] = useState<string | null>(null);
  const [gmailSyncSummary, setGmailSyncSummary] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [gmailBackfillStatus, setGmailBackfillStatus] = useState<string | null>(null);
  const [gmailBackfillStartedAt, setGmailBackfillStartedAt] = useState<string | null>(null);
  const [gmailBackfillCompletedAt, setGmailBackfillCompletedAt] = useState<string | null>(null);
  const [gmailBackfillEstimate, setGmailBackfillEstimate] = useState<number | null>(null);
  const [gmailBackfillProcessed, setGmailBackfillProcessed] = useState<number | null>(null);
  const [gmailImportStatus, setGmailImportStatus] = useState<string | null>(null);
  const [gmailImportProgress, setGmailImportProgress] = useState<number | null>(null);
  const [gmailImportSummary, setGmailImportSummary] = useState<string | null>(null);
  const [gmailPriorityDomainsInput, setGmailPriorityDomainsInput] = useState('');
  const [gmailPriorityDomains, setGmailPriorityDomains] = useState<string[]>([]);
  const [savingGmailDomains, setSavingGmailDomains] = useState(false);
  const [lookbackMonths, setLookbackMonths] = useState<'1' | '3' | '6' | '12' | 'all'>('3');
  const [lookbackModalVisible, setLookbackModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      const identity = (user?.identities?.[0]?.identity_data as any) || {};
      const email = user?.email || identity.email;
      const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || identity.full_name || identity.name;

      if (email) {
        setUserEmail(email);
        setEditEmail(email);
      }
      if (fullName) {
        setUserName(fullName);
        setEditName(fullName);
      }
    };
    loadUser();
  }, []);

  const formatRelativeTime = (iso?: string | null) => {
    if (!iso) return 'Last sync: --';
    const last = new Date(iso);
    if (Number.isNaN(last.getTime())) return 'Last sync: --';
    const diffMs = Date.now() - last.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Last sync: just now';
    if (minutes < 60) return `Last sync: ${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Last sync: ${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `Last sync: ${days} days ago`;
  };

  const formatBackfillTime = (label: string, iso?: string | null) => {
    if (!iso) return `${label}: --`;
    const last = new Date(iso);
    if (Number.isNaN(last.getTime())) return `${label}: --`;
    const diffMs = Date.now() - last.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return `${label}: just now`;
    if (minutes < 60) return `${label}: ${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${label}: ${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${label}: ${days} days ago`;
  };

  const normalizeDomain = useCallback((value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    const withoutProtocol = trimmed.replace(/^https?:\/\//, '').replace(/^mailto:/, '');
    const withoutAt = withoutProtocol.replace(/^@/, '');
    const domain = withoutAt.split(/[\/\s]+/)[0];
    const sanitized = domain.replace(/[^a-z0-9.-]/g, '').replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '');
    if (!sanitized || !sanitized.includes('.')) return null;
    return sanitized.length <= 253 ? sanitized : null;
  }, []);

  const parseDomainsInput = useCallback((input: string) => {
    const parts = input.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
    const normalized = parts
      .map((value) => normalizeDomain(value))
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(normalized)).slice(0, 25);
  }, [normalizeDomain]);

  const loadGmailStatus = useCallback(async () => {
    setGmailLoading(true);
    setGmailError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (userId) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('gmail_priority_domains')
          .eq('id', userId)
          .maybeSingle();
        const domains = (profileRow as any)?.gmail_priority_domains;
        if (Array.isArray(domains)) {
          setGmailPriorityDomains(domains);
          setGmailPriorityDomainsInput(domains.join(', '));
        }
      }
      const connection = await fetchGmailConnection();
      setGmailEmail(connection?.email ?? null);
      setHasGmailRefreshToken(!!connection?.refresh_token);
      setGmailLastSyncedAt(connection?.last_synced_at ?? null);
      setGmailBackfillPageToken(connection?.backfill_page_token ?? null);
      setGmailBackfillStartedAt(connection?.backfill_started_at ?? null);
      setGmailBackfillCompletedAt(connection?.backfill_completed_at ?? null);
      setGmailBackfillEstimate(connection?.backfill_total_estimate ?? null);
      setGmailBackfillProcessed(connection?.backfill_processed_count ?? null);
      if (connection?.backfill_page_token) {
        setGmailBackfillStatus('Backfill in progress');
      } else if (connection?.backfill_completed_at) {
        setGmailBackfillStatus('Backfill complete');
      } else if (connection?.backfill_started_at) {
        setGmailBackfillStatus('Backfill started');
      } else {
        setGmailBackfillStatus(null);
      }
      const { data, error } = await supabase
        .from('gmail_sync_logs')
        .select(
          'applications_created, applications_updated, job_email_events_created, job_email_events_updated, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        const created = data.applications_created ?? 0;
        const updated = data.applications_updated ?? 0;
        const parts = [];
        if (created > 0) parts.push(`Imported ${created} new applications`);
        if (updated > 0) parts.push(`updated ${updated}`);
        if (parts.length === 0) {
          setGmailSyncSummary('No recent application changes.');
        } else {
          setGmailSyncSummary(parts.join(', '));
        }
      } else {
        setGmailSyncSummary(null);
      }
      if (userId) {
        const { data: syncState } = await supabase
          .from('gmail_sync_state')
          .select('initial_import_status, initial_import_progress, last_sync_summary')
          .eq('user_id', userId)
          .maybeSingle();
        setGmailImportStatus((syncState as any)?.initial_import_status ?? null);
        setGmailImportProgress(
          typeof (syncState as any)?.initial_import_progress === 'number'
            ? (syncState as any).initial_import_progress
            : null
        );
        setGmailImportSummary((syncState as any)?.last_sync_summary ?? null);
      } else {
        setGmailImportStatus(null);
        setGmailImportProgress(null);
        setGmailImportSummary(null);
      }
    } catch (err: any) {
      setGmailError('Unable to load Gmail connection right now.');
    } finally {
      setGmailLoading(false);
    }
  }, []);

  const handleSavePriorityDomains = async () => {
    if (savingGmailDomains) return;
    setSavingGmailDomains(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        Alert.alert('Not signed in', 'Please sign in to save domains.');
        return;
      }
      const domains = parseDomainsInput(gmailPriorityDomainsInput);
      const { error } = await supabase
        .from('profiles')
        .update({ gmail_priority_domains: domains })
        .eq('id', userId);
      if (error) throw error;
      setGmailPriorityDomains(domains);
      setGmailPriorityDomainsInput(domains.join(', '));
      successNotification();
      Alert.alert('Saved', 'Priority domains updated for Gmail sync.');
    } catch (err: any) {
      Alert.alert('Save failed', 'Unable to save priority domains right now.');
    } finally {
      setSavingGmailDomains(false);
    }
  };

  const backfillProgressText = useMemo(() => {
    if (!gmailBackfillEstimate || !gmailBackfillProcessed) return null;
    if (gmailBackfillEstimate <= 0) return null;
    const cappedProcessed = Math.min(gmailBackfillProcessed, gmailBackfillEstimate);
    const percent = Math.round((cappedProcessed / gmailBackfillEstimate) * 100);
    return `Backfill progress: ${percent}% (${cappedProcessed}/${gmailBackfillEstimate})`;
  }, [gmailBackfillEstimate, gmailBackfillProcessed]);

  useEffect(() => {
    loadGmailStatus();
  }, [loadGmailStatus]);

  useEffect(() => {
    const loadNotificationMeta = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
      setUnreadNotifications(count ?? 0);

      const { data } = await supabase
        .from('user_notification_settings')
        .select('push_enabled')
        .maybeSingle();
      if (data && typeof data.push_enabled === 'boolean') {
        setPushEnabled(data.push_enabled);
      }
    };
    loadNotificationMeta();
  }, []);

  useEffect(() => {
    if (typeof unreadCount === 'number') {
      setUnreadNotifications(unreadCount);
    }
  }, [unreadCount]);

  const initials = useMemo(() => (userName ? userName.charAt(0).toUpperCase() : 'U'), [userName]);

  const openEditProfile = () => {
    setEditName(userName);
    setEditEmail(userEmail);
    setEditVisible(true);
  };

  const handleSaveProfile = async () => {
    const nextName = editName.trim();
    const nextEmail = editEmail.trim();

    if (!nextName || !nextEmail) {
      Alert.alert('Missing info', 'Name and email are required to update your profile.');
      return;
    }

    setSavingProfile(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        email: nextEmail,
        data: { full_name: nextName },
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        setUserName(nextName);
        setUserEmail(nextEmail);
      }

      successNotification();
      setEditVisible(false);
    } catch (err: any) {
      Alert.alert('Update failed', 'Unable to save your changes right now.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    warningNotification();
    try {
      await supabase.auth.signOut();
      await onLogout?.();
    } catch (err: any) {
      Alert.alert('Sign out failed', 'Could not sign out right now.');
    }
  };

  const handleReconnectGmail = async () => {
    try {
      setReconnectingGmail(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (await isMockReviewer(session)) {
        await syncMockInbox(session);
        await loadGmailStatus();
        Alert.alert("Gmail reconnected", "Demo Gmail is ready to sync.");
        return;
      }
      const nativeResult = await connectGmailWithGoogleNative();
      const { data: nextSessionData } = await supabase.auth.getSession();
      const nextSession = nextSessionData.session;
      if (!nextSession?.access_token) {
        throw new Error("Not authenticated.");
      }
      await persistGmailConnectionWithAuthCode(
        nextSession,
        nativeResult.serverAuthCode,
        nextSession.access_token
      );
      await loadGmailStatus();
      Alert.alert("Gmail reconnected", "Your Gmail is now connected. You can sync your applications.");
    } catch (err: any) {
      Alert.alert("Reconnect failed", "Unable to reconnect Gmail right now.");
    } finally {
      setReconnectingGmail(false);
    }
  };


  const handleSyncGmail = async () => {
    try {
      setSyncingGmail(true);
      const result = await syncGmailApplications();
      if ((result as any)?.deferred) {
        Alert.alert('Gmail sync delayed', 'Sync is queued due to high server load. We will try again shortly.');
        scheduleDeferredGmailSync();
        await loadGmailStatus();
        return;
      }
      Alert.alert('Gmail sync', 'Sync complete. Your applications are up to date.');
      await loadGmailStatus();
      if (typeof onGmailSyncComplete === 'function') {
        onGmailSyncComplete();
      }
    } catch (err: any) {
      Alert.alert('Gmail sync failed', 'Unable to sync right now.');
    } finally {
      setSyncingGmail(false);
    }
  };

  const handleSyncGmailFull = async () => {
    try {
      setSyncingGmailFull(true);
      const maxPages = 20;
      const maxMessages = 500;
      const timeLimitMs = 110_000;
      const startMs = Date.now();
      let pageToken = gmailBackfillPageToken;
      let processedTotal = 0;
      let pageCount = 0;
      while (pageCount < maxPages) {
        const result = await syncGmailApplications(undefined, {
          hardSync: true,
          pageToken,
          maxMessages,
          lookback_months: lookbackMonths,
        });
        if ((result as any)?.deferred) {
          Alert.alert('Gmail import delayed', 'We are a bit overloaded. Please try again in a few minutes.');
          scheduleDeferredGmailSync();
          break;
        }
        processedTotal += (result as any)?.processed ?? 0;
        pageToken = (result as any)?.next_page_token ?? null;
        pageCount += 1;
        if (!pageToken) break;
        if (Date.now() - startMs > timeLimitMs) break;
      }
      setGmailBackfillPageToken(pageToken);
      if (pageToken) {
        Alert.alert(
          'Gmail import',
          `Imported ${processedTotal} emails. Tap "Import all" again to continue the backfill.`
        );
      } else {
        Alert.alert('Gmail import', `Imported ${processedTotal} emails from your Gmail history.`);
      }
      await loadGmailStatus();
      if (typeof onGmailSyncComplete === 'function') {
        onGmailSyncComplete();
      }
    } catch (err: any) {
      Alert.alert('Gmail import failed', 'Unable to import right now.');
    } finally {
      setSyncingGmailFull(false);
    }
  };

  const handleEnrichGmail = async () => {
    try {
      setSyncingGmailEnrich(true);
      const result = await syncGmailApplications(undefined, { enrichOnly: true, maxMessages: 120 });
      const processed = (result as any)?.processed ?? 0;
      if ((result as any)?.deferred) {
        Alert.alert('Gmail enrichment delayed', 'We are a bit overloaded. Please try again in a few minutes.');
        scheduleDeferredGmailSync();
        await loadGmailStatus();
        return;
      }
      Alert.alert('Gmail enrichment', `Enriched ${processed} emails with tasks/events.`);
      await loadGmailStatus();
      if (typeof onGmailSyncComplete === 'function') {
        onGmailSyncComplete();
      }
    } catch (err: any) {
      Alert.alert('Gmail enrichment failed', 'Unable to enrich right now.');
    } finally {
      setSyncingGmailEnrich(false);
    }
  };

  const handleResetGmail = async () => {
    try {
      setResettingGmail(true);
      const result = await resetGmailApplications();
      const deletedCount = result?.deleted ?? 0;
      Alert.alert('Reset complete', `Removed ${deletedCount} Gmail-imported applications.`);
      await loadGmailStatus();
    } catch (err: any) {
      Alert.alert('Reset failed', 'Unable to reset Gmail imports right now.');
    } finally {
      setResettingGmail(false);
    }
  };

  const handleExportData = async () => {
    if (exportingData) return;
    setExportingData(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user?.id) {
        Alert.alert('Not signed in', 'Please sign in to export your data.');
        return;
      }

      const safeFetch = async <T,>(label: string, query: PromiseLike<{ data: T; error: any }>) => {
        const { data, error } = await query;
        return { label, data, error };
      };

      const results = await Promise.all([
        safeFetch('profile', supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()),
        safeFetch('applications', supabase.from('applications').select('*').eq('user_id', user.id)),
        safeFetch('tasks', supabase.from('tasks').select('*').eq('user_id', user.id)),
        safeFetch('events', supabase.from('events').select('*').eq('user_id', user.id)),
        safeFetch('job_email_events', supabase.from('job_email_events').select('*').eq('user_id', user.id)),
        safeFetch('notifications', supabase.from('notifications').select('*').eq('user_id', user.id)),
        safeFetch('notification_settings', supabase.from('user_notification_settings').select('*').eq('user_id', user.id).maybeSingle()),
        safeFetch('user_devices', supabase.from('user_devices').select('id, device_id, platform, notifications_enabled, created_at').eq('user_id', user.id)),
        safeFetch('gmail_connections', supabase.from('gmail_connections').select('id, email, provider, token_scopes, refresh_token_expires_at, last_synced_at, created_at, updated_at').eq('user_id', user.id)),
        safeFetch('gmail_sync_state', supabase.from('gmail_sync_state').select('*').eq('user_id', user.id).maybeSingle()),
        safeFetch('gmail_sync_logs', supabase.from('gmail_sync_logs').select('*').eq('user_id', user.id)),
        safeFetch('mock_gmail_messages', supabase.from('mock_gmail_messages').select('*').eq('user_id', user.id)),
      ]);

      const exportPayload = {
        exported_at: new Date().toISOString(),
        user: { id: user.id, email: user.email },
        data: Object.fromEntries(results.map((result) => [result.label, result.data ?? null])),
      };

      const errors = results.filter((result) => result.error);
      if (errors.length > 0) {
        Alert.alert(
          'Partial export',
          `Some data could not be fetched (${errors.map((e) => e.label).join(', ')}). Exporting what we can.`,
        );
      }

      await Share.share({
        title: 'Basafy data export',
        message: JSON.stringify(exportPayload, null, 2),
      });
    } catch (err: any) {
      Alert.alert('Export failed', 'Unable to export data right now.');
    } finally {
      setExportingData(false);
    }
  };

  const handleResetOnboarding = () => {
    if (resettingOnboarding) return;
    Alert.alert(
      'Reset onboarding?',
      'This will restart Gmail onboarding and sign you out. You can sign in again to re-run setup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            (async () => {
              setResettingOnboarding(true);
              try {
                const { data: userData } = await supabase.auth.getUser();
                const userId = userData.user?.id;
                if (!userId) {
                  Alert.alert('Not signed in', 'Please sign in to reset onboarding.');
                  return;
                }
                const { error } = await supabase
                  .from('profiles')
                  .update({ has_seen_gmail_onboarding: false })
                  .eq('id', userId);
                if (error) throw error;
                await AsyncStorage.removeItem(`basafy:gmail-onboarding-completed:${userId}`);
                await AsyncStorage.removeItem('basafy:gmail-onboarding-completed');
                await supabase.auth.signOut();
                await onLogout?.();
              } catch (err: any) {
                Alert.alert('Reset failed', 'Unable to reset onboarding right now.');
              } finally {
                setResettingOnboarding(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleClearPipeline = () => {
    if (clearingPipeline) return;
    Alert.alert(
      'Clear pipeline?',
      'This will permanently remove all applications, tasks, events, and notifications. Gmail connection stays intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear pipeline',
          style: 'destructive',
          onPress: () => {
            (async () => {
              setClearingPipeline(true);
              try {
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData.session?.access_token;
                if (!token) {
                  Alert.alert('Not signed in', 'Please sign in to clear your pipeline.');
                  return;
                }
                const { data, error } = await supabase.functions.invoke('clear-pipeline', {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (error) throw error;
                const deleted = data?.deleted || {};
                Alert.alert(
                  'Pipeline cleared',
                  `Removed ${deleted.applications ?? 0} applications, ${deleted.tasks ?? 0} tasks, ${deleted.events ?? 0} events.`,
                );
              } catch (err: any) {
                Alert.alert('Clear failed', 'Unable to clear pipeline right now.');
              } finally {
                setClearingPipeline(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    if (deletingAccount) return;
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            (async () => {
              setDeletingAccount(true);
              try {
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData.session?.access_token;
                if (!token) {
                  Alert.alert('Not signed in', 'Please sign in to delete your account.');
                  return;
                }
                const { error } = await supabase.functions.invoke('delete-account', {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (error) throw error;
                await supabase.auth.signOut().catch(() => null);
                await onLogout?.();
                Alert.alert('Account deleted', 'Your account has been deleted.');
              } catch (err: any) {
                Alert.alert('Delete failed', 'Unable to delete account right now.');
              } finally {
                setDeletingAccount(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.glassCard}>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.subtitle}>Manage your account and preferences</Text>
            <Ionicons name="settings-outline" size={18} color="#8EA2C3" />
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <LinearGradientIcon initial={initials} />
              <View style={styles.avatarBadge}>
                <Ionicons name="checkmark" size={14} color="#0A0E1A" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profileEmail}>{userEmail}</Text>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>Pro Member</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={openEditProfile}>
            <Text style={styles.primaryButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.glassCard}>
          <SectionHeader icon="color-palette-outline" label="Appearance" />
          <View style={styles.themeRow}>
            {(['light', 'dark', 'system'] as ThemeMode[]).map((option) => {
              const active = mode === option;
              const icons: Record<ThemeMode, keyof typeof Ionicons.glyphMap> = {
                light: 'sunny-outline',
                dark: 'moon-outline',
                system: 'phone-portrait-outline',
              };
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.themePill, active && styles.themePillActive]}
                  activeOpacity={0.85}
                  onPress={() => { selectionChanged(); setMode(option); }}
                >
                  <Ionicons
                    name={icons[option]}
                    size={16}
                    color={active ? palette.text : palette.muted}
                  />
                  <Text style={[styles.themePillText, active && styles.themePillTextActive]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.glassCard}>
          <SectionHeader icon="notifications-outline" label="Notifications" />
          {!pushEnabled && (
            <>
              <View style={styles.banner}>
                <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>Turn on notifications</Text>
                  <Text style={styles.bannerSubtitle}>Enable alerts to stay on top of updates.</Text>
                </View>
                <TouchableOpacity style={styles.bannerButton} onPress={() => onNavigate?.('notification-settings')}>
                  <Text style={styles.bannerButtonText}>Enable</Text>
                </TouchableOpacity>
              </View>
              <Divider />
            </>
          )}
          <ActionRow
            icon="notifications-outline"
            label="Notification center"
            onPress={() => onNavigate?.('notifications')}
            rightElement={
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadNotifications}</Text>
              </View>
            }
          />
          <Divider />
          <ActionRow
            icon="options-outline"
            label="Notification settings"
            onPress={() => onNavigate?.('notification-settings')}
          />
          <Text style={styles.helperNote}>
            Customize reminders and digests in Notification settings.
          </Text>
        </View>

        <View style={styles.glassCard}>
          <SectionHeader icon="mail-outline" label="Gmail" />
          <View style={styles.connectionRow}>
            {gmailLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color="#9CC6FF" />
                <Text style={styles.rowSubtitle}>Fetching Gmail status…</Text>
              </View>
            ) : gmailEmail ? (
              <Text style={styles.rowSubtitle}>Connected as {gmailEmail}</Text>
            ) : gmailError ? (
              <Text style={[styles.rowSubtitle, styles.errorText]}>{gmailError}</Text>
            ) : (
              <Text style={styles.rowSubtitle}>Not connected</Text>
            )}
            {!gmailLoading && gmailEmail && (
              <Text style={styles.rowSubtitle}>{formatRelativeTime(gmailLastSyncedAt)}</Text>
            )}
            {!gmailLoading && gmailEmail && gmailSyncSummary && (
              <Text style={styles.rowSubtitle}>{gmailSyncSummary}</Text>
            )}
            {!gmailLoading && gmailEmail && gmailImportStatus === 'deep_running' && (
              <Text style={styles.rowSubtitle}>
                Deep sync running{gmailImportProgress !== null ? ` • ${gmailImportProgress}%` : ''}
              </Text>
            )}
            {!gmailLoading && gmailEmail && gmailImportStatus === 'deep_done' && (
              <Text style={styles.rowSubtitle}>Deep sync complete</Text>
            )}
            {!gmailLoading && gmailEmail && gmailImportStatus === 'failed' && (
              <Text style={[styles.rowSubtitle, styles.errorText]}>
                Gmail import failed. {gmailImportSummary ?? 'Tap to retry.'}
              </Text>
            )}
          </View>
          {gmailError && (
            <ActionRow icon="refresh-outline" label="Reload Gmail status" onPress={loadGmailStatus} />
          )}
          {!gmailLoading && gmailEmail && gmailImportStatus === 'failed' && (
            <ActionRow icon="refresh-outline" label="Retry Gmail import" onPress={handleSyncGmail} />
          )}
          <ActionRow
            icon="sync-outline"
            label="Sync Gmail now"
            onPress={handleSyncGmail}
            rightElement={
              syncingGmail ? <ActivityIndicator size="small" color="#9CC6FF" /> : <Ionicons name="chevron-forward" size={16} color="#8EA2C3" />
            }
          />
          {!gmailLoading && !hasGmailRefreshToken && (
            <>
              <Divider />
              <ActionRow
                icon="link-outline"
                label="Reconnect Gmail"
                onPress={handleReconnectGmail}
                rightElement={
                  reconnectingGmail ? <ActivityIndicator size="small" color="#9CC6FF" /> : <Ionicons name="chevron-forward" size={16} color="#8EA2C3" />
                }
              />
              <Text style={{ color: '#FF9D4F', fontSize: 12, marginTop: 4, marginLeft: 40 }}>Your Gmail connection expired. Tap to reconnect.</Text>
            </>
          )}
          <Divider />
          <ActionRow
            icon="sparkles-outline"
            label="Enrich tasks & events"
            onPress={handleEnrichGmail}
            rightElement={
              syncingGmailEnrich ? <ActivityIndicator size="small" color="#9CC6FF" /> : <Ionicons name="chevron-forward" size={16} color="#8EA2C3" />
            }
          />
          <Divider />
          <View style={{ marginBottom: 10 }}>
            <Text style={{ color: palette.text, fontWeight: '700', marginBottom: 4 }}>
              Email lookback period
            </Text>
            <TouchableOpacity
              style={{
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.03)',
                padding: 12,
              }}
              activeOpacity={0.85}
              onPress={() => setLookbackModalVisible(true)}
            >
              <Text style={{ color: palette.text }}>
                {lookbackMonths === '1'
                  ? '1 month'
                  : lookbackMonths === '3'
                    ? '3 months'
                    : lookbackMonths === '6'
                      ? '6 months'
                      : lookbackMonths === '12'
                        ? '12 months'
                        : 'All time'}
              </Text>
            </TouchableOpacity>
            <Modal
              visible={lookbackModalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setLookbackModalVisible(false)}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 24,
                }}
              >
                <View
                  style={{
                    backgroundColor: palette.background,
                    borderRadius: 16,
                    padding: 18,
                    minWidth: 220,
                  }}
                >
                  {[
                    { label: '1 month', value: '1' },
                    { label: '3 months', value: '3' },
                    { label: '6 months', value: '6' },
                    { label: '12 months', value: '12' },
                    { label: 'All time', value: 'all' },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={{
                        paddingVertical: 12,
                        borderBottomWidth: opt.value !== 'all' ? 1 : 0,
                        borderBottomColor: 'rgba(255,255,255,0.08)',
                      }}
                      onPress={() => {
                        setLookbackMonths(opt.value as any);
                        setLookbackModalVisible(false);
                      }}
                    >
                      <Text
                        style={{
                          color: lookbackMonths === opt.value ? palette.primary : palette.text,
                          fontWeight: lookbackMonths === opt.value ? '800' : '600',
                          fontSize: 16,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={{
                      marginTop: 10,
                      alignSelf: 'center',
                      paddingHorizontal: 18,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: 'rgba(255,255,255,0.08)',
                    }}
                    onPress={() => setLookbackModalVisible(false)}
                  >
                    <Text style={{ color: palette.muted, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
          <Divider />
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Priority company domains</Text>
            <TextInput
              value={gmailPriorityDomainsInput}
              onChangeText={setGmailPriorityDomainsInput}
              placeholder="e.g. acme.com, startup.io"
              placeholderTextColor="#6B7280"
              style={[styles.input, styles.domainInput]}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!savingGmailDomains}
              multiline
            />
            <Text style={styles.helperTextInline}>
              We’ll prioritize emails from these domains in Gmail sync.
            </Text>
            <View style={styles.domainActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.domainSaveButton, savingGmailDomains && styles.disabledButton]}
                onPress={handleSavePriorityDomains}
                activeOpacity={0.85}
                disabled={savingGmailDomains}
              >
                {savingGmailDomains ? (
                  <ActivityIndicator size="small" color="#9CC6FF" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Save domains</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.domainCountText}>
                {gmailPriorityDomains.length > 0
                  ? `${gmailPriorityDomains.length} saved`
                  : 'None saved yet'}
              </Text>
            </View>
          </View>
          <ActionRow
            icon="cloud-download-outline"
            label="Import all (full history)"
            onPress={handleSyncGmailFull}
            rightElement={
              syncingGmailFull ? <ActivityIndicator size="small" color="#9CC6FF" /> : <Ionicons name="chevron-forward" size={16} color="#8EA2C3" />
            }
          />
          <Divider />
          <ActionRow
            icon="trash-outline"
            label="Reset Gmail imported jobs"
            onPress={handleResetGmail}
            destructive
            rightElement={
              resettingGmail ? <ActivityIndicator size="small" color="#FF7B7B" /> : <Ionicons name="chevron-forward" size={16} color="#8EA2C3" />
            }
          />
          {!gmailLoading && gmailEmail && gmailBackfillStatus && (
            <Text style={styles.rowSubtitle}>{gmailBackfillStatus}</Text>
          )}
          {!gmailLoading && gmailEmail && backfillProgressText && (
            <Text style={styles.rowSubtitle}>{backfillProgressText}</Text>
          )}
          {!gmailLoading && gmailEmail && gmailBackfillStartedAt && (
            <Text style={styles.rowSubtitle}>{formatBackfillTime('Backfill started', gmailBackfillStartedAt)}</Text>
          )}
          {!gmailLoading && gmailEmail && gmailBackfillCompletedAt && !gmailBackfillPageToken && (
            <Text style={styles.rowSubtitle}>{formatBackfillTime('Backfill completed', gmailBackfillCompletedAt)}</Text>
          )}
          <Text style={styles.helperTextInline}>
            Re-sync anytime if you&apos;ve received new job emails. Background sync runs periodically when iOS allows.
          </Text>
        </View>

        <View style={styles.glassCard}>
          <SectionHeader icon="lock-closed-outline" label="Data & Privacy" />
          <ActionRow
            icon="download-outline"
            label="Export data"
            onPress={exportingData ? undefined : handleExportData}
            rightElement={
              exportingData ? <ActivityIndicator size="small" color="#9CC6FF" /> : undefined
            }
          />
          <Divider />
          <ActionRow
            icon="refresh-outline"
            label="Reset onboarding"
            onPress={resettingOnboarding ? undefined : handleResetOnboarding}
            rightElement={
              resettingOnboarding ? <ActivityIndicator size="small" color="#9CC6FF" /> : undefined
            }
          />
          <Divider />
          <ActionRow
            icon="trash-outline"
            label="Clear pipeline"
            destructive
            onPress={clearingPipeline ? undefined : handleClearPipeline}
            rightElement={
              clearingPipeline ? <ActivityIndicator size="small" color="#FF7B7B" /> : undefined
            }
          />
          <Divider />
          <ActionRow
            icon="alert-circle-outline"
            label="Delete account"
            destructive
            onPress={deletingAccount ? undefined : handleDeleteAccount}
            rightElement={
              deletingAccount ? <ActivityIndicator size="small" color="#FF7B7B" /> : undefined
            }
          />
          <Divider />
          <ActionRow icon="log-out-outline" label="Sign out" onPress={handleSignOut} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Basafy v1.0 • Made with ❤️ for job seekers</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://basafy.com/privacy')} activeOpacity={0.7}>
            <Text style={styles.footerPrivacy}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.footerSub}>Work your next move 🚀</Text>
        </View>
      </ScrollView>
      <FloatingNav
        activeTab={activeTab}
        onNavigate={onNavigate}
        bottomInset={insets.bottom}
        unreadCount={unreadNotifications}
      />
      <ProfileEditModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        name={editName}
        email={editEmail}
        onChangeName={setEditName}
        onChangeEmail={setEditEmail}
        onSave={handleSaveProfile}
        saving={savingProfile}
        bottomInset={insets.bottom}
        topInset={insets.top}
      />
    </SafeAreaView>
  );
}

// Helper hook so sub-components access themed styles + palette
function useStyles() {
  const { palette } = useTheme();
  return { styles: createStyles(palette), palette };
}

const LinearGradientIcon = ({ initial }: { initial: string }) => {
  const { styles } = useStyles();
  return (
    <LinearGradient colors={['#4A8CFF', '#5AEFD5']} style={styles.avatarInner}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </LinearGradient>
  );
};

const SectionHeader = ({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) => {
  const { styles } = useStyles();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={16} color="#9CC6FF" />
      </View>
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
};

const ActionRow = ({
  icon,
  label,
  destructive,
  onPress,
  rightElement,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}) => {
  const { styles } = useStyles();
  const disabled = !onPress;
  return (
    <TouchableOpacity
      style={[styles.actionRow, disabled && styles.actionRowDisabled]}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={16} color={destructive ? '#FF7B7B' : '#9CC6FF'} />
      </View>
      <Text style={[styles.actionLabel, destructive && styles.destructive]}>{label}</Text>
      {rightElement || <Ionicons name="chevron-forward" size={16} color="#8EA2C3" />}
    </TouchableOpacity>
  );
};

const Divider = () => {
  const { styles } = useStyles();
  return <View style={styles.divider} />;
};

const ProfileEditModal = ({
  visible,
  onClose,
  name,
  email,
  onChangeName,
  onChangeEmail,
  onSave,
  saving,
  bottomInset = 0,
  topInset = 0,
}: {
  visible: boolean;
  onClose: () => void;
  name: string;
  email: string;
  onChangeName: (text: string) => void;
  onChangeEmail: (text: string) => void;
  onSave: () => void;
  saving: boolean;
  bottomInset?: number;
  topInset?: number;
}) => {
  const { styles } = useStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.modalOverlay,
          { paddingBottom: Math.max(bottomInset, 16), paddingTop: Math.max(topInset, 16) },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContainer}
        >
          <View style={[styles.modalCard, { paddingBottom: 18 + bottomInset }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={onClose} disabled={saving} hitSlop={8}>
                <Ionicons name="close" size={20} color="#8EA2C3" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full name</Text>
                <TextInput
                  value={name}
                  onChangeText={onChangeName}
                  placeholder="Your name"
                  placeholderTextColor="#6B7280"
                  style={styles.input}
                  autoCapitalize="words"
                  editable={!saving}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={onChangeEmail}
                  placeholder="name@email.com"
                  placeholderTextColor="#6B7280"
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  editable={!saving}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, saving && styles.disabledButton]}
                onPress={onClose}
                activeOpacity={0.85}
                disabled={saving}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.disabledButton]}
                onPress={onSave}
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving ? <ActivityIndicator size="small" color="#0A0E1A" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              Changes are saved to your Supabase profile so your account stays in sync.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const createStyles = (palette: Palette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 120,
    gap: 14,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: palette.muted,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarInner: {
    width: 68,
    height: 68,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '800',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.background,
  },
  profileName: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  profileEmail: {
    color: palette.muted,
    marginTop: 2,
  },
  proBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#142040',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  proBadgeText: {
    color: '#9CC6FF',
    fontWeight: '700',
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  primaryButtonText: {
    color: palette.text,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: palette.overlay,
    borderWidth: 1,
    borderColor: palette.overlayBorder,
  },
  themePillActive: {
    backgroundColor: palette.primary + '22',
    borderColor: palette.primary + '55',
  },
  themePillText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  themePillTextActive: {
    color: palette.text,
  },
  rowSubtitle: {
    color: palette.muted,
    marginTop: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginVertical: 6,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    marginBottom: 6,
  },
  bannerTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 13,
  },
  bannerSubtitle: {
    color: palette.muted,
    marginTop: 2,
    fontSize: 12,
  },
  helperNote: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 10,
  },
  bannerButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
  },
  bannerButtonText: {
    color: '#0A0E1A',
    fontWeight: '800',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  actionRowDisabled: {
    opacity: 0.5,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    color: palette.text,
    fontWeight: '800',
  },
  notificationBadge: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 140, 255, 0.2)',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 12,
  },
  destructive: {
    color: '#FF7B7B',
  },
  footer: {
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  footerText: {
    color: palette.muted,
    fontWeight: '700',
  },
  footerPrivacy: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerSub: {
    color: palette.muted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalContainer: {
    width: '100%',
    alignItems: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: palette.background,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: palette.muted,
    fontWeight: '700',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: palette.text,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  domainSaveButton: {
    flex: 0,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: palette.muted,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#5AEFD5',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#0A0E1A',
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.8,
  },
  helperText: {
    color: palette.muted,
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  helperTextInline: {
    color: palette.muted,
    marginTop: 8,
    fontSize: 12,
  },
  domainInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  domainActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  domainCountText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  connectionRow: {
    paddingVertical: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#FF7B7B',
  },
});
