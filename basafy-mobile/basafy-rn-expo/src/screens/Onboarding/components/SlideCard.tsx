import React, { useEffect, useMemo, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Easing, Text, View } from 'react-native';
import { Slide } from '../../../types/onboarding';
import { createOnboardingStyles } from '../styles';
import { useTheme } from '../../../theme/palette';

type SlideCardProps = {
  slide: Slide;
  isActive?: boolean;
};

function PreviewBackdrop({
  children,
  accent,
  pulse,
}: {
  children: React.ReactNode;
  accent: string;
  pulse: Animated.Value;
}) {
  const { palette } = useTheme();
  const styles = createOnboardingStyles(palette);
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.65],
  });
  const orbShift = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });
  const highlightOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.5],
  });

  return (
    <View style={styles.previewShell}>
      <View style={styles.previewGlassTop} />
      <View style={styles.previewGlassBottom} />
      <Animated.View style={[styles.previewGlow, { backgroundColor: accent, opacity: glowOpacity }]} />
      <Animated.View
        style={[
          styles.previewOrbLeft,
          {
            backgroundColor: `${accent}33`,
            transform: [{ translateY: orbShift }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.previewOrbRight,
          {
            backgroundColor: `${accent}1F`,
            transform: [{ translateX: orbShift }],
          },
        ]}
      />
      <Animated.View style={[styles.liquidHighlight, { opacity: highlightOpacity }]} />
      <View style={styles.previewStroke} />
      {children}
    </View>
  );
}

function SyncPreview({
  accent,
  progress,
  pulse,
}: {
  accent: string;
  progress: Animated.Value;
  pulse: Animated.Value;
}) {
  const { palette } = useTheme();
  const styles = createOnboardingStyles(palette);
  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['18%', '92%'],
  });
  const badgeScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <PreviewBackdrop accent={accent} pulse={pulse}>
      <View style={styles.syncHeader}>
        <Animated.View style={[styles.syncBadge, { transform: [{ scale: badgeScale }] }]}>
          <Ionicons name="sparkles" size={13} color={accent} />
          <Text style={styles.syncBadgeText}>Gmail import running</Text>
        </Animated.View>
        <Text style={styles.syncCounter}>3 months</Text>
      </View>

      <View style={styles.inboxCard}>
        {[
          { sender: 'Careers', icon: 'mail', color: '#67E8F9' },
          { sender: 'Greenhouse', icon: 'flash', color: '#5AEFD5' },
          { sender: 'Recruiting', icon: 'notifications', color: '#FDE68A' },
        ].map((item, index) => {
          const rowOpacity = progress.interpolate({
            inputRange: [0, 0.25 + index * 0.18, 0.45 + index * 0.18, 1],
            outputRange: [0.35, 0.55, 1, 0.82],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View key={item.sender} style={[styles.inboxRow, { opacity: rowOpacity }]}>
              <View style={[styles.avatarDot, { backgroundColor: `${item.color}22` }]}>
                <Ionicons name={item.icon as any} size={16} color={item.color} />
              </View>
              <View style={styles.inboxMeta}>
                <View style={[styles.inboxLine, { width: index === 1 ? '68%' : '56%' }]} />
                <View style={[styles.inboxLine, { width: index === 2 ? '82%' : '72%', opacity: 0.72 }]} />
              </View>
              <Text style={styles.syncCounter}>{index + 1}m</Text>
            </Animated.View>
          );
        })}

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width, backgroundColor: accent }]} />
        </View>
      </View>

      <View style={styles.syncFooter}>
        <View>
          <Text style={styles.syncFooterText}>Import continues in background</Text>
          <Text style={styles.syncFooterSubtext}>We&apos;ll notify you when review is ready.</Text>
        </View>
        <Ionicons name="cloud-done" size={20} color={accent} />
      </View>
    </PreviewBackdrop>
  );
}

