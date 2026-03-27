import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FloatingNav from '../../components/main/FloatingNav';
import { useTheme, Palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';
import { LinearGradient } from 'expo-linear-gradient';
import EmptyState from '../../components/common/EmptyState';
import { lightImpact } from '../../lib/haptics';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
  onOpenApplication?: (application: {
    id: string;
    company: string | null;
    role: string | null;
    status: string | null;
    source_type?: string | null;
  }) => void;
  unreadCount?: number;
};

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const legend = [
  { label: 'Interview', color: '#4A8CFF' },
  { label: 'Deadline', color: '#FF7B7B' },
  { label: 'Assessment', color: '#5AEFD5' },
];

type CalendarEvent = {
  id: string;
  application_id: string | null;
  company: string | null;
  role_title: string | null;
  event_type: string;
  title: string | null;
  provider: string | null;
  meeting_link: string | null;
  start_at: string;
  source_type: string | null;
};

type HistoryEvent = {
  id: string;
  application_id: string | null;
  company: string | null;
  role_title: string | null;
  event_type: string;
  title: string | null;
  start_at: string;
  app_status: string | null;
};

type ViewMode = 'calendar' | 'history';
type HistoryPeriod = '1M' | '3M' | '6M' | '1Y';

const HISTORY_PERIODS: { label: HistoryPeriod; months: number }[] = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
];

