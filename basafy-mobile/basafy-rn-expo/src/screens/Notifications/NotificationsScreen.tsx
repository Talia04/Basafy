import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@backend/supabase/client';
import { palette } from '../../theme/palette';
import FloatingNav from '../../components/main/FloatingNav';
import EmptyState from '../../components/common/EmptyState';
import { NotificationsListSkeleton } from '../../components/common/SkeletonLoader';

type NotificationRow = {
  id: string;
  type: string;
  subtype: string | null;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
};

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
  onOpenApplication?: (applicationId: string) => void;
  unreadCount?: number;
  onNotificationsChanged?: () => void;
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'update', label: 'Updates' },
  { key: 'reminder', label: 'Reminders' },
  { key: 'system', label: 'System' },
];

export default function NotificationsScreen({
  activeTab = 'notifications',
  onNavigate,
  onOpenApplication,
  unreadCount: unreadCountProp,
  onNotificationsChanged,
}: Props) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    setErrorMessage(null);
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, subtype, title, body, entity_type, entity_id, metadata, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      setErrorMessage(error.message || 'Unable to load notifications.');
      setNotifications([]);
    } else {
      setNotifications((data as NotificationRow[]) || []);
    }
    setLoading(false);
  };

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter((item) => item.type === activeFilter);
  }, [notifications, activeFilter]);

  const groupedSections = useMemo(() => {
    const sectionsMap = new Map<string, NotificationRow[]>();
    for (const item of filteredNotifications) {
      const label = formatSectionLabel(item.created_at);
      const bucket = sectionsMap.get(label) || [];
      bucket.push(item);
      sectionsMap.set(label, bucket);
    }
    return Array.from(sectionsMap.entries()).map(([title, data]) => ({ title, data }));
  }, [filteredNotifications]);

  const handleMarkAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    if (error) {
      setErrorMessage(error.message || 'Unable to mark notifications as read.');
    } else {
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      onNotificationsChanged?.();
    }
    setMarkingAll(false);
  };

  const markNotificationRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item))
    );
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    if (error) {
      console.error('notifications mark read failed', error);
    } else {
      onNotificationsChanged?.();
    }
  };

  const handleNotificationPress = async (item: NotificationRow) => {
    if (!item.is_read) {
      await markNotificationRead(item.id);
    }
    if (item.entity_type === 'application' && item.entity_id) {
      onOpenApplication?.(item.entity_id);
      return;
    }
    if (item.entity_type === 'event') {
      onNavigate?.('calendar');
      return;
    }
    if (item.entity_type === 'task') {
      onNavigate?.('home');
      return;
    }
    onNavigate?.('home');
  };

  const renderItem = ({ item }: { item: NotificationRow }) => {
    const iconName = iconForNotification(item.type, item.subtype);
    const timeAgo = formatTimeAgo(item.created_at);
    return (
      <TouchableOpacity
        style={[styles.card, !item.is_read && styles.cardUnread]}
        activeOpacity={0.85}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.cardRow}>
          <View style={[styles.iconWrap, !item.is_read && styles.iconWrapUnread]}>
            <Ionicons name={iconName} size={18} color={item.is_read ? palette.muted : palette.primary} />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, !item.is_read && styles.cardTitleUnread]}>{item.title}</Text>
              <Text style={styles.cardTime}>{timeAgo}</Text>
            </View>
            {item.body ? <Text style={styles.cardSubtitle}>{item.body}</Text> : null}
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {(unreadCountProp ?? unreadCount) > 0
              ? `${unreadCountProp ?? unreadCount} unread`
              : 'All caught up'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.markAllButton, (unreadCountProp ?? unreadCount) === 0 && styles.markAllDisabled]}
          onPress={handleMarkAllRead}
          activeOpacity={0.8}
          disabled={(unreadCountProp ?? unreadCount) === 0 || markingAll}
        >
          {markingAll ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <Text style={styles.markAllText}>Mark all read</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const active = filter.key === activeFilter;
          return (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setActiveFilter(filter.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <NotificationsListSkeleton count={6} />
      ) : errorMessage ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchNotifications} activeOpacity={0.85}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={groupedSections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          contentContainerStyle={[styles.listContent, { paddingBottom: 120 + insets.bottom }]}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="No notifications yet"
              message="We'll show updates, reminders, and system alerts here as they arrive."
              variant="large"
            />
          }
        />
      )}
      <FloatingNav
        activeTab={activeTab}
        onNavigate={onNavigate}
        bottomInset={insets.bottom}
        unreadCount={unreadCountProp ?? unreadCount}
      />
    </SafeAreaView>
  );
}

const formatSectionLabel = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatTimeAgo = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const iconForNotification = (type: string, subtype: string | null) => {
  if (subtype === 'task_created') return 'checkmark-circle-outline';
  if (subtype === 'event_created') return 'calendar-outline';
  if (type === 'system') return 'warning-outline';
  if (type === 'reminder') return 'time-outline';
  return 'mail-outline';
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 140, 255, 0.18)',
  },
  markAllDisabled: {
    opacity: 0.5,
  },
  markAllText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(74, 140, 255, 0.2)',
  },
  filterText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: palette.text,
  },
  listContent: {
    gap: 12,
    paddingTop: 6,
  },
  sectionTitle: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardUnread: {
    borderColor: 'rgba(74, 140, 255, 0.45)',
    backgroundColor: 'rgba(74, 140, 255, 0.08)',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: {
    backgroundColor: 'rgba(74, 140, 255, 0.18)',
  },
  cardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  cardTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  cardTitleUnread: {
    color: '#E7F0FF',
  },
  cardTime: {
    color: palette.muted,
    fontSize: 11,
  },
  cardSubtitle: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.primary,
    marginTop: 8,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  loadingText: {
    color: palette.muted,
    marginTop: 10,
  },
  errorText: {
    color: '#FF7B7B',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 140, 255, 0.2)',
  },
  retryButtonText: {
    color: palette.primary,
    fontWeight: '700',
  },
  emptyText: {
    color: palette.muted,
    textAlign: 'center',
    paddingTop: 40,
  },
});
