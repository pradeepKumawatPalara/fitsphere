import { MY_FOOD_NAME_MAX, MY_FOOD_NAME_MIN } from '@fitsphere/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { useFieldChecks } from '../fieldChecks';
import { GRAMS_RULE, parseGrams, parseOwnValue } from '../mealItems';
import { MEAL_ITEM_GRAMS_MAX } from '@fitsphere/shared';
import { formatKcal } from '../meals';
import { gramsPerUnit, photoItemOf, unitWordFor, type PhotoFood } from '../photoMeal';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { Sheet } from './Sheet';
import { Banner, Field, Problem, Text, TextButton, TextInput, useFieldLabelStyle } from './ui';

// "Check the estimate" for a food read from a photo (D-120, ADR-0012; the canvas's PhotoEstimate, "3 ·
// Check the estimate", locked 2026-11-20): the name, the weight of the portion in grams and the values
// per 100 g, all as the AI estimated them and all editable; "This portion" shows the kcal for the weight.
// Done keeps the changes for the review's list; nothing is added to the meal from here.

const VALUES = [
  { key: 'kcal', label: 'Calories', unit: 'kcal', nutrient: 'kcal', required: true },
  { key: 'proteinG', label: 'Protein', unit: 'g', nutrient: 'grams', required: true },
  { key: 'carbsG', label: 'Carbs', unit: 'g', nutrient: 'grams', required: true },
  { key: 'fatG', label: 'Fat', unit: 'g', nutrient: 'grams', required: true },
  { key: 'fibreG', label: 'Fibre', unit: 'g', nutrient: 'grams', required: false },
] as const;
type Key = (typeof VALUES)[number]['key'];

const textOf = (value: number | null) => (value === null ? '' : String(value));