function ApplicationsPreview({
  accent,
  progress,
  pulse,
}: {
  accent: string;
  progress: Animated.Value;
  pulse: Animated.Value;
}) {
  const { palette } = useTheme();
  const styles = createOnboardingStyles(palette);

  const cards = [
    { company: 'Figma', role: 'Product Designer', status: 'Applied', statusColor: '#67E8F9' },
    { company: 'Notion', role: 'Design Systems', status: 'Interview', statusColor: '#5AEFD5' },
    { company: 'MSX International', role: 'Role needs review', status: 'Needs review', statusColor: '#FDE68A' },
  ];

  return (
    <PreviewBackdrop accent={accent} pulse={pulse}>
      <View style={styles.applicationsHeader}>
        <Text style={styles.applicationsHeaderTitle}>Applications</Text>
        <View style={styles.applicationsPill}>
          <Text style={styles.applicationsPillText}>Live import</Text>
        </View>
      </View>

      <View style={styles.appList}>
        {cards.map((card, index) => {
          const cardOpacity = progress.interpolate({
            inputRange: [0, 0.18 + index * 0.17, 0.34 + index * 0.17, 1],
            outputRange: [0.15, 0.18, 1, 1],
            extrapolate: 'clamp',
          });
          const translateY = progress.interpolate({
            inputRange: [0, 0.2 + index * 0.17, 0.42 + index * 0.17, 1],
            outputRange: [28, 22, 0, 0],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View key={card.company} style={[styles.appCard, { opacity: cardOpacity, transform: [{ translateY }] }]}>
              <View style={styles.appCardRow}>
                <Text style={styles.appTitle}>{card.company}</Text>
                <View style={[styles.statusChip, { backgroundColor: `${card.statusColor}22` }]}>
                  <Text style={[styles.statusChipText, { color: card.statusColor }]}>{card.status}</Text>
                </View>
              </View>
              <Text style={styles.appMeta}>{card.role}</Text>
              <View style={styles.miniChipRow}>
                <View style={styles.miniChip}>
                  <Text style={styles.miniChipText}>Gmail</Text>
                </View>
                {index === 2 && (
                  <View style={[styles.miniChip, { backgroundColor: 'rgba(253,230,138,0.18)' }]}>
                    <Text style={[styles.miniChipText, { color: '#FDE68A' }]}>Edit if needed</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          );
        })}
      </View>
    </PreviewBackdrop>
  );
}

function PipelinePreview({
  accent,
  progress,
  pulse,
}: {
  accent: string;
  progress: Animated.Value;
  pulse: Animated.Value;
}) {
  const { palette } = useTheme();
  const styles = createOnboardingStyles(palette);

  const appliedOpacity = progress.interpolate({
    inputRange: [0, 0.35, 0.45, 1],
    outputRange: [1, 1, 0.15, 0.1],
    extrapolate: 'clamp',
  });
  const appliedY = progress.interpolate({
    inputRange: [0, 0.35, 0.6, 1],
    outputRange: [0, 0, -8, -14],
    extrapolate: 'clamp',
  });
  const interviewOpacity = progress.interpolate({
    inputRange: [0, 0.34, 0.5, 1],
    outputRange: [0.18, 0.2, 1, 1],
    extrapolate: 'clamp',
  });
  const interviewY = progress.interpolate({
    inputRange: [0, 0.34, 0.55, 1],
    outputRange: [20, 18, 0, 0],
    extrapolate: 'clamp',
  });
  const boardScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.015],
  });

  return (
    <PreviewBackdrop accent={accent} pulse={pulse}>
      <View style={styles.pipelineHeader}>
        <Text style={styles.pipelineTitle}>Auto-sorted board</Text>
        <Ionicons name="layers" size={18} color={accent} />
      </View>

      <Animated.View style={[styles.board, { transform: [{ scale: boardScale }] }]}>
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Applied</Text>
          <Animated.View style={[styles.pipelineCard, { opacity: appliedOpacity, transform: [{ translateY: appliedY }] }]}>
            <Text style={styles.pipelineCardTitle}>Notion</Text>
            <Text style={styles.pipelineCardMeta}>Design Systems</Text>
          </Animated.View>
          <View style={styles.pipelineCard}>
            <Text style={styles.pipelineCardTitle}>Linear</Text>
            <Text style={styles.pipelineCardMeta}>Product Designer</Text>
          </View>
        </View>

        <View style={styles.column}>
          <Text style={styles.columnLabel}>Interview</Text>
          <Animated.View style={[styles.pipelineCard, { opacity: interviewOpacity, transform: [{ translateY: interviewY }] }]}>
            <Text style={styles.pipelineCardTitle}>Notion</Text>
            <Text style={styles.pipelineCardMeta}>Moved from Applied</Text>
          </Animated.View>
          <View style={styles.pipelineCard}>
            <Text style={styles.pipelineCardTitle}>Figma</Text>
            <Text style={styles.pipelineCardMeta}>Recruiter screen</Text>
          </View>
        </View>

        <View style={styles.column}>
          <Text style={styles.columnLabel}>Offer</Text>
          <View style={styles.pipelineCard}>
            <Text style={styles.pipelineCardTitle}>Arc</Text>
            <Text style={styles.pipelineCardMeta}>Final round</Text>
          </View>
        </View>
      </Animated.View>
    </PreviewBackdrop>
  );
}

