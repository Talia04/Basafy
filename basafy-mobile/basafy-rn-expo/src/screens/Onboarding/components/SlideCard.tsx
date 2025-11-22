import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { Slide } from '../../../types/onboarding';
import { styles } from '../styles';

type SlideCardProps = {
  slide: Slide;
};

const SlideCard = ({ slide }: SlideCardProps) => {
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
};

export default React.memo(SlideCard);
