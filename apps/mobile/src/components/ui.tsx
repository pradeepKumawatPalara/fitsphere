import { HeaderHeightContext } from 'expo-router/react-navigation';
import { ArrowRight, Check, CircleAlert, CircleCheck, Eye, EyeOff, Info, WifiOff, type LucideIcon } from 'lucide-react-native';
import { Children, createContext, isValidElement, useContext, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { themedStyles, useTheme } from '../theme';
import { barlowFor, TYPE } from '../typography';

// Text and fields in the theme's colours and the design's fonts (REQ-ACC-001, D-35). React Native's
// own text is black whatever the theme, so every screen takes Text and TextInput from here (a guard
// test checks it). A colour in a Text's `style` still wins.

/** True inside a Text: a nested Text keeps its parent's font unless its own style gives a weight. */
const InText = createContext(false);

export function Text({ style, children, ...props }: TextProps) {
  const { colors } = useTheme();
  const nested = useContext(InText);
  // Only a Text that holds another tells it so; plain text is passed as it is.
  const holdsText = Children.toArray(children).some(isValidElement);
  return (
    <NativeText {...props} style={[{ color: colors.ink }, style, fontFor(style, nested)]}>
      {holdsText ? <InText.Provider value>{children}</InText.Provider> : children}
    </NativeText>
  );
}

/**
 * The font file for a style: one a type style names (typography.ts) stays; otherwise Barlow's file
 * for the weight, or the parent's font for a nested Text that gives no weight. The weight itself is
 * then dropped, as Android would draw the file heavier still.
 */
function fontFor(style: StyleProp<TextStyle>, nested: boolean): TextStyle | undefined {
  const { fontFamily, fontWeight } = StyleSheet.flatten(style) ?? {};
  if (fontFamily || (nested && fontWeight === undefined)) return undefined;
  return { fontFamily: barlowFor(fontWeight), fontWeight: 'normal' };
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
      placeholderTextColor={colors.inkMuted}
      cursorColor={colors.accent}
      selectionHandleColor={colors.accent}
      selectionColor={colors.accentTint}
      style={[style, fontFor(style, false), { color: colors.ink }]}
    />
  );
}

export function Screen({ children }: { children: ReactNode }) {
  const styles = useStyles();
  // With no header (Check email, Verified, Account setup), below the phone's status bar too.
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const statusBar = useContext(SafeAreaInsetsContext)?.top ?? 0;
  const top = headerHeight > 0 ? 0 : statusBar;
  return <View style={[styles.screen, { paddingTop: 24 + top }]}>{children}</View>;
}

/**
 * A field (D-35): its label above in capitals, the value in a sunken box whose outline turns caramel
 * while typing, and a problem with the value under it, the outline red. A password field has a
 * button to show or hide what is typed. A `rule` the value must meet shows under it, a dot until it
 * is met and then a tick; when the `error` is the rule itself, the rule shows as the problem.
 */
export function Field({
  label,
  error,
  rule,
  secureTextEntry,
  onFocus,
  onBlur,
  style,
  ...input
}: { label: string; error?: string | null; rule?: { text: string; met: boolean } } & TextInputProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const hidden = secureTextEntry === true && !shown;
  const ShowHide = shown ? EyeOff : Eye;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.fieldBox, focused && styles.fieldBoxFocused, error ? styles.fieldBoxError : null]}>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          secureTextEntry={hidden}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...input}
          style={[styles.value, hidden && styles.hidden, style]}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
            onPress={() => setShown(!shown)}
            style={({ pressed }) => [styles.showHide, pressed && styles.pressed]}
          >
            <ShowHide size={22} color={colors.inkMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Problem text={error} /> : null}
      {rule && error !== rule.text ? <Rule text={rule.text} met={rule.met} /> : null}
    </View>
  );
}

/** A problem with a field's value, under it, read out as soon as it shows. */
/** Under a button greyed while a field has a problem (D-99): what to fix, centred, in the muted ink. */
export function ButtonHint({ text }: { text: string }) {
  const styles = useStyles();
  return <Text style={styles.buttonHint}>{text}</Text>;
}

export function Problem({ text }: { text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.underField}>
      <CircleAlert size={16} color={colors.danger} />
      <Text accessibilityRole="alert" style={styles.problemText}>
        {text}
      </Text>
    </View>
  );
}

