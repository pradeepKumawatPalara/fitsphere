import { Check, ChevronDown, Lightbulb } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

/** What the tips say (the owner's redesign of Log meal, 2026-11-18). */
export const MEAL_TIPS = {
  title: 'Tips for better results',
  summary: 'Amount, raw or cooked, one food at a time',
  practices: [
    { text: 'Say the amount, in grams' },
    { text: 'Say raw or cooked', note: 'Rice weighs about 3× more once cooked' },
    { text: 'Name each food on its own' },
  ],
  examples: [
    { tone: 'best', label: 'Best', text: '150 g raw chicken, 200 g cooked rice, 40 g raw moong dal cooked in 5 g oil' },
    { tone: 'vague', label: 'Vague', text: 'chicken wrap' },
    { tone: 'say', label: 'Say', text: '1 whole wheat wrap (60 g), 100 g cooked chicken, 30 g onion, 1 tsp oil' },
  ],
} as const;

// "Tips for better results" (the owner's option A, 2026-11-18): a banner on the caramel tint, as the app's
// other banners, folded at first (the owner, 2026-11-18) and opened on the three tips with a tap; inside it, Examples are
// folded until Show. "Best" and "Say" in green, "Vague" in red with its words struck through.
export function MealTips() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const toneColor = { best: colors.success, say: colors.success, vague: colors.danger };
  return (
    <View style={styles.banner}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide tips for better results' : 'Show tips for better results'}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <View style={styles.tile}>
          <Lightbulb size={22} color={colors.accent} />
        </View>
        <View style={styles.headWords}>
          <Text style={styles.title}>{MEAL_TIPS.title}</Text>
          <Text style={styles.summary}>{MEAL_TIPS.summary}</Text>
        </View>
        <ChevronDown size={20} strokeWidth={2.25} color={colors.accent} style={open ? styles.flipped : undefined} />
      </Pressable>
      {open ? (
        <View style={styles.body}>
          {MEAL_TIPS.practices.map((tip) => (
            <View key={tip.text} style={styles.practice}>
              <View style={styles.tick}>
                <Check size={16} strokeWidth={2.5} color={colors.success} />
              </View>
              <View style={styles.practiceWords}>
                <Text style={styles.practiceText}>{tip.text}</Text>
                {'note' in tip ? <Text style={styles.note}>{tip.note}</Text> : null}
              </View>
            </View>
          ))}
          <View style={styles.rule} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={examplesOpen ? 'Hide examples' : 'Show examples'}
            accessibilityState={{ expanded: examplesOpen }}
            onPress={() => setExamplesOpen((value) => !value)}
            style={({ pressed }) => [styles.examplesHead, pressed && styles.pressed]}
          >
            <Text accessibilityRole="header" style={styles.examplesTitle}>
              Examples
            </Text>
            <View style={styles.toggle}>
              <Text style={styles.toggleText}>{examplesOpen ? 'Hide' : 'Show'}</Text>
              <ChevronDown size={16} strokeWidth={2.5} color={colors.inkMuted} style={examplesOpen ? styles.flipped : undefined} />
            </View>
          </Pressable>
          {examplesOpen
            ? MEAL_TIPS.examples.map((example) => (
                <Text key={example.label} style={styles.example}>
                  <Text style={[styles.exampleLabel, { color: toneColor[example.tone] }]}>{`● ${example.label}  `}</Text>
                  <Text style={example.tone === 'vague' ? styles.struck : undefined}>{example.text}</Text>
                </Text>
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  banner: { borderRadius: 4, backgroundColor: c.accentTint, overflow: 'hidden' },
  head: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  tile: { width: 40, height: 40, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
  headWords: { flex: 1, minWidth: 0 },
  title: { ...TYPE.buttonSecondary, fontSize: 17, letterSpacing: 1, color: c.ink },
  summary: { ...TYPE.small, color: c.inkMuted },
  pressed: { opacity: 0.6 },
  flipped: { transform: [{ rotate: '180deg' }] },
  body: { gap: 10, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
  practice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tick: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.successTint },
  practiceWords: { flex: 1, gap: 2 },
  practiceText: { ...TYPE.input, fontSize: 16, lineHeight: 22, color: c.ink },
  note: { ...TYPE.small, color: c.inkMuted },
  rule: { height: 1, marginVertical: 2, backgroundColor: c.border },
  examplesHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  examplesTitle: { ...TYPE.link, fontSize: 15, color: c.ink },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toggleText: { ...TYPE.link, color: c.inkMuted },
  example: { ...TYPE.small, color: c.ink },
  exampleLabel: { fontFamily: 'Barlow_700Bold' },
  struck: { textDecorationLine: 'line-through', color: c.inkMuted },
}));
