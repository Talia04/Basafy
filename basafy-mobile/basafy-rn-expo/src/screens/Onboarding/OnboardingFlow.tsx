import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View, ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Pagination from './components/Pagination';
import SlideCard from './components/SlideCard';
import { createSlides } from './slides';
import { createOnboardingStyles } from './styles';
import { useTheme } from '../../theme/palette';
import { OnboardingProps, Slide } from '../../types/onboarding';

type InternalProps = OnboardingProps & {
  /**
   * When false, the component will immediately fire onComplete and render nothing
   * after onboarding is completed. Useful when parent wants to control the post-onboarding UI.
   */
  renderCompletedFallback?: boolean;
};

const STORAGE_KEY = 'basafy:onboarding-completed';
const SLIDE_WIDTH = Dimensions.get('window').width - 36;

export default function OnboardingFlow({ onComplete, onSignIn, renderCompletedFallback = true }: InternalProps) {
  const { palette } = useTheme();
  const styles = createOnboardingStyles(palette);
  const slides = createSlides(palette);
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

  useEffect(() => {
    if (!loading && !showOnboarding && !renderCompletedFallback) {
      onComplete?.();
    }
  }, [loading, showOnboarding, renderCompletedFallback, onComplete]);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setShowOnboarding(false);
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

  const handleSignIn = () => {
    AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => null);
    onSignIn?.();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#0A0E1A', '#121B34', '#0A0E1A']}
          style={StyleSheet.absoluteFillObject}
        />
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    );
  }

  if (!showOnboarding) {
    if (!renderCompletedFallback) {
      return null;
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#0A0E1A', '#121B34', '#0A0E1A']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.mainCard}>
          <Text style={styles.badge}>Basafy</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Your onboarding is complete. Hook up your navigation and screens here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0A0E1A', '#121B34', '#0A0E1A']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>Basafy</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleSignIn} style={styles.headerAction}>
            <Text style={styles.headerActionText}>Sign in</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.brandTitle}>Your job search simplified</Text>
          <Text style={styles.headerSubtitle}>Import, organize, track, and review everything in one place.</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <SlideCard slide={item} isActive={index === currentIndex} />
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToAlignment="center"
        snapToInterval={SLIDE_WIDTH}
        disableIntervalMomentum
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfigRef.current}
        getItemLayout={(_, index) => ({
          length: SLIDE_WIDTH,
          offset: SLIDE_WIDTH * index,
          index,
        })}
      />

      <Pagination total={slides.length} index={currentIndex} colors={slides.map((s) => s.accent)} />

      <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
        <Text style={styles.primaryButtonText}>
          {currentIndex === slides.length - 1 ? 'Start with Basafy' : 'Next'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={handleSignIn}>
        <Text style={styles.secondaryButtonText}>I already have an account</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tertiaryButton} onPress={handleSkip}>
        <Text style={styles.tertiaryButtonText}>Skip for now</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
