import { IFCT_ACKNOWLEDGEMENT, USDA_ACKNOWLEDGEMENT, type Dish, type Food, type FoodMeasure, type MealItem } from '@fitsphere/shared';
import { ChevronRight, Search, SquarePen } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { TEXTS } from '../auth/texts';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getMeta, searchDishes, searchFoods, searchMyFoods, type LocalMyFood } from '../local/store';
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
  servingsMax,
  unitsMax,
} from '../mealItems';
import { formatGrams, formatKcal, formatUnitGrams, MEASURE_NAMES, OWN_UNIT_NAMES, ownQuantityLabel, PORTION_UNIT_LABELS } from '../meals';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { GramsBox } from './GramsBox';
import { OwnFoodSheet } from './OwnFoodSheet';
import { PortionStepper } from './PortionStepper';
import { Sheet } from './Sheet';
import { Message, Problem, Text, TextButton, TextInput, useChoiceStyles } from './ui';

// Search the food list (REQ-LOG-007, REQ-ACC-005): offline, on the copy cached on the phone
// (ADR-0006 rule 1). A listed food is added in grams eaten, from its values per 100 g, or in one of
// the household units the owner has measured for it (D-36), counted in halves; a dish (D-28) in
// portions, from its values for one portion, which are estimated. IFCT's acknowledgement is shown
// under the results (D-25): the dishes' values come from IFCT too.
//
// More foods (D-39): USDA's foods follow the Indian ones, marked "USDA", with their servings as USDA
// labels them, counted in halves; USDA's credit is shown under IFCT's. The user's My foods come
// between them, marked "My food", logged in their own unit; one can be edited or deleted from here.

type Result = { kind: 'dish'; dish: Dish } | { kind: 'food'; food: Food } | { kind: 'mine'; food: LocalMyFood };

/** A My food's values are per 100 g or ml, or per one of its unit: "100 g", "slice". */
function perOne(food: LocalMyFood): string {
  return food.unit === 'g' || food.unit === 'ml' ? `100 ${food.unit}` : OWN_UNIT_NAMES[food.unit].one;
}

/** Grams, a household unit (D-36), or the index of a USDA serving (D-39). */
type Unit = 'g' | FoodMeasure | { serving: number };

