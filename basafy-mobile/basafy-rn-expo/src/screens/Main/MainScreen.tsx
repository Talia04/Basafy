import React from 'react';
import { SafeAreaView, Text, View, StyleSheet } from 'react-native';

export default function MainScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Main App</Text>
        <Text style={styles.subtitle}>Wire up your dashboard or tabs here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    padding: 20,
  },
  container: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#F4F6FA',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#A3B0C0',
    fontSize: 16,
  },
});
