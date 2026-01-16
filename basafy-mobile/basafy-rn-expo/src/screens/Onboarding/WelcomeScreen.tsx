import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { palette } from '../../theme/palette';

type Props = {
  onContinue: () => void;
  onSignIn: () => void;
  onExploreDemo?: () => void;
};

export default function WelcomeScreen({ onContinue, onSignIn, onExploreDemo }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0B1124', '#121B34']} style={styles.background} />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="pulse-outline" size={28} color="#5AEFD5" />
        </View>
        <Text style={styles.title}>Track job applications automatically</Text>
        <Text style={styles.subtitle}>
          Turn inbox updates into a clean pipeline, interview calendar, and clear next steps.
        </Text>

        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• Import from Gmail (optional)</Text>
          <Text style={styles.bullet}>• See pipeline + interview calendar</Text>
          <Text style={styles.bullet}>• Learn what&apos;s working</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={onContinue} activeOpacity={0.9}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              if (onExploreDemo) {
                onExploreDemo();
              } else {
                Alert.alert('Demo mode', 'Demo mode is coming soon.');
              }
            }}
            activeOpacity={0.9}
          >
            <Text style={styles.secondaryButtonText}>Explore demo</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSignIn} style={styles.linkButton}>
            <Text style={styles.linkText}>I already have an account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 18,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    fontSize: 16,
    color: palette.muted,
    lineHeight: 22,
  },
  bulletList: {
    gap: 6,
    paddingTop: 6,
  },
  bullet: {
    fontSize: 14,
    color: palette.text,
  },
  actions: {
    marginTop: 12,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#5AEFD5',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0A0E1A',
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryButtonText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 15,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  linkText: {
    color: '#9CC6FF',
    fontWeight: '700',
    fontSize: 14,
  },
});
