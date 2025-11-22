import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, Text, TouchableOpacity, View, ViewToken } from 'react-native';
import Pagination from './components/Pagination';
import SlideCard from './components/SlideCard';
import { slides } from './slides';
import { styles, palette } from './styles';
import { OnboardingProps, Slide } from '../../types/onboarding';

type InternalProps = OnboardingProps & {
  /**
   * When false, the component will immediately fire onComplete and render nothing
   * after onboarding is completed. Useful when parent wants to control the post-onboarding UI.
   */
  renderCompletedFallback?: boolean;
};

const STORAGE_KEY = 'basafy:onboarding-completed';

export default function OnboardingFlow({ onComplete, renderCompletedFallback = true }: InternalProps) {
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
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
