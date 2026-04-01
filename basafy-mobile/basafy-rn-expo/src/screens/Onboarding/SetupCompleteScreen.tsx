import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useTheme, Palette } from '../../theme/palette';
import { typography } from '../../theme/typography';

type Props = {
  onGoHome: () => void;
  onAddManual?: () => void;
  gmailSkipped?: boolean;
};

export default function SetupCompleteScreen({ onGoHome, onAddManual, gmailSkipped }: Props) {
  const { palette } = useTheme();
  const styles = createStyles(palette);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0B1124', '#1B2442']} style={styles.background} />
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle-outline" size={30} color="#5AEFD5" />
          </View>
          <Text style={styles.title}>You&apos;re set.</Text>
          <Text style={styles.subtitle}>
            Your workspace is ready. Gmail imports can finish in the background and we&apos;ll bring you back to review anything that needs cleanup.
          </Text>
          {gmailSkipped && (
            <Text style={styles.helper}>
              Want to get started right away? Add a manual application.
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={onGoHome} activeOpacity={0.9}>
              <Text style={styles.primaryButtonText}>Go to Home</Text>
            </TouchableOpacity>
            {gmailSkipped && onAddManual && (
              <TouchableOpacity style={styles.secondaryButton} onPress={onAddManual} activeOpacity={0.9}>
                <Text style={styles.secondaryButtonText}>Add a manual application</Text>
              </TouchableOpacity>
            )}
          </View>
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
    gap: 12,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    padding: 26,
    alignItems: 'center',
    gap: 10,
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
    fontSize: 26,
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
  helper: {
    marginTop: 4,
    fontSize: 13,
    color: '#9CC6FF',
    textAlign: 'center',
    fontFamily: typography.body,
  },
  actions: {
    marginTop: 16,
    width: '100%',
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
    fontFamily: typography.display,
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
    fontFamily: typography.body,
  },
});
