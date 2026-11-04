import type { Dish, Food, MealItem } from '@fitsphere/shared';
import { ChevronDown, ChevronLeft, SquarePen } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { formatInteger } from '../format';
import type { LocalMyFood } from '../local/store';
import {
  GRAMS_RULE,
  itemFromDish,
  itemFromFood,
  itemFromFoodUnits,
  itemFromMyFood,
  itemFromServings,
  ownQuantityRule,
  parseGrams,
  parseOwnQuantity,
  PORTIONS_MAX,
  servingsMax,
  unitsMax,
} from '../mealItems';
import { formatGrams, formatKcal, formatUnitGrams, MEASURE_NAMES, OWN_UNIT_NAMES, ownQuantityLabel, PORTION_UNIT_LABELS } from '../meals';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { NUTRIENTS } from './EatenSummary';
import { FullScreen } from './FullScreen';
import { Sheet } from './Sheet';
import { StripeCorner } from './StripeCorner';
import { IconButton, Problem, Text, TextButton, TextInput } from './ui';

// A food's page (D-45, after the owner's HealthifyMe example; the redesign's 3.6b, locked 2026-11-04),
// opened from Search foods over its results: the food's name and source, its Quantity and Measure
// side by side, then the macronutrients breakdown of that amount, with Add at the foot. Grams and a My
// food's quantity are typed; household units (D-36), USDA's servings (D-39) and a dish's portions
// (D-28) are counted in halves, chosen with the measure in a two-column picker.

export type FoodResult = { kind: 'dish'; dish: Dish } | { kind: 'food'; food: Food } | { kind: 'mine'; food: LocalMyFood };

/** One way to measure the food: typed, or counted in halves up to `max`. */
type Measure = { key: string; label: string; counted: boolean; max: number };

/** One row of the picker's wheels. */
const ROW = 52;

/** Halves from 0.5 to `max`. */
function halves(max: number): number[] {
  return Array.from({ length: Math.floor(max * 2) }, (_, index) => (index + 1) / 2);
}

