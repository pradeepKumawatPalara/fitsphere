import type { MealItem } from '@fitsphere/shared';
import { useState } from 'react';
import { View, type KeyboardTypeOptions } from 'react-native';
import { GRAMS_RULE, itemFromLabel, parseGrams, parsePer100g } from '../mealItems';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { Sheet } from './Sheet';
import { Field, Problem, Text, TextButton, TextInput, useFieldLabelStyle } from './ui';

// "Enter your own food" (REQ-LOG-007): the values from the label, per 100 g, and the grams eaten.
// Works offline and with AI off; saved with this meal only (MVP default). kcal, protein, carbs and
// fat are required, fibre optional (MVP default, D-26).
const FIELDS = [
  { key: 'kcal', label: 'kcal per 100 g', max: 900, required: true },
  { key: 'proteinG', label: 'Protein per 100 g (g)', max: 100, required: true },
  { key: 'carbsG', label: 'Carbs per 100 g (g)', max: 100, required: true },
  { key: 'fatG', label: 'Fat per 100 g (g)', max: 100, required: true },
  { key: 'fibreG', label: 'Fibre per 100 g (g, optional)', max: 100, required: false },
] as const;

type Key = (typeof FIELDS)[number]['key'];

export function OwnFoodSheet({
  initialName = '',
  onAdd,
  onClose,
}: {
  initialName?: string;
  onAdd(item: MealItem): void;
  onClose(): void;
}) {
  const styles = useStyles();
  const [name, setName] = useState(initialName);
  const [texts, setTexts] = useState<Record<Key, string>>({ kcal: '', proteinG: '', carbsG: '', fatG: '', fibreG: '' });
  const [gramsText, setGramsText] = useState('');

  const values = Object.fromEntries(
    FIELDS.map(({ key, max }) => [key, texts[key].trim() === '' ? 'empty' : (parsePer100g(texts[key], max) ?? 'invalid')]),
  ) as Record<Key, number | 'empty' | 'invalid'>;
  const grams = parseGrams(gramsText);
  const valid =
    name.trim().length > 0 &&
    name.trim().length <= 120 &&
    grams !== null &&
    FIELDS.every(({ key, required }) => typeof values[key] === 'number' || (!required && values[key] === 'empty'));

  // Why Add waits, when no field says so already.
  const missing =
    name.trim() === ''
      ? "Enter the food's name."
      : FIELDS.some(({ key, required }) => required && values[key] === 'empty')
        ? 'Enter kcal, protein, carbs and fat to add.'
        : gramsText.trim() === ''
          ? GRAMS_RULE
          : null;

  function add() {
    if (!valid || grams === null) return;
    const number = (key: Key) => (typeof values[key] === 'number' ? (values[key] as number) : null);
    onAdd(
      itemFromLabel(
        name,
        { kcal: number('kcal')!, proteinG: number('proteinG')!, carbsG: number('carbsG')!, fatG: number('fatG')!, fibreG: number('fibreG') },
        grams,
      ),
    );
    onClose();
  }

  return (
    <Sheet
      title="Enter your own food"
      onClose={onClose}
      actions={
        <>
          <TextButton title="Add" filled disabled={!valid} onPress={add} />
          {missing ? <Text style={styles.hint}>{missing}</Text> : null}
          <TextButton title="Cancel" wide onPress={onClose} />
        </>
      }
    >
      <Text style={styles.intro}>Type the values from the label, per 100 g.</Text>
      <Field label="Food name" value={name} onChangeText={setName} maxLength={120} autoCapitalize="sentences" />
      <View style={styles.panel}>
        {FIELDS.map(({ key, label, max }, index) => (
          <ValueRow
            key={key}
            label={label}
            value={texts[key]}
            onChangeText={(text) => setTexts((current) => ({ ...current, [key]: text }))}
            keyboardType="decimal-pad"
            problem={values[key] === 'invalid' ? `Enter 0 to ${max}, with at most one decimal.` : null}
            ruled={index > 0}
          />
        ))}
      </View>
      <ValueRow
        label="Grams eaten"
        value={gramsText}
        onChangeText={setGramsText}
        keyboardType="number-pad"
        problem={gramsText.trim() !== '' && grams === null ? GRAMS_RULE : null}
        unit="g"
      />
    </Sheet>
  );
}

/**
 * One value: its label at the left, the number in a box at the right in condensed figures, focused in
 * caramel and red with its problem under it when it can't be used. With a `unit`, the box is larger
 * and shows it (the grams eaten).
 */
function ValueRow({
  label,
  value,
  onChangeText,
  keyboardType,
  problem,
  unit,
  ruled = false,
}: {
  label: string;
  value: string;
  onChangeText(text: string): void;
  keyboardType: KeyboardTypeOptions;
  problem: string | null;
  unit?: string;
  ruled?: boolean;
}) {
  const styles = useStyles();
  const fieldLabel = useFieldLabelStyle();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.row, unit ? styles.rowOwn : styles.rowInPanel, ruled && styles.ruled]}>
      <View style={styles.line}>
        <Text style={[fieldLabel, styles.label]}>{label}</Text>
        <View style={[styles.box, unit ? styles.boxLarge : null, focused && styles.focused, problem ? styles.refused : null]}>
          <TextInput
            accessibilityLabel={label}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.value, unit ? styles.valueLarge : null]}
          />
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </View>
      </View>
      {problem ? <Problem text={problem} /> : null}
    </View>
  );
}

// The redesign's 3.8 (locked by the owner, 2026-11-03): the values per 100 g as ruled rows on a raised
// card, each label at the left and its number at the right; the grams eaten below in a larger box.
const useStyles = themedStyles((c) => ({
  intro: { fontSize: 15, lineHeight: 22, color: c.inkMuted },
  hint: { fontSize: 14, lineHeight: 20, color: c.inkMuted, textAlign: 'center' },
  panel: { borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised },
  row: { gap: 6 },
  rowInPanel: { paddingVertical: 8, paddingLeft: 14, paddingRight: 8 },
  rowOwn: { paddingTop: 4 },
  ruled: { borderTopWidth: 1, borderTopColor: c.border },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { flex: 1 },
  box: {
    width: 112,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.inkSubtle,
    backgroundColor: c.surfaceSunken,
  },
  boxLarge: { width: 150, minHeight: 60, paddingHorizontal: 14 },
  focused: { borderColor: c.accent },
  refused: { borderColor: c.danger },
  value: { ...TYPE.metric, flex: 1, paddingVertical: 8, textAlign: 'right' },
  valueLarge: { fontSize: 30, lineHeight: 34 },
  unit: { ...TYPE.label, fontSize: 16, lineHeight: 20, letterSpacing: 1, color: c.inkMuted },
}));
