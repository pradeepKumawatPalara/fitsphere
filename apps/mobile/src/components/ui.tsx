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
// in a Text's `style` still wins.

export function Text({ style, ...props }: TextProps) {
  const { colors } = useTheme();
  return <NativeText {...props} style={[{ color: colors.text }, style]} />;
}

/**
 * A field whose typed text, placeholder, cursor and selection always take the theme's colours: they
 * come last, so no caller can replace them. Otherwise Android uses its own theme, which follows the
 * phone, not the app's setting.
 */
export function TextInput({ style, ...props }: TextInputProps) {
  const { colors } = useTheme();
  return (
    <NativeTextInput
      {...props}
      placeholderTextColor={colors.textMuted}
      cursorColor={colors.primary}
      selectionHandleColor={colors.primary}
      selectionColor={colors.surfaceSelected}
      style={[style, { color: colors.text }]}
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
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} autoCapitalize="none" {...input} />
    </View>
  );
}

/** Field's input style (48 tall, radius 12, a 1.5 border, text 16), for a field with its own label. */
export function useFieldInputStyle() {
  return useStyles().input;
}

/** Field's label style (13, semibold, muted), for a field laid out on its own. */
export function useFieldLabelStyle() {
  return useStyles().label;
}

export function CheckBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>{checked ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * A choice among a few as a pill, the one spec for them all (meal slots, cm/in, Settings' choices,
 * Nutrition's tabs, the weight chart's range): 40 tall, a grey outline, the chosen one filled.
 */
export function useChoiceStyles() {
  const { choice, chosen, choiceText, chosenText, pressed } = useStyles();
  return { choice, chosen, choiceText, chosenText, pressed };
}

/**
 * An action in sentence case, in place of React Native's own Button (on Android, a blue bar in
 * capitals). `filled` for the screen's main action, `outlined` for the step to take first; plain for
 * a link to something else. `destructive` (Log out, Delete) turns it the "over" red; such an action
 * is outlined or a link, never filled. `wide` makes it full width and centred, 48 tall: Cancel under
 * a main action, and each half of a confirmation. Disabled, it fades and cannot be pressed.
 */
export function TextButton({
  title,
  onPress,
  outlined = false,
  filled = false,
  destructive = false,
  wide = false,
  disabled,
}: {
  title: string;
  onPress(): void;
  outlined?: boolean;
  filled?: boolean;
  destructive?: boolean;
  wide?: boolean;
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
        wide && styles.wide,
        destructive && styles.destructiveEdge,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.actionText, wide && styles.wideText, destructive && styles.destructiveText, filled && styles.filledText]}>
        {title}
      </Text>
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
  // A message and its next step, centred (Check email, Verified, Account setup, a reset link that
  // failed); 24 between them.
  screen: { flex: 1, padding: 24, gap: 24, justifyContent: 'center' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: c.textMuted },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: c.textFaint,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  checkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Wraps beside the box rather than running off the screen.
  checkLabel: { flexShrink: 1, fontSize: 15 },
  box: { width: 24, height: 24, borderWidth: 2, borderColor: c.textMuted, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boxChecked: { backgroundColor: c.primary, borderColor: c.primary },
  tick: { color: c.onPrimary, fontWeight: '700' },
  message: { fontSize: 15, color: c.error },
  choice: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: c.textFaint,
  },
  chosen: { backgroundColor: c.primary, borderColor: c.primary },
  choiceText: { fontSize: 15 },
  chosenText: { color: c.onPrimary, fontWeight: '600' },
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
  wide: { alignSelf: 'stretch', minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  wideText: { textAlign: 'center' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  actionText: { color: c.primary, fontSize: 15, fontWeight: '600' },
  destructiveEdge: { borderColor: c.over },
  destructiveText: { color: c.over },
  filledText: { color: c.onPrimary },
}));
