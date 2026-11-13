import { OZ_SERVING_LABEL, type MealItem } from '@fitsphere/shared';
import { ChevronDown, ChevronLeft, SquarePen, Trash } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { formatInteger } from '../format';
import type { ListedFood, LocalMyFood } from '../local/store';
import {
  GRAMS_RULE,
  itemFromDish,
  itemFromFood,
  itemFromFoodUnits,
  itemFromMyFood,
  itemFromPackaged,
  itemFromPackagedServings,
  itemFromServings,
  ownQuantityRule,
  OZ_SERVING,
  packagedServing,
  parseGrams,
  parseOwnQuantity,
  PORTIONS_MAX,
  servingsMax,
  unitsMax,
  type FoodServing,
  type FoodUnit,
} from '../mealItems';
import {
  formatAmount,
  formatGrams,
  formatKcal,
  formatMeasureGrams,
  formatUnitGrams,
  MEASURE_NAMES,
  OWN_UNIT_NAMES,
  ownQuantityLabel,
  PORTION_UNIT_LABELS,
} from '../meals';
import { measureWord, nameHasNumber, type SearchAmount } from '../searchAmount';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { NUTRIENTS } from './EatenSummary';
import { SOURCE_MARKS } from './foodSources';
import { FullScreen } from './FullScreen';
import { Sheet } from './Sheet';
import { StripeCorner } from './StripeCorner';
import { IconButton, Problem, Text, TextButton, TextInput } from './ui';

// A food's page (D-45, after the owner's HealthifyMe example; the redesign's 3.6b, locked 2026-11-04),
// opened from Search foods over its results: the food's name and source, its Quantity and Measure
// side by side, then the macronutrients breakdown of that amount, with Add at the foot. Grams and a My
// food's quantity are typed; household units (D-36), USDA's servings (D-39) and a dish's portions
// (D-28) are counted in halves, chosen with the measure in a two-column picker.
//
// A recent food (D-60) opens on the amount it was last logged in, said under the boxes; when foods
// are ticked in Search foods, Add says how many foods go into the meal with this one.
//
// A food already in the meal (D-64) opens from Log meal's review on its amount there, "In this meal
// now: 100 g", with Save change, and Remove from meal centred under it; any of its measures can be
// chosen, so 100 g can become 1 paratha. Opened from a food of a logged meal in Nutrition (D-97), it
// names that meal and its date beside the back arrow, "Lunch · Thu 12 Nov", and Save change saves the
// meal at once.
//
// More measures (D-76; the redesign's 3.6b "more measures", locked 2026-11-11): a serving that holds
// several things also gives one of them ("2 slices" gives Slice; the food list brings it as one more
// serving), every listed and packaged food can be logged in oz, and each measure shows its grams
// beside its name. The food's own measures come first, smallest first, then Grams, then oz.

export type FoodResult = ListedFood;

/**
 * One way to measure the food: typed, or counted in halves up to `max`; with the grams one holds,
 * shown beside its name, and the serving or household unit it counts.
 */
type Measure = { key: string; name: string; grams: number | null; counted: boolean; max: number; serving?: FoodServing; unit?: FoodUnit };

/** What a measure is called when read out, and in tests: "Slice (28 g)", "Grams". */
function measureLabel(measure: Pick<Measure, 'name' | 'grams'>): string {
  return measure.grams === null ? measure.name : `${measure.name} (${formatMeasureGrams(measure.grams)})`;
}

const GRAMS: Measure = { key: 'g', name: 'Grams', grams: null, counted: false, max: 0 };

function servingMeasure(key: string, serving: FoodServing): Measure {
  return { key, name: serving.label, grams: serving.grams, counted: true, max: servingsMax(serving.grams), serving };
}

const OZ: Measure = servingMeasure('oz', OZ_SERVING);

/** One row of the picker's wheels. */
const ROW = 52;

