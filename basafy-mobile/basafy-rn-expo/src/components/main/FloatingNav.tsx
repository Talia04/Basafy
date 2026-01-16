import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { navItems } from '../../lib/mock/homeData';

type Props = {
  activeTab?: string;
  onNavigate?: (key: string) => void;
  bottomInset?: number;
  unreadCount?: number;
};

export default function FloatingNav({
  activeTab,
  onNavigate,
  bottomInset = 0,
  unreadCount = 0,
}: Props) {
  const bottomOffset = Math.max(bottomInset, 10);
  const contentPaddingVertical = 12;

  return (
    <View style={[styles.navWrapper, { bottom: bottomOffset }]}>
      <LinearGradient
        colors={['#0F1628CC', '#0F1628DD']}
        style={[styles.navBar, { paddingVertical: contentPaddingVertical }]}
      >
        {navItems.map((item) => {
          const active = item.key === activeTab;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.navItem}
              activeOpacity={0.8}
              onPress={() => onNavigate?.(item.key)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Ionicons name={item.icon as any} size={22} color={active ? '#4A8CFF' : '#8EA2C3'} />
            </TouchableOpacity>
          );
        })}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  navWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    gap: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
});
