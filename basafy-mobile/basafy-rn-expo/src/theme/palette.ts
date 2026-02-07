import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ════════════════════════════════════════════════════════════════
// Color Palettes
// ════════════════════════════════════════════════════════════════

export interface Palette {
  background: string;
  card: string;
  text: string;
  muted: string;
  primary: string;
  success: string;
  accentPink: string;
  /** Semi-transparent overlay for glass cards */
  overlay: string;
  /** Slightly more visible overlay */
  overlayLight: string;
  /** Border overlay */
  overlayBorder: string;
  /** Inverted text (used on colored buttons) */
  invertedText: string;
}

export const darkPalette: Palette = {
  background: '#0A0E1A',
  card: '#111827',
  text: '#F4F6FA',
  muted: '#A3B0C0',
  primary: '#4A8CFF',
  success: '#5AEFD5',
  accentPink: '#F38FA9',
  overlay: 'rgba(255,255,255,0.03)',
  overlayLight: 'rgba(255,255,255,0.06)',
  overlayBorder: 'rgba(255,255,255,0.08)',
  invertedText: '#0A0E1A',
};

export const lightPalette: Palette = {
  background: '#F5F7FA',
  card: '#FFFFFF',
  text: '#1A1D26',
  muted: '#6B7280',
  primary: '#3B7BF7',
  success: '#10B981',
  accentPink: '#E6527A',
  overlay: 'rgba(0,0,0,0.03)',
  overlayLight: 'rgba(0,0,0,0.05)',
  overlayBorder: 'rgba(0,0,0,0.08)',
  invertedText: '#FFFFFF',
};

// ════════════════════════════════════════════════════════════════
// Theme Mode
// ════════════════════════════════════════════════════════════════

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'basafy:theme-mode';

// ════════════════════════════════════════════════════════════════
// Context
// ════════════════════════════════════════════════════════════════

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  palette: Palette;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  isDark: true,
  palette: darkPalette,
  setMode: () => { },
});

// ════════════════════════════════════════════════════════════════
// Provider
// ════════════════════════════════════════════════════════════════

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

  // Load persisted preference
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => { });
  }, []);

  const isDark = useMemo(() => {
    if (mode === 'system') return systemScheme !== 'light';
    return mode === 'dark';
  }, [mode, systemScheme]);

  const currentPalette = isDark ? darkPalette : lightPalette;

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, isDark, palette: currentPalette, setMode }),
    [mode, isDark, currentPalette, setMode],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

// ════════════════════════════════════════════════════════════════
// Hook
// ════════════════════════════════════════════════════════════════

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// ════════════════════════════════════════════════════════════════
// Backward-compat: static palette (default dark) for files that
// haven't migrated to useTheme() yet.
// ════════════════════════════════════════════════════════════════
export const palette = darkPalette;
