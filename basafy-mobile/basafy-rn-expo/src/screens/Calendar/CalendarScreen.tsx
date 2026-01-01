import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FloatingNav from '../../components/main/FloatingNav';
import { palette } from '../../theme/palette';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
};

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthLabel = 'March 2025';

const calendarGrid = [
  [null, null, null, null, null, null, 1],
  [2, 3, 4, 5, 6, 7, 8],
  [9, 10, 11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20, 21, 22],
  [23, 24, 25, 26, 27, 28, 29],
  [30, 31, null, null, null, null, null],
];

const legend = [
  { label: 'Interview', color: '#4A8CFF' },
  { label: 'Deadline', color: '#FF7B7B' },
  { label: 'Assessment', color: '#5AEFD5' },
];

const selectedDate = 14;
const selectedLabel = 'Friday, March 14';

const mockEvents = [
  {
    id: 'event-1',
    company: 'Google',
    title: 'Recruiter Call',
    type: 'interview',
    time: '10:00 AM',
    provider: 'Google Meet',
    link: 'meet.google.com',
  },
  {
    id: 'event-2',
    company: 'Stripe',
    title: 'Technical Interview',
    type: 'interview',
    time: '2:00 PM',
    provider: 'Zoom',
    link: 'zoom.us',
  },
];

export default function CalendarScreen({ activeTab = 'calendar', onNavigate }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>Your upcoming interviews and deadlines</Text>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <View style={styles.monthControls}>
              <TouchableOpacity style={styles.iconButton} activeOpacity={0.85}>
                <Ionicons name="chevron-back" size={16} color={palette.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} activeOpacity={0.85}>
                <Ionicons name="chevron-forward" size={16} color={palette.text} />
              </TouchableOpacity>
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
                  const isSelected = day === selectedDate;
                  const hasDot = day === 15 || day === 18;
                  const dotColor = day === 15 ? '#FF7B7B' : '#5AEFD5';
                  return (
                    <View key={`cell-${rowIndex}-${colIndex}`} style={styles.cell}>
                      {day ? (
                        <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                          <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
                        </View>
                      ) : (
                        <View style={styles.dayCircle} />
                      )}
                      {hasDot && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
                    </View>
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
          <View style={styles.eventsList}>
            {mockEvents.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventCompany}>{event.company}</Text>
                  <View style={styles.eventBadge}>
                    <Text style={styles.eventBadgeText}>{event.type}</Text>
                  </View>
                </View>
                <Text style={styles.eventRole}>{event.title}</Text>
                <View style={styles.eventMetaRow}>
                  <Ionicons name="time-outline" size={14} color={palette.muted} />
                  <Text style={styles.eventMetaText}>{event.time}</Text>
                </View>
                <View style={styles.eventMetaRow}>
                  <Ionicons name="videocam-outline" size={14} color={palette.muted} />
                  <Text style={styles.eventMetaText}>
                    {event.provider} • {event.link}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <FloatingNav activeTab={activeTab} onNavigate={onNavigate} bottomInset={insets.bottom} />
    </SafeAreaView>
  );
}

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
    borderRadius: 24,
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
    borderRadius: 24,
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
    borderRadius: 24,
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
    borderRadius: 16,
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
});
