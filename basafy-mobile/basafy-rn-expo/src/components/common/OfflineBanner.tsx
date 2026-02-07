/**
 * Offline indicator banner component
 * Shows when device is offline or data is stale
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../theme/palette';

interface OfflineBannerProps {
  isOffline?: boolean;
  isStale?: boolean;
  message?: string;
}

export function OfflineBanner({ isOffline, isStale, message }: OfflineBannerProps) {
  if (!isOffline && !isStale) return null;

  const bannerMessage = message || (isOffline 
    ? 'You are offline. Showing cached data.' 
    : 'Showing cached data. Pull to refresh.');

  return (
    <View style={[styles.banner, isOffline ? styles.offlineBanner : styles.staleBanner]}>
      <Ionicons 
        name={isOffline ? 'cloud-offline-outline' : 'time-outline'} 
        size={16} 
        color={isOffline ? '#FFF' : palette.foreground} 
      />
      <Text style={[styles.bannerText, isOffline ? styles.offlineText : styles.staleText]}>
        {bannerMessage}
      </Text>
    </View>
  );
}

interface StaleDataBadgeProps {
  isStale?: boolean;
  small?: boolean;
}

export function StaleDataBadge({ isStale, small = false }: StaleDataBadgeProps) {
  if (!isStale) return null;

  return (
    <View style={[styles.badge, small && styles.badgeSmall]}>
      <Ionicons name="time-outline" size={small ? 10 : 12} color={palette.muted} />
      <Text style={[styles.badgeText, small && styles.badgeTextSmall]}>Cached</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  offlineBanner: {
    backgroundColor: palette.destructive || '#DC2626',
  },
  staleBanner: {
    backgroundColor: palette.muted + '30' || '#F3F4F6',
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  offlineText: {
    color: '#FFF',
  },
  staleText: {
    color: palette.foreground,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.muted + '20',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  badgeSmall: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    color: palette.muted,
    fontWeight: '500',
  },
  badgeTextSmall: {
    fontSize: 9,
  },
});

export default OfflineBanner;
