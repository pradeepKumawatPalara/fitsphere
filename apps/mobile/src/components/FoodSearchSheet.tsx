import { IFCT_ACKNOWLEDGEMENT, INDB_ACKNOWLEDGEMENT, OFF_ATTRIBUTION, type Food, type MealItem } from '@fitsphere/shared';
import { ChevronLeft, ChevronRight, Info, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { TEXTS } from '../auth/texts';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getMeta, searchDishes, searchFoods, searchMyFoods, searchPackaged, type LocalMyFood } from '../local/store';
import { formatKcal, OWN_UNIT_NAMES, PORTION_UNIT_LABELS } from '../meals';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { FoodDetail, type FoodResult } from './FoodDetail';
import { BRAND_LABEL_CREDIT, SOURCE_MARKS } from './foodSources';
import { FullScreen } from './FullScreen';
import { OwnFoodSheet } from './OwnFoodSheet';
import { Sheet } from './Sheet';
import { IconButton, Message, Text, TextButton, TextInput } from './ui';

// Search the food list (REQ-LOG-007, REQ-ACC-005): offline, on the copy cached on the phone
// (ADR-0006 rule 1). Dishes (D-28) come first, then INDB's Indian recipes (D-46), IFCT's Indian
// foods and the user's My foods (D-39), then brands' own labels approved by the owner (D-49), then
// packaged foods sold in India from Open Food Facts, by name or brand (D-48), each marked; USDA's foods are no longer listed (D-47). IFCT's acknowledgement
// is one tap away, behind the i at the top (D-25, changed by D-44): the dishes' values come from IFCT
// too; INDB's and Open Food Facts' credits are shown with it.
//
// A food whose name is exactly what was typed comes first, wherever its source would list it; the
// rest keep their order (D-51).
//
// The search fills the screen, so the most results show above the keyboard (D-44). A result opens the
// food's page over them (D-45, FoodDetail), and its back arrow returns to the same results. A My food
// can be edited or deleted from its page.

type Result = FoodResult;

/** A name or a search as compared for an exact match: lowercase, its letters and digits only, one space between words. */
function matchKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The names a result answers to: a packaged food also by its brand and name together. */
function namesOf(result: Result): string[] {
  if (result.kind === 'dish') return [result.dish.name];
  if (result.kind === 'packaged') return [result.food.name, `${result.food.brand ?? ''} ${result.food.name}`];
  return [result.food.name];
}

/**
 * The results with those named exactly as the search first ("bread" finds "Bread" above "Bread,
 * white" and "Brown bread"), ignoring case, spaces and punctuation; the rest keep their order (D-51).
 */
export function exactFirst(query: string, results: readonly Result[]): Result[] {
  const key = matchKey(query);
  if (!key) return [...results];
  const exact = (result: Result) => namesOf(result).some((name) => matchKey(name) === key);
  return [...results.filter(exact), ...results.filter((result) => !exact(result))];
}

/** A My food's values are per 100 g or ml, or per one of its unit: "100 g", "slice". */
function perOne(food: LocalMyFood): string {
  return food.unit === 'g' || food.unit === 'ml' ? `100 ${food.unit}` : OWN_UNIT_NAMES[food.unit].one;
}

