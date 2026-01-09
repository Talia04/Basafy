import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FloatingNav from '../../components/main/FloatingNav';
import { palette } from '../../theme/palette';
import { supabase } from '@backend/supabase/client';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';

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

type SankeyNode = { id: string; count: number };
type SankeyLink = { source: string; target: string; count: number };
type SankeyData = { nodes: SankeyNode[]; links: SankeyLink[] };

export default function InsightsScreen({ activeTab = 'insights', onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [range, setRange] = useState('30D');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [sankey, setSankey] = useState<SankeyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const rangeParams = useMemo(() => {
    const endAt = new Date();
    if (range === 'All') {
      return { startAt: null as string | null, endAt: null as string | null };
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
      const [summaryResponse, sankeyResponse] = await Promise.all([
        supabase
          .rpc('get_insights_summary', {
            p_start_at: rangeParams.startAt,
            p_end_at: rangeParams.endAt,
          })
          .single(),
        supabase.rpc('get_insights_sankey', {
          p_start_at: rangeParams.startAt,
          p_end_at: rangeParams.endAt,
        }),
      ]);
      if (!mounted) return;
      if (summaryResponse.error) {
        setError(summaryResponse.error.message);
        setSummary(null);
      } else {
        setSummary(summaryResponse.data as SummaryData);
      }
      if (sankeyResponse.error) {
        setSankey(null);
      } else {
        setSankey(sankeyResponse.data as SankeyData);
      }
      setSelectedNode(null);
      setLoading(false);
    };
    fetchSummary();
    return () => {
      mounted = false;
    };
  }, [rangeParams]);

  useEffect(() => {
    if (!loading) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim]);

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
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim }}
      >
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
            {selectedNode ? (
              <Text style={styles.sectionHint}>{formatNodeLabel(selectedNode)}</Text>
            ) : (
              <Text style={styles.sectionHint}>Tap a node</Text>
            )}
          </View>
          {loading ? (
            <View style={styles.sankeyPlaceholder}>
              <LinearGradient colors={['rgba(74,140,255,0.2)', 'rgba(15,22,40,0.6)']} style={styles.sankeyGlow} />
              <Text style={styles.sankeyText}>Loading flows…</Text>
            </View>
          ) : sankey && hasSankeyData(sankey) ? (
            <SankeyChart
              data={sankey}
              total={summary?.total_applications ?? 0}
              selectedNode={selectedNode}
              onSelectNode={(nodeId) => setSelectedNode((prev) => (prev === nodeId ? null : nodeId))}
            />
          ) : (
            <View style={styles.sankeyPlaceholder}>
              <LinearGradient colors={['rgba(74,140,255,0.2)', 'rgba(15,22,40,0.6)']} style={styles.sankeyGlow} />
              <Ionicons name="git-compare-outline" size={32} color="#8EA2C3" />
              <Text style={styles.sankeyText}>No pipeline data yet.</Text>
              <Text style={styles.sankeySubtext}>Connect Gmail or add applications to unlock insights.</Text>
              <SampleSankey />
            </View>
          )}
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
      </Animated.ScrollView>
      <FloatingNav activeTab={activeTab} onNavigate={onNavigate} bottomInset={insets.bottom} />
    </SafeAreaView>
  );
}

const SampleSankey = () => (
  <View style={styles.sampleWrap}>
    <Svg width={260} height={120}>
      <Rect x={6} y={20} width={18} height={80} rx={6} fill="rgba(148,163,184,0.7)" />
      <Rect x={120} y={10} width={18} height={40} rx={6} fill="rgba(74,140,255,0.7)" />
      <Rect x={120} y={70} width={18} height={30} rx={6} fill="rgba(255,123,123,0.7)" />
      <Rect x={220} y={40} width={18} height={24} rx={6} fill="rgba(247,200,115,0.8)" />
      <Path d="M24,60 C70,20 90,20 120,30" stroke="rgba(74,140,255,0.4)" strokeWidth={10} fill="none" />
      <Path d="M24,70 C70,90 90,90 120,85" stroke="rgba(255,123,123,0.4)" strokeWidth={8} fill="none" />
      <Path d="M138,30 C170,35 190,40 220,52" stroke="rgba(247,200,115,0.45)" strokeWidth={6} fill="none" />
    </Svg>
  </View>
);

const stageOrder = ['applied', 'assessment', 'interview', 'offer', 'rejected', 'archived'];
const stageColors: Record<string, string> = {
  applied: 'rgba(148,163,184,0.7)',
  assessment: 'rgba(90,239,213,0.75)',
  interview: 'rgba(74,140,255,0.85)',
  offer: 'rgba(247,200,115,0.85)',
  rejected: 'rgba(255,123,123,0.8)',
  archived: 'rgba(148,163,184,0.5)',
};

const formatNodeLabel = (stage: string) =>
  stage
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const hasSankeyData = (data: SankeyData) =>
  data.nodes.some((node) => node.count > 0) || data.links.some((link) => link.count > 0);

