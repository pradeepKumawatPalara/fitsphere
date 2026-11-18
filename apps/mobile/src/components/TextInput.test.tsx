import { render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import { ThemeProvider } from '../theme';
import { singleLineHeight, TextInput } from './ui';

// Every text field's height (the owner's report, 2026-11-17, a Realme Narzo phone: switching cm and in made
// the Measurements' empty boxes nearly twice as tall). A one-line field has a fixed height and no extra font
// padding, so the phone's fonts can't stretch it; one of many lines still grows with its text.

describe('the height of a one-line field', () => {
  it('is its line (its lineHeight, else 1.3 × its font size), its padding and its border', () => {
    // Barlow 17 with 12 above and below: 23 + 24.
    expect(singleLineHeight({ fontSize: 17, paddingVertical: 12 }, 1)).toBe(47);
    // A number field: line height 24, 8 above and below.
    expect(singleLineHeight({ fontSize: 20, lineHeight: 24, paddingVertical: 8 }, 1)).toBe(40);
    // A box that is the field itself: its border counts, each side its own.
    expect(singleLineHeight({ fontSize: 17, paddingTop: 10, paddingBottom: 6, borderWidth: 1.5 }, 1)).toBe(23 + 16 + 3);
    // No font size: Android's 14.
    expect(singleLineHeight({}, 1)).toBe(19);
  });

  it('grows its line with the phone’s text size, not its padding', () => {
    expect(singleLineHeight({ fontSize: 17, paddingVertical: 12 }, 1.3)).toBe(Math.ceil(23 * 1.3) + 24);
  });

  it('keeps a height the field sets itself', () => {
    expect(singleLineHeight({ height: 60, fontSize: 17, paddingVertical: 12 }, 2)).toBe(60);
  });
});

describe('TextInput', () => {
  it('a one-line field has its fixed height, no extra font padding, its text centred', async () => {
    await render(
      <ThemeProvider>
        <TextInput accessibilityLabel="Upper waist (cm)" value="" allowFontScaling={false} style={{ fontSize: 17, paddingVertical: 12, flex: 1 }} />
      </ThemeProvider>,
    );

    expect(StyleSheet.flatten(screen.getByLabelText('Upper waist (cm)').props.style)).toMatchObject({
      height: 47,
      includeFontPadding: false,
      textAlignVertical: 'center',
      flex: 1,
    });
  });

  it('its line grows with the phone’s text size', async () => {
    const { fontScale } = Dimensions.get('window');
    await render(
      <ThemeProvider>
        <TextInput accessibilityLabel="Lower waist (cm)" value="" style={{ fontSize: 17, paddingVertical: 12 }} />
      </ThemeProvider>,
    );

    expect(StyleSheet.flatten(screen.getByLabelText('Lower waist (cm)').props.style).height).toBe(Math.ceil(23 * fontScale) + 24);
  });

  it('a field of many lines still grows with its text', async () => {
    await render(
      <ThemeProvider>
        <TextInput accessibilityLabel="Notes" multiline value="" style={{ fontSize: 17, minHeight: 72 }} />
      </ThemeProvider>,
    );

    const style = StyleSheet.flatten(screen.getByLabelText('Notes').props.style);
    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBe(72);
  });
});
