import { IFCT_ACKNOWLEDGEMENT, type Dish, type Food, type MealItem } from '@fitsphere/shared';
import { useEffect, useState } from 'react';
import { Button, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { TEXTS } from '../auth/texts';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getMeta, searchDishes, searchFoods } from '../local/store';
import { GRAMS_RULE, itemFromDish, itemFromFood, parseGrams } from '../mealItems';
import { formatGrams, formatKcal, PORTION_UNIT_LABELS } from '../meals';
import { themedStyles } from '../theme';
import { PortionStepper } from './PortionStepper';
import { Sheet } from './Sheet';
import { Text, TextInput } from './ui';

// Search the food list (REQ-LOG-007, REQ-ACC-005): offline, on the copy cached on the phone
// (ADR-0006 rule 1). A listed food is added in grams eaten, from its values per 100 g; a dish (D-28)
// in portions, from its values for one portion, which are estimated. IFCT's acknowledgement is shown
// under the results (D-25): the dishes' values come from IFCT too.

type Result = { kind: 'dish'; dish: Dish } | { kind: 'food'; food: Food };

export function FoodSearchSheet({ onAdd, onClose }: { onAdd(item: MealItem): void; onClose(): void }) {
  const styles = useStyles();
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
          <Button
            title="Add"
            disabled={!preview}
            onPress={() => {
              if (!preview) return;
              onAdd(preview);
              onClose();
            }}
          />
          <Button title="Back to search" onPress={() => setChosen(null)} />
        </>
      }
    >
      {chosen.kind === 'dish' ? (
        <>
          <Text>
            One portion is one {PORTION_UNIT_LABELS[chosen.dish.portionUnit]}: {formatKcal(chosen.dish.kcal)} ·{' '}
            {formatGrams(chosen.dish.proteinG)} protein (estimated)
          </Text>
          <PortionStepper value={portions} onChange={setPortions} />
        </>
      ) : (
        <>
          <Text>
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
              style={[styles.input, styles.grow]}
            />
            <Text>g</Text>
          </View>
        </>
      )}
      {preview ? (
        <Text accessibilityLabel={`Adds ${formatKcal(preview.kcal)} and ${formatGrams(preview.proteinG)} protein`}>
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
    <Sheet title="Search foods" scroll={false} onClose={onClose} actions={<Button title="Close" onPress={onClose} />}>
      <TextInput
        accessibilityLabel="Search foods"
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. atta, dal, paneer"
        autoFocus
        style={styles.input}
      />
      {!listCached ? (
        <Text accessibilityRole="alert">{TEXTS.needsInternet('Downloading the food list')}</Text>
      ) : query.trim() !== '' && results.length === 0 ? (
        <Text>No foods found. Try another word, or enter your own food.</Text>
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
              style={styles.row}
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
              style={styles.row}
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

const useStyles = themedStyles((c) => ({
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // `grow` only beside other items in a row: in the sheet's column, flex: 1 would give a field no
  // height for its text (Yoga's flex basis is 0), which hid the search text.
  input: { borderWidth: 1, borderColor: c.textFaint, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  grow: { flex: 1 },
  list: { maxHeight: 360 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  name: { fontWeight: '600' },
  detail: { color: c.textMuted, fontSize: 13 },
  acknowledgement: { color: c.textMuted, fontSize: 11 },
  problem: { color: c.error },
}));
