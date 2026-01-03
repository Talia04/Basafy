import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FloatingNav from '../../components/main/FloatingNav';
import { palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';
import { LinearGradient } from 'expo-linear-gradient';

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

export default function CalendarScreen({ activeTab = 'calendar', onNavigate, onOpenApplication }: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<number>(() => new Date().getDate());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const monthLabel = useMemo(
    () => monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [monthDate]
  );

  useEffect(() => {
    let mounted = true;
    const loadEvents = async () => {
      setLoading(true);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 1);
      const monthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-01`;
      const { data, error } = await supabase
        .from('v_calendar_events')
        .select('id, application_id, company, role_title, event_type, title, provider, meeting_link, start_at, source_type, event_date')
        .gte('event_date', monthStartStr)
        .lt('event_date', monthEndStr)
        .order('start_at', { ascending: true });
      if (!mounted) return;
      if (!error && Array.isArray(data) && data.length > 0) {
        setEvents(
          data.map((item: any) => ({
            id: item.id,
            application_id: item.application_id ?? null,
            company: item.company ?? null,
            role_title: item.role_title ?? null,
            event_type: item.event_type ?? 'event',
            title: item.title ?? null,
            provider: item.provider ?? null,
            meeting_link: item.meeting_link ?? null,
            start_at: item.start_at,
            source_type: item.source_type ?? null,
          }))
        );
      } else {
        const { data: rawEvents, error: rawError } = await supabase
          .from('events')
          .select('id, application_id, event_type, title, provider, meeting_link, start_at, source_type')
          .gte('start_at', monthStart.toISOString())
          .lt('start_at', monthEnd.toISOString())
          .order('start_at', { ascending: true });
        if (rawError || !rawEvents) {
          setEvents([]);
          setLoading(false);
          return;
        }
        const appIds = Array.from(
          new Set(rawEvents.map((event: any) => event.application_id).filter(Boolean))
        );
        let appMap: Record<string, { company: string | null; role_title: string | null }> = {};
        if (appIds.length > 0) {
          const { data: appsData } = await supabase
            .from('applications')
            .select('id, company, role_title')
            .in('id', appIds);
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
      }
      setLoading(false);
    };
    loadEvents();
    return () => {
      mounted = false;
    };
  }, [monthDate]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: loading ? 0 : 1,
      duration: 350,
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
      >
        <LinearGradient colors={['rgba(74,140,255,0.18)', 'rgba(15,22,40,0.1)']} style={styles.headerCard}>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>Your upcoming interviews and deadlines</Text>
        </LinearGradient>

        <View style={styles.calendarCard}>
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
                  const hasEvents = day ? (eventsByDay[day] || []).length > 0 : false;
                  const dotColor = day ? getDotColor(eventsByDay[day] || []) : '#5AEFD5';
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
                      {hasEvents && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
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
        </View>

        <View style={styles.eventsCard}>
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
          ) : !monthHasEvents ? (
            <Text style={styles.emptyText}>No events this month yet.</Text>
          ) : selectedEvents.length === 0 ? (
            <Text style={styles.emptyText}>No events for this day.</Text>
          ) : (
            <View style={styles.eventsList}>
              {selectedEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCard}
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
                    <Text style={styles.eventCompany}>{event.company || event.title || 'Event'}</Text>
                    <View style={[styles.eventBadge, { backgroundColor: getBadgeColor(event.event_type) }]}>
                      <Text style={styles.eventBadgeText}>{formatEventType(event.event_type)}</Text>
                    </View>
                  </View>
                  <Text style={styles.eventRole}>{event.title || formatEventType(event.event_type)}</Text>
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
                  {event.meeting_link && (
                    <ScalePressable
                      style={styles.joinButton}
                      onPress={() => openMeetingLink(event.meeting_link)}
                    >
                      <Text style={styles.joinButtonText}>Join</Text>
                    </ScalePressable>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>
      <FloatingNav activeTab={activeTab} onNavigate={onNavigate} bottomInset={insets.bottom} />
    </SafeAreaView>
  );
}

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

const styles = StyleSheet.create({
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
    gap: 6,
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
});
