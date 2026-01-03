import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FloatingNav from '../../components/main/FloatingNav';
import { palette } from '../../theme/palette';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
};

const timeRanges = ['7D', '30D', '90D', 'All'];

export default function InsightsScreen({ activeTab = 'insights', onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState('30D');

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
          <View style={styles.overviewGrid}>
            {[
              { label: 'Response rate', value: '--', icon: 'swap-horizontal-outline' },
              { label: 'Interview conversion', value: '--', icon: 'trending-up-outline' },
              { label: 'Avg response time', value: '--', icon: 'timer-outline' },
              { label: 'Open tasks', value: '--', icon: 'checkbox-outline' },
            ].map((stat) => (
              <View key={stat.label} style={styles.overviewCard}>
                <View style={styles.overviewIcon}>
                  <Ionicons name={stat.icon as any} size={16} color="#9CC6FF" />
                </View>
                <Text style={styles.overviewLabel}>{stat.label}</Text>
                <Text style={styles.overviewValue}>{stat.value}</Text>
              </View>
            ))}
          </View>
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