/**
 * A rule for a field's value: a dot until it is met, then a green tick. The text stays muted, as the
 * light theme's green is under 4.5:1 for text this small; screen readers hear "Done." once it is met.
 */
function Rule({ text, met }: { text: string; met: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.underField}>
      {met ? (
        <Check size={16} strokeWidth={2.5} color={colors.success} />
      ) : (
        <View style={styles.ruleDotSlot}>
          <View style={styles.ruleDot} />
        </View>
      )}
      <Text accessibilityLabel={met ? `${text} Done.` : text} style={styles.ruleText}>
        {text}
      </Text>
    </View>
  );
}

/** Field's box as one input (54 tall, radius 4, a 1.5 outline, text 17), for a field with its own label. */
export function useFieldInputStyle() {
  return useStyles().input;
}

/** Field's label style (condensed capitals, muted), for a field laid out on its own. */
export function useFieldLabelStyle() {
  return useStyles().label;
}

/** A box to tick (D-35): square, 22, filled caramel with a dark tick once ticked. */
export function CheckBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Check size={16} strokeWidth={3} color={colors.onPrimary} /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * A choice among a few as a square block, the one spec for them all (meal slots, cm/in, Settings'
 * choices, Nutrition's tabs, the weight chart's range; D-35, with 2.5): 40 tall, radius 4, an outline
 * in the subtle ink, the chosen one filled caramel; the label in condensed capitals.
 */
export function useChoiceStyles() {
  const { choice, chosen, choiceText, chosenText, pressed } = useStyles();
  return { choice, chosen, choiceText, chosenText, pressed };
}

/**
 * An action (D-35), its title in condensed capitals. `filled` for the screen's main action: 56 tall,
 * caramel, with an arrow after the title when `arrow`; `busy` swaps the title for a spinner at the
 * same width. `outlined` for a secondary action; plain for a link, in caramel, at the right with
 * `end`. `strong` fills an outlined action caramel, at the outlined size, so it stands out among the
 * card's (Home's "Add measurements" when they are due, D-85). `destructive` (Log out, Delete) turns it red; such an action is outlined or a link, never
 * filled. `wide` makes it full width and centred: Cancel under a main action, and each half of a
 * confirmation. An `icon` goes before the title, in caramel (on a filled button, in the button's
 * text colour). Disabled, it fades and cannot be pressed.
 */
