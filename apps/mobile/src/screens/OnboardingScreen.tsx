import type { TargetKind } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { FormScreen } from '../components/FormScreen';
import { Problem, Text, TextButton, TextInput, useFieldLabelStyle } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { useFieldChecks } from '../fieldChecks';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { finishOnboarding } from '../onboarding';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { TARGET_GROUPS, targetTexts } from '../targets';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';

// "Set your targets" on a new user's first sign-in (the canvas "First-time goals form", B · Two steps,
// locked by the owner, 2026-11-20): the same eight targets as Your targets, in two steps, Food and
// Activity and body, with Skip on both and Back on the second. Every box may be left empty: that target
// is simply not set (Your targets sets it later); a value typed must be one Your targets would accept.
// Finishing saves the targets typed, exactly as Your targets does (each starts today, D-77), then goes to
// Home. Skip saves nothing. Either way the form is not shown again on this phone (`onboarding.ts`).

const STEPS = [
  { name: 'Food', title: 'Your food targets', intro: 'How much do you want to eat each day? You can change these any time in Your targets.' },
  { name: 'Activity and body', title: 'Activity and body', intro: 'How active do you want to be, and what weight are you aiming for?' },
] as const;

/** Each target's unit beside its box, and an example number shown until one is typed. */
const BOXES: Record<TargetKind, { unit: (bodyWeight: string) => string | null; example: string }> = {
  calories: { unit: () => 'kcal', example: '2000' },
  protein: { unit: () => 'g', example: '120' },
  carbs: { unit: () => 'g', example: '250' },
  fat: { unit: () => 'g', example: '65' },
  fibre: { unit: () => 'g', example: '30' },
  steps: { unit: () => null, example: '8000' },
  weekly_workouts: { unit: () => null, example: '4' },
  body_weight: { unit: (bodyWeight) => bodyWeight, example: '68' },
};

/** The first box of a step is the large one. */
const LARGE: readonly TargetKind[] = ['calories', 'steps', 'weekly_workouts', 'body_weight'];

const EMPTY: Record<TargetKind, string> = {
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  fibre: '',
  steps: '',
  weekly_workouts: '',
  body_weight: '',
};

