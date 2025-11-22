import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';

const { width } = Dimensions.get('window');

const STORAGE_KEY = 'basafy:onboarding-completed';

const palette = {
  background: '#0A0E1A',
  card: '#111827',
  text: '#F4F6FA',
  muted: '#A3B0C0',
  primary: '#4A8CFF',
  success: '#5AEFD5',
  accentPink: '#F38FA9',
};

type Slide = {
  id: string;
  title: string;
  description: string;
  colors: [string, string];
  accent: string;
  badge: string;
  iconName: keyof typeof Ionicons.glyphMap;
};

const slides: readonly Slide[] = [
  {
    id: 'pipeline',
    title: 'Pipeline clarity',
    description: 'Organize every application with a friendly Kanban pipeline.',
    colors: ['#0C3C41', '#0A272C'] as [string, string],
    accent: palette.success,
    badge: 'Stay organized',
    iconName: 'grid-outline',
  },
  {
    id: 'journey',
    title: 'Work your next move',
    description: 'Track your job search journey and stay ahead with clear goals.',
    colors: ['#122C5D', '#0F2145'] as [string, string],
    accent: palette.primary,
    badge: 'Job-ready',
    iconName: 'rocket-outline',
  },
  {
    id: 'ready',
    title: 'Ready when you are',
    description: 'Get started and keep your next move just one tap away.',
    colors: ['#132A5A', '#0D1E3A'] as [string, string],
    accent: palette.primary,
    badge: 'Always on deck',
    iconName: 'sparkles-outline',
  },
  {
    id: 'insights',
    title: 'Insights that guide you',
    description: 'See your progress, response times, and wins at a glance.',
    colors: ['#4A2B35', '#27151D'] as [string, string],
    accent: palette.accentPink,
    badge: 'Data-driven',
    iconName: 'trending-up-outline',
  },
];

type Props = {
  onComplete?: () => void;
};

export default function OnboardingFlow({ onComplete }: Props) {
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      const hasSeen = await AsyncStorage.getItem(STORAGE_KEY);
      setShowOnboarding(hasSeen !== 'true');
      setLoading(false);
    };

    checkOnboarding();
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setShowOnboarding(false);
    onComplete?.();
  }, [onComplete]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 60 });

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < slides.length) {
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    );
  }

  if (!showOnboarding) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.mainCard}>
          <Text style={styles.badge}>Basafy</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Your onboarding is complete. Navigation and screens coming up soon.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SlideCard slide={item} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToAlignment="center"
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfigRef.current}
      />

      <Pagination total={slides.length} index={currentIndex} colors={slides.map((s) => s.accent)} />

      <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
        <Text style={styles.primaryButtonText}>
          {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

type PaginationProps = {
  total: number;
  index: number;
  colors: string[];
};

const Pagination = React.memo(({ total, index, colors }: PaginationProps) => {
  return (
    <View style={styles.pagination}>
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === index;
        return (
          <View
            key={String(i)}
            style={[
              styles.dot,
              {
                backgroundColor: isActive ? colors[i] : '#1D2433',
                width: isActive ? 40 : 12,
              },
            ]}
            accessibilityLabel={isActive ? 'Active slide indicator' : 'Inactive slide indicator'}
          />
        );
      })}
    </View>
  );
});

type SlideCardProps = {
  slide: Slide;
};

const SlideCard = React.memo(({ slide }: SlideCardProps) => {
  return (
    <View style={styles.slideWrapper}>
      <LinearGradient colors={slide.colors} style={styles.card}>
        <View
          style={[styles.iconCircle, { backgroundColor: `${slide.accent}33` }]}
          accessible={true}
          accessibilityLabel={`Onboarding icon for ${slide.title}`}
        >
          <Ionicons name={slide.iconName} size={28} color={slide.accent} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.description}</Text>
        <View style={[styles.badgePill, { backgroundColor: `${slide.accent}22` }]}>
          <Text style={[styles.badgePillText, { color: slide.accent }]}>{slide.badge}</Text>
        </View>
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  clock: {
    color: palette.text,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  skip: {
    color: palette.primary,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 6,
  },
  slideWrapper: {
    width,
    paddingHorizontal: 12,
  },
  card: {
    flex: 1,
    height: 520,
    borderRadius: 28,
    padding: 28,
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74, 140, 255, 0.16)',
    color: palette.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontWeight: '700',
  },
  badgePill: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  badgePillText: {
    fontWeight: '700',
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 14,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 20,
  },
  dot: {
    height: 12,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: palette.primary,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  mainCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: palette.card,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignSelf: 'center',
    marginTop: 80,
  },
});
