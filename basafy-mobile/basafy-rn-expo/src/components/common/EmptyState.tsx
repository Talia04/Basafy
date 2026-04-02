import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, Palette } from '../../theme/palette';

type EmptyStateVariant = 'default' | 'compact' | 'large';

type Props = {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  /** Visual variant: 'compact' for inline, 'large' for full-screen, 'default' for cards */
  variant?: EmptyStateVariant;
  /** Optional hint text shown below message */
  hint?: string;
};

export default function EmptyState({
  title,
  message,
  icon,
  actionLabel,
  onAction,
  variant = 'default',
  hint,
}: Props) {
  const { palette, isDark } = useTheme();
  const styles = createStyles(palette);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const isCompact = variant === 'compact';
  const isLarge = variant === 'large';

  const iconSize = isCompact ? 24 : isLarge ? 56 : 40;
  const iconWrapSize = isCompact ? 40 : isLarge ? 96 : 72;

  return (
    <Animated.View
      style={[
        styles.wrap,
        isCompact && styles.wrapCompact,
        isLarge && styles.wrapLarge,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      {icon ? (
        <View
          style={[
            styles.iconWrap,
            { width: iconWrapSize, height: iconWrapSize, borderRadius: iconWrapSize / 2 },
          ]}
        >
          <LinearGradient
            colors={isDark ? ['rgba(74,140,255,0.25)', 'rgba(90,239,213,0.1)'] : ['rgba(29,79,215,0.14)', 'rgba(15,138,114,0.08)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Ionicons name={icon} size={iconSize} color={palette.accentBlue} />
        </View>
      ) : null}
      <Text style={[styles.title, isCompact && styles.titleCompact, isLarge && styles.titleLarge]}>
        {title}
      </Text>
      <Text style={[styles.message, isCompact && styles.messageCompact, isLarge && styles.messageLarge]}>
        {message}
      </Text>
      {hint ? (
        <View style={styles.hintRow}>
          <Ionicons name="arrow-down" size={12} color={palette.muted} />
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      ) : null}
      {actionLabel ? (
        <TouchableOpacity
          style={[styles.button, isLarge && styles.buttonLarge]}
          activeOpacity={0.85}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.buttonText, isLarge && styles.buttonTextLarge]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  wrapCompact: {
    gap: 8,
    paddingVertical: 16,
  },
  wrapLarge: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 48,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  title: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 17,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 14,
  },
  titleLarge: {
    fontSize: 22,
    fontWeight: '800',
  },
  message: {
    color: palette.muted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 280,
  },
  messageCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  messageLarge: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  hintText: {
    color: palette.muted,
    fontSize: 12,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: palette.accentSurface,
    borderWidth: 1,
    borderColor: palette.overlayBorderStrong,
  },
  buttonLarge: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  buttonText: {
    color: palette.accentBlue,
    fontSize: 13,
    fontWeight: '700',
  },
  buttonTextLarge: {
    fontSize: 15,
  },
});
