import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text, TextInput } from './components/ui';
import { applyServerEntries } from './local/store';
import { useSettings } from './settings/SettingsProvider';
import { renderInApp } from './testing/appHarness';
import { DARK_COLORS, LIGHT_COLORS, resolveScheme, ThemeProvider, useTheme, type ThemeColors } from './theme';
import { TYPE } from './typography';

// Appearance (REQ-ACC-001; MVP defaults, D-31): System follows the phone; Light and Dark override
// it. Every colour comes from the theme's tokens, and text is readable in both palettes.

let mockPhoneScheme: 'light' | 'dark' | null = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockPhoneScheme,
}));

beforeEach(() => {
  mockPhoneScheme = 'light';
});

function Probe() {
  const { scheme, colors } = useTheme();
  const { saveSetting } = useSettings();
  return (
    <>
      <Text testID="probe">{`${scheme} ${colors.bg}`}</Text>
      <Text accessibilityRole="button" onPress={() => void saveSetting('theme', 'dark')}>
        Choose Dark
      </Text>
    </>
  );
}

async function renderWithTheme(preference?: 'system' | 'light' | 'dark') {
  return renderInApp(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
    undefined,
    preference ? (db) => applyServerEntries(db, 'setting', [{ name: 'theme', value: preference, setAt: '2026-10-28T02:00:00.000Z' }]) : undefined,
  );
}