function capital(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/** A listed food's are Grams, its household units, then USDA's servings; a dish's, its portion; a My food's, its unit. */
function measuresOf(result: FoodResult): Measure[] {
  if (result.kind === 'dish') return [{ key: 'portion', label: capital(PORTION_UNIT_LABELS[result.dish.portionUnit]), counted: true, max: PORTIONS_MAX }];
  if (result.kind === 'mine') {
    const unit = result.food.unit;
    return [{ key: 'own', label: unit === 'g' ? 'Grams' : unit === 'ml' ? 'ml' : capital(OWN_UNIT_NAMES[unit].many), counted: false, max: 0 }];
  }
  return [
    { key: 'g', label: 'Grams', counted: false, max: 0 },
    ...result.food.measures.map((entry) => ({
      key: entry.measure,
      label: `${capital(MEASURE_NAMES[entry.measure].one)} (${formatUnitGrams(entry.grams)})`,
      counted: true,
      max: unitsMax(entry.grams),
    })),
    ...result.food.portions.map((entry, index) => ({
      key: `serving ${index}`,
      label: `${entry.label} (${formatUnitGrams(entry.grams)})`,
      counted: true,
      max: servingsMax(entry.grams),
    })),
  ];
}

/** What the amount adds, or null when the typed quantity can't be added. */
function itemOf(result: FoodResult, measure: Measure, count: number, typed: string): MealItem | null {
  if (result.kind === 'dish') return itemFromDish(result.dish, count);
  if (result.kind === 'mine') {
    const quantity = parseOwnQuantity(typed, result.food.unit);
    return quantity === null ? null : itemFromMyFood(result.food, quantity);
  }
  if (measure.key === 'g') {
    const grams = parseGrams(typed);
    return grams === null ? null : itemFromFood(result.food, grams);
  }
  if (measure.key.startsWith('serving ')) {
    const serving = result.food.portions[Number(measure.key.slice('serving '.length))];
    return serving ? itemFromServings(result.food, serving, count) : null;
  }
  const unit = result.food.measures.find((entry) => entry.measure === measure.key);
  return unit ? itemFromFoodUnits(result.food, unit, count) : null;
}

export function FoodDetail({
  result,
  onBack,
  onAdd,
  onEdit,
}: {
  result: FoodResult;
  onBack(): void;
  onAdd(item: MealItem): void;
  onEdit(food: LocalMyFood): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const measures = measuresOf(result);
  const [measureIndex, setMeasureIndex] = useState(0);
  const [count, setCount] = useState(1);
  const [typed, setTyped] = useState(result.kind === 'mine' && result.food.unit !== 'g' && result.food.unit !== 'ml' ? '1' : '100');
  const [picking, setPicking] = useState(false);
  const measure = measures[measureIndex] ?? measures[0]!;
  const item = itemOf(result, measure, count, typed);

  const name = result.kind === 'dish' ? result.dish.name : result.food.name;
  const mark = result.kind === 'dish' ? 'Dish' : result.kind === 'mine' ? 'My food' : result.food.source === 'usda_fndds' ? 'USDA' : null;
  const per =
    result.kind === 'dish'
      ? `One ${PORTION_UNIT_LABELS[result.dish.portionUnit]}: ${formatKcal(result.dish.kcal)}`
      : result.kind === 'mine'
        ? result.food.unit === 'g' || result.food.unit === 'ml'
          ? `Per 100 ${result.food.unit}: ${formatKcal(result.food.kcal)}`
          : `One ${OWN_UNIT_NAMES[result.food.unit].one}: ${formatKcal(result.food.kcal)}`
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
    <FullScreen onClose={onBack} footer={<TextButton title="Add" filled disabled={!item} onPress={() => item && onAdd(item)} />}>
      <View style={styles.header}>
        <IconButton label="Back to search" onPress={onBack}>
          <ChevronLeft size={24} strokeWidth={2.25} color={colors.accent} />
        </IconButton>
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
                  accessibilityLabel={`Measure: ${measure.label}`}
                  onPress={() => setPicking(true)}
                  style={({ pressed }) => [styles.box, pressed && styles.pressed]}
                >
                  <Text numberOfLines={1} style={styles.measureText}>
                    {measure.label}
                  </Text>
                  <ChevronDown size={18} strokeWidth={2.25} color={colors.accent} />
                </Pressable>
              ) : (
                <View accessible accessibilityLabel={`Measure: ${measure.label}`} style={styles.box}>
                  <Text numberOfLines={1} style={styles.measureText}>
                    {measure.label}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {item ? null : <Problem text={result.kind === 'mine' ? ownQuantityRule(result.food.unit) : GRAMS_RULE} />}
          {result.kind === 'mine' ? <TextButton title="Edit My food" icon={SquarePen} onPress={() => onEdit(result.food)} /> : null}
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
              options={counts.map(String)}
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
            options={measures.map((entry) => entry.label)}
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

/** A column of rows that snaps to the band; a row can also be tapped. */
function Wheel({ label, options, index, onChange }: { label: string; options: string[]; index: number; onChange(row: number): void }) {
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
          key={option}
          accessibilityRole="button"
          accessibilityLabel={option}
          accessibilityState={{ selected: row === index }}
          onPress={() => {
            onChange(row);
            ref.current?.scrollTo({ y: row * ROW, animated: true });
          }}
          style={styles.wheelRow}
        >
          <Text numberOfLines={1} style={[styles.wheelText, row === index && styles.wheelChosen]}>
            {option}
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
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingLeft: 6 },
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
  measureText: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '500' },
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
  typeHere: { height: ROW * 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  hint: { fontSize: 14, lineHeight: 20, color: c.inkMuted, textAlign: 'center' },
}));
