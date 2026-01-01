import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FloatingNav from '../../components/main/FloatingNav';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { summaryStats, metrics, upcomingEvents, tasks as mockTasks } from '../../lib/mock/homeData';
import { palette } from '../../theme/palette';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
};

export default function MainScreen({ activeTab = 'home', onNavigate }: Props) {
  const [tasks, setTasks] = useState(mockTasks);
  const insets = useSafeAreaInsets();

  const handleToggleTask = (title: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.title === title ? { ...task, done: !task.done } : task))
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <GreetingCard />
        <MetricsStack />
        <MetricsRow />
        <UpcomingSection />
        <TasksSection />
      </ScrollView>
      <FloatingNav activeTab={activeTab} onNavigate={onNavigate} bottomInset={insets.bottom} />
    </SafeAreaView>
  );
}

const GreetingCard = () => (
  <View style={styles.glassCard}>
    <View style={styles.greetingRow}>
      <Ionicons name="sparkles" size={20} color="#5AEFD5" />
      <Text style={styles.greetingLabel}>Good afternoon</Text>
    </View>
    <Text style={styles.greetingTitle}>Hi Tanya 👋</Text>
    <Text style={styles.greetingSubtitle}>Here&apos;s your job search at a glance.</Text>
  </View>
);

const MetricsStack = () => (
  <View style={[styles.glassCard, { gap: 12 }]}>
    {summaryStats.map((item) => (
      <View key={item.label} style={styles.metricStackCard}>
        <View style={styles.metricStackIcon}>
          <Ionicons name={item.icon as any} size={18} color={item.accent} />
        </View>
        <View style={styles.metricStackText}>
          <Text style={styles.metricStackLabel}>{item.label}</Text>
          <Text style={styles.metricStackValue}>{item.value}</Text>
        </View>
      </View>
    ))}
  </View>
);

const MetricsRow = () => (
  <View style={styles.metricRow}>
    {metrics.map((item) => (
      <View key={item.label} style={styles.metricCard}>
        <View style={styles.metricIcon}>
          <Ionicons name={item.icon as any} size={16} color="#9CC6FF" />
        </View>
        <Text style={styles.metricLabel}>{item.label}</Text>
        <Text style={styles.metricValue}>{item.value}</Text>
      </View>
    ))}
  </View>
);

const UpcomingSection = () => (
    <View style={styles.glassCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="calendar-outline" size={16} color="#9CC6FF" />
          <Text style={styles.sectionTitle}>Coming Up</Text>
        </View>
      </View>
      {upcomingEvents.map((item) => (
        <View key={item.company + item.time} style={styles.eventCard}>
          <LinearGradient colors={item.accent as [string, string]} style={styles.eventBorder} />
          <View style={styles.eventHeader}>
            <Text style={styles.eventCompany}>{item.company}</Text>
            <View style={styles.eventIcon}>
              <Ionicons name="videocam-outline" size={16} color="#BFD7FF" />
            </View>
          </View>
          <Text style={styles.eventRole}>{item.role}</Text>
          <View style={styles.eventMetaRow}>
            <EventMeta icon="calendar-outline" text={item.day} />
            <EventMeta icon="time-outline" text={item.time} />
          </View>
          <Text style={styles.eventPlatform}>Platform: {item.link}</Text>
          <View style={styles.eventActions}>
            <TouchableOpacity style={styles.primaryChip}>
              <Text style={styles.primaryChipText}>Join</Text>
            </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryChip}>
            <Text style={styles.secondaryChipText}>Prepare</Text>
          </TouchableOpacity>
        </View>
      </View>
    ))}
  </View>
);

const EventMeta = ({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) => (
  <View style={styles.eventMeta}>
    <Ionicons name={icon} size={14} color="#A3B0C0" />
    <Text style={styles.eventMetaText}>{text}</Text>
  </View>
);

const TasksSection = () => {
  const [tasksState, setTasksState] = useState(mockTasks);
  const pendingCount = tasksState.filter((t) => !t.done).length;

  const toggleTask = (title: string) => {
    setTasksState((prev) => prev.map((task) => (task.title === title ? { ...task, done: !task.done } : task)));
  };

  return (
    <View style={styles.glassCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tasks</Text>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{pendingCount} pending</Text>
        </View>
      </View>
      <View style={{ gap: 12 }}>
        {tasksState.map((task) => (
          <TouchableOpacity
            key={task.title}
            style={styles.taskCard}
            activeOpacity={0.85}
            onPress={() => toggleTask(task.title)}
          >
            <View style={styles.taskRow}>
              <View style={[styles.checkCircle, task.done && styles.checkCircleDone]}>
                {task.done && <Ionicons name="checkmark" size={14} color={palette.text} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.taskTitle,
                    task.done && styles.taskTitleDone,
                    task.status === 'overdue' && !task.done ? styles.taskTitleOverdue : null,
                  ]}
                >
                  {task.title}
                </Text>
                <Text
                  style={[
                    styles.taskSubtitle,
                    task.status === 'overdue' && !task.done ? styles.taskSubtitleOverdue : null,
                    task.done && styles.taskSubtitleDone,
                  ]}
                >
                  {task.detail}
                </Text>
              </View>
              {task.status === 'overdue' && !task.done && (
                <View style={styles.overdueChip}>
                  <Text style={styles.overdueChipText}>Overdue</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};


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
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  greetingLabel: {
    color: palette.muted,
    fontWeight: '700',
  },
  greetingTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  greetingSubtitle: {
    color: palette.muted,
  },
  metricStackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metricStackIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricStackText: {
    flex: 1,
  },
  metricStackLabel: {
    color: palette.muted,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricStackValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    color: palette.muted,
    fontWeight: '700',
  },
  metricValue: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sectionBadgeText: {
    color: palette.muted,
    fontWeight: '700',
  },
  eventCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  eventBorder: {
    height: 3,
    borderRadius: 10,
    marginBottom: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventCompany: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  eventRole: {
    color: palette.muted,
    marginBottom: 10,
  },
  eventIcon: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 8,
    borderRadius: 12,
  },
  eventMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventMetaText: {
    color: palette.muted,
  },
  eventPlatform: {
    color: palette.muted,
    marginBottom: 10,
  },
  eventActions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryChip: {
    flex: 1,
    backgroundColor: palette.primary,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryChipText: {
    color: palette.text,
    fontWeight: '800',
  },
  secondaryChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryChipText: {
    color: palette.text,
    fontWeight: '700',
  },
  taskCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  taskRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  taskTitle: {
    color: palette.text,
    fontWeight: '800',
  },
  taskTitleOverdue: {
    color: '#FF7B7B',
  },
  taskTitleDone: {
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'line-through',
  },
  taskSubtitle: {
    color: palette.muted,
    marginTop: 4,
  },
  taskSubtitleOverdue: {
    color: '#FF7B7B',
  },
  taskSubtitleDone: {
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'line-through',
  },
  overdueChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,123,123,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,123,123,0.5)',
  },
  overdueChipText: {
    color: '#FF7B7B',
    fontSize: 11,
    fontWeight: '700',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  checkCircleDone: {
    backgroundColor: '#4A8CFF',
    borderColor: '#4A8CFF',
  },
  navWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: 'center',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    gap: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  navLabel: {
    color: '#8EA2C3',
    fontSize: 12,
    fontWeight: '700',
  },
  navLabelActive: {
    color: palette.primary,
  },
});
