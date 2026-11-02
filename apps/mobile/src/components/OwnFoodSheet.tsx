import type { MealItem } from '@fitsphere/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { itemFromLabel, parseGrams, parsePer100g } from '../mealItems';
import { themedStyles } from '../theme';
import { Sheet } from './Sheet';
import { Text, TextButton, TextInput, useFieldInputStyle, useFieldLabelStyle } from './ui';

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
  const fieldInput = useFieldInputStyle();
  const fieldLabel = useFieldLabelStyle();
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
          <TextButton title="Cancel" onPress={onClose} />
        </>
      }
    >
      <Text style={styles.intro}>Type the values from the label, per 100 g.</Text>
      <TextInput accessibilityLabel="Food name" value={name} onChangeText={setName} maxLength={120} style={fieldInput} />
      {FIELDS.map(({ key, label }) => (
        <View key={key} style={styles.field}>
          <Text style={fieldLabel}>{label}</Text>
          <TextInput
            accessibilityLabel={label}
            value={texts[key]}
            onChangeText={(text) => setTexts((current) => ({ ...current, [key]: text }))}
            keyboardType="decimal-pad"
            style={[fieldInput, styles.number]}
          />
          {values[key] === 'invalid' ? <Text style={styles.problem}>Enter a number with at most one decimal.</Text> : null}
        </View>
      ))}
      <View style={styles.field}>
        <Text style={fieldLabel}>Grams eaten</Text>
        <TextInput
          accessibilityLabel="Grams eaten"
          value={gramsText}
          onChangeText={setGramsText}
          keyboardType="number-pad"
          style={[fieldInput, styles.number]}
        />
      </View>
    </Sheet>
  );
}

// Fields as Field: a 13 label, 6 above its input; numbers in fixed-width digits.
const useStyles = themedStyles((c) => ({
  intro: { fontSize: 15, color: c.textMuted },
  field: { gap: 6 },
  number: { fontVariant: ['tabular-nums'] },
  problem: { fontSize: 13, color: c.error },
}));
