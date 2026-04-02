import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ════════════════════════════════════════════════════════════════
// Color Palettes
// ════════════════════════════════════════════════════════════════

export interface Palette {
  shell: string;
  background: string;
  card: string;
  text: string;
  muted: string;
  primary: string;
  success: string;
  accentPink: string;
  accentPurple: string;
  accentYellow: string;
  accentOrange: string;
  accentGreen: string;
  accentBlue: string;
  accentCyan: string;
  accentGradient: string[];
  funGradient: string[];
  /** Semi-transparent overlay for glass cards */
  overlay: string;
  /** Slightly more visible overlay */
  overlayLight: string;
  /** Border overlay */
  overlayBorder: string;
  /** Stronger border for light cards and nav chrome */
  overlayBorderStrong: string;
  /** Elevated surface used for glass cards and floating chrome */
  surface: string;
  /** More subtle elevated surface */
  surfaceMuted: string;
  /** Accent-tinted surface */
  accentSurface: string;
  /** Theme-aware floating nav gradient */
  navGradient: [string, string, ...string[]];
  /** Theme-aware top banner background */
  bannerBackground: string;
  /** Theme-aware top banner border */
  bannerBorder: string;
  /** Inverted text (used on colored buttons) */
  invertedText: string;
}

export const darkPalette: Palette = {
  shell: '#0A0E1A',
  background: '#0A0E1A',
  card: '#111827',
  text: '#F4F6FA',
  muted: '#A3B0C0',
  primary: '#4A8CFF',
  success: '#5AEFD5',
  accentPink: '#F38FA9',
  accentPurple: '#A78BFA',
  accentYellow: '#FDE68A',
  accentOrange: '#FDBA74',
  accentGreen: '#22D3EE', // Modern teal, less neon
  accentBlue: '#60A5FA',
  accentCyan: '#67E8F9',
  accentGradient: ['#4A8CFF', '#F38FA9', '#FDE68A', '#6EE7B7', '#A78BFA'],
  funGradient: ['#F38FA9', '#A78BFA', '#4A8CFF', '#6EE7B7', '#FDE68A'],
  overlay: 'rgba(255,255,255,0.03)',
  overlayLight: 'rgba(255,255,255,0.06)',
  overlayBorder: 'rgba(255,255,255,0.08)',
  overlayBorderStrong: 'rgba(255,255,255,0.14)',
  surface: 'rgba(255,255,255,0.06)',
  surfaceMuted: 'rgba(255,255,255,0.03)',
  accentSurface: 'rgba(74,140,255,0.12)',
  navGradient: ['#0F1628CC', '#0F1628DD'],
  bannerBackground: 'rgba(10,14,26,0.96)',
  bannerBorder: 'rgba(90,239,213,0.2)',
  invertedText: '#0A0E1A',
};

export const lightPalette: Palette = {
  shell: '#EEF2F7',
  background: '#F4F7FB',
  card: '#FFFFFF',
  text: '#172033',
  muted: '#627086',
  primary: '#255CE6',
  success: '#129A74',
  accentPink: '#D94670',
  accentPurple: '#8B5CF6',
  accentYellow: '#DCA11A',
  accentOrange: '#E88734',
  accentGreen: '#0F8A72',
  accentBlue: '#1D4FD7',
  accentCyan: '#0B7E90',
  accentGradient: ['#255CE6', '#D94670', '#DCA11A', '#0F8A72', '#7C3AED'],
  funGradient: ['#D94670', '#7C3AED', '#255CE6', '#0F8A72', '#DCA11A'],
  overlay: 'rgba(15,23,42,0.04)',
  overlayLight: 'rgba(15,23,42,0.08)',
  overlayBorder: 'rgba(15,23,42,0.10)',
  overlayBorderStrong: 'rgba(15,23,42,0.16)',
  surface: 'rgba(255,255,255,0.94)',
  surfaceMuted: 'rgba(255,255,255,0.78)',
  accentSurface: 'rgba(37,92,230,0.08)',
  navGradient: ['rgba(255,255,255,0.94)', 'rgba(240,244,250,0.98)'],
  bannerBackground: 'rgba(255,255,255,0.98)',
  bannerBorder: 'rgba(17,153,184,0.18)',
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
