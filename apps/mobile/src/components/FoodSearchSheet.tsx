import { IFCT_ACKNOWLEDGEMENT, type Dish, type Food, type MealItem } from '@fitsphere/shared';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { TEXTS } from '../auth/texts';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getMeta, searchDishes, searchFoods } from '../local/store';
import { GRAMS_RULE, itemFromDish, itemFromFood, parseGrams } from '../mealItems';
import { formatGrams, formatKcal, PORTION_UNIT_LABELS } from '../meals';
import { themedStyles } from '../theme';
import { PortionStepper } from './PortionStepper';
import { Sheet } from './Sheet';
import { Text, TextButton, TextInput, useFieldInputStyle } from './ui';

// Search the food list (REQ-LOG-007, REQ-ACC-005): offline, on the copy cached on the phone
// (ADR-0006 rule 1). A listed food is added in grams eaten, from its values per 100 g; a dish (D-28)
// in portions, from its values for one portion, which are estimated. IFCT's acknowledgement is shown
// under the results (D-25): the dishes' values come from IFCT too.

type Result = { kind: 'dish'; dish: Dish } | { kind: 'food'; food: Food };

export function FoodSearchSheet({ onAdd, onClose }: { onAdd(item: MealItem): void; onClose(): void }) {
  const styles = useStyles();
  const fieldInput = useFieldInputStyle();
  const local = useLocalDatabase();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [listCached, setListCached] = useState(true);
  const [chosen, setChosen] = useState<Result | null>(null);
  const [gramsText, setGramsText] = useState('100');
  const [portions, setPortions] = useState(1);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([searchDishes(db, query), searchFoods(db, query), getMeta(db, 'food_list_version')]).then(
      ([dishes, foods, version]) => {
        if (!active) return;
        setResults([...dishes.map((dish): Result => ({ kind: 'dish', dish })), ...foods.map((food): Result => ({ kind: 'food', food }))]);
        setListCached(version !== null);
      },
    );
    return () => {
      active = false;
    };
  }, [local.state, query]);

  const grams = parseGrams(gramsText);
  const preview =
    chosen?.kind === 'dish' ? itemFromDish(chosen.dish, portions) : chosen && grams !== null ? itemFromFood(chosen.food, grams) : null;

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
          <TextButton title="Back to search" onPress={() => setChosen(null)} />
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
      ) : (
        <>
          <Text style={styles.body}>
            Per 100 g: {formatKcal(chosen.food.kcal)}
            {chosen.food.kcalEstimated ? ' (estimated)' : ''} · {formatGrams(chosen.food.proteinG)} protein
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel="Grams eaten"
              value={gramsText}
              onChangeText={setGramsText}
              keyboardType="number-pad"
              autoFocus
              style={[fieldInput, styles.grow, styles.number]}
            />
            <Text style={styles.unit}>g</Text>
          </View>
        </>
      )}
      {preview ? (
        <Text accessibilityLabel={`Adds ${formatKcal(preview.kcal)} and ${formatGrams(preview.proteinG)} protein`} style={styles.preview}>
          = {formatKcal(preview.kcal)} · {formatGrams(preview.proteinG)} protein
        </Text>
      ) : (
        <Text accessibilityRole="alert" style={styles.problem}>
          {GRAMS_RULE}
        </Text>
      )}
    </Sheet>
  ) : (
    // The results scroll themselves, so the sheet's body doesn't.
    <Sheet title="Search foods" scroll={false} onClose={onClose} actions={<TextButton title="Close" onPress={onClose} />}>
      <TextInput
        accessibilityLabel="Search foods"
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. atta, dal, paneer"
        autoFocus
        style={fieldInput}
      />
      {!listCached ? (
        <Text accessibilityRole="alert" style={styles.body}>
          {TEXTS.needsInternet('Downloading the food list')}
        </Text>
      ) : query.trim() !== '' && results.length === 0 ? (
        <Text style={styles.empty}>No foods found. Try another word, or enter your own food.</Text>
      ) : null}
      <FlatList
        data={results}
        keyExtractor={(result) => (result.kind === 'dish' ? `dish:${result.dish.code}` : `${result.food.source}:${result.food.code}`)}
        style={styles.list}
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
              <Text style={styles.name}>{result.dish.name}</Text>
              <Text style={styles.detail}>
                Dish · {formatKcal(result.dish.kcal)} per {PORTION_UNIT_LABELS[result.dish.portionUnit]} · estimated
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${result.food.name}, ${formatKcal(result.food.kcal)} per 100 g${result.food.kcalEstimated ? ', estimated' : ''}`}
              onPress={() => {
                setChosen(result);
                setGramsText('100');
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.name}>{result.food.name}</Text>
              <Text style={styles.detail}>
                {formatKcal(result.food.kcal)} per 100 g{result.food.kcalEstimated ? ' · estimated' : ''}
              </Text>
            </Pressable>
          )
        }
      />
      <Text style={styles.acknowledgement}>Food values: {IFCT_ACKNOWLEDGEMENT}</Text>
    </Sheet>
  );
}

// Results ruled with hairlines, as the app's lists; what an addition comes to at the size of a value.
const useStyles = themedStyles((c) => ({
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // `grow` only beside other items in a row: in the sheet's column, flex: 1 would give a field no
  // height for its text (Yoga's flex basis is 0), which hid the search text.
  grow: { flex: 1 },
  number: { fontVariant: ['tabular-nums'] },
  unit: { fontSize: 15, color: c.textMuted },
  body: { fontSize: 15 },
  preview: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  empty: { fontSize: 15, color: c.textMuted },
  list: { maxHeight: 360 },
  row: { minHeight: 48, justifyContent: 'center', gap: 2, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  pressed: { opacity: 0.6 },
  name: { fontSize: 15, fontWeight: '600' },
  detail: { color: c.textMuted, fontSize: 13 },
  acknowledgement: { color: c.textMuted, fontSize: 13 },
  problem: { fontSize: 13, color: c.error },
}));
