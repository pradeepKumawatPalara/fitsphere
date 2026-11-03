import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { Barlow_700Bold } from '@expo-google-fonts/barlow/700Bold';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { BarlowCondensed_800ExtraBold_Italic } from '@expo-google-fonts/barlow-condensed/800ExtraBold_Italic';
import type { TextStyle } from 'react-native';

// The design system's two families (D-35; docs/design/design-system.md, "Typography"): Barlow for
// running text, Barlow Condensed for headings, numbers, labels, buttons and tabs, in capitals. Each
// weight is its own font file, loaded at app start. On Android a custom font does not follow
// `fontWeight`, so a style names the file instead.

/** The font files the app loads, by the name a style gives as `fontFamily`. */
export const FONT_FILES = {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_800ExtraBold_Italic,
};

type FontName = keyof typeof FONT_FILES;

/** Barlow's file for a weight: what the shared Text uses for a style that gives only a weight. */
export function barlowFor(weight: TextStyle['fontWeight']): FontName {
  switch (String(weight ?? '400')) {
    case '500':
      return 'Barlow_500Medium';
    case '600':
      return 'Barlow_600SemiBold';
    case '700':
    case '800':
    case '900':
    case 'bold':
      return 'Barlow_700Bold';
    default:
      return 'Barlow_400Regular';
  }
}

const condensed = (fontFamily: FontName, fontSize: number, letterSpacing = 0): TextStyle => ({
  fontFamily,
  fontSize,
  letterSpacing,
  textTransform: 'uppercase',
});

/** The type styles a redesigned screen uses; the rest of the design's scale comes with its screens. */
export const TYPE = {
  /** The one hero number on a screen, the only italic. Its line is its size, so Android draws it whole. */
  heroNumber: { fontFamily: 'BarlowCondensed_800ExtraBold_Italic', fontSize: 84, lineHeight: 86, fontVariant: ['tabular-nums'] },
  /** Screen headings: never italic. */
  display: { ...condensed('BarlowCondensed_800ExtraBold', 52, 0.5), lineHeight: 52 },
  button: condensed('BarlowCondensed_800ExtraBold', 20, 1.5),
  buttonSecondary: condensed('BarlowCondensed_800ExtraBold', 18, 1.5),
  link: condensed('BarlowCondensed_800ExtraBold', 15, 1),
  /** A sheet's title. */
  sheetTitle: { ...condensed('BarlowCondensed_800ExtraBold', 34, 0.5), lineHeight: 36 },
  /** A pushed screen's title in its header (Log meal, Settings). */
  screenHeader: { ...condensed('BarlowCondensed_800ExtraBold', 24, 0.5), lineHeight: 26 },
  /** The header's greeting. */
  heading: { ...condensed('BarlowCondensed_800ExtraBold', 26, 0.5), lineHeight: 28 },
  /** A value on a card: a target's progress, a tile's reading, a week's count. */
  metric: { ...condensed('BarlowCondensed_800ExtraBold', 22), lineHeight: 24, fontVariant: ['tabular-nums'] },
  /** Field labels and overlines, in the muted colour. */
  label: { ...condensed('BarlowCondensed_700Bold', 13, 1.5), lineHeight: 16 },
  tab: { ...condensed('BarlowCondensed_700Bold', 12, 1.2), lineHeight: 14 },
  /** A day of the month in a calendar, in fixed-width digits. */
  dayNumber: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 18, lineHeight: 20, fontVariant: ['tabular-nums'] },
  wordmark: condensed('BarlowCondensed_800ExtraBold', 18, 3),
  /** A field's value. */
  input: { fontFamily: 'Barlow_400Regular', fontSize: 17 },
  /** Hints, errors and banners. */
  small: { fontFamily: 'Barlow_400Regular', fontSize: 14, lineHeight: 20 },
} as const satisfies Record<string, TextStyle>;
