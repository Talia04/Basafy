import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FloatingNav from '../../components/main/FloatingNav';
import { palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';

export type Application = {
  id: string;
  company: string | null;
  role: string | null;
  status: string | null;
  source_type: string | null;
  is_hidden: boolean;
  gmail_message_id?: string | null;
  gmail_thread_id?: string | null;
  email_snippet?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_synced_at?: string | null;
};

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
  onOpenApplication?: (application: Application) => void;
  unreadCount?: number;
  onRefresh?: () => Promise<void>;
};

export default function ApplicationsScreen({
  activeTab = 'applications',
  onNavigate,
  onOpenApplication,
  unreadCount = 0,
  onRefresh,
}: Props) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchApplications();
  }, [showHidden]);

  const fetchApplications = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      let query = supabase
        .from('applications')
        .select(
          'id, company, role, status, source_type, is_hidden, gmail_message_id, gmail_thread_id, email_snippet, created_at, updated_at, last_synced_at'
        )
        .order('created_at', { ascending: false });

      if (!showHidden) {
        query = query.eq('is_hidden', false);
      }

      const { data, error } = await query;

      if (error) {
        setErrorMessage(error.message || 'Unable to load applications.');
        setApplications([]);
      } else if (data) {
        setApplications(data);
      } else {
        setApplications([]);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to load applications.');
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [showHidden]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Call external refresh handler (e.g., Gmail sync) if provided
      if (onRefresh) {
        await onRefresh();
      }
      // Then refresh the applications list
      await fetchApplications(true);
    } catch (err) {
      // Error handling is done in fetchApplications
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, fetchApplications]);

  function capitalizeFirstLetter(str?: string | null): string {
    if (!str) return '';
    const trimmed = str.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  function renderItem({ item }: { item: Application }) {
    const companyLabel = capitalizeFirstLetter(item.company || 'Untitled application');
    const roleLabel = item.role || 'Role not set';
    const statusLabel = item.status ? `Status: ${item.status}` : 'Status: Unknown';
    const isHidden = item.is_hidden && showHidden;

    return (
      <TouchableOpacity
        style={[styles.card, isHidden && styles.cardHidden]}
        activeOpacity={0.85}
        onPress={() => onOpenApplication?.(item)}
      >
        <View style={styles.cardRow}>
          <View style={styles.iconWrap}>
            <Ionicons name="briefcase-outline" size={18} color={palette.muted} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.titleText, isHidden && styles.textHidden]}>
              {companyLabel}
            </Text>
            <Text style={[styles.roleText, isHidden && styles.textHidden]}>
              {roleLabel}
              {item.is_hidden ? ' (hidden)' : ''}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.statusText, isHidden && styles.textHidden]}>
                {statusLabel}
              </Text>
              {item.source_type === 'gmail' && (
                <View style={styles.gmailBadge}>
                  <Ionicons name="mail-outline" size={11} color="#EA4335" />
                  <Text style={styles.gmailBadgeText}>Gmail</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="briefcase-outline" size={48} color={palette.muted} style={{ opacity: 0.5 }} />
      <Text style={styles.emptyTitle}>No applications yet</Text>
      <Text style={styles.emptyText}>
        Add one manually or connect Gmail to import your job applications automatically.
      </Text>
      <Text style={styles.pullHint}>Pull down to refresh</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Applications</Text>
        <TouchableOpacity
          style={[styles.filterButton, showHidden && styles.filterButtonActive]}
          onPress={() => setShowHidden((prev) => !prev)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={showHidden ? 'eye-outline' : 'eye-off-outline'}
            size={14}
            color={palette.muted}
          />
          <Text style={styles.filterText}>Show hidden imports</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.loadingText}>Loading applications…</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.loadingWrap}>
          <Ionicons name="alert-circle" size={32} color="#FF6B6B" style={{ marginBottom: 8 }} />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchApplications()}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={14} color={palette.text} />
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 120 + insets.bottom },
            applications.length === 0 && styles.emptyListContent,
          ]}
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={palette.primary}
              colors={[palette.primary]}
              progressBackgroundColor={palette.card}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <FloatingNav
        activeTab={activeTab}
        onNavigate={onNavigate}
        bottomInset={insets.bottom}
        unreadCount={unreadCount}
      />
    </SafeAreaView>
  );
}

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
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  title: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(74, 140, 255, 0.18)',
  },
  filterText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingTop: 8,
    gap: 12,
  },
  emptyListContent: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHidden: {
    opacity: 0.55,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  cardContent: {
    flex: 1,
  },
  titleText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  roleText: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  statusText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  gmailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(234, 67, 53, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 67, 53, 0.35)',
  },
  gmailBadgeText: {
    color: '#EA4335',
    fontSize: 11,
    fontWeight: '700',
  },
  textHidden: {
    color: 'rgba(244, 246, 250, 0.7)',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 13,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  retryButtonText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: palette.muted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  pullHint: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 24,
    opacity: 0.6,
  },
});
