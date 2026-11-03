import { render, screen } from '@testing-library/react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { FormScreen } from './FormScreen';
import { Screen, Text } from './ui';

// A screen with no header (the sign-in screens, app start) starts below the phone's status bar; with
// a header (Change password), the header already clears it (the owner's final check, #11).

const STATUS_BAR = 32;

function phone(children: ReactNode, headerHeight?: number) {
  const insets = { top: STATUS_BAR, right: 0, bottom: 0, left: 0 };
  const page = <SafeAreaInsetsContext.Provider value={insets}>{children}</SafeAreaInsetsContext.Provider>;
  return headerHeight === undefined ? page : <HeaderHeightContext.Provider value={headerHeight}>{page}</HeaderHeightContext.Provider>;
}

/** The padding above the outermost view holding `text`. */
function paddingTopAbove(text: string): number {
  let element = screen.getByText(text).parent;
  let padding = 0;
  while (element) {
    const top = StyleSheet.flatten(element.props.style)?.paddingTop;
    if (typeof top === 'number') padding = top;
    element = element.parent;
  }
  return padding;
}

describe('REQ-ACC-001 forms and message screens clear the status bar', () => {
  it.each([
    ['no header', 0, STATUS_BAR],
    ['a header', 56, 0],
  ])('FormScreen with %s', async (_, headerHeight, padding) => {
    await render(phone(<FormScreen footer={<Text>Footer</Text>}>{<Text>Form</Text>}</FormScreen>, headerHeight));

    const outer = screen.getByText('Footer').parent!.parent!;
    expect(StyleSheet.flatten(outer.props.style)).toMatchObject({ paddingTop: padding });
  });

  it.each([
    ['no header', 0, 24 + STATUS_BAR],
    ['a header', 56, 24],
  ])('Screen with %s', async (_, headerHeight, padding) => {
    await render(phone(<Screen>{<Text>Message</Text>}</Screen>, headerHeight));

    expect(paddingTopAbove('Message')).toBe(padding);
  });
});
