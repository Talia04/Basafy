import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloatingNav from '../../components/main/FloatingNav';
import { fetchGmailConnection, resetGmailApplications, syncGmailApplications } from '../../lib/gmailIntegration';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
  onLogout?: () => Promise<void> | void;
  onGmailSyncComplete?: () => void;
};

export default function ProfileScreen({ activeTab = 'profile', onNavigate, onLogout, onGmailSyncComplete }: Props) {
  const [interviewReminders, setInterviewReminders] = useState(true);
  const [followUpNudges, setFollowUpNudges] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [resettingGmail, setResettingGmail] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [gmailLastSyncedAt, setGmailLastSyncedAt] = useState<string | null>(null);
  const [gmailSyncSummary, setGmailSyncSummary] = useState<string | null>(null);
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

  const loadGmailStatus = useCallback(async () => {
    setGmailLoading(true);
    setGmailError(null);
    try {
      const connection = await fetchGmailConnection();
      setGmailEmail(connection?.email ?? null);
      setGmailLastSyncedAt(connection?.last_synced_at ?? null);
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
    } catch (err: any) {
      setGmailError(err?.message || 'Unable to load Gmail connection.');
    } finally {
      setGmailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGmailStatus();
  }, [loadGmailStatus]);

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

      setEditVisible(false);
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Unable to save your changes right now.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      await onLogout?.();
    } catch (err: any) {
      Alert.alert('Sign out failed', err?.message || 'Could not sign out right now.');
    }
  };

  const handleSyncGmail = async () => {
    try {
      setSyncingGmail(true);
      await syncGmailApplications();
      Alert.alert('Gmail sync', 'Sync complete. Your applications are up to date.');
      await loadGmailStatus();
      if (typeof onGmailSyncComplete === 'function') {
        onGmailSyncComplete();
      }
    } catch (err: any) {
      Alert.alert('Gmail sync failed', err?.message || 'Unable to sync right now.');
    } finally {
      setSyncingGmail(false);
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
      Alert.alert('Reset failed', err?.message || 'Unable to reset Gmail imports right now.');
    } finally {
      setResettingGmail(false);
    }
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
          <SectionHeader icon="notifications-outline" label="Notifications" />
          <ToggleRow
            title="Interview reminders"
            subtitle="Get notified 1 day and 1 hour before"
            value={interviewReminders}
            onValueChange={setInterviewReminders}
          />
          <Divider />
          <ToggleRow
            title="Follow-up nudges"
            subtitle="Reminders to follow up on applications"
            value={followUpNudges}
            onValueChange={setFollowUpNudges}
          />
          <Divider />
          <ToggleRow
            title="Weekly digest"
            subtitle="Summary of your job search activity"
            value={weeklyDigest}
            onValueChange={setWeeklyDigest}
          />
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
          </View>
          {gmailError && (
            <ActionRow icon="refresh-outline" label="Reload Gmail status" onPress={loadGmailStatus} />
          )}
          <ActionRow
            icon="sync-outline"
            label="Sync Gmail now"
            onPress={handleSyncGmail}
            rightElement={
              syncingGmail ? <ActivityIndicator size="small" color="#9CC6FF" /> : <Ionicons name="chevron-forward" size={16} color="#8EA2C3" />
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
          <Text style={styles.helperTextInline}>
            Re-sync anytime if you&apos;ve received new job emails. Automatic sync is coming soon.
          </Text>
        </View>

        <View style={styles.glassCard}>
          <SectionHeader icon="lock-closed-outline" label="Data & Privacy" />
          <ActionRow icon="download-outline" label="Export data" />
          <Divider />
          <ActionRow icon="refresh-outline" label="Reset onboarding" />
          <Divider />
          <ActionRow icon="trash-outline" label="Clear pipeline" />
          <Divider />
          <ActionRow icon="alert-circle-outline" label="Delete account" destructive />
          <Divider />
          <ActionRow icon="log-out-outline" label="Sign out" onPress={handleSignOut} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Basafy v1.0 • Made with ❤️ for job seekers</Text>
          <Text style={styles.footerSub}>Work your next move 🚀</Text>
        </View>
      </ScrollView>
      <FloatingNav activeTab={activeTab} onNavigate={onNavigate} bottomInset={insets.bottom} />
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

const LinearGradientIcon = ({ initial }: { initial: string }) => (
  <LinearGradient colors={['#4A8CFF', '#5AEFD5']} style={styles.avatarInner}>
    <Text style={styles.avatarInitial}>{initial}</Text>
  </LinearGradient>
);

const SectionHeader = ({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionIcon}>
      <Ionicons name={icon} size={16} color="#9CC6FF" />
    </View>
    <Text style={styles.sectionTitle}>{label}</Text>
  </View>
);

const ToggleRow = ({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => (
  <View style={styles.toggleRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowSubtitle}>{subtitle}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      thumbColor={value ? '#fff' : '#cbd5e1'}
      trackColor={{ false: '#475569', true: '#4A8CFF' }}
    />
  </View>
);

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
}) => (
  <TouchableOpacity style={styles.actionRow} activeOpacity={0.85} onPress={onPress}>
    <View style={styles.actionIconWrap}>
      <Ionicons name={icon} size={16} color={destructive ? '#FF7B7B' : '#9CC6FF'} />
    </View>
    <Text style={[styles.actionLabel, destructive && styles.destructive]}>{label}</Text>
    {rightElement || <Ionicons name="chevron-forward" size={16} color="#8EA2C3" />}
  </TouchableOpacity>
);

const Divider = () => <View style={styles.divider} />;

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
}) => (
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

const styles = StyleSheet.create({
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
  },
  rowTitle: {
    color: palette.text,
    fontWeight: '800',
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
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
