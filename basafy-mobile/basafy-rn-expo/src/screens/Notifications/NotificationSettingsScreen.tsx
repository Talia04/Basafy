import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../theme/palette';
import FloatingNav from '../../components/main/FloatingNav';
import { supabase } from '@backend/supabase/client';
import { disablePushNotifications, registerForPushNotifications, upsertPushToken } from '../../lib/pushNotifications';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
  unreadCount?: number;
};

type SettingsState = {
  push_enabled: boolean;
  updates_enabled: boolean;
  reminders_enabled: boolean;
  event_reminder_24h: boolean;
  event_reminder_2h: boolean;
  event_reminder_15m: boolean;
  task_due_enabled: boolean;
  task_overdue_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
};

const defaultSettings: SettingsState = {
  push_enabled: false,
  updates_enabled: true,
  reminders_enabled: true,
  event_reminder_24h: true,
  event_reminder_2h: true,
  event_reminder_15m: false,
  task_due_enabled: true,
  task_overdue_enabled: false,
  quiet_hours_start: '',
  quiet_hours_end: '',
};

export default function NotificationSettingsScreen({
  activeTab = 'profile',
  onNavigate,
  unreadCount = 0,
}: Props) {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_notification_settings')
      .select(
        'push_enabled, updates_enabled, reminders_enabled, event_reminder_24h, event_reminder_2h, event_reminder_15m, task_due_enabled, task_overdue_enabled, quiet_hours_start, quiet_hours_end'
      )
      .maybeSingle();
    if (!error && data) {
      setSettings({
        push_enabled: data.push_enabled ?? false,
        updates_enabled: data.updates_enabled ?? true,
        reminders_enabled: data.reminders_enabled ?? true,
        event_reminder_24h: data.event_reminder_24h ?? true,
        event_reminder_2h: data.event_reminder_2h ?? true,
        event_reminder_15m: data.event_reminder_15m ?? false,
        task_due_enabled: data.task_due_enabled ?? true,
        task_overdue_enabled: data.task_overdue_enabled ?? false,
        quiet_hours_start: data.quiet_hours_start ?? '',
        quiet_hours_end: data.quiet_hours_end ?? '',
      });
    }
    setLoading(false);
  };

  const quietHoursHint = useMemo(() => {
    if (!settings.quiet_hours_start || !settings.quiet_hours_end) return 'Quiet hours disabled';
    return `Muted between ${settings.quiet_hours_start} and ${settings.quiet_hours_end}`;
  }, [settings.quiet_hours_start, settings.quiet_hours_end]);

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handlePushToggle = async (value: boolean) => {
    if (saving) return;
    if (value) {
      updateSetting('push_enabled', true);
      setSaving(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (userId) {
          await supabase.from('user_notification_settings').upsert({ user_id: userId, push_enabled: true });
        }
        const result = await registerForPushNotifications();
        if (!result.ok || !result.token) {
          throw new Error(result.error || 'Unable to enable notifications.');
        }
        await upsertPushToken(result.token, true);
        updateSetting('push_enabled', true);
      } catch (err: any) {
        Alert.alert('Save failed', err?.message || 'Unable to store your device token.');
        updateSetting('push_enabled', false);
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData.user?.id;
          if (userId) {
            await supabase.from('user_notification_settings').upsert({ user_id: userId, push_enabled: false });
          }
        } catch {
          // ignore rollback errors
        }
      } finally {
        setSaving(false);
      }
    } else {
      updateSetting('push_enabled', false);
      setSaving(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (userId) {
          await supabase.from('user_notification_settings').upsert({ user_id: userId, push_enabled: false });
        }
        await disablePushNotifications();
        updateSetting('push_enabled', false);
      } catch (err: any) {
        Alert.alert('Save failed', err?.message || 'Unable to disable notifications.');
        updateSetting('push_enabled', true);
      } finally {
        setSaving(false);
      }
    }
  };

  const saveSettings = async () => {
    if (saving) return;
    const start = settings.quiet_hours_start?.trim();
    const end = settings.quiet_hours_end?.trim();
    if ((start && !isValidTime(start)) || (end && !isValidTime(end))) {
      Alert.alert('Invalid time', 'Quiet hours should be in 24-hour format, e.g. 22:00.');
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      Alert.alert('Not signed in', 'Please sign in to update notification settings.');
      setSaving(false);
      return;
    }
    const payload = {
      user_id: userId,
      push_enabled: settings.push_enabled,
      updates_enabled: settings.updates_enabled,
      reminders_enabled: settings.reminders_enabled,
      event_reminder_24h: settings.event_reminder_24h,
      event_reminder_2h: settings.event_reminder_2h,
      event_reminder_15m: settings.event_reminder_15m,
      task_due_enabled: settings.task_due_enabled,
      task_overdue_enabled: settings.task_overdue_enabled,
      quiet_hours_start: start || null,
      quiet_hours_end: end || null,
    };
    const { error } = await supabase.from('user_notification_settings').upsert(payload);
    if (error) {
      Alert.alert('Save failed', error.message || 'Unable to save settings right now.');
    } else {
      Alert.alert('Saved', 'Notification settings updated.');
    }
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => onNavigate?.('profile')}>
              <Ionicons name="chevron-back" size={18} color={palette.text} />
              <Text style={styles.backText}>Profile</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>Control what we surface and when.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Push notifications</Text>
            <ToggleRow
              title="Enable push notifications"
              subtitle="Turn on system alerts (requires OS permission)"
              value={settings.push_enabled}
              onValueChange={handlePushToggle}
            />
            {saving && settings.push_enabled && (
              <Text style={styles.hintText}>Enabling push notifications…</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sync updates</Text>
            <ToggleRow
              title="Pipeline updates"
              subtitle="New jobs and stage changes"
              value={settings.updates_enabled}
              onValueChange={(value) => updateSetting('updates_enabled', value)}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Reminders</Text>
            <ToggleRow
              title="Reminders"
              subtitle="Event and task reminders"
              value={settings.reminders_enabled}
              onValueChange={(value) => updateSetting('reminders_enabled', value)}
            />
            <Divider />
            <ToggleRow
              title="Event reminders (24h)"
              subtitle="24 hours before interviews"
              value={settings.event_reminder_24h}
              onValueChange={(value) => updateSetting('event_reminder_24h', value)}
            />
            <Divider />
            <ToggleRow
              title="Event reminders (2h)"
              subtitle="2 hours before interviews"
              value={settings.event_reminder_2h}
              onValueChange={(value) => updateSetting('event_reminder_2h', value)}
            />
            <Divider />
            <ToggleRow
              title="Event reminders (15m)"
              subtitle="15 minutes before interviews"
              value={settings.event_reminder_15m}
              onValueChange={(value) => updateSetting('event_reminder_15m', value)}
            />
            <Divider />
            <ToggleRow
              title="Task due reminders"
              subtitle="Morning of due date"
              value={settings.task_due_enabled}
              onValueChange={(value) => updateSetting('task_due_enabled', value)}
            />
            <Divider />
            <ToggleRow
              title="Overdue nudges"
              subtitle="Subtle reminders for overdue tasks"
              value={settings.task_overdue_enabled}
              onValueChange={(value) => updateSetting('task_overdue_enabled', value)}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Quiet hours</Text>
            <Text style={styles.subtitle}>Coming soon.</Text>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={saveSettings}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#0A0E1A" /> : <Text style={styles.saveButtonText}>Save settings</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <FloatingNav
        activeTab={activeTab}
        onNavigate={onNavigate}
        bottomInset={insets.bottom}
        unreadCount={unreadCount}
      />
    </SafeAreaView>
  );
}

const isValidTime = (value: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

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

const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 140,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  title: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 12,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  hintText: {
    color: palette.muted,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  quietRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  inputLabel: {
    color: palette.muted,
    fontSize: 11,
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: palette.primary,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#0A0E1A',
    fontWeight: '800',
  },
});