describe('REQ-ACC-001 System, Light and Dark', () => {
  it('REQ-ACC-001 System follows the phone, and Light and Dark override it', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('D-31 with nothing chosen the app follows the phone', async () => {
    mockPhoneScheme = 'dark';
    await renderWithTheme();
    expect(await screen.findByText(`dark ${DARK_COLORS.bg}`)).toBeOnTheScreen();
  });

  it('REQ-ACC-001 Light keeps the app light on a dark phone', async () => {
    mockPhoneScheme = 'dark';
    await renderWithTheme('light');
    expect(await screen.findByText(`light ${LIGHT_COLORS.bg}`)).toBeOnTheScreen();
  });

  it('REQ-ACC-001 choosing Dark applies at once', async () => {
    await renderWithTheme('system');
    expect(await screen.findByText(`light ${LIGHT_COLORS.bg}`)).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Choose Dark'));

    expect(await screen.findByText(`dark ${DARK_COLORS.bg}`)).toBeOnTheScreen();
  });

  it('REQ-ACC-001 text takes the theme’s colour, and a colour in its style still wins', async () => {
    mockPhoneScheme = 'dark';
    await renderInApp(
      <ThemeProvider>
        <Text>Plain</Text>
        <Text style={{ color: DARK_COLORS.danger }}>Warning</Text>
      </ThemeProvider>,
    );
    expect(await screen.findByText('Plain')).toHaveStyle({ color: DARK_COLORS.ink });
    expect(screen.getByText('Warning')).toHaveStyle({ color: DARK_COLORS.danger });
  });

  it.each([
    ['light', LIGHT_COLORS],
    ['dark', DARK_COLORS],
  ] as ['light' | 'dark', ThemeColors][])(
    'REQ-ACC-001 in %s, a field’s typed text, placeholder, cursor and selection take the theme’s colours, whatever the caller passes',
    async (scheme, colors) => {
      mockPhoneScheme = scheme;
      await renderInApp(
        <ThemeProvider>
          <TextInput
            accessibilityLabel="Field"
            placeholder="Hint"
            placeholderTextColor={colors.danger}
            cursorColor={colors.danger}
            selectionColor={colors.danger}
            selectionHandleColor={colors.danger}
            style={{ color: colors.danger }}
          />
        </ThemeProvider>,
      );
      const field = await screen.findByLabelText('Field');

      expect(field).toHaveStyle({ color: colors.ink });
      expect(field.props).toMatchObject({
        placeholderTextColor: colors.inkMuted,
        cursorColor: colors.accent,
        selectionHandleColor: colors.accent,
        selectionColor: colors.accentTint,
      });
      // Readable on screens, sheets and cards, and while selected.
      for (const ground of [colors.bg, colors.surface]) {
        expect(contrast(colors.ink, ground)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(field.props.placeholderTextColor, ground)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(colors.ink, field.props.selectionColor)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

// WCAG 2 contrast ratio between two sRGB colours written #rgb or #rrggbb.
function luminance(hex: string): number {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// The design's fonts (D-35): on Android a custom font does not follow fontWeight, so the shared Text
// names Barlow's file for the weight and drops the weight.
describe('D-35 the design’s fonts', () => {
  it('text takes Barlow’s file for its weight, and a nested text keeps its parent’s font unless it gives a weight', async () => {
    await render(
      <Text testID="total" style={{ fontWeight: '600' }}>
        Total <Text testID="amount">2,000</Text> <Text testID="unit" style={{ fontWeight: '700' }}>kcal</Text>
      </Text>,
    );
    expect(screen.getByTestId('total')).toHaveStyle({ fontFamily: 'Barlow_600SemiBold', fontWeight: 'normal' });
    expect(screen.getByTestId('amount')).not.toHaveStyle({ fontFamily: 'Barlow_400Regular' });
    expect(screen.getByTestId('unit')).toHaveStyle({ fontFamily: 'Barlow_700Bold', fontWeight: 'normal' });
  });

  it('plain text is Barlow regular, and a type style keeps its own file', async () => {
    await render(
      <>
        <Text>Plain</Text>
        <Text style={TYPE.display}>Heading</Text>
      </>,
    );
    expect(screen.getByText('Plain')).toHaveStyle({ fontFamily: 'Barlow_400Regular' });
    expect(screen.getByText('Heading')).toHaveStyle({ fontFamily: 'BarlowCondensed_800ExtraBold', textTransform: 'uppercase' });
  });
});

describe('REQ-ACC-001 readable in both palettes', () => {
  it.each([
    ['light', LIGHT_COLORS],
    ['dark', DARK_COLORS],
  ] as [string, ThemeColors][])('the %s palette: body text, muted text, caramel text and error text are at least 4.5:1 on screens and cards, and text on a caramel button too', (_, colors) => {
    for (const ground of [colors.bg, colors.surface]) {
      for (const ink of [colors.ink, colors.inkMuted, colors.accent, colors.danger]) {
        expect(contrast(ink, ground)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['light', LIGHT_COLORS],
    ['dark', DARK_COLORS],
  ] as [string, ThemeColors][])('the %s palette: field outlines are at least 3:1 on screens, cards and inside the field, and lighter than muted text', (_, colors) => {
    for (const ground of [colors.bg, colors.surface, colors.surfaceSunken]) {
      expect(contrast(colors.inkSubtle, ground)).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(colors.inkSubtle, colors.bg)).toBeLessThan(contrast(colors.inkMuted, colors.bg));
  });

  it('both palettes have every token', () => {
    expect(Object.keys(DARK_COLORS).sort()).toEqual(Object.keys(LIGHT_COLORS).sort());
  });
});

// The guard: a colour code or React Native's own Text anywhere else would show wrongly in one theme.
// Node's file functions, typed here as memoryDb does, since the app's types leave Node out.
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = jest.requireActual<{
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: 'utf8'): string;
  statSync(path: string): { isDirectory(): boolean };
}>('node:fs');
const { join, relative } = jest.requireActual<{ join(...parts: string[]): string; relative(from: string, to: string): string }>(
  'node:path',
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('REQ-ACC-001 every colour comes from the theme', () => {
  const files = sourceFiles(__dirname);

  it('REQ-ACC-001 no colour code outside theme.tsx', () => {
    // Hex codes, and rgb() or rgba() values such as a backdrop's.
    const found = files
      .filter((file) => relative(__dirname, file) !== 'theme.tsx')
      .flatMap((file) =>
        (readFileSync(file, 'utf8').match(/['"](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))['"]/g) ?? []).map((code) => `${relative(__dirname, file)}: ${code}`),
      );
    expect(found).toEqual([]);
  });

  it('REQ-ACC-001 Text and TextInput come from components/ui, never straight from react-native', () => {
    const found = files
      .filter((file) => relative(__dirname, file).replace(/\\/g, '/') !== 'components/ui.tsx')
      .filter((file) => {
        const imports = readFileSync(file, 'utf8').match(/import \{([^}]*)\} from 'react-native'/g) ?? [];
        return imports.some((line) => /(^|[{,\s])(Text|TextInput)(\s*[,}])/.test(line.replace(/type \w+/g, '')));
      })
      .map((file) => relative(__dirname, file));
    expect(found).toEqual([]);
  });
});
