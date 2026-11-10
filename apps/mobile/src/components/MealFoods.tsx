import { MAX_MEAL_ITEMS, type MealItem } from '@fitsphere/shared';
import { CircleAlert, SquarePen } from 'lucide-react-native';
import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listedFoodOf } from '../local/store';
import {
  addAmount,
  amountLimit,
  GRAMS_RULE,
  gramsPerUnitOf,
  ownQuantityRule,
  parseGrams,
  parseOwnQuantity,
  sameFood,
  servingsMax,
  unitsMax,
  withGrams,
  withOwnQuantity,
  withPortions,
  withServings,
  withUnits,
} from '../mealItems';
import {
  formatAmount,
  formatGrams,
  formatKcal,
  formatMeasures,
  formatOwnUnits,
  formatPortions,
  formatServings,
  MEASURE_NAMES,
  OWN_UNIT_NAMES,
  ownQuantityLabel,
} from '../meals';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { FoodDetail, type FoodResult } from './FoodDetail';
import { ActionsSheet, DuplicateFoodSheet } from './MealSheets';
import { PortionStepper } from './PortionStepper';
import { Text, TextInput } from './ui';

// A meal's foods while they are being put together, in Log meal (REQ-LOG-001…003) and in a saved meal
// (REQ-SAVED-003, D-69): adding foods, with "Already in this meal" for a listed food added again
// (D-34), and changing one. A food the phone lists opens its own page on its amount, where any of its
// measures can be chosen (D-64); a food with no page (one typed once, or a barcode product not in the
// list) opens a sheet for its amount, its buttons centred.

/**
 * The foods and what changes them. `items` may also be replaced from outside with `setItems`; adding
 * and changing always work on the list as it is now. `sheets` is rendered by the screen, after its own.
 */
export function useMealFoods(initial: readonly MealItem[] = []): {
  items: MealItem[];
  setItems: Dispatch<SetStateAction<MealItem[]>>;
  addItems(added: MealItem[]): void;
  change(index: number): Promise<void>;
  sheets: ReactNode;
} {
  const local = useLocalDatabase();
  const [items, setItems] = useState<MealItem[]>(() => [...initial]);
  // Foods being added that the meal already has, while "Already in this meal" asks (D-34).
  const [duplicate, setDuplicate] = useState<MealItem[] | null>(null);
  // A food open on its own page (D-64): its place in the meal, and the food.
  const [page, setPage] = useState<{ index: number; result: FoodResult } | null>(null);
  // A food with no page, open in the sheet for its amount.
  const [changing, setChanging] = useState<number | null>(null);

  function addItems(added: MealItem[]) {
    // A listed food already in the meal: ask whether to put the amounts together (D-34).
    if (added.some((item) => items.some((existing) => sameFood(existing, item)))) setDuplicate(added);
    else addSeparately(added);
  }

  function addSeparately(added: MealItem[]) {
    setItems((current) => [...current, ...added].slice(0, MAX_MEAL_ITEMS));
  }

  /** Each food already in the meal takes the amount added, if it can; the rest are added as they are. */
  function addToExisting(added: MealItem[]) {
    setItems((current) => {
      const next = [...current];
      const rest: MealItem[] = [];
      for (const item of added) {
        const index = next.findIndex((existing) => sameFood(existing, item));
        const together = index >= 0 ? addAmount(next[index]!, item) : null;
        if (together) next[index] = together;
        else rest.push(item);
      }
      return [...next, ...rest].slice(0, MAX_MEAL_ITEMS);
    });
  }

  /** A food of the meal: its own page when the phone lists it (D-64), else the sheet for its amount. */
  async function change(index: number) {
    const item = items[index];
    if (!item) return;
    const result = local.state.status === 'ready' ? await listedFoodOf(local.state.db, item) : null;
    if (result) setPage({ index, result });
    else setChanging(index);
  }

  function replace(index: number, changed: MealItem) {
    setItems((current) => current.map((item, at) => (at === index ? changed : item)));
  }

  function remove(index: number) {
    setItems((current) => current.filter((_, at) => at !== index));
  }

  const changingItem = changing === null ? undefined : items[changing];
  const sheets = (
    <>
      {duplicate ? (
        <DuplicateFoodSheet
          {...duplicatePrompt(duplicate, items)}
          onAdd={() => {
            addToExisting(duplicate);
            setDuplicate(null);
          }}
          onKeep={() => {
            addSeparately(duplicate);
            setDuplicate(null);
          }}
        />
      ) : null}
      {page && items[page.index] ? (
        <FoodDetail
          result={page.result}
          from={items[page.index]!.amount}
          fromLabel="In this meal now"
          backLabel="Back to the meal"
          addTitle="Save change"
          onBack={() => setPage(null)}
          onAdd={(changed) => {
            replace(page.index, changed);
            setPage(null);
          }}
          onRemove={() => {
            remove(page.index);
            setPage(null);
          }}
        />
      ) : null}
      {changing !== null && changingItem ? (
        <ChangeAmountSheet
          key={changing}
          item={changingItem}
          onChange={(changed) => replace(changing, changed)}
          onRemove={() => remove(changing)}
          onClose={() => setChanging(null)}
        />
      ) : null}
    </>
  );
  return { items, setItems, addItems, change, sheets };
}

