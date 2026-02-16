import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FloatingNav from '../../components/main/FloatingNav';
import EmptyState from '../../components/common/EmptyState';
import { ApplicationsListSkeleton } from '../../components/common/SkeletonLoader';
import SwipeableRow from '../../components/common/SwipeableRow';
import { useTheme, Palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';
import { useCachedData } from '../../lib/useCachedData';
import { CacheKeys } from '../../lib/cache';
import { lightImpact, selectionChanged } from '../../lib/haptics';
import { isMockReviewer, syncMockInbox } from '../../lib/gmailIntegration';

const STATUS_FILTERS = ['All', 'Applied', 'Interview', 'Offer', 'Rejected'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
type SortMode = 'date' | 'alpha';

export type Application = {
  id: string;
  company: string | null;
  role: string | null;
  role_title?: string | null;
  status: string | null;
  source_type: string | null;
  is_hidden: boolean;
  gmail_message_id?: string | null;
  gmail_thread_id?: string | null;
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
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const searchInputRef = useRef<TextInput>(null);
  const mockSyncAttempted = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchApplications();
  }, [showHidden]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;
    const subscribe = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!active || !userId) return;
      channel = supabase
        .channel(`applications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'applications',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            fetchApplications(true);
          },
        )
        .subscribe();
    };
    subscribe();
    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchApplications]);

  const fetchApplications = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      let query = supabase
        .from('applications')
        .select(
          'id, company, role, role_title, status, source_type, is_hidden, gmail_message_id, gmail_thread_id, created_at, updated_at, last_synced_at'
        )
        .order('created_at', { ascending: false });

      if (!showHidden) {
        query = query.or('is_hidden.is.null,is_hidden.eq.false');
      }

      const { data, error } = await query;

      if (error) {
        setErrorMessage('Unable to load applications right now.');
        setApplications([]);
      } else if (data) {
        setApplications(data);
        if (!mockSyncAttempted.current && data.length === 0) {
          const { data: sessionData } = await supabase.auth.getSession();
          const session = sessionData.session;
          if (await isMockReviewer(session)) {
            mockSyncAttempted.current = true;
            try {
              await syncMockInbox(session);
            } catch (syncErr) {
              console.warn('Demo sync failed', syncErr);
            }
            await fetchApplications(true);
            return;
          }
        }
      } else {
        setApplications([]);
      }
    } catch (err: any) {
      setErrorMessage('Unable to load applications right now.');
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [showHidden]);

  const filteredApplications = useMemo(() => {
    let result = applications;

    // Search filter (company or role)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (app) =>
          (app.company ?? '').toLowerCase().includes(q) ||
          (app.role ?? '').toLowerCase().includes(q) ||
          (app.role_title ?? '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'All') {
      const target = statusFilter.toLowerCase();
      result = result.filter((app) => {
        const appStatus = (app.status ?? '').toLowerCase();
        // "interview" matches "interviewing", "phone_interview", etc.
        if (target === 'interview') return appStatus.includes('interview');
        return appStatus === target || appStatus.includes(target);
      });
    }

    // Sort
    if (sortMode === 'alpha') {
      result = [...result].sort((a, b) =>
        (a.company ?? '').localeCompare(b.company ?? '')
      );
    }
    // 'date' sort is already the default order from the query (created_at DESC)

    return result;
  }, [applications, searchQuery, statusFilter, sortMode]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (statusFilter !== 'All') count++;
    if (sortMode !== 'date') count++;
    return count;
  }, [searchQuery, statusFilter, sortMode]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('All');
    setSortMode('date');
    selectionChanged();
  }, []);

  const handleRefresh = useCallback(async () => {
    lightImpact();
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

  const handleToggleHide = useCallback(async (app: Application) => {
    const newHidden = !(app.is_hidden ?? false);
    const { error } = await supabase
      .from('applications')
      .update({ is_hidden: newHidden })
      .eq('id', app.id);
    if (!error) {
      setApplications((prev) =>
        showHidden
          ? prev.map((a) => (a.id === app.id ? { ...a, is_hidden: newHidden } : a))
          : prev.filter((a) => a.id !== app.id),
      );
    }
  }, [showHidden]);

  const handleDelete = useCallback((app: Application) => {
    Alert.alert(
      'Delete Application',
      `Are you sure you want to delete ${app.company || 'this application'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('applications')
              .delete()
              .eq('id', app.id);
            if (!error) {
              setApplications((prev) => prev.filter((a) => a.id !== app.id));
            }
          },
        },
      ],
    );
  }, []);

  function renderItem({ item }: { item: Application }) {
    const companyLabel = capitalizeFirstLetter(item.company || 'Untitled application');
    const roleLabel = item.role || item.role_title || 'Role not set';
    const statusLabel = item.status ? `Status: ${capitalizeFirstLetter(item.status)}` : 'Status: Unknown';
    const isHidden = item.is_hidden && showHidden;

    return (
      <SwipeableRow
        rightActions={[
          {
            icon: item.is_hidden ? 'eye-outline' : 'eye-off-outline',
            label: item.is_hidden ? 'Show' : 'Hide',
            color: '#F4F6FA',
            backgroundColor: 'rgba(74,140,255,0.35)',
            onPress: () => handleToggleHide(item),
          },
          {
            icon: 'trash-outline',
            label: 'Delete',
            color: '#F4F6FA',
            backgroundColor: 'rgba(255,90,90,0.4)',
            onPress: () => handleDelete(item),
          },
        ]}
      >
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
      </SwipeableRow>
    );
  }

  const renderEmptyComponent = () => {
    if (activeFilterCount > 0) {
      return (
        <EmptyState
          icon="search-outline"
          title="No matches"
          message="No applications match your current filters. Try broadening your search."
          hint="Tap 'Clear' to reset filters"
          variant="large"
        />
      );
    }
    return (
      <EmptyState
        icon="briefcase-outline"
        title="No applications yet"
        message="Add one manually or connect Gmail to import your job applications automatically."
        hint="Pull down to refresh"
        variant="large"
      />
    );
  };

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

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={16} color={palette.muted} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search company or role…"
            placeholderTextColor={palette.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
        <TouchableOpacity
          style={[styles.sortButton, sortMode === 'alpha' && styles.sortButtonActive]}
          onPress={() => {
            setSortMode((prev) => (prev === 'date' ? 'alpha' : 'date'));
            selectionChanged();
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name={sortMode === 'date' ? 'time-outline' : 'text-outline'}
            size={16}
            color={sortMode === 'alpha' ? palette.primary : palette.muted}
          />
        </TouchableOpacity>
      </View>

      {/* Status filter pills */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContent}
        >
          {STATUS_FILTERS.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterPill,
                statusFilter === status && styles.filterPillActive,
              ]}
              onPress={() => {
                setStatusFilter(status);
                selectionChanged();
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === status && styles.filterPillTextActive,
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {activeFilterCount > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearFilters}
            activeOpacity={0.8}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Results count when filtering */}
      {activeFilterCount > 0 && !loading && (
        <Text style={styles.resultsCount}>
          {filteredApplications.length} result{filteredApplications.length !== 1 ? 's' : ''}
        </Text>
      )}

      {loading && !refreshing ? (
        <View style={styles.skeletonWrap}>
          <ApplicationsListSkeleton count={6} />
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
          data={filteredApplications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 120 + insets.bottom },
            filteredApplications.length === 0 && styles.emptyListContent,
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

const createStyles = (palette: Palette) => StyleSheet.create({
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
    marginBottom: 10,
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
  // ─── Search ───
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.overlayBorder,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: palette.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.overlayBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortButtonActive: {
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}18`,
  },
  // ─── Filter pills ───
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterPillsContent: {
    gap: 8,
    paddingRight: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.overlayBorder,
  },
  filterPillActive: {
    backgroundColor: `${palette.primary}22`,
    borderColor: palette.primary,
  },
  filterPillText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: palette.primary,
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  clearButtonText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  resultsCount: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 2,
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
  skeletonWrap: {
    flex: 1,
    paddingTop: 8,
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