export function FoodSearchSheet({ onAdd, onClose }: { onAdd(item: MealItem): void; onClose(): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const local = useLocalDatabase();
  const { version } = useSync();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [listCached, setListCached] = useState(true);
  const [chosen, setChosen] = useState<Result | null>(null);
  const [editing, setEditing] = useState<LocalMyFood | null>(null);
  // The food sources' sheet, behind the i (D-44).
  const [sources, setSources] = useState(false);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([
      searchDishes(db, query),
      searchFoods(db, query),
      searchMyFoods(db, query),
      searchPackaged(db, query),
      getMeta(db, 'food_list_version'),
    ]).then(
      ([dishes, foods, mine, packaged, listVersion]) => {
        if (!active) return;
        const listed = (source: Food['source']) => foods.filter((food) => food.source === source).map((food): Result => ({ kind: 'food', food }));
        setResults(
          exactFirst(query, [
            ...dishes.map((dish): Result => ({ kind: 'dish', dish })),
            ...listed('indb'),
            ...listed('ifct2017'),
            ...mine.map((food): Result => ({ kind: 'mine', food })),
            ...listed('brand_label'),
            ...packaged.map((food): Result => ({ kind: 'packaged', food })),
          ]),
        );
        setListCached(listVersion !== null);
      },
    );
    return () => {
      active = false;
    };
  }, [local.state, query, version]);

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

  return (
    <FullScreen onClose={onClose}>
          <View style={styles.header}>
            <IconButton label="Close search" onPress={onClose}>
              <ChevronLeft size={24} strokeWidth={2.25} color={colors.accent} />
            </IconButton>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
              Search foods
            </Text>
            <IconButton label="Food sources" onPress={() => setSources(true)}>
              <Info size={22} color={colors.accent} />
            </IconButton>
          </View>
          <View style={styles.searchArea}>
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
          </View>
          <FlatList
            data={results}
            keyExtractor={(result) =>
              result.kind === 'dish'
                ? `dish:${result.dish.code}`
                : result.kind === 'mine'
                  ? `mine:${result.food.id}`
                  : result.kind === 'packaged'
                    ? `packaged:${result.food.barcode}`
                    : `${result.food.source}:${result.food.code}`
            }
            style={[styles.list, results.length > 0 && styles.listCard]}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: result }) =>
              result.kind === 'dish' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${result.dish.name}, dish, ${formatKcal(result.dish.kcal)} per ${PORTION_UNIT_LABELS[result.dish.portionUnit]}, estimated`}
                  onPress={() => setChosen(result)}
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
                  onPress={() => setChosen(result)}
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
              ) : result.kind === 'packaged' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${result.food.name}, ${result.food.brand ? `${result.food.brand}, ` : ''}packaged, ${formatKcal(result.food.kcal)} per 100 g`}
                  onPress={() => setChosen(result)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{result.food.name}</Text>
                    <View style={styles.detailLine}>
                      <Text style={styles.mark}>Packaged</Text>
                      <Text numberOfLines={1} style={styles.detail}>
                        {result.food.brand ? `${result.food.brand} · ` : ''}
                        {formatKcal(result.food.kcal)} per 100 g
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} strokeWidth={2.25} color={colors.accent} />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${result.food.name}, ${SOURCE_MARKS[result.food.source] ? `${SOURCE_MARKS[result.food.source]}, ` : ''}${formatKcal(result.food.kcal)} per 100 g${result.food.kcalEstimated ? ', estimated' : ''}`}
                  onPress={() => setChosen(result)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{result.food.name}</Text>
                    <View style={styles.detailLine}>
                      {SOURCE_MARKS[result.food.source] ? <Text style={styles.mark}>{SOURCE_MARKS[result.food.source]}</Text> : null}
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
      {sources ? (
        <Sheet title="Food sources" onClose={() => setSources(false)} actions={<TextButton title="Close" wide onPress={() => setSources(false)} />}>
          <Text style={styles.source}>Food values: {IFCT_ACKNOWLEDGEMENT}</Text>
          <Text style={styles.source}>Foods marked INDB: {INDB_ACKNOWLEDGEMENT}</Text>
          <Text style={styles.source}>Foods marked Brand label: {BRAND_LABEL_CREDIT}</Text>
          <Text style={styles.source}>Foods marked Packaged: {OFF_ATTRIBUTION}.</Text>
        </Sheet>
      ) : null}
      {chosen ? (
        <FoodDetail
          result={chosen}
          onBack={() => setChosen(null)}
          onAdd={(item: MealItem) => {
            onAdd(item);
            onClose();
          }}
          onEdit={setEditing}
        />
      ) : null}
    </FullScreen>
  );
}

// The redesign's 3.6 (locked by the owner, 2026-11-03; the full screen locked 2026-11-04, D-44): the
// search fills the screen under a header with the back arrow, its title and the i; the search in a
// sunken box with its icon; the results ruled on a raised card down to the keyboard, each opening
// with a chevron; the food sources in a sheet.
const useStyles = themedStyles((c) => ({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 8 },
  title: { ...TYPE.screenHeader, flex: 1 },
  searchArea: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 12 },
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
  empty: { fontSize: 15, lineHeight: 22, color: c.inkMuted, textAlign: 'center' },
  // As tall as its results, and no taller than the room above the keyboard.
  list: { flexGrow: 0, marginHorizontal: 16 },
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
  source: { fontSize: 15, lineHeight: 22 },
}));
