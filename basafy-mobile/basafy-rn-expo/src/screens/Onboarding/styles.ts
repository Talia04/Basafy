import { Dimensions, StyleSheet } from 'react-native';
import { palette } from '../../theme/palette';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 18,
  },
  skip: {
    color: palette.primary,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 6,
  },
  slideWrapper: {
    width,
    paddingHorizontal: 12,
  },
  card: {
    flex: 1,
    height: 520,
    borderRadius: 28,
    padding: 28,
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74, 140, 255, 0.16)',
    color: palette.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontWeight: '700',
  },
  badgePill: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  badgePillText: {
    fontWeight: '700',
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 14,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 20,
  },
  dot: {
    height: 12,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: palette.primary,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  mainCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: palette.card,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignSelf: 'center',
    marginTop: 80,
  },
});

export { palette };
