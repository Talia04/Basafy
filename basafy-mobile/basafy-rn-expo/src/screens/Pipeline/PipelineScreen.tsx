import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FloatingNav from '../../components/main/FloatingNav';
import { palette } from '../../theme/palette';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
};

type PipelineItem = {
  id: string;
  company: string;
  role: string;
  status: string;
  appliedLabel: string;
};

const pipelineColumns: Array<{
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  items: PipelineItem[];
}> = [
  {
    key: 'applied',
    title: 'Applied',
    icon: 'mail-outline',
    tone: '#8AA4FF',
    items: [
      { id: 'applied-1', company: 'Amazon', role: 'SDE Intern', status: 'Applied', appliedLabel: 'Applied 1 week ago' },
      { id: 'applied-2', company: 'Intuit', role: 'Data Science Intern', status: 'Applied', appliedLabel: 'Applied 3 days ago' },
    ],
  },
  {
    key: 'assessment',
    title: 'Assessment',
    icon: 'clipboard-outline',
    tone: '#5AEFD5',
    items: [
      { id: 'assessment-1', company: 'Meta', role: 'Online Assessment', status: 'Assessment', appliedLabel: 'Applied 1 week ago' },
      { id: 'assessment-2', company: 'Snowflake', role: 'SWE Intern', status: 'Assessment', appliedLabel: 'Applied 5 days ago' },
    ],
  },
  {
    key: 'interview',
    title: 'Interview',
    icon: 'chatbubbles-outline',
    tone: '#9CC6FF',
    items: [
      { id: 'interview-1', company: 'Stripe', role: 'Software Engineer Intern', status: 'Interview', appliedLabel: 'Applied 2 weeks ago' },
    ],
  },
  {
    key: 'offer',
    title: 'Offer',
    icon: 'ribbon-outline',
    tone: '#F7C873',
    items: [
      { id: 'offer-1', company: 'Notion', role: 'Product Engineer', status: 'Offer', appliedLabel: 'Applied 1 month ago' },
    ],
  },
  {
    key: 'rejected',
    title: 'Rejected',
    icon: 'close-circle-outline',
    tone: '#FF7B7B',
    items: [
      { id: 'rejected-1', company: 'Pinterest', role: 'Frontend Engineer', status: 'Rejected', appliedLabel: 'Applied 3 weeks ago' },
    ],
  },
];

export default function PipelineScreen({ activeTab = 'pipeline', onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  const totals = useMemo(() => {
    const total = pipelineColumns.reduce((sum, col) => sum + col.items.length, 0);
    const active = pipelineColumns
      .filter((col) => col.key !== 'rejected')
      .reduce((sum, col) => sum + col.items.length, 0);
    return { total, active };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Pipeline</Text>
          <Text style={styles.subtitle}>
            {totals.total} total • {totals.active} active
          </Text>
          <TouchableOpacity style={styles.newButton} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color={palette.text} />
            <Text style={styles.newButtonText}>New Application</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columnsRow}>
          {pipelineColumns.map((column) => (
            <View key={column.key} style={styles.columnCard}>
              <View style={styles.columnHeader}>
                <View style={styles.columnTitleRow}>
                  <View style={[styles.columnIcon, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                    <Ionicons name={column.icon} size={16} color={column.tone} />
                  </View>
                  <Text style={styles.columnTitle}>{column.title}</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{column.items.length}</Text>
                </View>
              </View>

              <View style={styles.cardList}>
                {column.items.map((item) => (
                  <View key={item.id} style={styles.applicationCard}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{item.company.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.companyText}>{item.company}</Text>
                      <Text style={styles.roleText}>{item.role}</Text>
                      <View style={styles.statusRow}>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillText}>{item.status}</Text>
                        </View>
                      </View>
                      <View style={styles.appliedRow}>
                        <Ionicons name="time-outline" size={12} color={palette.muted} />
                        <Text style={styles.appliedText}>{item.appliedLabel}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.addRow} activeOpacity={0.85}>
                <Ionicons name="add" size={16} color={palette.muted} />
                <Text style={styles.addRowText}>Add Application</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
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
    paddingBottom: 120,
    gap: 16,
  },
  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.muted,
  },
  newButton: {
    marginTop: 6,
    backgroundColor: '#4A8CFF',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  newButtonText: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 15,
  },
  columnsRow: {
    gap: 14,
    paddingRight: 18,
  },
  columnCard: {
    width: 260,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  columnTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  columnIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 16,
  },
  countBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 12,
  },
  cardList: {
    gap: 12,
  },
  applicationCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.text,
    fontWeight: '800',
  },
  companyText: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 15,
  },
  roleText: {
    color: palette.muted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statusPillText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  appliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  appliedText: {
    color: palette.muted,
    fontSize: 12,
  },
  addRow: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  addRowText: {
    color: palette.muted,
    fontWeight: '700',
  },
});
