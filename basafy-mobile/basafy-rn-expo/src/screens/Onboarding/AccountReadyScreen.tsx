import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useTheme, Palette } from '../../theme/palette';
import { typography } from '../../theme/typography';

type Props = {
  onContinue: () => void;
};

export default function AccountReadyScreen({ onContinue }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0B1124', '#151F3B']} style={styles.background} />
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle-outline" size={28} color="#5AEFD5" />
          </View>
          <Text style={styles.title}>Your account is ready.</Text>
          <Text style={styles.subtitle}>Next, we can pull in job emails to kickstart your pipeline.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onContinue} activeOpacity={0.9}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
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
    alignItems: 'center',
    gap: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    padding: 26,
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(17,24,39,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
    fontFamily: typography.display,
  },
  subtitle: {
    fontSize: 15,
    color: palette.muted,
    textAlign: 'center',
    fontFamily: typography.body,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#5AEFD5',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: '#0A0E1A',
    fontWeight: '800',
    fontSize: 16,
    fontFamily: typography.display,
  },
});
