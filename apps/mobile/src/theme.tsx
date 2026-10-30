// The app's colours (REQ-ACC-001). Every colour a screen uses comes from here, never a hex value in
// the screen. This is the light theme only, with the token names the Settings slice uses; that
// slice adds the dark theme and the System/Light/Dark setting, and its version of this file
// replaces this one (D-P1).

export type ThemeColors = {
  /** Screen background. */
  background: string;
  /** Cards and tiles. */
  surface: string;
  /** A chosen row, chip or tag. */
  surfaceSelected: string;
  /** Hairlines, row and card borders. */
  border: string;
  /** Body text. */
  text: string;
  /** Secondary text. */
  textMuted: string;
  /** Disabled text, placeholders and small print. */
  textFaint: string;
  /** Buttons, links and the chart line. */
  primary: string;
  /** A selected outline, or a link on a surface. */
  primaryStrong: string;
  /** Text on `primary`. */
  onPrimary: string;
  /** Error text. */
  error: string;
  /** Over a target. */
  over: string;
  /** A target met, or a logged day's dot. */
  success: string;
  /** Warning text. */
  warning: string;
  /** A warning banner. */
  warningSurface: string;
  /** A progress bar's or the chart's track. */
  track: string;
  /** A blue-grey accent. */
  neutral: string;
  /** A blue-grey outline, or an empty dot. */
  neutralLight: string;
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
};

export function useTheme(): { scheme: 'light' | 'dark'; colors: ThemeColors } {
  return { scheme: 'light', colors: LIGHT_COLORS };
}
