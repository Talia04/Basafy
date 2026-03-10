import React, { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Text, View } from 'react-native';
import { Slide } from '../../../types/onboarding';
import { createOnboardingStyles } from '../styles';
import { useTheme } from '../../../theme/palette';

type SlideCardProps = {
  slide: Slide;
  isActive?: boolean;
};

const SlideCard = ({ slide, isActive = false }: SlideCardProps) => {
  const { palette } = useTheme();
  const styles = createOnboardingStyles(palette);
  const opacity = useRef(new Animated.Value(isActive ? 1 : 0.6)).current;
  const translateY = useRef(new Animated.Value(isActive ? 0 : 16)).current;
  const iconScale = useRef(new Animated.Value(isActive ? 1 : 0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: isActive ? 1 : 0.6,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: isActive ? 0 : 16,
        duration: 260,
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
  return (
    <Animated.View style={[styles.slideWrapper, { opacity, transform: [{ translateY }] }]}>
      <LinearGradient colors={slide.colors} style={styles.card}>
        <View style={styles.cardSheen} />
        <View style={styles.cardGlow} />
        <Animated.View
          style={[
            styles.iconCircle,
            { backgroundColor: `${slide.accent}33`, transform: [{ scale: iconScale }] },
          ]}
          accessible={true}
          accessibilityLabel={`Onboarding icon for ${slide.title}`}
        >
          <Ionicons name={slide.iconName} size={28} color={slide.accent} />
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
