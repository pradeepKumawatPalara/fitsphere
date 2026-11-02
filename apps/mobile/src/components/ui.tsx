import type { ReactNode } from 'react';
import {
  Pressable,
  Text as NativeText,
  TextInput as NativeTextInput,
  View,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { themedStyles, useTheme } from '../theme';

// Text and fields in the theme's colours (REQ-ACC-001). React Native's own text is black whatever
// the theme, so every screen takes Text and TextInput from here (a guard test checks it). A colour
// in `style` still wins.

export function Text({ style, ...props }: TextProps) {
  const { colors } = useTheme();
  return <NativeText {...props} style={[{ color: colors.text }, style]} />;
}

export function TextInput({ style, placeholderTextColor, ...props }: TextInputProps) {
  const { colors } = useTheme();
  return (
    <NativeTextInput
      placeholderTextColor={placeholderTextColor ?? colors.textFaint}
      {...props}
      style={[{ color: colors.text }, style]}
    />
  );
}

export function Screen({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.screen}>{children}</View>;
}

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} autoCapitalize="none" {...input} />
    </View>
  );
}

export function CheckBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>{checked ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text>{label}</Text>
    </Pressable>
  );
}

/**
 * An action in sentence case, in place of React Native's own Button (on Android, a blue bar in
 * capitals). `filled` for the screen's main action, `outlined` for the step to take first; plain for
 * a link to something else. Disabled, it fades and cannot be pressed.
 */
export function TextButton({
  title,
  onPress,
  outlined = false,
  filled = false,
  disabled,
}: {
  title: string;
  onPress(): void;
  outlined?: boolean;
  filled?: boolean;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        filled ? styles.filled : outlined ? styles.outlined : styles.link,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.actionText, filled && styles.filledText]}>{title}</Text>
    </Pressable>
  );
}

export function Message({ text }: { text: string | null }) {
  const styles = useStyles();
  return text ? (
    <Text accessibilityRole="alert" style={styles.message}>
      {text}
    </Text>
  ) : null;
}

const useStyles = themedStyles((c) => ({
  screen: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  field: { gap: 4 },
  input: { borderWidth: 1, borderColor: c.textFaint, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: { width: 24, height: 24, borderWidth: 2, borderColor: c.textMuted, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boxChecked: { backgroundColor: c.primary, borderColor: c.primary },
  tick: { color: c.onPrimary, fontWeight: '700' },
  message: { color: c.error },
  link: { alignSelf: 'flex-start', paddingVertical: 6 },
  outlined: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: c.primary,
    borderRadius: 22,
  },
  filled: {
    alignSelf: 'stretch',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: c.primary,
  },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  actionText: { color: c.primary, fontSize: 15, fontWeight: '600' },
  filledText: { color: c.onPrimary },
}));
