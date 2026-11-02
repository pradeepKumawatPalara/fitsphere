import { useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { themedStyles } from '../theme';

// A screen with a form (Sign in, Sign up, Forgot password, Reset password, Change password): the
// form scrolls to the field being typed in, and the footer, with the main button, rides above the
// keyboard. The footer's padding clears the phone's navigation bar; with the keyboard up the bar is
// behind it, so the offset takes that padding back and no strip shows above the keyboard.
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
  const bottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={-bottom} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: 16 + bottom }]}>{footer}</View>
    </KeyboardAvoidingView>
  );
}

// 24 between groups, 12 within one, 8 in the footer.
const useStyles = themedStyles((c) => ({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 12 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: c.background,
  },
}));
