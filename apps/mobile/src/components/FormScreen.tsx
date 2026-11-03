import { HeaderHeightContext } from 'expo-router/react-navigation';
import { useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Keyboard, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { themedStyles } from '../theme';
import { StripeCorner } from './StripeCorner';

// A screen with a form (Sign in, Sign up, Forgot password, Reset password, Change password): the
// form scrolls to the field being typed in, and the footer, with the main button, rides above the
// keyboard. The footer's padding clears the phone's navigation bar; with the keyboard up the bar is
// behind it, so the lift takes that padding back and no strip shows above the keyboard.
//
// The screen lifts itself rather than using React Native's KeyboardAvoidingView, which reacts only
// to a keyboard that opens after the screen appears. Sign up opens from Sign in's footer while the
// keyboard is still up; tapping its fields then sends no new event, and its button stayed behind
// the keyboard. Here the keyboard is read when the screen appears too, and the screen's bottom edge
// is measured on screen rather than taken from its place under the header.
//
// A screen with no header (the sign-in screens) has the design's stripe corner at its top right.
export function FormScreen({
  children,
  footer,
  contentStyle,
}: {
  children: ReactNode;
  footer: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  // None outside the app (tests).
  const insets = useContext(SafeAreaInsetsContext);
  const bottom = insets?.bottom ?? 0;
  const headerless = (useContext(HeaderHeightContext) ?? 0) === 0;
  // A screen with no header (the sign-in screens) starts below the phone's status bar.
  const top = headerless ? (insets?.top ?? 0) : 0;
  const frame = useRef<ComponentRef<typeof View>>(null);
  // The keyboard's top edge on screen, or null while it is closed.
  const [keyboardTop, setKeyboardTop] = useState(() => Keyboard.metrics()?.screenY ?? null);
  // The screen's bottom edge on screen, once measured.
  const [screenBottom, setScreenBottom] = useState<number | null>(null);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardTop(event.endCoordinates.screenY);
      measureBottom(frame.current, setScreenBottom);
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardTop(null));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const lift = keyboardTop === null || screenBottom === null ? 0 : Math.max(screenBottom - keyboardTop - bottom, 0);
  return (
    <View
      ref={frame}
      onLayout={() => measureBottom(frame.current, setScreenBottom)}
      style={[styles.screen, { paddingTop: top, paddingBottom: lift }]}
    >
      {headerless ? <StripeCorner /> : null}
      <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: 16 + bottom }]}>{footer}</View>
    </View>
  );
}

function measureBottom(view: ComponentRef<typeof View> | null, onBottom: (bottom: number) => void) {
  view?.measureInWindow((_x, y, _width, height) => onBottom(y + height));
}

// The sign-in screens' gutter, 20 (D-35); 24 between groups, 12 within one and in the footer.
const useStyles = themedStyles((c) => ({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 12, backgroundColor: c.bg },
}));