const SankeyChart = ({
  data,
  total,
  selectedNode,
  onSelectNode,
}: {
  data: SankeyData;
  total: number;
  selectedNode: string | null;
  onSelectNode: (nodeId: string) => void;
}) => {
  const [width, setWidth] = useState(0);
  const height = 280;
  const padding = 24;
  const nodeWidth = 96;

  const nodesById = useMemo(() => {
    const map = new Map<string, SankeyNode>();
    data.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [data.nodes]);

  const minHeight = 24;
  const appliedCount = nodesById.get('applied')?.count ?? total;
  const appliedHeight = Math.max(minHeight, height - padding * 2);

  const svgWidth = Math.max(width, 860);
  const columnGap = (svgWidth - padding * 2 - nodeWidth) / (stageOrder.length - 1);

  const stageYRatio: Record<string, number> = {
    applied: 0.5,
    assessment: 0.25,
    interview: 0.55,
    offer: 0.55,
    rejected: 0.18,
    archived: 0.82,
  };

  const nodeList = stageOrder.map((stage, index) => {
    const count = stage === 'applied' ? appliedCount : nodesById.get(stage)?.count ?? 0;
    const heightValue =
      stage === 'applied' || appliedCount === 0
        ? appliedHeight
        : Math.max(minHeight, (count / appliedCount) * appliedHeight);
    const ratio = stageYRatio[stage] ?? 0.5;
    const y =
      stage === 'applied'
        ? padding
        : Math.max(
            padding,
            Math.min(height - heightValue - padding, padding + ratio * (height - heightValue - padding * 2))
          );
    return {
      id: stage,
      x: padding + index * columnGap,
      y,
      width: nodeWidth,
      height: heightValue,
      count,
    };
  });

  const nodeById = new Map(nodeList.map((node) => [node.id, node]));
  const links = data.links
    .filter((link) => link.count > 0)
    .map((link) => {
      const sourceNode = nodeById.get(link.source);
      const targetNode = nodeById.get(link.target);
      if (!sourceNode || !targetNode) return null;
      const strokeWidth =
        appliedCount === 0 ? 4 : 4 + (link.count / appliedCount) * 12;
      const sourceX = sourceNode.x + sourceNode.width;
      const sourceY = sourceNode.y + sourceNode.height / 2;
      const targetX = targetNode.x;
      const targetY = targetNode.y + targetNode.height / 2;
      const controlX = (sourceX + targetX) / 2;
      return {
        path: `M${sourceX},${sourceY} C${controlX},${sourceY} ${controlX},${targetY} ${targetX},${targetY}`,
        color: stageColors[link.target] ?? 'rgba(148,163,184,0.6)',
        width: strokeWidth,
      };
    })
    .filter(Boolean) as Array<{ path: string; color: string; width: number }>;

  const selectedSummary = selectedNode
    ? nodeList.find((node) => node.id === selectedNode)
    : null;
  const selectedText = selectedSummary
    ? `${formatNodeLabel(selectedSummary.id)}: ${selectedSummary.count} apps (${total > 0 ? Math.round((selectedSummary.count / total) * 100) : 0}%)`
    : null;

  return (
    <View style={styles.sankeyWrap} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {selectedText ? <Text style={styles.sankeyTooltip}>{selectedText}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sankeyContent}>
        {width > 0 ? (
          <Svg width={svgWidth} height={height}>
            {links.map((link, index) => (
              <Path
                key={`link-${index}`}
                d={link.path}
                stroke={link.color}
                strokeWidth={link.width}
                fill="none"
                strokeLinecap="round"
                opacity={selectedNode ? 0.35 : 0.7}
              />
            ))}
            {nodeList.map((node) => (
              <React.Fragment key={node.id}>
                <Rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={12}
                  fill={stageColors[node.id] ?? 'rgba(148,163,184,0.6)'}
                  opacity={selectedNode && selectedNode !== node.id ? 0.4 : 1}
                  onPress={() => onSelectNode(node.id)}
                />
                <LabelPill
                  node={node}
                  svgWidth={svgWidth}
                  text={`${node.id === 'applied' ? 'Applications' : formatNodeLabel(node.id)} · ${node.count}`}
                />
              </React.Fragment>
            ))}
          </Svg>
        ) : null}
      </ScrollView>
    </View>
  );
};

const LabelPill = ({
  node,
  svgWidth,
  text,
}: {
  node: { x: number; y: number; width: number; height: number };
  svgWidth: number;
  text: string;
}) => {
  const padding = 10;
  const approxChar = 6.2;
  const labelWidth = Math.min(150, Math.max(70, Math.round(text.length * approxChar)));
  const isLeft = node.x + node.width / 2 < svgWidth / 2;
  const x = isLeft
    ? Math.max(8, node.x - labelWidth - padding)
    : Math.min(svgWidth - labelWidth - 8, node.x + node.width + padding);
  const y = node.y + node.height / 2 - 10;
  return (
    <>
      <Rect x={x} y={y} width={labelWidth} height={20} rx={10} fill="rgba(15,22,40,0.85)" />
      <SvgText
        x={x + labelWidth / 2}
        y={y + 14}
        fontSize={10}
        fontWeight="600"
        fill="#E4EDFF"
        textAnchor="middle"
      >
        {text}
      </SvgText>
    </>
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
    gap: 18,
  },
  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 26,
    padding: 20,
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
    fontSize: 25,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.muted,
    marginTop: 6,
    fontSize: 13,
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
    padding: 20,
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
    fontSize: 17,
    fontWeight: '700',
  },
  sectionHint: {
    color: palette.muted,
    fontSize: 12,
  },
  sectionBody: {
    color: palette.muted,
    fontSize: 13,
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
    padding: 16,
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
    fontSize: 19,
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
  sankeySubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textAlign: 'center',
  },
  sampleWrap: {
    marginTop: 10,
  },
  sankeyWrap: {
    gap: 10,
  },
  sankeyContent: {
    paddingBottom: 4,
  },
  sankeyTooltip: {
    color: '#E4EDFF',
    fontSize: 12,
    fontWeight: '700',
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