/** A quantity typed: more than 0, two decimals at most (as a food's page, D-102); null when it is not one. */
export function parseQuantity(text: string): number | null {
  const trimmed = text.trim();
  if (!/^(\d+\.?\d{0,2}|\.\d{1,2})$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 && value <= 10_000 ? value : null;
}
const QUANTITY_RULE = 'Enter a quantity above 0, with at most two decimals.';
const round2 = (value: number) => Math.round(value * 100) / 100;

/** `source`: what the AI read, for the words ("from your photo", "from what you said"). */
export function PhotoFoodSheet({
  food,
  onDone,
  onBack,
  source = 'photo',
}: {
  food: PhotoFood;
  onDone(food: PhotoFood): void;
  onBack(): void;
  source?: 'photo' | 'voice';
}) {
  const styles = useStyles();
  const labelStyle = useFieldLabelStyle();
  const [name, setName] = useState(food.name);
  const [gramsText, setGramsText] = useState(String(food.grams));
  const [quantityText, setQuantityText] = useState(String(food.quantity));
  // The weight of one of the unit, from the AI's estimate: the Quantity box and the amount follow each other.
  const [perUnit] = useState(() => gramsPerUnit(food));
  const [texts, setTexts] = useState<Record<Key, string>>({
    kcal: textOf(food.per100.kcal),
    proteinG: textOf(food.per100.proteinG),
    carbsG: textOf(food.per100.carbsG),
    fatG: textOf(food.per100.fatG),
    fibreG: textOf(food.per100.fibreG),
  });
  const [focused, setFocused] = useState<string | null>(null);

  const grams = parseGrams(gramsText);
  const quantity = parseQuantity(quantityText);

  function changeQuantity(text: string) {
    setQuantityText(text);
    const typed = parseQuantity(text);
    const weight = typed === null ? null : Math.round(perUnit * typed);
    if (weight !== null && weight >= 1 && weight <= MEAL_ITEM_GRAMS_MAX) setGramsText(String(weight));
  }
  function changeGrams(text: string) {
    setGramsText(text);
    const typed = parseGrams(text);
    if (typed !== null) setQuantityText(String(round2(typed / perUnit)));
  }
  const values = Object.fromEntries(
    VALUES.map(({ key, nutrient }) => [key, texts[key].trim() === '' ? 'empty' : (parseOwnValue(texts[key], 'g', nutrient) ?? 'invalid')]),
  ) as Record<Key, number | 'empty' | 'invalid'>;
  const valuesValid = VALUES.every(({ key, required }) => typeof values[key] === 'number' || (!required && values[key] === 'empty'));
  const nameValid = name.trim().length >= MY_FOOD_NAME_MIN && name.trim().length <= MY_FOOD_NAME_MAX;
  const valid = nameValid && grams !== null && quantity !== null && valuesValid;
  // Each problem shows once typing pauses or the field is left (D-99).
  const checks = useFieldChecks({ name, grams: gramsText, quantity: quantityText, ...texts });

  /** The food as it stands now; null while something cannot be used. */
  function current(): PhotoFood | null {
    if (!valid || grams === null) return null;
    const number = (key: Key) => (typeof values[key] === 'number' ? values[key] : null);
    const per100 = { kcal: number('kcal')!, proteinG: number('proteinG')!, carbsG: number('carbsG')!, fatG: number('fatG')!, fibreG: number('fibreG') };
    const changed = grams !== food.grams || VALUES.some(({ key }) => per100[key] !== food.per100[key]);
    // The list's line follows the quantity once it is changed ("3 pieces"); untouched, it keeps what the AI said.
    const typed = quantity ?? food.quantity;
    const seen = typed === food.quantity ? food.seen : `${typed} ${unitWordFor(food.unit, typed)}`;
    return { ...food, name: name.trim(), grams, per100, quantity: typed, seen, edited: food.edited || changed };
  }
  const now = current();
  const portion = now ? photoItemOf(now).kcal : null;

  const missing = !nameValid
    ? name.trim() === ''
      ? "Enter the food's name."
      : "Check the food's name."
    : quantity === null
      ? QUANTITY_RULE
      : grams === null
      ? GRAMS_RULE
      : !valuesValid
        ? 'Enter calories, protein, carbs and fat per 100 g.'
        : null;

  return (
    <Sheet
      title="Check the estimate"
      onClose={onBack}
      actions={
        <>
          <TextButton title="Done" filled disabled={!now} onPress={() => now && onDone(now)} />
          {missing ? <Text style={styles.hint}>{missing}</Text> : null}
          <TextButton title="Back to the list" outlined wide onPress={onBack} />
        </>
      }
    >
      <Banner
        tone="info"
        text={`Estimated by AI from ${source === 'voice' ? 'what you said' : 'your photo'}. Change anything that looks off, then add it.`}
      />
      <Field
        label="Food name"
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
        error={!nameValid && name.trim() !== '' && checks.shows('name') ? `Enter the food's name in ${MY_FOOD_NAME_MIN} to ${MY_FOOD_NAME_MAX} characters.` : null}
        onFocus={() => checks.focus('name')}
        onBlur={() => checks.blur('name')}
      />
      <View style={styles.group}>
        <Text style={labelStyle}>Quantity</Text>
        <View style={[styles.box, focused === 'quantity' && styles.boxFocused, quantity === null && quantityText.trim() !== '' && checks.shows('quantity') && styles.boxRefused]}>
          <TextInput
            accessibilityLabel={`Quantity (${unitWordFor(food.unit, quantity ?? 2)})`}
            value={quantityText}
            onChangeText={changeQuantity}
            onFocus={() => {
              setFocused('quantity');
              checks.focus('quantity');
            }}
            onBlur={() => {
              setFocused(null);
              checks.blur('quantity');
            }}
            keyboardType="decimal-pad"
            style={styles.number}
          />
          <Text style={styles.unit}>{unitWordFor(food.unit, quantity ?? 2)}</Text>
        </View>
        {quantity === null && quantityText.trim() !== '' && checks.shows('quantity') ? <Problem text={QUANTITY_RULE} /> : null}
      </View>
      <View style={styles.group}>
        <Text style={labelStyle}>Amount</Text>
        <View style={[styles.box, focused === 'grams' && styles.boxFocused, grams === null && gramsText.trim() !== '' && checks.shows('grams') && styles.boxRefused]}>
          <TextInput
            accessibilityLabel="Amount (g)"
            value={gramsText}
            onChangeText={changeGrams}
            onFocus={() => {
              setFocused('grams');
              checks.focus('grams');
            }}
            onBlur={() => {
              setFocused(null);
              checks.blur('grams');
            }}
            keyboardType="number-pad"
            style={styles.number}
          />
          <Text style={styles.unit}>g</Text>
        </View>
        {grams === null && gramsText.trim() !== '' && checks.shows('grams') ? (
          <Problem text={GRAMS_RULE} />
        ) : (
          <Text style={styles.help}>
            {food.seen ? `The AI ${source === 'voice' ? 'heard' : 'saw'} about ${food.seen}. ` : `Estimated from ${source === 'voice' ? 'what you said' : 'the photo'}. `}The values below change with the amount.
          </Text>
        )}
      </View>
      <Text style={labelStyle}>Nutrition per 100 g</Text>
      <View style={styles.grid}>
        {VALUES.map(({ key, label, unit, nutrient }) => {
          const refused = values[key] === 'invalid' && checks.shows(key);
          return (
            <View key={key} style={styles.cell}>
              <Text style={labelStyle}>{label}</Text>
              <View style={[styles.box, focused === key && styles.boxFocused, refused && styles.boxRefused]}>
                <TextInput
                  accessibilityLabel={`${label} (${unit} per 100 g)`}
                  value={texts[key]}
                  onChangeText={(text) => setTexts((currentTexts) => ({ ...currentTexts, [key]: text }))}
                  onFocus={() => {
                    setFocused(key);
                    checks.focus(key);
                  }}
                  onBlur={() => {
                    setFocused(null);
                    checks.blur(key);
                  }}
                  keyboardType="decimal-pad"
                  style={styles.number}
                />
                <Text style={styles.unit}>{unit}</Text>
              </View>
              {refused ? <Problem text={`Enter 0 to ${nutrient === 'kcal' ? 900 : 100}, with at most one decimal.`} /> : null}
            </View>
          );
        })}
      </View>
      <View style={styles.portion}>
        <Text style={labelStyle}>This portion</Text>
        <Text accessibilityLiveRegion="polite" style={styles.portionValue}>
          {portion === null ? '–' : formatKcal(portion)}
        </Text>
      </View>
    </Sheet>
  );
}

// Locked boards "3 · Check the estimate" (dark and light): boxes 54 high in the sunken fill, the focused
// one outlined in caramel, the values two to a row, "This portion" on a raised card.
const useStyles = themedStyles((c) => ({
  hint: { ...TYPE.small, color: c.inkMuted, textAlign: 'center' },
  group: { gap: 6 },
  help: { ...TYPE.small, color: c.inkMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: '45%', flexGrow: 1, gap: 6 },
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
  boxFocused: { borderColor: c.accent },
  boxRefused: { borderColor: c.danger },
  number: { ...TYPE.input, flex: 1, paddingVertical: 12, fontVariant: ['tabular-nums'] },
  unit: { ...TYPE.label, fontSize: 14, color: c.inkMuted },
  portion: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  portionValue: { ...TYPE.metric, fontVariant: ['tabular-nums'] },
}));
