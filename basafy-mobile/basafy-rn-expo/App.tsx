import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

const colors = {
  background: '#0A0E1A',
  primary: '#4A8CFF',
  secondary: '#5AEFD5',
  text: '#F0F2F5',
  muted: '#9BA7B5',
};

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.card}>
        <Text style={styles.badge}>Basafy</Text>
        <Text style={styles.title}>Work your next move</Text>
        <Text style={styles.subtitle}>
          Fresh Expo scaffold. Replace this screen with your onboarding, navigation, and dashboard when ready.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: 'rgba(26, 32, 48, 0.85)',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74, 140, 255, 0.16)',
    color: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 16,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 10,
  },
});
