import { IFCT_ACKNOWLEDGEMENT, type Dish, type Food, type MealItem } from '@fitsphere/shared';
import { ChevronRight, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { TEXTS } from '../auth/texts';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getMeta, searchDishes, searchFoods } from '../local/store';
import { GRAMS_RULE, itemFromDish, itemFromFood, parseGrams } from '../mealItems';
import { formatGrams, formatKcal, PORTION_UNIT_LABELS } from '../meals';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { GramsBox } from './GramsBox';
import { PortionStepper } from './PortionStepper';
import { Sheet } from './Sheet';
import { Message, Problem, Text, TextButton, TextInput } from './ui';

// Search the food list (REQ-LOG-007, REQ-ACC-005): offline, on the copy cached on the phone
// (ADR-0006 rule 1). A listed food is added in grams eaten, from its values per 100 g; a dish (D-28)
// in portions, from its values for one portion, which are estimated. IFCT's acknowledgement is shown
// under the results (D-25): the dishes' values come from IFCT too.

type Result = { kind: 'dish'; dish: Dish } | { kind: 'food'; food: Food };

export function FoodSearchSheet({ onAdd, onClose }: { onAdd(item: MealItem): void; onClose(): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
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
      ) : (
        <>
          <Text style={styles.body}>
            Per 100 g: {formatKcal(chosen.food.kcal)}
            {chosen.food.kcalEstimated ? ' (estimated)' : ''} · {formatGrams(chosen.food.proteinG)} protein
          </Text>
          <GramsBox value={gramsText} onChangeText={setGramsText} refused={!preview} autoFocus />
        </>
      )}
      {preview ? (
        <Text accessibilityLabel={`Adds ${formatKcal(preview.kcal)} and ${formatGrams(preview.proteinG)} protein`} style={styles.preview}>
          = {formatKcal(preview.kcal)} · {formatGrams(preview.proteinG)} protein
        </Text>
      ) : (
        <Problem text={GRAMS_RULE} />
      )}
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
        keyExtractor={(result) => (result.kind === 'dish' ? `dish:${result.dish.code}` : `${result.food.source}:${result.food.code}`)}
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
              <View style={styles.rowText}>
                <Text style={styles.name}>{result.food.name}</Text>
                <Text style={styles.detail}>
                  {formatKcal(result.food.kcal)} per 100 g{result.food.kcalEstimated ? ' · estimated' : ''}
                </Text>
              </View>
              <ChevronRight size={20} strokeWidth={2.25} color={colors.accent} />
            </Pressable>
          )
        }
      />
      <Text style={styles.acknowledgement}>Food values: {IFCT_ACKNOWLEDGEMENT}</Text>
    </Sheet>
  );
}

// The redesign's 3.6 (locked by the owner, 2026-11-03): the search in a sunken box with its icon; the
// results ruled on a raised card, each opening with a chevron; grams large in a box with their unit,
// red with the rule under them when they can't be added; what an addition comes to in condensed
// figures.
const useStyles = themedStyles((c) => ({
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
  detail: { color: c.inkMuted, fontSize: 14, lineHeight: 20 },
  acknowledgement: { color: c.inkMuted, fontSize: 12, lineHeight: 16 },
}));
