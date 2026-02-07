import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { darkPalette, Palette } from '../../theme/palette';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>Try again or restart the app.</Text>
          <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={this.reset}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// Error boundaries are class components — use static dark palette as fallback
const createStyles = (palette: Palette) => StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: palette.muted,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: palette.primary,
  },
  buttonText: {
    color: palette.text,
    fontWeight: '700',
  },
});

// Error boundaries are class components — use static dark palette
const styles = createStyles(darkPalette);
