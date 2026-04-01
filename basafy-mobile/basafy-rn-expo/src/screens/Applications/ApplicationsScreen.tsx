import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { typography } from '../../theme/typography';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@backend/supabase/client';
import { useApplications, QueryKeys } from '../../lib/queries';
import type { ApplicationRow } from '../../lib/queries';
import { lightImpact, selectionChanged } from '../../lib/haptics';
import { isMockReviewer, syncMockInbox } from '../../lib/gmailIntegration';
import { useGmailSyncState } from '../../lib/useGmailSyncState';

const STATUS_FILTERS = ['All', 'Applied', 'Interview', 'Offer', 'Rejected'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
type SortMode = 'newest' | 'oldest' | 'alpha';

type ListItem = Application | { _type: 'header'; label: string };

function getDateGroup(dateStr: string | null | undefined): 'Today' | 'This Week' | 'Earlier' {
  if (!dateStr) return 'Earlier';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return 'Today';
  if (diffDays < 7) return 'This Week';
  return 'Earlier';
}

function insertDateHeaders(apps: Application[]): ListItem[] {
  const result: ListItem[] = [];
  let lastGroup: string | null = null;
  for (const app of apps) {
    const group = getDateGroup(app.applied_at ?? app.created_at);
    if (group !== lastGroup) {
      result.push({ _type: 'header', label: group });
      lastGroup = group;
    }
    result.push(app);
  }
  return result;
}

function capitalizeFirstLetter(str?: string | null): string {
  if (!str) return '';
  const trimmed = str.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export type Application = {
  id: string;
  company: string | null;
  role: string | null;
  role_title?: string | null;
  status: string | null;
  source_type: string | null;
  is_hidden: boolean;
  is_starred: boolean;
  gmail_message_id?: string | null;
  gmail_thread_id?: string | null;
  email_snippet?: string | null;
  applied_at?: string | null;
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

type ApplicationCardProps = {
  item: Application;
  isHidden: boolean;
  isFavorited: boolean;
  companyLabel: string;
  roleLabel: string;
  statusLabel: string;
  dateLabel: string | null;
  styles: ReturnType<typeof createStyles>;
  palette: Palette;
  onPress?: (item: Application) => void;
  onToggleHide: (item: Application) => void;
  onToggleStar: (item: Application) => void;
  onDelete: (item: Application) => void;
};

const ApplicationCard = React.memo(function ApplicationCard({
  item,
  isHidden,
  isFavorited,
  companyLabel,
  roleLabel,
  statusLabel,
  dateLabel,
  styles,
  palette,
  onPress,
  onToggleHide,
  onToggleStar,
  onDelete,
}: ApplicationCardProps) {
  return (
    <SwipeableRow
        rightActions={[
          {
            icon: item.is_hidden ? 'eye-outline' : 'eye-off-outline',
            label: item.is_hidden ? 'Show' : 'Hide',
            color: '#F4F6FA',
            backgroundColor: 'rgba(74,140,255,0.35)',
            onPress: () => onToggleHide(item),
          },
          {
            icon: 'trash-outline',
            label: 'Delete',
            color: '#F4F6FA',
            backgroundColor: 'rgba(255,90,90,0.4)',
            onPress: () => onDelete(item),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.card, isHidden && styles.cardHidden]}
          activeOpacity={0.85}
          onPress={() => onPress?.(item)}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.statusText, isHidden && styles.textHidden]}>
                    {statusLabel}
                  </Text>
                  {dateLabel && (
                    <Text style={[styles.dateText, isHidden && styles.textHidden]}>
                      · {dateLabel}
                    </Text>
                  )}
                </View>
                <View style={styles.badgeRow}>
                  {(item.source_type === 'gmail' || !!item.gmail_thread_id) && (
                    <View style={styles.gmailBadge}>
                      <Ionicons name="mail-outline" size={11} color="#EA4335" />
                      <Text style={styles.gmailBadgeText}>Gmail</Text>
                    </View>
                  )}
                  {(item.source_type === 'gmail' || !!item.gmail_thread_id) && (!item.company || !item.role) && (
                    <View style={styles.reviewBadge}>
                      <Ionicons name="alert-circle-outline" size={11} color="#F4A942" />
                      <Text style={styles.reviewBadgeText}>Needs review</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.starButton}
              onPress={(e) => { e.stopPropagation(); onToggleStar(item); }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isFavorited ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isFavorited ? '#F4A942' : palette.muted}
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </SwipeableRow>
  );
});

export default function ApplicationsScreen({
  activeTab = 'applications',
  onNavigate,
  onOpenApplication,
  unreadCount = 0,
  onRefresh,
}: Props) {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const queryClient = useQueryClient();

  const [viewTab, setViewTab] = useState<'all' | 'favorites'>('all');
  const listOpacity = useRef(new Animated.Value(1)).current;
  const [showHidden, setShowHidden] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [userId, setUserId] = useState<string | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const mockSyncAttempted = useRef(false);
  const realtimeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { phase: gmailSyncState } = useGmailSyncState(userId);

  const {
    data: applications = [],
    isLoading: loading,
    isError,
    refetch,
  } = useApplications(showHidden);

  // Show error message when query fails
  useEffect(() => {
    if (isError) setErrorMessage('Unable to load applications right now.');
    else setErrorMessage(null);
  }, [isError]);

  // Mock reviewer: seed demo data when the list is empty on first load
  useEffect(() => {
    if (loading || applications.length > 0 || mockSyncAttempted.current) return;
    mockSyncAttempted.current = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (await isMockReviewer(session)) {
        try { await syncMockInbox(session); } catch (err) { console.warn('Demo sync failed', err); }
        queryClient.invalidateQueries({ queryKey: QueryKeys.applications(showHidden) });
      }
    })();
  }, [loading, applications.length]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;
    const subscribe = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!active || !userId) return;
      setUserId(userId);
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
            // Debounce: bulk inserts fire one event per row — coalesce into a single invalidation
            if (realtimeDebounce.current) clearTimeout(realtimeDebounce.current);
            realtimeDebounce.current = setTimeout(() => {
              realtimeDebounce.current = null;
              queryClient.invalidateQueries({ queryKey: ['applications'] });
            }, 800);
          },
        )
        .subscribe();
    };
    subscribe();
    return () => {
      active = false;
      if (realtimeDebounce.current) clearTimeout(realtimeDebounce.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredApplications = useMemo((): ListItem[] => {
    let result = applications;

    // Favorites tab — only show starred apps
    if (viewTab === 'favorites') {
      result = result.filter((app) => app.is_starred);
    }

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
        if (target === 'interview') return appStatus.includes('interview');
        return appStatus === target || appStatus.includes(target);
      });
    }

    if (sortMode === 'alpha') {
      result = [...result].sort((a, b) =>
        (a.company ?? '').localeCompare(b.company ?? '')
      );
      return result; // no date headers for alpha
    }

    if (sortMode === 'oldest') {
      result = [...result].sort((a, b) => {
        const aDate = a.applied_at ?? a.created_at ?? '';
        const bDate = b.applied_at ?? b.created_at ?? '';
        return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
      });
    }
    // 'newest' is already the default order from the query (applied_at DESC)

    return insertDateHeaders(result);
  }, [applications, viewTab, searchQuery, statusFilter, sortMode]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (statusFilter !== 'All') count++;
    if (sortMode !== 'newest') count++;
    return count;
  }, [searchQuery, statusFilter, sortMode]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('All');
    setSortMode('newest');
    selectionChanged();
  }, []);

  const switchTab = useCallback((tab: 'all' | 'favorites') => {
    if (tab === viewTab) return;
    selectionChanged();
    // Reset to 0, update state synchronously, then fade in — no fade-out wait
    listOpacity.setValue(0);
    setViewTab(tab);
    Animated.timing(listOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [viewTab, listOpacity]);

  const handleRefresh = useCallback(async () => {
    lightImpact();
    setRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refetch]);

  const handleToggleHide = useCallback(async (app: Application) => {
    const newHidden = !(app.is_hidden ?? false);
    const qKey = QueryKeys.applications(showHidden);
    // Optimistic update
    queryClient.setQueryData(qKey, (old: ApplicationRow[] | undefined) => {
      if (!old) return old;
      return showHidden
        ? old.map((a) => (a.id === app.id ? { ...a, is_hidden: newHidden } : a))
        : old.filter((a) => a.id !== app.id);
    });
    const { error } = await supabase.from('applications').update({ is_hidden: newHidden }).eq('id', app.id);
    if (error) queryClient.invalidateQueries({ queryKey: qKey });
  }, [showHidden, queryClient]);

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
            const qKey = QueryKeys.applications(showHidden);
            // Optimistic remove
            queryClient.setQueryData(qKey, (old: ApplicationRow[] | undefined) =>
              old ? old.filter((a) => a.id !== app.id) : old
            );
            // tasks and events cascade via FK; notifications has no FK so clear manually
            await supabase
              .from('notifications')
              .delete()
              .eq('entity_id', app.id)
              .eq('entity_type', 'application');
            const { error } = await supabase.from('applications').delete().eq('id', app.id);
            if (error) {
              console.error('[handleDelete] Failed to delete application:', error);
              queryClient.invalidateQueries({ queryKey: qKey });
            }
          },
        },
      ],
    );
  }, [showHidden, queryClient]);

  const handleToggleStar = useCallback(async (app: Application) => {
    const newStarred = !app.is_starred;
    selectionChanged();
    const qKey = QueryKeys.applications(showHidden);
    queryClient.setQueryData(qKey, (old: ApplicationRow[] | undefined) => {
      if (!old) return old;
      return old.map((a) => (a.id === app.id ? { ...a, is_starred: newStarred } : a));
    });
    const { error } = await supabase.from('applications').update({ is_starred: newStarred }).eq('id', app.id);
    if (error) queryClient.invalidateQueries({ queryKey: qKey });
  }, [showHidden, queryClient]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if ('_type' in item && item._type === 'header') {
      return (
        <Text style={{ color: 'rgba(230,237,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8, marginBottom: 2, marginLeft: 4 }}>
          {item.label}
        </Text>
      );
    }
    const app = item as Application;
    const companyLabel = capitalizeFirstLetter(app.company || 'Untitled application');
    const roleLabel = app.role || app.role_title || 'Role not set';
    const statusLabel = app.status ? capitalizeFirstLetter(app.status) : 'Unknown';
    const isHidden = app.is_hidden && showHidden;
    const dateStr = app.applied_at ?? app.created_at ?? null;
    const dateLabel = dateStr
      ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null;

    return (
      <ApplicationCard
        item={app}
        isHidden={isHidden}
        isFavorited={app.is_starred}
        companyLabel={companyLabel}
        roleLabel={roleLabel}
        statusLabel={statusLabel}
        dateLabel={dateLabel}
        styles={styles}
        palette={palette}
        onPress={onOpenApplication}
        onToggleHide={handleToggleHide}
        onToggleStar={handleToggleStar}
        onDelete={handleDelete}
      />
    );
  }, [showHidden, styles, palette, onOpenApplication, handleToggleHide, handleToggleStar, handleDelete]);

  const renderEmptyComponent = () => {
    const appCount = filteredApplications.filter((i) => !('_type' in i)).length;
    if (viewTab === 'favorites' && appCount === 0) {
      return (
        <EmptyState
          icon="bookmark-outline"
          title="No saved applications"
          message="Tap the bookmark icon on any application to save it here for quick access."
          variant="large"
        />
      );
    }
    if (activeFilterCount > 0 && appCount === 0) {
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

  const favoriteCount = useMemo(
    () => applications.filter((a) => a.is_starred).length,
    [applications]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Applications</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={() => onNavigate?.('pipeline')}
            activeOpacity={0.8}
            accessibilityLabel="Switch to board view"
          >
            <Ionicons name="grid-outline" size={16} color={palette.primary} />
            <Text style={styles.viewToggleText}>Board</Text>
          </TouchableOpacity>
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
            <Text style={styles.filterText}>Show hidden</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* All / Favorites tabs */}
      <View style={styles.viewTabRow}>
        <TouchableOpacity
          style={[styles.viewTab, viewTab === 'all' && styles.viewTabActive]}
          onPress={() => switchTab('all')}
          activeOpacity={0.8}
        >
          <Ionicons name="list-outline" size={14} color={viewTab === 'all' ? palette.primary : palette.muted} />
          <Text style={[styles.viewTabText, viewTab === 'all' && styles.viewTabTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewTab, viewTab === 'favorites' && styles.viewTabActive]}
          onPress={() => switchTab('favorites')}
          activeOpacity={0.8}
        >
          <Ionicons name="bookmark" size={14} color={viewTab === 'favorites' ? '#F4A942' : palette.muted} />
          <Text style={[styles.viewTabText, viewTab === 'favorites' && styles.viewTabTextActiveFav]}>Saved</Text>
          {favoriteCount > 0 && (
            <View style={styles.viewTabBadge}>
              <Text style={styles.viewTabBadgeText}>{favoriteCount}</Text>
            </View>
          )}
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
          style={[styles.sortButton, sortMode !== 'newest' && styles.sortButtonActive]}
          onPress={() => {
            setSortMode((prev) => prev === 'newest' ? 'oldest' : prev === 'oldest' ? 'alpha' : 'newest');
            selectionChanged();
          }}
          activeOpacity={0.8}
          accessibilityLabel={`Sort: ${sortMode === 'newest' ? 'Newest first' : sortMode === 'oldest' ? 'Oldest first' : 'A–Z'}`}
        >
          <Ionicons
            name={sortMode === 'alpha' ? 'text-outline' : sortMode === 'oldest' ? 'arrow-up-outline' : 'arrow-down-outline'}
            size={16}
            color={sortMode !== 'newest' ? palette.primary : palette.muted}
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

      {/* Gmail import progress banner */}
      {gmailSyncState.isRunning && (
        <View style={styles.importBanner}>
          <ActivityIndicator size="small" color="#5AEFD5" />
          <Text style={styles.importBannerText}>
            {gmailSyncState.summary || 'Importing more from Gmail…'}
          </Text>
        </View>
      )}

      {/* Results count when filtering */}
      {activeFilterCount > 0 && !loading && (
        <Text style={styles.resultsCount}>
          {filteredApplications.filter((i) => !('_type' in i)).length} result{filteredApplications.filter((i) => !('_type' in i)).length !== 1 ? 's' : ''}
        </Text>
      )}

      <Animated.View style={{ flex: 1, opacity: listOpacity }}>
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
              onPress={() => refetch()}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={14} color={palette.text} />
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredApplications}
            keyExtractor={(item) => ('_type' in item ? `header-${item.label}` : item.id.toString())}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: 120 + insets.bottom },
              filteredApplications.filter((i) => !('_type' in i)).length === 0 && styles.emptyListContent,
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
      </Animated.View>

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
  viewToggleButton: {
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(74,140,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,140,255,0.45)',
  },
  viewToggleText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: typography.body,
    letterSpacing: 0.2,
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
  // ─── View tabs (All / Saved) ───
  viewTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  viewTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.overlayBorder,
  },
  viewTabActive: {
    backgroundColor: `${palette.primary}18`,
    borderColor: palette.primary,
  },
  viewTabText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  viewTabTextActive: {
    color: palette.primary,
  },
  viewTabTextActiveFav: {
    color: '#F4A942',
  },
  viewTabBadge: {
    backgroundColor: '#F4A942',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  viewTabBadgeText: {
    color: '#0A0D16',
    fontSize: 10,
    fontWeight: '800',
  },
  // ─── Star button ───
  starButton: {
    padding: 4,
    marginLeft: 4,
    alignSelf: 'flex-start',
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
  dateText: {
    color: palette.muted,
    fontSize: 12,
    opacity: 0.7,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  importBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(90, 239, 213, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(90, 239, 213, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  importBannerText: {
    color: '#5AEFD5',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(244, 169, 66, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 169, 66, 0.4)',
  },
  reviewBadgeText: {
    color: '#F4A942',
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
