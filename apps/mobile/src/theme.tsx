import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { useThemePreference } from './settings/SettingsProvider';

// The app's light and dark colours (REQ-ACC-001; MVP defaults, D-S1). Every colour on screen comes
// from these tokens; a guard test refuses colour codes anywhere else. System follows the phone's
// own setting; Light and Dark override it. Android's own dialogs and the keyboard follow the phone.

export type ThemeColors = {
  /** Screens and sheets. */
  background: string;
  /** Cards and tiles. */
  surface: string;
  /** A chosen row, chip or tag. */
  surfaceSelected: string;
  /** Hairlines and the borders of rows, cards and fields. */
  border: string;
  text: string;
  textMuted: string;
  /** Disabled text, placeholders and small print. */
  textFaint: string;
  /** Buttons, links, the selected day and chart lines. */
  primary: string;
  /** A selected outline, or a link on a surface. */
  primaryStrong: string;
  /** Text on `primary`. */
  onPrimary: string;
  error: string;
  /** Over a target (Q-022). */
  over: string;
  /** A target met, a logged day. */
  success: string;
  warning: string;
  warningSurface: string;
  /** The empty part of a progress bar or chart. */
  track: string;
  neutral: string;
  neutralLight: string;
  macroCarbs: string;
  macroFat: string;
  macroFibre: string;
};

export const LIGHT_COLORS: ThemeColors = {
  background: '#fff',
  surface: '#f1f5fb',
  surfaceSelected: '#e3ecf8',
  border: '#dde3ec',
  text: '#000',
  textMuted: '#555',
  textFaint: '#999',
  primary: '#1565c0',
  primaryStrong: '#0d47a1',
  onPrimary: '#fff',
  error: '#b00020',
  over: '#c62828',
  success: '#2e7d32',
  warning: '#8a5a00',
  warningSurface: '#fff4d6',
  track: '#dde3ec',
  neutral: '#455a64',
  neutralLight: '#90a4ae',
  macroCarbs: '#ef6c00',
  macroFat: '#ad1457',
  macroFibre: '#2e7d32',
};

export const DARK_COLORS: ThemeColors = {
  background: '#121417',
  surface: '#1d232b',
  surfaceSelected: '#23364f',
  border: '#38414d',
  text: '#ececec',
  textMuted: '#b3bac4',
  textFaint: '#8a939e',
  primary: '#90caf9',
  primaryStrong: '#bbdefb',
  onPrimary: '#0b1f33',
  error: '#ff8a80',
  over: '#ef9a9a',
  success: '#81c784',
  warning: '#ffcc80',
  warningSurface: '#3d3012',
  track: '#38414d',
  neutral: '#b0bec5',
  neutralLight: '#78909c',
  macroCarbs: '#ffb74d',
  macroFat: '#f48fb1',
  macroFibre: '#81c784',
};

export type Scheme = 'light' | 'dark';
type ThemeValue = { scheme: Scheme; colors: ThemeColors };

// Without a provider (signed-out screens tested on their own), light.
const ThemeContext = createContext<ThemeValue>({ scheme: 'light', colors: LIGHT_COLORS });

/** The scheme the app shows: the setting, or the phone's own when it is System. */
export function resolveScheme(preference: 'system' | Scheme, phone: string | null | undefined): Scheme {
  if (preference !== 'system') return preference;
  return phone === 'dark' ? 'dark' : 'light';
}

/** The theme for everything inside: the app's colours, the headers and tab bar, and the status bar. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useThemePreference();
  const phone = useColorScheme();
  const scheme = resolveScheme(preference, phone);
  const value = useMemo(() => ({ scheme, colors: scheme === 'dark' ? DARK_COLORS : LIGHT_COLORS }), [scheme]);
  const navigation = useMemo(() => navigationTheme(value.scheme, value.colors), [value]);
  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={navigation}>
        {children}
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

function navigationTheme(scheme: Scheme, colors: ThemeColors): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.error,
    },
  };
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/** What StyleSheet.create accepts. */
type StyleSet = Parameters<typeof StyleSheet.create>[0];

/**
 * A component's styles from the theme's colours: `const useStyles = themedStyles((c) => ({ … }))`
 * outside the component, and `const styles = useStyles()` inside it. One style sheet is made per
 * palette and kept.
 */
export function themedStyles<S extends StyleSet>(
  // The same shape as StyleSheet.create's, so values such as 'row' keep their literal types.
  make: (colors: ThemeColors) => S & StyleSet,
): () => Readonly<S> {
  const made = new Map<ThemeColors, Readonly<S>>();
  return function useStyles() {
    const { colors } = useTheme();
    let styles = made.get(colors);
    if (!styles) {
      styles = StyleSheet.create(make(colors));
      made.set(colors, styles);
    }
    return styles;
  };
}
