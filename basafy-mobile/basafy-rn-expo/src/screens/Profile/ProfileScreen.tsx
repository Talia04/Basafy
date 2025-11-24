import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';
import { navItems } from '../../lib/mock/homeData';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloatingNav from '../../components/main/FloatingNav';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
};

export default function ProfileScreen({ activeTab = 'profile', onNavigate }: Props) {
  const [interviewReminders, setInterviewReminders] = useState(true);
  const [followUpNudges, setFollowUpNudges] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [userEmail, setUserEmail] = useState('tanyachisepo04@gmail.com');
  const [userName, setUserName] = useState('Tanya Chisepo');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (user?.email) setUserEmail(user.email);
      const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name;
      if (fullName) setUserName(fullName);
    };
    loadUser();
  }, []);

  const initials = useMemo(() => (userName ? userName.charAt(0).toUpperCase() : 'U'), [userName]);

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

          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85}>
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
          <SectionHeader icon="lock-closed-outline" label="Data & Privacy" />
          <ActionRow icon="download-outline" label="Export data" />
          <Divider />
          <ActionRow icon="refresh-outline" label="Reset onboarding" />
          <Divider />
          <ActionRow icon="trash-outline" label="Clear pipeline" />
          <Divider />
          <ActionRow icon="alert-circle-outline" label="Delete account" destructive />
          <Divider />
          <ActionRow icon="log-out-outline" label="Sign out" />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Basafy v1.0 • Made with ❤️ for job seekers</Text>
          <Text style={styles.footerSub}>Work your next move 🚀</Text>
        </View>
      </ScrollView>
      <FloatingNav activeTab={activeTab} onNavigate={onNavigate} bottomInset={insets.bottom} />
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
}) => (
  <TouchableOpacity style={styles.actionRow} activeOpacity={0.85}>
    <View style={styles.actionIconWrap}>
      <Ionicons name={icon} size={16} color={destructive ? '#FF7B7B' : '#9CC6FF'} />
    </View>
    <Text style={[styles.actionLabel, destructive && styles.destructive]}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color="#8EA2C3" />
  </TouchableOpacity>
);

const Divider = () => <View style={styles.divider} />;

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
});
