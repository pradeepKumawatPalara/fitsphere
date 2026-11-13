import { MY_FOOD_NAME_MAX, MY_FOOD_NAME_MIN, MY_FOOD_UNITS, myFoodValueMax, type MealItem, type MyFoodUnit } from '@fitsphere/shared';
import { Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View, type KeyboardTypeOptions } from 'react-native';
import type { LocalMyFood } from '../local/store';
import { itemFromOwn, ownQuantityRule, parseOwnQuantity, parseOwnValue, type LabelValues } from '../mealItems';
import { formatGrams, formatKcal, OWN_UNIT_NAMES, ownQuantityLabel } from '../meals';
import { useFieldChecks } from '../fieldChecks';
import { useSync } from '../sync/SyncProvider';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { Sheet } from './Sheet';
import { CheckBox, Field, Problem, Text, TextButton, TextInput, useChoiceStyles, useFieldLabelStyle } from './ui';

// "Enter your own food" (REQ-LOG-007; D-39, the owner's addition, 2026-11-04): the food's unit, its
// values from the label per 100 g or 100 ml, or for one of its other unit (a slice, a bowl…), and the
// quantity eaten. Works offline and with AI off. kcal, protein, carbs and fat are required, fibre
// optional (MVP default, D-26). "Save to My foods", ticked at first (MVP default), keeps it to log
// again (REQ-LOG-011). Opened with a My food (`editing`), it changes or deletes that My food.

const FIELDS = [
  { key: 'kcal', name: 'kcal', nutrient: 'kcal', required: true },
  { key: 'proteinG', name: 'Protein', nutrient: 'grams', required: true },
  { key: 'carbsG', name: 'Carbs', nutrient: 'grams', required: true },
  { key: 'fatG', name: 'Fat', nutrient: 'grams', required: true },
  { key: 'fibreG', name: 'Fibre', nutrient: 'grams', required: false },
] as const;

type Key = (typeof FIELDS)[number]['key'];

/** "per 100 g", "per 100 ml" or "per slice". */
function perText(unit: MyFoodUnit): string {
  return unit === 'g' ? 'per 100 g' : unit === 'ml' ? 'per 100 ml' : `per ${OWN_UNIT_NAMES[unit].one}`;
}

/** The value's label, e.g. "kcal per slice", "Protein per 100 g (g)", "Fibre per slice (g, optional)". */
function fieldLabel(field: (typeof FIELDS)[number], unit: MyFoodUnit): string {
  if (field.key === 'kcal') return `kcal ${perText(unit)}`;
  return `${field.name} ${perText(unit)} (g${field.required ? '' : ', optional'})`;
}

function textOf(value: number | null): string {
  return value === null ? '' : String(value);
}