export function FoodSearchSheet({ onAdd, onClose }: { onAdd(item: MealItem): void; onClose(): void }) {
  const styles = useStyles();
  const choice = useChoiceStyles();
  const { colors } = useTheme();
  const local = useLocalDatabase();
  const { version } = useSync();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [listCached, setListCached] = useState(true);
  const [chosen, setChosen] = useState<Result | null>(null);
  const [gramsText, setGramsText] = useState('100');
  const [portions, setPortions] = useState(1);
  const [unit, setUnit] = useState<Unit>('g');
  const [units, setUnits] = useState(1);
  const [editing, setEditing] = useState<LocalMyFood | null>(null);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([searchDishes(db, query), searchFoods(db, query), searchMyFoods(db, query), getMeta(db, 'food_list_version')]).then(
      ([dishes, foods, mine, listVersion]) => {
        if (!active) return;
        const listed = (source: Food['source']) => foods.filter((food) => food.source === source).map((food): Result => ({ kind: 'food', food }));
        setResults([
          ...dishes.map((dish): Result => ({ kind: 'dish', dish })),
          ...listed('ifct2017'),
          ...mine.map((food): Result => ({ kind: 'mine', food })),
          ...listed('usda_fndds'),
        ]);
        setListCached(listVersion !== null);
      },
    );
    return () => {
      active = false;
    };
  }, [local.state, query, version]);

  const grams = parseGrams(gramsText);
  const chosenUnit = chosen?.kind === 'food' && typeof unit === 'string' ? (chosen.food.measures.find((entry) => entry.measure === unit) ?? null) : null;
  const chosenServing = chosen?.kind === 'food' && typeof unit === 'object' ? (chosen.food.portions[unit.serving] ?? null) : null;
  const quantity = chosen?.kind === 'mine' ? parseOwnQuantity(gramsText, chosen.food.unit) : null;
  const preview =
    chosen?.kind === 'dish'
      ? itemFromDish(chosen.dish, portions)
      : chosen?.kind === 'mine'
        ? quantity === null
          ? null
          : itemFromMyFood(chosen.food, quantity)
        : chosen && chosenServing
          ? itemFromServings(chosen.food, chosenServing, units)
          : chosen && chosenUnit
            ? itemFromFoodUnits(chosen.food, chosenUnit, units)
            : chosen && grams !== null
              ? itemFromFood(chosen.food, grams)
              : null;

  if (editing) {
    return (
      <OwnFoodSheet
        editing={editing}
        onClose={() => {
          setEditing(null);
          setChosen(null);
        }}
      />
    );
  }

  return chosen ? (
    <Sheet
      title={chosen.kind === 'dish' ? chosen.dish.name : chosen.food.name}
      onClose={onClose}
      actions={
        <>
          <TextButton
            title="Add"
            filled
            disabled={!preview}
            onPress={() => {
              if (!preview) return;
              onAdd(preview);
              onClose();
            }}
          />
          <TextButton title="Back to search" wide onPress={() => setChosen(null)} />
        </>
      }
    >
      {chosen.kind === 'dish' ? (
        <>
          <Text style={styles.body}>
            One portion is one {PORTION_UNIT_LABELS[chosen.dish.portionUnit]}: {formatKcal(chosen.dish.kcal)} ·{' '}
            {formatGrams(chosen.dish.proteinG)} protein (estimated)
          </Text>
          <PortionStepper value={portions} onChange={setPortions} />
        </>
      ) : chosen.kind === 'mine' ? (
        <>
          <Text style={styles.body}>
            My food · {chosen.food.unit === 'g' || chosen.food.unit === 'ml' ? `per ${perOne(chosen.food)}` : `one ${perOne(chosen.food)}`}:{' '}
            {formatKcal(chosen.food.kcal)} · {formatGrams(chosen.food.proteinG)} protein
          </Text>
          <GramsBox
            value={gramsText}
            onChangeText={setGramsText}
            refused={!preview}
            autoFocus
            label={ownQuantityLabel(chosen.food.unit)}
            unit={chosen.food.unit === 'g' || chosen.food.unit === 'ml' ? chosen.food.unit : OWN_UNIT_NAMES[chosen.food.unit].many}
            decimal={chosen.food.unit !== 'g' && chosen.food.unit !== 'ml'}
          />
        </>
      ) : (
        <>
          <Text style={styles.body}>
            {chosen.food.source === 'usda_fndds' ? 'USDA · per 100 g' : 'Per 100 g'}: {formatKcal(chosen.food.kcal)}
            {chosen.food.kcalEstimated ? ' (estimated)' : ''} · {formatGrams(chosen.food.proteinG)} protein
          </Text>
          {chosen.food.measures.length + chosen.food.portions.length > 0 ? (
            <View accessibilityRole="radiogroup" accessibilityLabel="Unit" style={styles.units}>
              {[
                { key: 'g', label: 'Grams', value: 'g' as Unit },
                ...chosen.food.measures.map((entry) => ({ key: entry.measure, label: MEASURE_NAMES[entry.measure].one, value: entry.measure as Unit })),
                ...chosen.food.portions.map((entry, index) => ({ key: `serving ${index}`, label: entry.label, value: { serving: index } as Unit })),
              ].map(({ key, label, value }) => {
                const checked = typeof value === 'object' ? typeof unit === 'object' && unit.serving === value.serving : value === unit;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked }}
                    onPress={() => {
                      setUnit(value);
                      setUnits(1);
                    }}
                    style={({ pressed }) => [choice.choice, styles.unit, checked && choice.chosen, pressed && choice.pressed]}
                  >
                    <Text style={[choice.choiceText, styles.unitText, checked && choice.chosenText]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {chosenServing ? (
            <>
              <PortionStepper
                value={units}
                onChange={setUnits}
                max={servingsMax(chosenServing.grams)}
                unit={{ one: chosenServing.label.toLowerCase(), many: chosenServing.label.toLowerCase() }}
                stacked
              />
              <Text style={styles.body}>
                One {chosenServing.label.toLowerCase()} is {formatUnitGrams(chosenServing.grams)}
              </Text>
            </>
          ) : chosenUnit ? (
            <>
              <PortionStepper value={units} onChange={setUnits} max={unitsMax(chosenUnit.grams)} unit={MEASURE_NAMES[chosenUnit.measure]} />
              <Text style={styles.body}>
                One {MEASURE_NAMES[chosenUnit.measure].one}
                {MEASURE_NAMES[chosenUnit.measure].size ? ` (${MEASURE_NAMES[chosenUnit.measure].size})` : ''} is{' '}
                {formatUnitGrams(chosenUnit.grams)}
              </Text>
            </>
          ) : (
            <GramsBox value={gramsText} onChangeText={setGramsText} refused={!preview} autoFocus />
          )}
        </>
      )}
      {preview ? (
        <Text accessibilityLabel={`Adds ${formatKcal(preview.kcal)} and ${formatGrams(preview.proteinG)} protein`} style={styles.preview}>
          = {preview.amount.unit === 'measure' || preview.amount.unit === 'serving' ? `${formatUnitGrams(preview.amount.grams)} · ` : ''}
          {formatKcal(preview.kcal)} · {formatGrams(preview.proteinG)} protein
        </Text>
      ) : (
        <Problem text={chosen.kind === 'mine' ? ownQuantityRule(chosen.food.unit) : GRAMS_RULE} />
      )}
      {chosen.kind === 'mine' ? <TextButton title="Edit My food" icon={SquarePen} onPress={() => setEditing(chosen.food)} /> : null}
    </Sheet>
  ) : (
    // The results scroll themselves, so the sheet's body doesn't.
    <Sheet title="Search foods" scroll={false} onClose={onClose} actions={<TextButton title="Close" wide onPress={onClose} />}>
      <View style={styles.searchBox}>
        <Search size={20} color={colors.inkMuted} />
        <TextInput
          accessibilityLabel="Search foods"
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. atta, dal, paneer"
          autoFocus
          style={styles.searchInput}
        />
      </View>
      {!listCached ? (
        <Message text={TEXTS.needsInternet('Downloading the food list')} offline />
      ) : query.trim() !== '' && results.length === 0 ? (
        <Text style={styles.empty}>No foods found. Try another word, or enter your own food.</Text>
      ) : null}
      <FlatList
        data={results}
        keyExtractor={(result) =>
          result.kind === 'dish' ? `dish:${result.dish.code}` : result.kind === 'mine' ? `mine:${result.food.id}` : `${result.food.source}:${result.food.code}`
        }
        style={[styles.list, results.length > 0 && styles.listCard]}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: result }) =>
          result.kind === 'dish' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${result.dish.name}, dish, ${formatKcal(result.dish.kcal)} per ${PORTION_UNIT_LABELS[result.dish.portionUnit]}, estimated`}
              onPress={() => {
                setChosen(result);
                setPortions(1);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.name}>{result.dish.name}</Text>
                <Text style={styles.detail}>
                  Dish · {formatKcal(result.dish.kcal)} per {PORTION_UNIT_LABELS[result.dish.portionUnit]} · estimated
                </Text>
              </View>
              <ChevronRight size={20} strokeWidth={2.25} color={colors.accent} />
            </Pressable>
          ) : result.kind === 'mine' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${result.food.name}, my food, ${formatKcal(result.food.kcal)} per ${perOne(result.food)}`}
              onPress={() => {
                setChosen(result);
                setGramsText(result.food.unit === 'g' || result.food.unit === 'ml' ? '100' : '1');
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.name}>{result.food.name}</Text>
                <View style={styles.detailLine}>
                  <Text style={[styles.mark, styles.markMine]}>My food</Text>
                  <Text style={styles.detail}>
                    {formatKcal(result.food.kcal)} per {perOne(result.food)}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} strokeWidth={2.25} color={colors.accent} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${result.food.name}, ${result.food.source === 'usda_fndds' ? 'USDA, ' : ''}${formatKcal(result.food.kcal)} per 100 g${result.food.kcalEstimated ? ', estimated' : ''}`}
              onPress={() => {
                setChosen(result);
                setGramsText('100');
                setUnit('g');
                setUnits(1);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.name}>{result.food.name}</Text>
                <View style={styles.detailLine}>
                  {result.food.source === 'usda_fndds' ? <Text style={styles.mark}>USDA</Text> : null}
                  <Text style={styles.detail}>
                    {formatKcal(result.food.kcal)} per 100 g{result.food.kcalEstimated ? ' · estimated' : ''}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} strokeWidth={2.25} color={colors.accent} />
            </Pressable>
          )
        }
      />
      <Text style={styles.acknowledgement}>Food values: {IFCT_ACKNOWLEDGEMENT}</Text>
      <Text style={styles.acknowledgement}>Foods marked USDA: {USDA_ACKNOWLEDGEMENT}</Text>
    </Sheet>
  );
}

// The redesign's 3.6 (locked by the owner, 2026-11-03): the search in a sunken box with its icon; the
// results ruled on a raised card, each opening with a chevron; grams large in a box with their unit,
// red with the rule under them when they can't be added; what an addition comes to in condensed
// figures. A food with household units (D-36) offers Grams and its units as choice blocks, as the
// meal choice's, which wrap at their own widths; a unit is counted with the portions' − and +.
const useStyles = themedStyles((c) => ({
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  unit: { paddingHorizontal: 12 },
  unitText: { fontSize: 15, letterSpacing: 0.5 },
  searchBox: {
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
  // flex: 1 only in the box's row: in the sheet's column a field with flex: 1 has no height for its
  // text (Yoga's flex basis is 0), which hid the search text.
  searchInput: { ...TYPE.input, flex: 1, paddingVertical: 12 },
  body: { fontSize: 15, lineHeight: 22, color: c.inkMuted },
  preview: { ...TYPE.metric },
  empty: { fontSize: 15, lineHeight: 22, color: c.inkMuted, textAlign: 'center' },
  list: { maxHeight: 360 },
  listCard: { borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rowText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  detail: { flexShrink: 1, color: c.inkMuted, fontSize: 14, lineHeight: 20 },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // A food's source, as a small tag: USDA in the muted ink on the sunken colour; My food in caramel.
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
  acknowledgement: { color: c.inkMuted, fontSize: 12, lineHeight: 16 },
}));