/**
 * The meal's foods, ruled on a card, each with its amount, kcal and protein and a button to change it.
 * `empty` is said when there are none (Log meal names the meal, D-68).
 */
export function MealFoodRows({
  items,
  empty = 'No foods yet.',
  onChange,
}: {
  items: readonly MealItem[];
  empty?: string;
  onChange(index: number): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.review}>
      {items.length === 0 ? <Text style={styles.empty}>{empty}</Text> : null}
      {items.map((item, index) => (
        <View key={index} style={[styles.item, index > 0 && styles.itemRuled]}>
          <View style={styles.itemText}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text
              accessibilityLabel={`${item.name}: ${formatAmount(item.amount)}, ${formatKcal(item.kcal)}, ${formatGrams(item.proteinG)} protein`}
              style={styles.itemDetail}
            >
              {formatAmount(item.amount)} · {formatKcal(item.kcal)} · {formatGrams(item.proteinG)} protein
              {item.estimated ? ' · estimated' : ''}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change ${item.name}`}
            onPress={() => onChange(index)}
            style={({ pressed }) => [styles.itemAction, pressed && styles.pressed]}
          >
            <SquarePen size={20} color={colors.accent} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/** A food with no page: its amount typed or stepped, then "Change to …"; or Remove. */
function ChangeAmountSheet({
  item,
  onChange,
  onRemove,
  onClose,
}: {
  item: MealItem;
  onChange(changed: MealItem): void;
  onRemove(): void;
  onClose(): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [gramsText, setGramsText] = useState(item.amount.unit === 'g' || item.amount.unit === 'own' ? String(item.amount.value) : '');
  const [portions, setPortions] = useState(item.amount.unit === 'g' ? 1 : item.amount.value);
  const newGrams = parseGrams(gramsText);
  // Your own food in its unit (D-39): its quantity is typed, as grams are.
  const newQuantity = item.amount.unit === 'own' ? parseOwnQuantity(gramsText, item.amount.name) : null;
  const amount = item.amount;
  return (
    <ActionsSheet
      centred
      title={item.name}
      actions={[
        ...(amount.unit === 'g' && newGrams !== null && newGrams !== amount.value
          ? [{ label: `Change to ${newGrams} g`, onPress: () => onChange(withGrams(item, newGrams)) }]
          : []),
        ...(amount.unit === 'portion' && portions !== amount.value
          ? [{ label: `Change to ${formatPortions(portions)}`, onPress: () => onChange(withPortions(item, portions)) }]
          : []),
        ...(amount.unit === 'serving' && portions !== amount.value
          ? [{ label: `Change to ${formatServings(portions, amount.label)}`, onPress: () => onChange(withServings(item, portions)) }]
          : []),
        ...(amount.unit === 'own' && newQuantity !== null && newQuantity !== amount.value
          ? [{ label: `Change to ${formatOwnUnits(newQuantity, amount.name)}`, onPress: () => onChange(withOwnQuantity(item, newQuantity)) }]
          : []),
        ...(amount.unit === 'measure' && portions !== amount.value
          ? [{ label: `Change to ${formatMeasures(portions, amount.measure)}`, onPress: () => onChange(withUnits(item, portions)) }]
          : []),
        { label: 'Remove', destructive: true, onPress: onRemove },
      ]}
      onClose={onClose}
    >
      {amount.unit === 'g' ? (
        <View style={styles.change}>
          <View style={[styles.gramsBox, newGrams === null && styles.gramsRefused]}>
            <TextInput accessibilityLabel="New grams" value={gramsText} onChangeText={setGramsText} keyboardType="number-pad" style={styles.input} />
            <Text style={styles.unit}>g</Text>
          </View>
          {newGrams === null ? (
            <View style={styles.problem}>
              <CircleAlert size={16} color={colors.danger} />
              <Text accessibilityRole="alert" style={styles.problemText}>
                {GRAMS_RULE}
              </Text>
            </View>
          ) : null}
        </View>
      ) : amount.unit === 'own' ? (
        <View style={styles.change}>
          <View style={[styles.gramsBox, newQuantity === null && styles.gramsRefused]}>
            <TextInput
              accessibilityLabel={`New ${ownQuantityLabel(amount.name).toLowerCase()}`}
              value={gramsText}
              onChangeText={setGramsText}
              keyboardType={amount.name === 'ml' ? 'number-pad' : 'decimal-pad'}
              style={styles.input}
            />
            <Text style={styles.unit}>{amount.name === 'ml' ? 'ml' : OWN_UNIT_NAMES[amount.name].many}</Text>
          </View>
          {newQuantity === null ? (
            <View style={styles.problem}>
              <CircleAlert size={16} color={colors.danger} />
              <Text accessibilityRole="alert" style={styles.problemText}>
                {ownQuantityRule(amount.name)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : amount.unit === 'serving' ? (
        <PortionStepper
          value={portions}
          onChange={setPortions}
          max={servingsMax(gramsPerUnitOf(amount))}
          unit={{ one: amount.label.toLowerCase(), many: amount.label.toLowerCase() }}
          stacked
        />
      ) : amount.unit === 'measure' ? (
        <PortionStepper value={portions} onChange={setPortions} max={unitsMax(gramsPerUnitOf(amount))} unit={MEASURE_NAMES[amount.measure]} />
      ) : (
        <PortionStepper value={portions} onChange={setPortions} />
      )}
    </ActionsSheet>
  );
}

/** "A", "A and B", "A, B and C". */
function list(names: readonly string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** What "Already in this meal" says about foods added again, and whether any can take the amount (D-34). */
function duplicatePrompt(added: readonly MealItem[], items: readonly MealItem[]): { message: string; canAdd: boolean } {
  const matches = added.flatMap((item) => {
    const existing = items.find((current) => sameFood(current, item));
    return existing ? [{ item, existing, together: addAmount(existing, item) }] : [];
  });
  if (matches.length === 1) {
    const { item, existing, together } = matches[0]!;
    const already = `${item.name} is already in this meal (${formatAmount(existing.amount)}).`;
    return together
      ? { message: `${already} Add ${formatAmount(item.amount)} to it, for ${formatAmount(together.amount)} in all?`, canAdd: true }
      : { message: `${already} Together that would be over ${amountLimit(existing)}, the most for one food, so it's added on its own.`, canAdd: false };
  }
  const names = list(matches.map((match) => match.item.name));
  const over = matches.filter((match) => !match.together).map((match) => match.item.name);
  if (over.length === matches.length) {
    return {
      message: `${matches.length} foods are already in this meal: ${names}. Together each would be over the most for one food, so they're added on their own.`,
      canAdd: false,
    };
  }
  const passing = over.length === 0 ? '' : ` ${list(over)} would be over the most for one food, so ${over.length === 1 ? "it's" : "they're"} added on ${over.length === 1 ? 'its' : 'their'} own.`;
  return { message: `${matches.length} foods are already in this meal: ${names}. Add the amounts to them?${passing}`, canAdd: true };
}

// The foods ruled like Home's measurements, each 64 high with its change button 44 square; the
// change-grams field in its sheet as Field, its unit inside it.
const useStyles = themedStyles((c) => ({
  pressed: { opacity: 0.6 },
  review: { paddingLeft: 16, paddingRight: 4, paddingVertical: 2, borderRadius: 4, backgroundColor: c.surface },
  empty: { paddingVertical: 14, fontSize: 15, color: c.inkMuted },
  item: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  itemRuled: { borderTopWidth: 1, borderTopColor: c.border },
  itemText: { flex: 1, gap: 2 },
  itemName: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  itemDetail: { fontSize: 14, lineHeight: 20, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  itemAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  change: { gap: 8 },
  gramsBox: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.accent,
    backgroundColor: c.surfaceSunken,
  },
  gramsRefused: { borderColor: c.danger },
  input: { ...TYPE.input, flex: 1, paddingVertical: 12, fontVariant: ['tabular-nums'] },
  unit: { ...TYPE.label, fontSize: 14, color: c.inkMuted },
  problem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  problemText: { ...TYPE.small, flexShrink: 1, color: c.danger },
}));