export function OwnFoodSheet({
  initialName = '',
  editing = null,
  onAdd,
  onClose,
}: {
  initialName?: string;
  /** A My food to change or delete, instead of a food to add. */
  editing?: LocalMyFood | null;
  onAdd?(item: MealItem): void;
  onClose(): void;
}) {
  const styles = useStyles();
  const choice = useChoiceStyles();
  const labelStyle = useFieldLabelStyle();
  const sync = useSync();
  const [name, setName] = useState(editing?.name ?? initialName);
  const [unit, setUnit] = useState<MyFoodUnit>(editing?.unit ?? 'g');
  const [texts, setTexts] = useState<Record<Key, string>>({
    kcal: textOf(editing?.kcal ?? null),
    proteinG: textOf(editing?.proteinG ?? null),
    carbsG: textOf(editing?.carbsG ?? null),
    fatG: textOf(editing?.fatG ?? null),
    fibreG: textOf(editing?.fibreG ?? null),
  });
  const [quantityText, setQuantityText] = useState('');
  const [keep, setKeep] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const values = Object.fromEntries(
    FIELDS.map(({ key, nutrient }) => [
      key,
      texts[key].trim() === '' ? 'empty' : (parseOwnValue(texts[key], unit, nutrient) ?? 'invalid'),
    ]),
  ) as Record<Key, number | 'empty' | 'invalid'>;
  const quantity = parseOwnQuantity(quantityText, unit);
  const valuesValid = FIELDS.every(({ key, required }) => typeof values[key] === 'number' || (!required && values[key] === 'empty'));
  const nameValid = name.trim().length >= MY_FOOD_NAME_MIN && name.trim().length <= MY_FOOD_NAME_MAX;
  // Each problem shows once typing pauses or the field is left (D-99).
  const checks = useFieldChecks({ name, quantity: quantityText, ...texts });
  const nameProblem = !nameValid && name.trim() !== '' && checks.shows('name') ? `Enter the food's name in ${MY_FOOD_NAME_MIN} to ${MY_FOOD_NAME_MAX} characters.` : null;
  const valid = nameValid && valuesValid && (editing !== null || quantity !== null);

  // Why the main button waits, when no field says so already.
  const missing = !nameValid
    ? name.trim() === ''
      ? "Enter the food's name."
      : "Check the food's name."
    : FIELDS.some(({ key, required }) => required && values[key] === 'empty')
      ? `Enter kcal, protein, carbs and fat to ${editing ? 'save' : 'add'}.`
      : editing === null && quantityText.trim() === ''
        ? ownQuantityRule(unit)
        : null;

  function food(): { name: string; unit: MyFoodUnit } & LabelValues {
    const number = (key: Key) => (typeof values[key] === 'number' ? values[key] : null);
    return { name: name.trim(), unit, kcal: number('kcal')!, proteinG: number('proteinG')!, carbsG: number('carbsG')!, fatG: number('fatG')!, fibreG: number('fibreG') };
  }

  async function add() {
    if (!valid || quantity === null) return;
    const id = keep ? sync.newId() : null;
    if (id) await sync.save('myFood', { id, ...food() });
    onAdd?.(itemFromOwn(food(), quantity, id));
    onClose();
  }

  async function save() {
    if (!valid || !editing) return;
    await sync.save('myFood', { id: editing.id, ...food() });
    onClose();
  }

  async function remove() {
    if (!editing) return;
    await sync.remove('myFood', editing.id);
    onClose();
  }

  if (editing && deleting) {
    return (
      <Sheet title="Delete My food" onClose={onClose}>
        <Text style={styles.body}>Delete {editing.name} from My foods? Meals you've already logged keep it.</Text>
        <View style={styles.actions}>
          <View style={styles.half}>
            <TextButton title="Keep it" outlined wide onPress={() => setDeleting(false)} />
          </View>
          <View style={styles.half}>
            <TextButton title="Delete" outlined wide destructive onPress={() => void remove()} />
          </View>
        </View>
      </Sheet>
    );
  }

  const preview = editing === null && valid && quantity !== null ? itemFromOwn(food(), quantity, null) : null;
  return (
    <Sheet
      title={editing ? 'Edit My food' : 'Enter your own food'}
      onClose={onClose}
      actions={
        <>
          <TextButton title={editing ? 'Save' : 'Add'} filled disabled={!valid} onPress={() => void (editing ? save() : add())} />
          {missing ? <Text style={styles.hint}>{missing}</Text> : null}
          {editing ? <TextButton title="Delete from My foods" icon={Trash} destructive wide onPress={() => setDeleting(true)} /> : null}
          <TextButton title="Cancel" wide onPress={onClose} />
        </>
      }
    >
      <Field
        label="Food name"
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
        error={nameProblem}
        onFocus={() => checks.focus('name')}
        onBlur={() => checks.blur('name')}
      />
      <View style={styles.group}>
        <Text style={labelStyle}>Unit</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Unit" style={styles.units}>
          {MY_FOOD_UNITS.map((key) => {
            const checked = key === unit;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={`Unit: ${OWN_UNIT_NAMES[key].label}`}
                accessibilityState={{ checked }}
                onPress={() => setUnit(key)}
                style={({ pressed }) => [choice.choice, styles.unitChoice, checked && choice.chosen, pressed && choice.pressed]}
              >
                <Text style={[choice.choiceText, styles.unitChoiceText, checked && choice.chosenText]}>{OWN_UNIT_NAMES[key].label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text style={styles.intro}>
        {unit === 'g' || unit === 'ml' ? `Type the values from the label, ${perText(unit)}.` : `Type the values for one ${OWN_UNIT_NAMES[unit].one}.`}
      </Text>
      <View style={styles.panel}>
        {FIELDS.map((field, index) => (
          <ValueRow
            key={field.key}
            label={fieldLabel(field, unit)}
            value={texts[field.key]}
            onChangeText={(text) => setTexts((current) => ({ ...current, [field.key]: text }))}
            keyboardType="decimal-pad"
            problem={
              values[field.key] === 'invalid' && checks.shows(field.key)
                ? `Enter 0 to ${myFoodValueMax(unit, field.nutrient).toLocaleString('en-US')}, with at most one decimal.`
                : null
            }
            onFocus={() => checks.focus(field.key)}
            onBlur={() => checks.blur(field.key)}
            ruled={index > 0}
          />
        ))}
      </View>
      {editing === null ? (
        <>
          <ValueRow
            label={ownQuantityLabel(unit)}
            value={quantityText}
            onChangeText={setQuantityText}
            keyboardType={unit === 'g' || unit === 'ml' ? 'number-pad' : 'decimal-pad'}
            problem={quantityText.trim() !== '' && quantity === null && checks.shows('quantity') ? ownQuantityRule(unit) : null}
            onFocus={() => checks.focus('quantity')}
            onBlur={() => checks.blur('quantity')}
            unit={unit === 'g' || unit === 'ml' ? unit : OWN_UNIT_NAMES[unit].many}
          />
          {preview ? (
            <Text accessibilityLabel={`Adds ${formatKcal(preview.kcal)} and ${formatGrams(preview.proteinG)} protein`} style={styles.preview}>
              = {formatKcal(preview.kcal)} · {formatGrams(preview.proteinG)} protein
            </Text>
          ) : null}
          <View style={styles.keep}>
            <CheckBox label="Save to My foods" checked={keep} onChange={setKeep} />
            <Text style={styles.keepHint}>Next time, find it in Search foods.</Text>
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

/**
 * One value: its label at the left, the number in a box at the right in condensed figures, focused in
 * caramel and red with its problem under it when it can't be used. With a `unit`, the box is larger
 * and shows it (the quantity eaten).
 */
function ValueRow({
  label,
  value,
  onChangeText,
  keyboardType,
  problem,
  unit,
  ruled = false,
  onFocus,
  onBlur,
}: {
  label: string;
  value: string;
  onChangeText(text: string): void;
  keyboardType: KeyboardTypeOptions;
  problem: string | null;
  unit?: string;
  ruled?: boolean;
  onFocus(): void;
  onBlur(): void;
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
            onFocus={() => {
              setFocused(true);
              onFocus();
            }}
            onBlur={() => {
              setFocused(false);
              onBlur();
            }}
            style={[styles.value, unit ? styles.valueLarge : null]}
          />
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </View>
      </View>
      {problem ? <Problem text={problem} /> : null}
    </View>
  );
}

// The redesign's 3.8 (locked by the owner, 2026-11-03; the unit, quantity and My foods locked
// 2026-11-04): the unit as choice blocks that wrap; the values as ruled rows on a raised card, each
// label at the left and its number at the right; the quantity below in a larger box with its unit;
// then "Save to My foods". Deleting a My food asks first, keeping it on the left.
const useStyles = themedStyles((c) => ({
  intro: { fontSize: 15, lineHeight: 22, color: c.inkMuted },
  body: { fontSize: 16, lineHeight: 24 },
  hint: { fontSize: 14, lineHeight: 20, color: c.inkMuted, textAlign: 'center' },
  group: { gap: 8 },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unitChoice: { paddingHorizontal: 12 },
  unitChoiceText: { fontSize: 15, letterSpacing: 0.5 },
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
  boxLarge: { width: 170, minHeight: 60, paddingHorizontal: 14 },
  focused: { borderColor: c.accent },
  refused: { borderColor: c.danger },
  value: { ...TYPE.metric, flex: 1, paddingVertical: 8, textAlign: 'right' },
  valueLarge: { fontSize: 30, lineHeight: 34 },
  unit: { ...TYPE.label, fontSize: 16, lineHeight: 20, letterSpacing: 1, color: c.inkMuted },
  preview: { ...TYPE.metric },
  keep: { gap: 2 },
  keepHint: { ...TYPE.small, color: c.inkMuted, marginLeft: 34 },
  actions: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
}));
