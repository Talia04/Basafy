import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../theme/palette';

type Props = {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({ title, message, icon, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color="#9CC6FF" />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel ? (
        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(74,140,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 14,
  },
  message: {
    color: palette.muted,
    textAlign: 'center',
    fontSize: 12,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  buttonText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
});