export default function CalendarScreen({
  activeTab = 'calendar',
  onNavigate,
  onOpenApplication,
  unreadCount = 0,
}: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<number>(() => new Date().getDate());
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History mode state
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('6M');
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const monthLabel = useMemo(
    () => monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [monthDate]
  );

  const loadEvents = async (mounted = true) => {
    setLoading(true);
    setError(null);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 1);
    // Query events table directly — avoids any production view that may still
    // have a start_at >= now() filter from an older migration.
    const { data: rawEvents, error: rawError } = await supabase
      .from('events')
      .select('id, application_id, event_type, title, provider, meeting_link, start_at, source_type')
      .gte('start_at', monthStart.toISOString())
      .lt('start_at', monthEnd.toISOString())
      .order('start_at', { ascending: true });

    if (!mounted) return;

    if (rawError || !rawEvents) {
      setError('Unable to load calendar events.');
      setEvents([]);
      setLoading(false);
      return;
    }

    const appIds = Array.from(
      new Set(rawEvents.map((e: any) => e.application_id).filter(Boolean))
    );
    let appMap: Record<string, { company: string | null; role_title: string | null }> = {};
    if (appIds.length > 0) {
      const { data: appsData } = await supabase
        .from('applications')
        .select('id, company, role_title')
        .in('id', appIds as string[]);
      appMap = (appsData || []).reduce((acc: any, app: any) => {
        acc[app.id] = { company: app.company ?? null, role_title: app.role_title ?? null };
        return acc;
      }, {});
    }

    setEvents(
      rawEvents.map((item: any) => ({
        id: item.id,
        application_id: item.application_id ?? null,
        company: appMap[item.application_id]?.company ?? null,
        role_title: appMap[item.application_id]?.role_title ?? null,
        event_type: item.event_type ?? 'event',
        title: item.title ?? null,
        provider: item.provider ?? null,
        meeting_link: item.meeting_link ?? null,
        start_at: item.start_at,
        source_type: item.source_type ?? null,
      }))
    );
    setLoading(false);
  };
  useEffect(() => {
    loadEvents();
  }, [monthDate]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    const months = HISTORY_PERIODS.find((p) => p.label === historyPeriod)?.months ?? 6;
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const { data: evData } = await supabase
      .from('events')
      .select('id, application_id, event_type, title, start_at')
      .in('event_type', ['interview', 'assessment'])
      .lte('start_at', new Date().toISOString())
      .gte('start_at', since.toISOString())
      .order('start_at', { ascending: false });

    if (!evData || evData.length === 0) {
      setHistoryEvents([]);
      setHistoryLoading(false);
      return;
    }

    const appIds = Array.from(new Set(evData.map((e: any) => e.application_id).filter(Boolean)));
    let appMap: Record<string, { company: string | null; role_title: string | null; status: string | null }> = {};
    if (appIds.length > 0) {
      const { data: appsData } = await supabase
        .from('applications')
        .select('id, company, role_title, status')
        .in('id', appIds);
      appMap = (appsData || []).reduce((acc: any, app: any) => {
        acc[app.id] = { company: app.company ?? null, role_title: app.role_title ?? null, status: app.status ?? null };
        return acc;
      }, {});
    }

    setHistoryEvents(
      evData.map((ev: any) => ({
        id: ev.id,
        application_id: ev.application_id ?? null,
        company: appMap[ev.application_id]?.company ?? null,
        role_title: appMap[ev.application_id]?.role_title ?? null,
        event_type: ev.event_type,
        title: ev.title ?? null,
        start_at: ev.start_at,
        app_status: appMap[ev.application_id]?.status ?? null,
      }))
    );
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (viewMode === 'history') loadHistory();
  }, [viewMode, historyPeriod]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: loading ? 0.6 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, loading]);

  const calendarGrid = useMemo(() => buildCalendarGrid(monthDate), [monthDate]);
  const selectedLabel = useMemo(() => {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), selectedDay);
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }, [monthDate, selectedDay]);

  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);
  const selectedEvents = eventsByDay[selectedDay] || [];

  const handleRefresh = async () => {
    lightImpact();
    setRefreshing(true);
    try {
      if (viewMode === 'history') {
        await loadHistory();
      } else {
        await loadEvents();
      }
    } finally {
      setRefreshing(false);
    }
  };

  const goPrevMonth = () => {
    setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDay(1);
  };

  const goNextMonth = () => {
    setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDay(1);
  };

  const monthHasEvents = events.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.primary}
            colors={[palette.primary]}
            progressBackgroundColor={palette.card}
          />
        }
      >
        <LinearGradient colors={['rgba(74,140,255,0.18)', 'rgba(15,22,40,0.1)']} style={styles.headerCard}>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>Your interviews, assessments and deadlines</Text>
          <View style={styles.modeToggle}>
            {(['calendar', 'history'] as ViewMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.modeTab, viewMode === mode && styles.modeTabActive]}
                onPress={() => { lightImpact(); setViewMode(mode); }}
                activeOpacity={0.85}
              >
                <Text style={[styles.modeTabText, viewMode === mode && styles.modeTabTextActive]}>
                  {mode === 'calendar' ? 'Calendar' : 'History'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {viewMode === 'history' && (
          <View style={styles.historyContainer}>
            {/* Period selector */}
            <View style={styles.periodRow}>
              {HISTORY_PERIODS.map((p) => (
                <TouchableOpacity
                  key={p.label}
                  style={[styles.periodChip, historyPeriod === p.label && styles.periodChipActive]}
                  onPress={() => { lightImpact(); setHistoryPeriod(p.label); }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.periodChipText, historyPeriod === p.label && styles.periodChipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
              {!historyLoading && historyEvents.length > 0 && (
                <Text style={styles.historyCount}>{historyEvents.length} event{historyEvents.length !== 1 ? 's' : ''}</Text>
              )}
            </View>

            {historyLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={palette.primary} />
                <Text style={styles.loadingText}>Loading history…</Text>
              </View>
            ) : historyEvents.length === 0 ? (
              <EmptyState icon="time-outline" title="No events in this period" message="Interviews and assessments you've had will appear here." />
            ) : (
              <HistoryList
                events={historyEvents}
                palette={palette}
                onOpenApplication={onOpenApplication}
              />
            )}
          </View>
        )}

        {viewMode === 'calendar' && <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <View style={styles.monthControls}>
              <ScalePressable style={styles.iconButton} onPress={goPrevMonth}>
                <Ionicons name="chevron-back" size={16} color={palette.text} />
              </ScalePressable>
              <ScalePressable style={styles.iconButton} onPress={goNextMonth}>
                <Ionicons name="chevron-forward" size={16} color={palette.text} />
              </ScalePressable>
            </View>
          </View>

          <View style={styles.weekdaysRow}>
            {weekdays.map((day) => (
              <Text key={day} style={styles.weekdayText}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {calendarGrid.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.gridRow}>
                {row.map((day, colIndex) => {
                  const isSelected = day === selectedDay;
                  const dayEvents = day ? (eventsByDay[day] || []) : [];
                  const hasEvents = dayEvents.length > 0;
                  const allPast = hasEvents && dayEvents.every(e => new Date(e.start_at).getTime() < Date.now());
                  const dotColor = day ? getDotColor(dayEvents) : '#5AEFD5';
                  return (
                    <Pressable
                      key={`cell-${rowIndex}-${colIndex}`}
                      style={styles.cell}
                      onPress={() => day && setSelectedDay(day)}
                      disabled={!day}
                    >
                      {day ? (
                        <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                          <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
                        </View>
                      ) : (
                        <View style={styles.dayCircle} />
                      )}
                      {hasEvents && (
                        <View style={[styles.dot, { backgroundColor: dotColor, opacity: allPast ? 0.4 : 1 }]} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.legendRow}>
            {legend.map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>}

        {viewMode === 'calendar' && <View style={styles.eventsCard}>
          <View style={styles.eventsHeader}>
            <View style={styles.pinIcon}>
              <Ionicons name="pin" size={14} color={palette.text} />
            </View>
            <Text style={styles.eventsTitle}>{selectedLabel}</Text>
          </View>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={palette.primary} />
              <Text style={styles.loadingText}>Loading events…</Text>
            </View>
          ) : error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorTitle}>Couldn&apos;t load events</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={() => loadEvents()}>
                <Text style={styles.retryButtonText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : !monthHasEvents ? (
            <EmptyState icon="calendar-outline" title="No events this month" message="Connect Gmail or add an event to get started." />
          ) : selectedEvents.length === 0 ? (
            <EmptyState icon="calendar-outline" title="No events for this day" message="Pick another date or add an interview." />
          ) : (
            <View style={styles.eventsList}>
              {selectedEvents.map((event) => {
                const isPast = new Date(event.start_at).getTime() < Date.now();
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.eventCard, isPast && styles.eventCardPast]}
                    activeOpacity={0.85}
                    onPress={() =>
                      event.application_id &&
                      onOpenApplication?.({
                        id: event.application_id,
                        company: event.company,
                        role: event.role_title,
                        status: null,
                        source_type: 'gmail',
                      })
                    }
                  >
                    <View style={styles.eventHeader}>
                      <Text style={[styles.eventCompany, isPast && styles.textPast]}>
                        {event.company || event.title || 'Event'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        {isPast && (
                          <View style={styles.pastBadge}>
                            <Text style={styles.pastBadgeText}>Past</Text>
                          </View>
                        )}
                        <View style={[styles.eventBadge, { backgroundColor: getBadgeColor(event.event_type) }]}>
                          <Text style={styles.eventBadgeText}>{formatEventType(event.event_type)}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.eventRole, isPast && styles.textPast]}>
                      {event.title || formatEventType(event.event_type)}
                    </Text>
                    <View style={styles.eventMetaRow}>
                      <Ionicons name="time-outline" size={14} color={palette.muted} />
                      <Text style={styles.eventMetaText}>{formatTime(event.start_at)}</Text>
                    </View>
                    <View style={styles.eventMetaRow}>
                      <Ionicons name="videocam-outline" size={14} color={palette.muted} />
                      <Text style={styles.eventMetaText}>
                        {event.provider ? formatProvider(event.provider) : 'TBD'} • {event.meeting_link || 'No link'}
                      </Text>
                    </View>
                    {event.source_type === 'gmail' && <Text style={styles.fromEmailLabel}>From email</Text>}
                    {event.meeting_link && !isPast && (
                      <ScalePressable
                        style={styles.joinButton}
                        onPress={() => openMeetingLink(event.meeting_link!)}
                      >
                        <Text style={styles.joinButtonText}>Join</Text>
                      </ScalePressable>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>}
      </Animated.ScrollView>
      <FloatingNav
        activeTab={activeTab}
        onNavigate={onNavigate}
        bottomInset={insets.bottom}
        unreadCount={unreadCount}
      />
    </SafeAreaView>
  );
}

// ─── History helpers ─────────────────────────────────────────────────────────

function groupHistoryByMonth(events: HistoryEvent[]): { label: string; events: HistoryEvent[] }[] {
  const map = new Map<string, HistoryEvent[]>();
  for (const ev of events) {
    const d = new Date(ev.start_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, evs]) => ({
      label: new Date(evs[0].start_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      events: evs,
    }));
}

function outcomeInfo(status: string | null): { text: string; color: string } | null {
  switch (status) {
    case 'offer':      return { text: 'Offer',      color: '#4ADE80' };
    case 'rejected':   return { text: 'Rejected',   color: '#FF7B7B' };
    case 'interview':  return { text: 'Interview',  color: '#4A8CFF' };
    case 'assessment': return { text: 'Assessment', color: '#5AEFD5' };
    default:           return null;
  }
}

function HistoryList({
  events,
  palette,
  onOpenApplication,
}: {
  events: HistoryEvent[];
  palette: any;
  onOpenApplication?: Props['onOpenApplication'];
}) {
  const groups = groupHistoryByMonth(events);
  return (
    <View style={{ gap: 20 }}>
      {groups.map((group) => (
        <View key={group.label}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700' }}>{group.label}</Text>
            <Text style={{ color: palette.muted, fontSize: 12 }}>· {group.events.length}</Text>
          </View>
          <View style={{ gap: 8 }}>
            {group.events.map((ev) => {
              const outcome = outcomeInfo(ev.app_status);
              const typeColor = ev.event_type === 'interview' ? '#4A8CFF' : '#5AEFD5';
              return (
                <TouchableOpacity
                  key={ev.id}
                  style={{
                    flexDirection: 'row',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.06)',
                    overflow: 'hidden',
                  }}
                  activeOpacity={0.85}
                  onPress={() =>
                    ev.application_id &&
                    onOpenApplication?.({
                      id: ev.application_id,
                      company: ev.company,
                      role: ev.role_title,
                      status: ev.app_status,
                      source_type: 'gmail',
                    })
                  }
                >
                  {/* left colour bar */}
                  <View style={{ width: 3, backgroundColor: typeColor, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }} />
                  <View style={{ flex: 1, padding: 12, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {ev.company || ev.title || 'Unknown company'}
                      </Text>
                      {outcome && (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: `${outcome.color}22` }}>
                          <Text style={{ color: outcome.color, fontSize: 11, fontWeight: '700' }}>{outcome.text}</Text>
                        </View>
                      )}
                    </View>
                    {ev.role_title ? (
                      <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>{ev.role_title}</Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: `${typeColor}22` }}>
                        <Text style={{ color: typeColor, fontSize: 11, fontWeight: '600' }}>
                          {ev.event_type === 'interview' ? 'Interview' : 'Assessment'}
                        </Text>
                      </View>
                      <Text style={{ color: palette.muted, fontSize: 12 }}>
                        {new Date(ev.start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {' · '}
                        {new Date(ev.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const buildCalendarGrid = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: Array<Array<number | null>> = [];
  let dayCounter = 1 - startDay;
  for (let row = 0; row < 6; row += 1) {
    const week: Array<number | null> = [];
    for (let col = 0; col < 7; col += 1) {
      if (dayCounter < 1 || dayCounter > daysInMonth) {
        week.push(null);
      } else {
        week.push(dayCounter);
      }
      dayCounter += 1;
    }
    weeks.push(week);
  }
  return weeks;
};

const groupEventsByDay = (events: CalendarEvent[]) => {
  const map: Record<number, CalendarEvent[]> = {};
  events.forEach((event) => {
    const date = new Date(event.start_at);
    const day = date.getDate();
    map[day] = [...(map[day] || []), event];
  });
  return map;
};

const getDotColor = (events: CalendarEvent[]) => {
  const types = new Set(events.map((event) => event.event_type.toLowerCase()));
  if (types.has('deadline')) return '#FF7B7B';
  if (types.has('assessment')) return '#5AEFD5';
  return '#4A8CFF';
};

const getBadgeColor = (type: string) => {
  const normalized = type.toLowerCase();
  if (normalized === 'deadline') return 'rgba(255,123,123,0.2)';
  if (normalized === 'assessment') return 'rgba(90,239,213,0.2)';
  return 'rgba(74,140,255,0.2)';
};

const formatTime = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '--'
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatEventType = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatProvider = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const openMeetingLink = (link: string) => {
  if (!link) return;
  try {
    Linking.openURL(link);
  } catch {
    // ignore
  }
};

const ScalePressable = ({
  children,
  style,
  onPress,
  disabled,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  disabled?: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
};

const createStyles = (palette: Palette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    padding: 18,
    gap: 16,
  },
  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 3,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  modeTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
  },
  modeTabActive: {
    backgroundColor: palette.primary,
  },
  modeTabText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#0A0E1A',
    fontWeight: '700',
  },
  historyContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 16,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  periodChipActive: {
    backgroundColor: 'rgba(74,140,255,0.2)',
    borderColor: '#4A8CFF',
  },
  periodChipText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  periodChipTextActive: {
    color: '#7FB2FF',
    fontWeight: '700',
  },
  historyCount: {
    color: palette.muted,
    fontSize: 12,
    marginLeft: 4,
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.muted,
  },
  calendarCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthLabel: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  monthControls: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekdayText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
    width: 34,
    textAlign: 'center',
  },
  grid: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cell: {
    width: 34,
    alignItems: 'center',
    gap: 6,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: '#4A8CFF',
  },
  dayText: {
    color: palette.text,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#0A0E1A',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  eventsCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pinIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventsTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 16,
  },
  eventsList: {
    gap: 12,
  },
  eventCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  eventCardPast: {
    opacity: 0.55,
  },
  textPast: {
    color: palette.muted,
  },
  pastBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pastBadgeText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventCompany: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  eventBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(74,140,255,0.2)',
  },
  eventBadgeText: {
    color: '#7FB2FF',
    fontSize: 12,
    fontWeight: '700',
  },
  eventRole: {
    color: palette.muted,
    fontSize: 13,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventMetaText: {
    color: palette.muted,
    fontSize: 12,
  },
  fromEmailLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  joinButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74,140,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  joinButtonText: {
    color: '#7FB2FF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 12,
  },
  errorWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  errorTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: palette.muted,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: palette.primary,
  },
  retryButtonText: {
    color: palette.text,
    fontWeight: '700',
  },
});