/** Halves from 0.5 to `max`. */
function halves(max: number): number[] {
  return Array.from({ length: Math.floor(max * 2) }, (_, index) => (index + 1) / 2);
}

function capital(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/**
 * A listed food's are its household units and servings, smallest first, then Grams and oz (D-76); a
 * dish's, its portion; a My food's, its unit; a packaged food's, the serving its label gives in
 * grams (D-48), then Grams and oz.
 */
function measuresOf(result: FoodResult): Measure[] {
  if (result.kind === 'packaged') {
    const serving = packagedServing(result.food);
    return [...(serving ? [servingMeasure('serving', serving)] : []), GRAMS, OZ];
  }
  if (result.kind === 'dish') {
    return [{ key: 'portion', name: capital(PORTION_UNIT_LABELS[result.dish.portionUnit]), grams: null, counted: true, max: PORTIONS_MAX }];
  }
  if (result.kind === 'mine') {
    const unit = result.food.unit;
    return [{ key: 'own', name: unit === 'g' ? 'Grams' : unit === 'ml' ? 'ml' : capital(OWN_UNIT_NAMES[unit].many), grams: null, counted: false, max: 0 }];
  }
  const own: Measure[] = [
    ...result.food.measures.map((unit) => ({
      key: unit.measure,
      name: capital(MEASURE_NAMES[unit.measure].one),
      grams: unit.grams,
      counted: true,
      max: unitsMax(unit.grams),
      unit,
    })),
    ...result.food.portions.map((serving, index) => servingMeasure(`serving ${index}`, serving)),
  ];
  // Smallest first: "Slice" before the "2 slices" it comes from. The sort keeps equal grams in order.
  return [...own.sort((a, b) => (a.grams ?? 0) - (b.grams ?? 0)), GRAMS, OZ];
}

/** What the amount adds, or null when the typed quantity can't be added. */
function itemOf(result: FoodResult, measure: Measure, count: number, typed: string): MealItem | null {
  if (result.kind === 'dish') return itemFromDish(result.dish, count);
  if (result.kind === 'mine') {
    const quantity = parseOwnQuantity(typed, result.food.unit);
    return quantity === null ? null : itemFromMyFood(result.food, quantity);
  }
  if (result.kind === 'packaged') {
    if (measure.serving) return itemFromPackagedServings(result.food, measure.serving, count);
    const grams = parseGrams(typed);
    return grams === null ? null : itemFromPackaged(result.food, grams);
  }
  if (measure.serving) return itemFromServings(result.food, measure.serving, count);
  if (measure.unit) return itemFromFoodUnits(result.food, measure.unit, count);
  const grams = parseGrams(typed);
  return grams === null ? null : itemFromFood(result.food, grams);
}

/**
 * The measure, count and typed quantity of an amount last logged (D-60), when the food still has that
 * measure and the count fits it; otherwise null, and the page opens as usual.
 */
function startOf(result: FoodResult, measures: Measure[], from: MealItem['amount']): { measureIndex: number; count: number; typed: string } | null {
  const at = (key: string) => measures.findIndex((measure) => measure.key === key);
  const typed = (index: number, value: number) => (index < 0 ? null : { measureIndex: index, count: 1, typed: String(value) });
  const counted = (index: number, value: number) => (index < 0 || value > measures[index]!.max ? null : { measureIndex: index, count: value, typed: '100' });
  switch (from.unit) {
    case 'g':
      return typed(at(result.kind === 'mine' ? 'own' : 'g'), from.value);
    case 'own':
      return typed(at('own'), from.value);
    case 'portion':
      return counted(at('portion'), from.value);
    case 'measure':
      return counted(at(from.measure), from.value);
    case 'serving':
      if (from.label === OZ_SERVING_LABEL) return counted(at('oz'), from.value);
      if (result.kind === 'packaged') return counted(at('serving'), from.value);
      if (result.kind !== 'food') return null;
      return counted(
        measures.findIndex((measure) => measure.key.startsWith('serving ') && measure.serving?.label === from.label),
        from.value,
      );
  }
}

/**
 * The measure, count and typed quantity of an amount typed with the search (D-96: "2 roti", "1 cup
 * rice", "half plate biryani", "100g paneer"), when the food has that measure and the count fits it;
 * otherwise null, and the page opens as usual. A bare count goes to the measure the page opens on, or
 * else the food's first counted one ("2 maggi": 2 servings); grams to Grams. A number that is in the
 * food's name ("5 Star") is not an amount.
 */
function startFromSearch(result: FoodResult, measures: Measure[], opening: number, amount: SearchAmount): { measureIndex: number; count: number; typed: string } | null {
  const { count, unit } = amount;
  if (!(count > 0) || nameHasNumber(result.kind === 'dish' ? result.dish.name : result.food.name, amount)) return null;
  if (result.kind === 'mine') {
    const weighed = result.food.unit === 'g' || result.food.unit === 'ml';
    const fits = weighed ? unit === 'g' : unit === null || measureWord(OWN_UNIT_NAMES[result.food.unit].one) === unit;
    return fits ? { measureIndex: 0, count: 1, typed: String(count) } : null;
  }
  if (unit === 'g') {
    const grams = measures.findIndex((measure) => measure.key === 'g');
    return grams < 0 ? null : { measureIndex: grams, count: 1, typed: String(count) };
  }
  const counted = (measure: Measure) => measure.counted && measure.key !== 'oz';
  const fits = (index: number) => index >= 0 && counted(measures[index]!) && Number.isInteger(count * 2) && count <= measures[index]!.max;
  const index =
    unit === null
      ? fits(opening)
        ? opening
        : measures.findIndex(counted)
      : measures.findIndex((measure) => counted(measure) && measureWord(measure.name) === unit);
  return fits(index) ? { measureIndex: index, count, typed: '100' } : null;
}

export function FoodDetail({
  result,
  from,
  amount,
  fromLabel = 'Last time',
  backLabel = 'Back to search',
  context,
  addTitle = 'Add',
  addNote,
  onBack,
  onAdd,
  onEdit,
  onRemove,
}: {
  result: FoodResult;
  /** The amount a recent food was last logged in (D-60), or a food in the meal has now (D-64). */
  from?: MealItem['amount'];
  /** The amount typed with the search the food was found by (D-96): the page opens on it when it fits. */
  amount?: SearchAmount | null;
  /** What `from` is called under the boxes: "Last time", or "In this meal now" (D-64). */
  fromLabel?: string;
  backLabel?: string;
  /** Beside the back arrow: the logged meal the food is in, and its date (D-97). */
  context?: string;
  addTitle?: string;
  /** Said above Add: the ticked foods that go in with this one (D-60). */
  addNote?: string;
  onBack(): void;
  onAdd(item: MealItem): void;
  /** Opens a My food to edit; without it, the page offers no Edit My food. */
  onEdit?(food: LocalMyFood): void;
  /** Takes the food out of the meal it is in (D-64): "Remove from meal", centred under Add. */
  onRemove?(): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const measures = measuresOf(result);
  // An INDB recipe opens on its serving (D-46): INDB's values are per 100 g of the raw ingredients,
  // so its serving, not grams of the cooked dish, gives INDB's own figures. A home-style food opens on
  // its serving too, as it is eaten: a slice, two slices, a plate (D-59), and so does an estimated
  // dish: a katori, a plate, a piece (D-62). A recent food opens on the amount it was last logged in,
  // when it still has it (D-60); a food found by a search with an amount, on that amount (D-96).
  const servingFirst =
    result.kind === 'food' && (result.food.source === 'indb' || result.food.source === 'home' || result.food.source === 'dish_estimate') && result.food.portions.length > 0;
  // Otherwise on Grams (D-76: the food's own measures come before it).
  const opening = Math.max(0, measures.findIndex((measure) => measure.key === (servingFirst ? 'serving 0' : 'g')));
  const [start] = useState(() => (from ? startOf(result, measures, from) : amount ? startFromSearch(result, measures, opening, amount) : null));
  const [measureIndex, setMeasureIndex] = useState(() => start?.measureIndex ?? opening);
  const [count, setCount] = useState(start?.count ?? 1);
  const [typed, setTyped] = useState(start?.typed ?? (result.kind === 'mine' && result.food.unit !== 'g' && result.food.unit !== 'ml' ? '1' : '100'));
  const [picking, setPicking] = useState(false);
  const measure = measures[measureIndex] ?? measures[0]!;
  const item = itemOf(result, measure, count, typed);

  const name = result.kind === 'dish' ? result.dish.name : result.food.name;
  const mark =
    result.kind === 'dish' ? 'Dish' : result.kind === 'mine' ? 'My food' : result.kind === 'packaged' ? 'Packaged' : SOURCE_MARKS[result.food.source];
  const per =
    result.kind === 'dish'
      ? `One ${PORTION_UNIT_LABELS[result.dish.portionUnit]}: ${formatKcal(result.dish.kcal)}`
      : result.kind === 'mine'
        ? result.food.unit === 'g' || result.food.unit === 'ml'
          ? `Per 100 ${result.food.unit}: ${formatKcal(result.food.kcal)}`
          : `One ${OWN_UNIT_NAMES[result.food.unit].one}: ${formatKcal(result.food.kcal)}`
        : result.kind === 'packaged'
          ? `${result.food.brand ? `${result.food.brand} · ` : ''}Per 100 g: ${formatKcal(result.food.kcal)}`
          : `Per 100 g: ${formatKcal(result.food.kcal)}${result.food.kcalEstimated ? ' (estimated)' : ''}`;
  // Beside the energy: the weight the amount comes to, or that a dish's values are estimated.
  const note = !item
    ? null
    : result.kind === 'dish'
      ? 'Estimated'
      : item.amount.unit === 'g'
        ? `Net wt: ${formatUnitGrams(item.amount.value)}`
        : item.amount.unit === 'measure' || item.amount.unit === 'serving'
          ? `Net wt: ${formatUnitGrams(item.amount.grams)}`
          : null;

  return (
    <FullScreen
      onClose={onBack}
      footer={
        <View style={styles.footer}>
          {addNote ? <Text style={styles.addNote}>{addNote}</Text> : null}
          <TextButton title={addTitle} filled disabled={!item} onPress={() => item && onAdd(item)} />
          {onRemove ? <TextButton title="Remove from meal" destructive wide icon={Trash} onPress={onRemove} /> : null}
        </View>
      }
    >
      <View style={styles.header}>
        <IconButton label={backLabel} onPress={onBack}>
          <ChevronLeft size={24} strokeWidth={2.25} color={colors.accent} />
        </IconButton>
        {context ? <Text style={styles.context}>{context}</Text> : null}
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <StripeCorner size={140} />
          <View style={styles.titleBlock}>
            <Text accessibilityRole="header" style={styles.name}>
              {name}
            </Text>
            <View style={styles.perLine}>
              {mark ? <Text style={[styles.mark, result.kind === 'mine' && styles.markMine]}>{mark}</Text> : null}
              <Text style={styles.per}>{per}</Text>
            </View>
          </View>
          <View style={styles.amountRow}>
            <View style={styles.quantity}>
              <Text style={styles.label}>Quantity</Text>
              {measure.counted ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Quantity: ${count}`}
                  onPress={() => setPicking(true)}
                  style={({ pressed }) => [styles.box, pressed && styles.pressed]}
                >
                  <Text style={styles.count}>{count}</Text>
                  <ChevronDown size={18} strokeWidth={2.25} color={colors.accent} />
                </Pressable>
              ) : (
                <View style={[styles.box, !item && styles.refused]}>
                  <TextInput
                    accessibilityLabel={result.kind === 'mine' ? ownQuantityLabel(result.food.unit) : 'Grams eaten'}
                    value={typed}
                    onChangeText={setTyped}
                    keyboardType={result.kind === 'mine' && result.food.unit !== 'g' && result.food.unit !== 'ml' ? 'decimal-pad' : 'number-pad'}
                    autoFocus
                    style={styles.typed}
                  />
                </View>
              )}
            </View>
            <View style={styles.measure}>
              <Text style={styles.label}>Measure</Text>
              {measures.length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Measure: ${measureLabel(measure)}`}
                  onPress={() => setPicking(true)}
                  style={({ pressed }) => [styles.box, pressed && styles.pressed]}
                >
                  <MeasureName measure={measure} />
                  <ChevronDown size={18} strokeWidth={2.25} color={colors.accent} />
                </Pressable>
              ) : (
                <View accessible accessibilityLabel={`Measure: ${measureLabel(measure)}`} style={styles.box}>
                  <MeasureName measure={measure} />
                </View>
              )}
            </View>
          </View>
          {item ? null : <Problem text={result.kind === 'mine' ? ownQuantityRule(result.food.unit) : GRAMS_RULE} />}
          {from ? <Text style={styles.per}>{`${fromLabel}: ${formatAmount(from)}`}</Text> : null}
          {result.kind === 'mine' && onEdit ? <TextButton title="Edit My food" icon={SquarePen} onPress={() => onEdit(result.food)} /> : null}
        </View>

        <Text accessibilityRole="header" style={styles.heading}>
          Macronutrients breakdown
        </Text>
        <View style={styles.card}>
          <View>
            <Text style={[styles.label, styles.tight]}>Calories</Text>
            <View style={styles.energyRow}>
              <View accessible accessibilityLabel={item ? `Adds ${formatKcal(item.kcal)}` : 'Adds –'} style={styles.energy}>
                <Text style={[styles.kcal, !item && styles.none]}>{item ? formatInteger(Math.round(item.kcal)) : '–'}</Text>
                {item ? <Text style={styles.kcalUnit}>kcal</Text> : null}
              </View>
              {note ? <Text style={styles.note}>{note}</Text> : null}
            </View>
          </View>
          <View style={styles.nutrients}>
            {NUTRIENTS.map(({ key, label, colour }, index) => {
              const value = item ? formatGrams(item[key]) : '–';
              return (
                <View key={key} accessible accessibilityLabel={`${label}: ${value}`} style={[styles.nutrient, index > 0 && styles.ruled]}>
                  <View style={[styles.swatch, { backgroundColor: colors[colour] }]} />
                  <Text style={styles.nutrientName}>{label}</Text>
                  <Text style={styles.nutrientValue}>{value}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
      {picking ? (
        <AmountPicker
          measures={measures}
          measureIndex={measureIndex}
          count={count}
          onDone={(index, chosen) => {
            setMeasureIndex(index);
            setCount(chosen);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </FullScreen>
  );
}

/**
 * The quantity and the measure as two wheels, the chosen row of each on one band across the middle;
 * Done keeps them. A typed measure (Grams) has no wheel: its quantity is typed in the box.
 */
function AmountPicker({
  measures,
  measureIndex,
  count,
  onDone,
  onClose,
}: {
  measures: Measure[];
  measureIndex: number;
  count: number;
  onDone(measureIndex: number, count: number): void;
  onClose(): void;
}) {
  const styles = useStyles();
  const [index, setIndex] = useState(measureIndex);
  const [chosen, setChosen] = useState(count);
  const measure = measures[index] ?? measures[0]!;
  const counts = measure.counted ? halves(measure.max) : [];
  return (
    <Sheet
      onClose={onClose}
      scroll={false}
      header={
        <View style={styles.columns}>
          <Text style={[styles.label, styles.quantity, styles.centred]}>Quantity</Text>
          <Text style={[styles.label, styles.measure, styles.centred]}>Measure</Text>
        </View>
      }
      actions={<TextButton title="Done" filled onPress={() => onDone(index, chosen)} />}
    >
      <View style={styles.wheels}>
        <View style={styles.band} />
        <View style={styles.quantity}>
          {measure.counted ? (
            <Wheel
              key={measure.key}
              label="Quantity"
              options={counts.map((value) => ({ name: String(value) }))}
              index={Math.max(0, counts.indexOf(chosen))}
              onChange={(row) => setChosen(counts[row] ?? 1)}
            />
          ) : (
            <View style={styles.typeHere}>
              <Text style={styles.hint}>Type the grams in the box</Text>
            </View>
          )}
        </View>
        <View style={styles.measure}>
          <Wheel
            label="Measure"
            words
            options={measures.map((entry) => ({ name: entry.name, detail: entry.grams === null ? undefined : formatMeasureGrams(entry.grams) }))}
            index={index}
            onChange={(row) => {
              setIndex(row);
              const next = measures[row];
              if (next?.counted && chosen > next.max) setChosen(1);
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}

/** A measure's name, and the grams one holds in the muted ink beside it (D-76). */
function MeasureName({ measure }: { measure: Pick<Measure, 'name' | 'grams'> }) {
  const styles = useStyles();
  return (
    <Text numberOfLines={1} style={styles.measureName}>
      <Text style={styles.measureText}>{measure.name}</Text>
      {measure.grams === null ? null : <Text style={styles.measureGrams}>{`  ${formatMeasureGrams(measure.grams)}`}</Text>}
    </Text>
  );
}

/** One row of a wheel: a name, and for a measure the grams it holds beside it (D-76). */
type WheelOption = { name: string; detail?: string };

/**
 * A column of rows that snaps to the band; a row can also be tapped. Numbers in the condensed
 * figures; `words` (the measures) in Barlow as written, so "oz" stays "oz" (D-76).
 */
function Wheel({
  label,
  options,
  index,
  words = false,
  onChange,
}: {
  label: string;
  options: WheelOption[];
  index: number;
  words?: boolean;
  onChange(row: number): void;
}) {
  const styles = useStyles();
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);

  function settle(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const row = Math.min(options.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.y / ROW)));
    if (row !== index) onChange(row);
  }

  return (
    <ScrollView
      ref={ref}
      accessibilityLabel={label}
      style={styles.wheel}
      contentContainerStyle={styles.wheelContent}
      snapToInterval={ROW}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // Opens on the chosen row.
      onLayout={() => ref.current?.scrollTo({ y: index * ROW, animated: false })}
      onMomentumScrollEnd={settle}
      onScrollEndDrag={(event) => {
        if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.05) settle(event);
      }}
    >
      {options.map((option, row) => (
        <Pressable
          key={`${option.name} ${option.detail ?? ''}`}
          accessibilityRole="button"
          accessibilityLabel={option.detail ? `${option.name} (${option.detail})` : option.name}
          accessibilityState={{ selected: row === index }}
          onPress={() => {
            onChange(row);
            ref.current?.scrollTo({ y: row * ROW, animated: true });
          }}
          style={styles.wheelRow}
        >
          <Text
            numberOfLines={1}
            style={words ? [styles.wheelWord, row === index && styles.wheelWordChosen] : [styles.wheelText, row === index && styles.wheelChosen]}
          >
            {option.name}
            {option.detail ? <Text style={[styles.wheelDetail, row === index && styles.wheelDetailChosen]}>{`  ${option.detail}`}</Text> : null}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// The redesign's 3.6b (locked by the owner, 2026-11-04): the name and the amount on a card with the
// stripe corner, the name in condensed capitals over its source tag; Quantity and Measure as sunken
// boxes, two parts to three; the breakdown on a card, the energy as a 44 reading with its weight in a
// chip, each nutrient on its own ruled row with its colour's square; Add filled at the foot. The
// picker's wheels show five rows, the chosen ones on a caramel band.
const useStyles = themedStyles((c) => ({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 6 },
  context: { ...TYPE.label, flexShrink: 1, color: c.inkMuted },
  footer: { gap: 8 },
  addNote: { fontSize: 14, lineHeight: 20, color: c.inkMuted, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 14 },
  card: { overflow: 'hidden', padding: 16, gap: 14, borderRadius: 4, backgroundColor: c.surface },
  titleBlock: { gap: 6 },
  name: { ...TYPE.heading },
  perLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  per: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: c.inkMuted },
  // A food's source, as in the results: USDA and Dish in the muted ink on the sunken colour; My food in caramel.
  mark: {
    ...TYPE.label,
    fontSize: 12,
    letterSpacing: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    color: c.inkMuted,
    backgroundColor: c.surfaceSunken,
  },
  markMine: { color: c.accent, backgroundColor: c.accentTint },
  amountRow: { flexDirection: 'row', gap: 10 },
  quantity: { flex: 2 },
  measure: { flex: 3 },
  label: { ...TYPE.label, color: c.inkMuted, marginBottom: 6 },
  box: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surfaceSunken,
  },
  refused: { borderColor: c.danger },
  pressed: { opacity: 0.6 },
  count: { ...TYPE.metric, fontSize: 24, lineHeight: 26 },
  typed: { ...TYPE.metric, flex: 1, fontSize: 24, lineHeight: 28, paddingVertical: 8 },
  measureName: { flexShrink: 1 },
  measureText: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  measureGrams: { fontSize: 14, lineHeight: 20, fontWeight: '400', color: c.inkMuted },
  heading: { ...TYPE.label, marginTop: 4, color: c.inkMuted },
  tight: { marginBottom: 2 },
  energyRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  energy: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  kcal: { ...TYPE.metric, fontSize: 44, lineHeight: 46 },
  none: { color: c.inkSubtle },
  kcalUnit: { ...TYPE.metric, fontSize: 18, paddingBottom: 6, color: c.accent },
  note: { marginBottom: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, overflow: 'hidden', fontSize: 13, lineHeight: 18, color: c.inkMuted, backgroundColor: c.surfaceSunken },
  nutrients: { borderTopWidth: 1, borderTopColor: c.border },
  nutrient: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ruled: { borderTopWidth: 1, borderTopColor: c.border },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  nutrientName: { flex: 1, fontSize: 16, lineHeight: 22 },
  nutrientValue: { ...TYPE.metric, fontSize: 20, lineHeight: 22 },
  columns: { flexDirection: 'row' },
  centred: { textAlign: 'center' },
  wheels: { height: ROW * 5, flexDirection: 'row' },
  band: { position: 'absolute', left: 0, right: 0, top: ROW * 2, height: ROW, borderRadius: 4, backgroundColor: c.accentTint },
  wheel: { flexGrow: 0, height: ROW * 5 },
  wheelContent: { paddingVertical: ROW * 2 },
  wheelRow: { height: ROW, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  wheelText: { ...TYPE.metric, fontSize: 18, color: c.inkSubtle },
  wheelChosen: { fontSize: 22, color: c.ink },
  // The measures in Barlow as written (the locked "more measures" design, D-76): the name 16, the
  // chosen one 18 semibold in the ink; its grams beside it, smaller and muted.
  wheelWord: { fontSize: 16, lineHeight: 22, fontWeight: '400', color: c.inkSubtle },
  wheelWordChosen: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: c.ink },
  wheelDetail: { fontSize: 13, fontWeight: '400', color: c.inkSubtle },
  wheelDetailChosen: { fontSize: 14, color: c.inkMuted },
  typeHere: { height: ROW * 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  hint: { fontSize: 14, lineHeight: 20, color: c.inkMuted, textAlign: 'center' },
}));
