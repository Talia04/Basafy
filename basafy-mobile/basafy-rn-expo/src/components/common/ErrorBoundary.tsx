import React from 'react';
import {
  Clipboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { darkPalette, lightPalette, Palette } from '../../theme/palette';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
  palette: Palette;
};

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    copied: false,
    palette: darkPalette, // default, overridden in constructor
  };

  constructor(props: Props) {
    super(props);
    // Load persisted theme preference for the crash screen
    AsyncStorage.getItem('basafy:theme-mode')
      .then((stored) => {
        if (stored === 'light') {
          this.setState({ palette: lightPalette });
        }
        // 'dark' and 'system' both default to darkPalette for the crash screen
      })
      .catch(() => { });
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // ── Structured error log ──────────────────────────────
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 10).join('\n'),
      componentStack: errorInfo.componentStack
        ?.split('\n')
        .filter((l) => l.trim())
        .slice(0, 15)
        .join('\n'),
      platform: Platform.OS,
      version: Platform.Version,
    };

    console.error('╔══════════════════════════════════════════════════╗');
    console.error('║           BASAFY — UNCAUGHT RENDER ERROR        ║');
    console.error('╚══════════════════════════════════════════════════╝');
    console.error(JSON.stringify(report, null, 2));

    // Persist the last crash for diagnostics
    AsyncStorage.setItem(
      'basafy:last-crash',
      JSON.stringify(report),
    ).catch(() => { });
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    });
  };

  handleRestart = async () => {
    try {
      // Dynamic import so the app doesn't crash if expo-updates isn't installed
      const Updates = await import('expo-updates');
      await Updates.reloadAsync();
    } catch {
      // Fallback: just reset the error boundary
      this.reset();
    }
  };

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const text = [
      `Error: ${error?.name ?? 'Unknown'}: ${error?.message ?? 'No message'}`,
      '',
      '── Stack Trace ──',
      error?.stack?.split('\n').slice(0, 12).join('\n') ?? '(none)',
      '',
      '── Component Stack ──',
      errorInfo?.componentStack
        ?.split('\n')
        .filter((l) => l.trim())
        .slice(0, 10)
        .join('\n') ?? '(none)',
    ].join('\n');
    Clipboard.setString(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2500);
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo, showDetails, copied, palette } = this.state;
    const s = createStyles(palette);
    const showDebug = __DEV__;

    return (
      <View style={s.wrap}>
        {/* ── Illustration ── */}
        <View style={s.iconCircle}>
          <Ionicons name="warning-outline" size={36} color={palette.primary} />
        </View>

        {/* ── Title ── */}
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.subtitle}>
          An unexpected error crashed this screen.{'\n'}
          You can try again or restart the app.
        </Text>

        {/* ── Error name badge ── */}
        {showDebug && error && (
          <View style={s.errorBadge}>
            <Ionicons name="bug-outline" size={14} color="#FF7B7B" />
            <Text style={s.errorBadgeText} numberOfLines={2}>
              {error.name}: {error.message}
            </Text>
          </View>
        )}

        {/* ── Action buttons ── */}
        <View style={s.buttonRow}>
          <TouchableOpacity style={s.primaryButton} activeOpacity={0.85} onPress={this.reset}>
            <Ionicons name="refresh-outline" size={16} color={palette.invertedText} />
            <Text style={s.primaryButtonText}>Try again</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.secondaryButton} activeOpacity={0.85} onPress={this.handleRestart}>
            <Ionicons name="power-outline" size={16} color={palette.text} />
            <Text style={s.secondaryButtonText}>Restart app</Text>
          </TouchableOpacity>
        </View>

        {/* ── Expandable details ── */}
        {showDebug && (
          <TouchableOpacity style={s.detailsToggle} activeOpacity={0.8} onPress={this.toggleDetails}>
            <Ionicons
              name={showDetails ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={14}
              color={palette.muted}
            />
            <Text style={s.detailsToggleText}>
              {showDetails ? 'Hide details' : 'Show details'}
            </Text>
          </TouchableOpacity>
        )}

        {showDebug && showDetails && (
          <View style={s.detailsCard}>
            <ScrollView style={s.detailsScroll} nestedScrollEnabled>
              {error?.stack && (
                <>
                  <Text style={s.detailsHeading}>Stack Trace</Text>
                  <Text style={s.detailsCode} selectable>
                    {error.stack
                      .split('\n')
                      .slice(0, 12)
                      .join('\n')}
                  </Text>
                </>
              )}
              {errorInfo?.componentStack && (
                <>
                  <Text style={s.detailsHeading}>Component Stack</Text>
                  <Text style={s.detailsCode} selectable>
                    {errorInfo.componentStack
                      .split('\n')
                      .filter((l) => l.trim())
                      .slice(0, 10)
                      .join('\n')}
                  </Text>
                </>
              )}
            </ScrollView>
            <TouchableOpacity style={s.copyButton} activeOpacity={0.8} onPress={this.handleCopyError}>
              <Ionicons
                name={copied ? 'checkmark-circle-outline' : 'copy-outline'}
                size={14}
                color={copied ? palette.success : palette.muted}
              />
              <Text style={[s.copyButtonText, copied && { color: palette.success }]}>
                {copied ? 'Copied!' : 'Copy error info'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const createStyles = (palette: Palette) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      backgroundColor: palette.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
      gap: 14,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: palette.overlay,
      borderWidth: 1,
      borderColor: palette.overlayBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    title: {
      color: palette.text,
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
    },
    subtitle: {
      color: palette.muted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    errorBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,123,123,0.1)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,123,123,0.2)',
      maxWidth: '100%',
    },
    errorBadgeText: {
      color: '#FF7B7B',
      fontSize: 12,
      fontWeight: '600',
      flexShrink: 1,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: palette.primary,
    },
    primaryButtonText: {
      color: palette.invertedText,
      fontWeight: '700',
      fontSize: 14,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: palette.overlay,
      borderWidth: 1,
      borderColor: palette.overlayBorder,
    },
    secondaryButtonText: {
      color: palette.text,
      fontWeight: '600',
      fontSize: 14,
    },
    detailsToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    detailsToggleText: {
      color: palette.muted,
      fontSize: 13,
    },
    detailsCard: {
      width: '100%',
      backgroundColor: palette.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.overlayBorder,
      overflow: 'hidden',
    },
    detailsScroll: {
      maxHeight: 220,
      padding: 14,
    },
    detailsHeading: {
      color: palette.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 6,
      marginTop: 4,
    },
    detailsCode: {
      color: palette.text,
      fontSize: 11,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      lineHeight: 16,
      marginBottom: 12,
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: palette.overlayBorder,
    },
    copyButtonText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '600',
    },
  });
