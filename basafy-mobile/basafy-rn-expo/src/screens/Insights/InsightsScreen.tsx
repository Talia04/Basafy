import React, { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FloatingNav from '../../components/main/FloatingNav';
import { palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
};

const timeRanges = ['7D', '30D', '90D', 'All'];

type SummaryData = {
  total_applications: number;
  stage_applied: number;
  stage_assessment: number;
  stage_interview: number;
  stage_offer: number;
  stage_rejected: number;
  stage_archived: number;
  response_rate: number | null;
  avg_response_days: number | null;
  open_tasks: number;
  stalled_count: number;
};

export default function InsightsScreen({ activeTab = 'insights', onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState('30D');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rangeParams = useMemo(() => {
    const endAt = new Date();
    if (range === 'All') {
      return { startAt: null as string | null, endAt: endAt.toISOString() };
    }
    const days = range === '7D' ? 7 : range === '90D' ? 90 : 30;
    const startAt = new Date(endAt.getTime() - days * 24 * 60 * 60 * 1000);
    return { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
  }, [range]);

  useEffect(() => {
    let mounted = true;
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .rpc('get_insights_summary', {
          p_start_at: rangeParams.startAt,
          p_end_at: rangeParams.endAt,
        })
        .single();
      if (!mounted) return;
      if (fetchError) {
        setError(fetchError.message);
        setSummary(null);
      } else {
        setSummary(data as SummaryData);
      }
      setLoading(false);
    };
    fetchSummary();
    return () => {
      mounted = false;
    };
  }, [rangeParams]);

  const overviewStats = [
    {
      label: 'Response rate',
      value:
        summary && summary.total_applications > 0
          ? `${Math.round((summary.response_rate ?? 0) * 100)}%`
          : '--',
      icon: 'swap-horizontal-outline',
    },
    {
      label: 'Interview conversion',
      value:
        summary && summary.total_applications > 0
          ? `${Math.round((summary.stage_interview / Math.max(1, summary.total_applications)) * 100)}%`
          : '--',
      icon: 'trending-up-outline',
    },
    {
      label: 'Avg response time',
      value: summary?.avg_response_days != null ? `${summary.avg_response_days.toFixed(1)}d` : '--',
      icon: 'timer-outline',
    },
    {
      label: 'Open tasks',
      value: summary ? `${summary.open_tasks}` : '--',
      icon: 'checkbox-outline',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Insights</Text>
              <Text style={styles.subtitle}>Your job search story, at a glance.</Text>
            </View>
            <Ionicons name="sparkles" size={20} color="#5AEFD5" />
          </View>
          <View style={styles.rangeRow}>
            {timeRanges.map((item) => {
              const active = item === range;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.rangePill, active && styles.rangePillActive]}
                  activeOpacity={0.85}
                  onPress={() => setRange(item)}
                >
                  <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Overview</Text>
          {loading ? (
            <View style={styles.overviewGrid}>
              {Array.from({ length: 4 }).map((_, index) => (
                <View key={`skeleton-${index}`} style={styles.overviewCard}>
                  <View style={[styles.skeletonLine, { width: '45%' }]} />
                  <View style={[styles.skeletonLine, { width: '60%' }]} />
                </View>
              ))}
            </View>
          ) : summary && summary.total_applications === 0 ? (
            <Text style={styles.emptyText}>
              Connect Gmail or add applications to unlock insights.
            </Text>
          ) : (
            <View style={styles.overviewGrid}>
              {overviewStats.map((stat) => (
                <View key={stat.label} style={styles.overviewCard}>
                  <View style={styles.overviewIcon}>
                    <Ionicons name={stat.icon as any} size={16} color="#9CC6FF" />
                  </View>
                  <Text style={styles.overviewLabel}>{stat.label}</Text>
                  <Text style={styles.overviewValue}>{stat.value}</Text>
                </View>
              ))}
            </View>
          )}
          {error ? <Text style={styles.errorText}>Couldn&apos;t load insights. Try again.</Text> : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pipeline Flow</Text>
            <Text style={styles.sectionHint}>Sankey coming next</Text>
          </View>
          <View style={styles.sankeyPlaceholder}>
            <LinearGradient colors={['rgba(74,140,255,0.2)', 'rgba(15,22,40,0.6)']} style={styles.sankeyGlow} />
            <Ionicons name="git-compare-outline" size={32} color="#8EA2C3" />
            <Text style={styles.sankeyText}>Stage flows will appear here.</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Source effectiveness</Text>
          <Text style={styles.sectionBody}>Compare Gmail vs manual once data is ready.</Text>
          <View style={styles.placeholderBars}>
            <View style={[styles.bar, { width: '68%' }]} />
            <View style={[styles.bar, { width: '52%' }]} />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Stalled and ghosted</Text>
          <Text style={styles.sectionBody}>We will flag stalled applications here.</Text>
          <View style={styles.stalledRow}>
            <View style={styles.stalledIcon}>
              <Ionicons name="alert-circle-outline" size={18} color="#FF7B7B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stalledTitle}>No stalled apps yet</Text>
              <Text style={styles.stalledSubtitle}>Keep the momentum going.</Text>
            </View>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85}>
              <Text style={styles.secondaryButtonText}>Review</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          <View style={styles.recoCard}>
            <Ionicons name="bulb-outline" size={18} color="#F7C873" />
            <Text style={styles.recoText}>Actionable guidance will appear here as your data grows.</Text>
            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Learn more</Text>
            </TouchableOpacity>
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
    paddingBottom: 120,
    gap: 16,
  },
  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.muted,
    marginTop: 4,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rangePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rangePillActive: {
    backgroundColor: 'rgba(74,140,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(74,140,255,0.4)',
  },
  rangeText: {
    color: '#B9C7DD',
    fontWeight: '700',
  },
  rangeTextActive: {
    color: '#E4EDFF',
  },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHint: {
    color: palette.muted,
    fontSize: 12,
  },
  sectionBody: {
    color: palette.muted,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overviewCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  overviewIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: 'rgba(74,140,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewLabel: {
    color: '#B9C7DD',
    fontSize: 12,
    fontWeight: '600',
  },
  overviewValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  emptyText: {
    color: palette.muted,
  },
  errorText: {
    color: '#FF7B7B',
    fontSize: 12,
  },
  sankeyPlaceholder: {
    minHeight: 140,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(12,18,35,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  sankeyGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  sankeyText: {
    color: palette.muted,
    textAlign: 'center',
  },
  placeholderBars: {
    gap: 10,
  },
  bar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(74,140,255,0.3)',
  },
  stalledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stalledIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,123,123,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stalledTitle: {
    color: palette.text,
    fontWeight: '700',
  },
  stalledSubtitle: {
    color: palette.muted,
    fontSize: 12,
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  secondaryButtonText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  recoCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  recoText: {
    color: palette.muted,
    fontSize: 13,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#4A8CFF',
  },
  primaryButtonText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
});