export function OnboardingScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const labelStyle = useFieldLabelStyle();
  const router = useRouter();
  const local = useLocalDatabase();
  const sync = useSync();
  const unit = useBodyWeightUnit();
  const texts = targetTexts(unit);
  const [step, setStep] = useState<0 | 1>(0);
  const [values, setValues] = useState<Record<TargetKind, string>>(EMPTY);
  const [focused, setFocused] = useState<TargetKind | null>(null);
  const [busy, setBusy] = useState(false);
  // Each problem shows once typing pauses or the box is left (D-99).
  const checks = useFieldChecks(values);

  const kinds = TARGET_GROUPS[step]!.kinds;
  const invalid = (kind: TargetKind) => values[kind].trim() !== '' && texts[kind].parse(values[kind]) === null;
  const stepInvalid = kinds.some(invalid);

  async function leave(save: boolean) {
    setBusy(true);
    if (save) {
      for (const kind of TARGET_GROUPS.flatMap((group) => group.kinds)) {
        const value = values[kind].trim() === '' ? null : texts[kind].parse(values[kind]);
        if (value !== null) await sync.save('target', { kind, value });
      }
    }
    if (local.state.status === 'ready') await finishOnboarding(local.state.db);
    setBusy(false);
    router.replace('/home');
  }

  const info = STEPS[step];
  return (
    <FormScreen
      contentStyle={styles.content}
      footer={
        <>
          {stepInvalid ? <Text style={styles.hint}>Check the values marked in red.</Text> : null}
          {step === 0 ? (
            <TextButton title="Next" filled arrow disabled={stepInvalid} onPress={() => setStep(1)} />
          ) : (
            <TextButton title="Save and finish" filled busy={busy} disabled={stepInvalid} onPress={() => void leave(true)} />
          )}
          <Text style={styles.hint}>Step {step + 1} of 2 · leave a box empty to set it later</Text>
        </>
      }
    >
      <View style={styles.top}>
        {step === 1 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep(0)} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <ChevronLeft size={24} strokeWidth={2.25} color={colors.accent} />
            <Text style={styles.link}>Back</Text>
          </Pressable>
        ) : (
          <Wordmark />
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="Skip" disabled={busy} onPress={() => void leave(false)} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
          <Text style={styles.link}>Skip</Text>
        </Pressable>
      </View>

      <View accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of 2`} style={styles.progress}>
        <View style={styles.segments}>
          <View style={[styles.segment, styles.segmentOn]} />
          <View style={[styles.segment, step === 1 && styles.segmentOn]} />
        </View>
        <View style={styles.stepNames}>
          <Text style={[styles.stepName, step === 0 && styles.stepNameOn]}>1 · {STEPS[0].name}</Text>
          <Text style={[styles.stepName, step === 1 && styles.stepNameOn]}>2 · {STEPS[1].name}</Text>
        </View>
      </View>

      <Text accessibilityRole="header" style={styles.title}>
        {info.title}
      </Text>
      <Text style={styles.intro}>{info.intro}</Text>

      <View style={styles.fields}>
        {kinds.map((kind, index) => {
          const text = texts[kind];
          const large = LARGE.includes(kind) && (step === 1 || index === 0);
          const suffix = BOXES[kind].unit(unit);
          const refused = invalid(kind) && checks.shows(kind);
          const pair = step === 0 && index > 0;
          return (
            <View key={kind} style={[styles.field, pair && styles.half]}>
              <Text style={labelStyle}>{text.label}</Text>
              <View style={[styles.box, large && styles.boxLarge, focused === kind && styles.boxFocused, refused && styles.boxRefused]}>
                <TextInput
                  accessibilityLabel={`${text.label} in ${text.unit}`}
                  value={values[kind]}
                  onChangeText={(next) => setValues((current) => ({ ...current, [kind]: next }))}
                  onFocus={() => {
                    setFocused(kind);
                    checks.focus(kind);
                  }}
                  onBlur={() => {
                    setFocused((current) => (current === kind ? null : current));
                    checks.blur(kind);
                  }}
                  placeholder={BOXES[kind].example}
                  keyboardType={text.decimal ? 'decimal-pad' : 'number-pad'}
                  style={[styles.number, large && styles.numberLarge]}
                />
                {suffix ? <Text style={styles.unit}>{suffix}</Text> : null}
              </View>
              {refused ? <Problem text={text.rule} /> : null}
            </View>
          );
        })}
      </View>
    </FormScreen>
  );
}

// The locked boards "B · Two steps": the wordmark and Skip over a two-part progress bar, the title in
// display capitals, the first box of each step large, the rest 54 high and two to a row.
const useStyles = themedStyles((c) => ({
  content: { paddingTop: 8, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -8 },
  skip: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  link: { ...TYPE.link, color: c.accent },
  progress: { gap: 8 },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.track },
  segmentOn: { backgroundColor: c.accent },
  stepNames: { flexDirection: 'row', justifyContent: 'space-between' },
  stepName: { ...TYPE.label, color: c.inkSubtle },
  stepNameOn: { color: c.accent },
  title: { ...TYPE.display, marginTop: 10 },
  intro: { fontSize: 15, lineHeight: 21, color: c.inkMuted },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { flexBasis: '100%', gap: 6 },
  half: { flexBasis: '45%', flexGrow: 1 },
  box: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.inkSubtle,
    backgroundColor: c.surfaceSunken,
  },
  boxLarge: { minHeight: 64, paddingHorizontal: 16 },
  boxFocused: { borderColor: c.accent },
  boxRefused: { borderColor: c.danger },
  number: { ...TYPE.input, flex: 1, paddingVertical: 12, fontVariant: ['tabular-nums'] },
  numberLarge: { ...TYPE.metric, fontSize: 32, lineHeight: 36 },
  unit: { ...TYPE.label, fontSize: 14, color: c.inkMuted },
  hint: { ...TYPE.small, color: c.inkMuted, textAlign: 'center' },
}));
