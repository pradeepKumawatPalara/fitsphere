import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { useThemePreference } from './settings/SettingsProvider';

// The app's light and dark colours (REQ-ACC-001; MVP defaults, D-31): the design system's tokens
// (D-35; docs/design/design-system.md, "Colour tokens"). Every colour on screen comes from these
// tokens; a guard test refuses colour codes anywhere else. System follows the phone's own setting;
// Light and Dark override it. Android's own dialogs and the keyboard follow the phone.

export type ThemeColors = {
  /** Screens. */
  bg: string;
  /** Cards, sheets and the tab bar. */
  surface: string;
  /** Icon buttons and the chosen segment. */
  surfaceRaised: string;
  /** Inside fields and segment tracks. */
  surfaceSunken: string;
  /** Hairlines, dividers and the outlines of cards and secondary buttons. */
  border: string;
  /** The empty part of a bar or chart. */
  track: string;
  /** Text and numbers. */
  ink: string;
  /** Labels, hints, secondary text and placeholders. */
  inkMuted: string;
  /** Disabled text, future days and field outlines. */
  inkSubtle: string;
  /** Caramel as text or a mark: today, links, icons, the tab shown, an outline. */
  accent: string;
  /** A quiet caramel fill: banners, icon tiles, a chosen row, chip or tag. */
  accentTint: string;
  /** Caramel as a fill: the main button, the selected day, the avatar. */
  primary: string;
  primaryPressed: string;
  /** Text and icons on `primary`. */
  onPrimary: string;
  protein: string;
  carbs: string;
  fat: string;
  /** A quiet fill of `fat`'s blue-grey: an icon tile (Log meal's Scan barcode, D-58). */
  fatTint: string;
  fiber: string;
  /** Done, a target met, a logged day. */
  success: string;
  successTint: string;
  /** A day with a meal in the header's month calendar (D-84): a soft green fill, a little stronger than `successTint`. */
  loggedDayTint: string;
  /** Over a target (Q-022): gold, never red. */
  warning: string;
  /** A quiet fill of `warning`'s gold: an icon tile (Log meal's Saved meals, D-58). */
  warningTint: string;
  /** Errors and actions that delete. */
  danger: string;
  dangerTint: string;
  focus: string;
  /** Behind a sheet: dims the screen it opens over. */
  scrim: string;
  /** Behind the full-size photo viewer. */
  scrimStrong: string;
  /** Text on `scrimStrong`, the same in both themes, as the backdrop is. */
  onScrim: string;
  /** The signature corner's diagonal stripes. */
  stripe: string;
};

export const LIGHT_COLORS: ThemeColors = {
  bg: '#F4EFEC',
  surface: '#FBF8F6',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#EDE5E0',
  border: '#DDD1CA',
  track: '#E6DCD6',
  ink: '#11212D',
  inkMuted: '#3D4D55',
  inkSubtle: '#8A817F',
  accent: '#7D5434',
  accentTint: '#F3E6DA',
  primary: '#B58863',
  primaryPressed: '#9C7150',
  onPrimary: '#161616',
  protein: '#7D5434',
  carbs: '#A88B74',
  fat: '#3D4D55',
  fatTint: 'rgba(61,77,85,0.10)',
  fiber: '#6F8D9B',
  success: '#3F7A5C',
  successTint: 'rgba(63,122,92,0.10)',
  loggedDayTint: 'rgba(63,122,92,0.14)',
  warning: '#96650F',
  warningTint: 'rgba(150,101,15,0.10)',
  danger: '#B0463A',
  dangerTint: 'rgba(176,70,58,0.08)',
  focus: '#11212D',
  scrim: 'rgba(17,33,45,0.40)',
  scrimStrong: 'rgba(0,0,0,0.9)',
  onScrim: '#F1EAE5',
  stripe: 'rgba(125,84,52,0.07)',
};

export const DARK_COLORS: ThemeColors = {
  bg: '#11212D',
  surface: '#182B37',
  surfaceRaised: '#213744',
  surfaceSunken: '#0C1820',
  border: '#2C4250',
  track: '#263C49',
  ink: '#F1EAE5',
  inkMuted: '#A79E9C',
  inkSubtle: '#6F7F88',
  accent: '#C99A73',
  accentTint: '#3A332C',
  primary: '#B58863',
  primaryPressed: '#9C7150',
  onPrimary: '#161616',
  protein: '#C99A73',
  carbs: '#E3D5CC',
  fat: '#8FA9B5',
  fatTint: 'rgba(143,169,181,0.14)',
  fiber: '#6D8592',
  success: '#7FB89A',
  successTint: 'rgba(127,184,154,0.14)',
  loggedDayTint: 'rgba(127,184,154,0.17)',
  warning: '#E8C37C',
  warningTint: 'rgba(232,195,124,0.14)',
  danger: '#E5806F',
  dangerTint: 'rgba(229,128,111,0.12)',
  focus: '#E3D5CC',
  scrim: 'rgba(5,10,14,0.66)',
  scrimStrong: 'rgba(0,0,0,0.9)',
  onScrim: '#F1EAE5',
  stripe: 'rgba(201,154,115,0.08)',
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

// The headers and tab bar in Barlow, a file per weight (typography.ts).
const NAVIGATION_FONTS: Theme['fonts'] = {
  regular: { fontFamily: 'Barlow_400Regular', fontWeight: 'normal' },
  medium: { fontFamily: 'Barlow_500Medium', fontWeight: 'normal' },
  bold: { fontFamily: 'Barlow_600SemiBold', fontWeight: 'normal' },
  heavy: { fontFamily: 'Barlow_700Bold', fontWeight: 'normal' },
};

function navigationTheme(scheme: Scheme, colors: ThemeColors): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.bg,
      text: colors.ink,
      border: colors.border,
      notification: colors.danger,
    },
    fonts: NAVIGATION_FONTS,
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