function InsightsPreview({
  accent,
  progress,
  pulse,
}: {
  accent: string;
  progress: Animated.Value;
  pulse: Animated.Value;
}) {
  const { palette } = useTheme();
  const styles = createOnboardingStyles(palette);
  const barHeights = useMemo(() => [38, 56, 42, 70, 62], []);
  const numberLift = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  return (
    <PreviewBackdrop accent={accent} pulse={pulse}>
      <View style={styles.insightsHeader}>
        <Text style={styles.insightsTitle}>Search insights</Text>
        <Text style={styles.insightsSubtle}>Updated live</Text>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Response rate</Text>
          <Animated.Text style={[styles.statValue, { transform: [{ translateY: numberLift }] }]}>34%</Animated.Text>
          <Text style={[styles.statTrend, { color: '#5AEFD5' }]}>+8% this week</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Interviews</Text>
          <Animated.Text style={[styles.statValue, { transform: [{ translateY: numberLift }] }]}>7</Animated.Text>
          <Text style={[styles.statTrend, { color: '#9CC6FF' }]}>2 pending replies</Text>
        </View>
      </View>

      <View style={styles.chartShell}>
        <View style={styles.chartBars}>
          {barHeights.map((baseHeight, index) => {
            const animatedHeight = progress.interpolate({
              inputRange: [0, 0.2 + index * 0.08, 1],
              outputRange: [12, baseHeight, baseHeight + 6],
              extrapolate: 'clamp',
            });
            return (
              <View key={index} style={styles.chartBarTrack}>
                <Animated.View
                  style={[
                    styles.chartBarFill,
                    {
                      backgroundColor: index === 3 ? accent : index % 2 === 0 ? '#67E8F9' : '#A78BFA',
                      height: animatedHeight,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.insightCallout}>
          <Text style={styles.insightCalloutTitle}>Next best move</Text>
          <Text style={styles.insightCalloutBody}>
            Follow up on 3 stalled applications and review 1 new import with missing role details.
          </Text>
        </View>
      </View>
    </PreviewBackdrop>
  );
}

function ProductPreview({
  slide,
  progress,
  pulse,
}: {
  slide: Slide;
  progress: Animated.Value;
  pulse: Animated.Value;
}) {
  switch (slide.id) {
    case 'sync':
      return <SyncPreview accent={slide.accent} progress={progress} pulse={pulse} />;
    case 'applications':
      return <ApplicationsPreview accent={slide.accent} progress={progress} pulse={pulse} />;
    case 'pipeline':
      return <PipelinePreview accent={slide.accent} progress={progress} pulse={pulse} />;
    case 'insights':
      return <InsightsPreview accent={slide.accent} progress={progress} pulse={pulse} />;
    default:
      return null;
  }
}

const SlideCard = ({ slide, isActive = false }: SlideCardProps) => {
  const { palette } = useTheme();
  const styles = createOnboardingStyles(palette);
  const opacity = useRef(new Animated.Value(isActive ? 1 : 0.6)).current;
  const translateY = useRef(new Animated.Value(isActive ? 0 : 16)).current;
  const iconScale = useRef(new Animated.Value(isActive ? 1 : 0.92)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: isActive ? 1 : 0.6,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: isActive ? 0 : 16,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: isActive ? 1 : 0.92,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isActive, opacity, translateY, iconScale]);

  useEffect(() => {
    const progressLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );

    if (isActive) {
      progressLoop.start();
      pulseLoop.start();
    } else {
      progress.stopAnimation();
      pulse.stopAnimation();
      progress.setValue(0.12);
      pulse.setValue(0);
    }

    return () => {
      progressLoop.stop();
      pulseLoop.stop();
    };
  }, [isActive, progress, pulse]);

  return (
    <Animated.View style={[styles.slideWrapper, { opacity, transform: [{ translateY }] }]}>
      <LinearGradient colors={slide.colors} style={styles.card}>
        <View style={styles.cardSheen} />
        <View style={styles.cardGlow} />
        <ProductPreview slide={slide} progress={progress} pulse={pulse} />
        <Animated.View
          style={[
            styles.iconCircle,
            { backgroundColor: `${slide.accent}33`, transform: [{ scale: iconScale }] },
          ]}
          accessible
          accessibilityLabel={`Onboarding icon for ${slide.title}`}
        >
          <Ionicons name={slide.iconName} size={22} color={slide.accent} />
        </Animated.View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.description}</Text>
        <View style={[styles.badgePill, { backgroundColor: `${slide.accent}22` }]}>
          <Text style={[styles.badgePillText, { color: slide.accent }]}>{slide.badge}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

export default React.memo(SlideCard);