export function TextButton({
  title,
  onPress,
  outlined = false,
  filled = false,
  strong = false,
  destructive = false,
  wide = false,
  arrow = false,
  busy = false,
  end = false,
  icon: Icon,
  disabled,
}: {
  title: string;
  onPress(): void;
  outlined?: boolean;
  filled?: boolean;
  strong?: boolean;
  destructive?: boolean;
  wide?: boolean;
  arrow?: boolean;
  busy?: boolean;
  end?: boolean;
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        filled ? styles.filled : outlined ? styles.outlined : styles.link,
        strong && styles.strong,
        wide && styles.wide,
        end && styles.end,
        destructive && styles.destructiveEdge,
        pressed && (filled || strong ? styles.filledPressed : styles.pressed),
        disabled && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <>
          {Icon ? <Icon size={filled ? 22 : 18} strokeWidth={2.25} color={filled || strong ? colors.onPrimary : destructive ? colors.danger : colors.accent} /> : null}
          <Text
            style={[
              filled ? styles.filledText : outlined ? styles.outlinedText : styles.linkText,
              strong && styles.strongText,
              wide && styles.wideText,
              destructive && styles.destructiveText,
            ]}
          >
            {title}
          </Text>
          {arrow ? (
            <ArrowRight
              size={filled ? 22 : 18}
              strokeWidth={2.25}
              color={filled || strong ? colors.onPrimary : destructive ? colors.danger : outlined ? colors.ink : colors.accent}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/** A small icon that acts (edit, delete), 40 wide and 44 tall to tap; read out by its label. */
export function IconButton({ label, onPress, children }: { label: string; onPress(): void; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

/**
 * A banner (D-35): an icon and a short text on a quiet fill. `info` in caramel; `error` on a red tint
 * with a red edge; `success` (a step that is done, as a changed password) on a green tint with a green
 * edge. Read out as soon as it shows.
 */
export function Banner({ text, tone, icon }: { text: string; tone: 'info' | 'error' | 'success'; icon?: LucideIcon }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const Icon = icon ?? (tone === 'error' ? CircleAlert : tone === 'success' ? CircleCheck : Info);
  const look = { info: [styles.bannerInfo, colors.accent], error: [styles.bannerError, colors.danger], success: [styles.bannerSuccess, colors.success] } as const;
  const [fill, iconColor] = look[tone];
  return (
    <View style={[styles.banner, fill]}>
      <Icon size={20} color={iconColor} />
      <Text accessibilityRole="alert" style={styles.bannerText}>
        {text}
      </Text>
    </View>
  );
}

/** What went wrong, as an error banner; `offline` when the step needs an internet connection. */
export function Message({ text, offline = false }: { text: string | null; offline?: boolean }) {
  return text ? <Banner tone="error" text={text} icon={offline ? WifiOff : undefined} /> : null;
}

const useStyles = themedStyles((c) => ({
  buttonHint: { ...TYPE.small, color: c.inkMuted, textAlign: 'center' },
  // A message and its next step, centred (Check email, Verified, Account setup, a reset link that
  // failed); 24 between them.
  screen: { flex: 1, padding: 24, gap: 24, justifyContent: 'center' },
  field: { gap: 8 },
  label: { ...TYPE.label, color: c.inkMuted },
  // The outline is the subtle ink, not the border colour, so a field's edge stays 3:1 on its ground.
  fieldBox: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.inkSubtle,
    backgroundColor: c.surfaceSunken,
  },
  fieldBoxFocused: { borderColor: c.accent },
  fieldBoxError: { borderColor: c.danger },
  value: { ...TYPE.input, flex: 1, minHeight: 51, paddingVertical: 12, paddingRight: 14 },
  // The dots of a hidden password, spaced.
  hidden: { letterSpacing: 2 },
  showHide: { width: 44, height: 44, marginRight: 4, alignItems: 'center', justifyContent: 'center' },
  underField: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  problemText: { ...TYPE.small, flexShrink: 1, color: c.danger },
  ruleDotSlot: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  ruleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.inkSubtle },
  ruleText: { ...TYPE.small, flexShrink: 1, color: c.inkMuted },
  input: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: c.inkSubtle,
    borderRadius: 4,
    backgroundColor: c.surfaceSunken,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...TYPE.input,
  },
  checkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Wraps beside the box rather than running off the screen.
  checkLabel: { flexShrink: 1, fontSize: 16, lineHeight: 22 },
  box: { width: 22, height: 22, borderWidth: 1.5, borderColor: c.inkSubtle, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boxChecked: { backgroundColor: c.primary, borderColor: c.primary },
  choice: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.inkSubtle,
  },
  chosen: { backgroundColor: c.primary, borderColor: c.primary },
  choiceText: { ...TYPE.buttonSecondary, fontSize: 16, letterSpacing: 1, color: c.ink },
  chosenText: { color: c.onPrimary },
  filled: {
    alignSelf: 'stretch',
    minHeight: 56,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 4,
    backgroundColor: c.primary,
  },
  filledPressed: { backgroundColor: c.primaryPressed },
  filledText: { ...TYPE.button, color: c.onPrimary },
  outlined: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 4,
  },
  outlinedText: { ...TYPE.buttonSecondary, color: c.ink },
  strong: { backgroundColor: c.primary, borderColor: c.primary },
  strongText: { color: c.onPrimary },
  link: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  linkText: { ...TYPE.link, color: c.accent },
  wide: { alignSelf: 'stretch', minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  wideText: { textAlign: 'center' },
  end: { alignSelf: 'flex-end' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  iconButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  destructiveEdge: { borderColor: c.danger },
  destructiveText: { color: c.danger },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 4 },
  bannerInfo: { backgroundColor: c.accentTint },
  bannerError: { backgroundColor: c.dangerTint, borderWidth: 1, borderColor: c.danger },
  bannerSuccess: { backgroundColor: c.successTint, borderWidth: 1, borderColor: c.success },
  bannerText: { ...TYPE.small, flexShrink: 1, color: c.ink },
}));
