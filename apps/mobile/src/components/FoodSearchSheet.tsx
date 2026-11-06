import { addDays, IFCT_ACKNOWLEDGEMENT, INDB_ACKNOWLEDGEMENT, OFF_ATTRIBUTION, type Food, type IstDay, type MealItem } from '@fitsphere/shared';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Info, Search, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { TEXTS } from '../auth/texts';
import { formatInteger } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import {
  getMeta,
  listedFoodOf,
  recentFoodKey,
  recentFoods,
  searchDishes,
  searchFoods,
  searchMyFoods,
  searchPackaged,
  type LocalMyFood,
} from '../local/store';
import { formatAmount, formatKcal, OWN_UNIT_NAMES, PORTION_UNIT_LABELS } from '../meals';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { FoodDetail, type FoodResult } from './FoodDetail';
import { BRAND_LABEL_CREDIT, HOME_FOODS_CREDIT } from './foodSources';
import { FullScreen } from './FullScreen';
import { OwnFoodSheet } from './OwnFoodSheet';
import { Sheet } from './Sheet';
import { IconButton, Message, Text, TextButton, TextInput } from './ui';

// Search the food list (REQ-LOG-007, REQ-ACC-005): offline, on the copy cached on the phone
// (ADR-0006 rule 1). Since D-54 the user's My foods (D-39) come first, then brands' own labels
// (D-49), then packaged foods sold in India from Open Food Facts, by name or brand (D-48), then INDB's
// Indian recipes (D-46), then the rest: dishes (D-28) and IFCT's Indian foods. Since D-61 no result
// carries a source tag (each food's page still does): a branded food shows its brand under its name,
// a My food "Your food", and the branded foods of one name are one row ("Bread · 3 brands"), which
// opens to list them, a brand each. USDA's foods are no longer listed (D-47). IFCT's acknowledgement
// is one tap away, behind the i at the top (D-25, changed by D-44): the dishes' values come from IFCT too; INDB's and Open Food Facts'
// credits are shown with it.
//
// A food whose name is exactly what was typed comes first, wherever its source would list it; the
// rest keep that order (D-51). Since D-59 the home-style forms of daily foods (a bread slice, butter
// toast, bread omelette) come next, before My foods, untagged.
//
// The search fills the screen, so the most results show above the keyboard (D-44). A result opens the
// food's page over them (D-45, FoodDetail), and its back arrow returns to the same results. A My food
// can be edited or deleted from its page.
//
// The results follow the search as it is typed or erased, a letter at a time; the cross at the end of
// the box clears it, and its results, and is shown only while something is typed (D-57).
//
// Before anything is typed, Recent foods lists what was logged on the last five days, today's first,
// each food once by its name with the amount it was last logged in (D-60, the redesign's 3.6 with
// recent foods, locked by the owner on 2026-11-06). The tick box on the right picks a food as it was
// last time, and the bar at the foot adds every ticked food; the name opens the food's page on that
// amount, to change it. Once foods are ticked, a food added from its page, a recent one or one found
// by the search, goes into the meal with them. The keyboard opens by itself only when there are no
// recent foods, so it does not hide them.

type Result = FoodResult;

/** How many days Recent foods looks back, today included (D-60). */
export const RECENT_FOOD_DAYS = 5;

function nameOf(result: Result): string {
  return result.kind === 'dish' ? result.dish.name : result.food.name;
}

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

/**
 * A branded food's brand and its name without the brand (D-61): a packaged food's brand, or a brand
 * label's, which is its food group; null for every other food, and for a packaged food with no brand.
 */
export function brandOf(result: Result): { brand: string; product: string } | null {
  const product = (brand: string, name: string) => (name.toLowerCase().startsWith(`${brand.toLowerCase()} `) ? name.slice(brand.length + 1) : name);
  if (result.kind === 'packaged') return result.food.brand ? { brand: result.food.brand, product: product(result.food.brand, result.food.name) } : null;
  if (result.kind === 'food' && result.food.source === 'brand_label') return { brand: result.food.foodGroup, product: product(result.food.foodGroup, result.food.name) };
  return null;
}

/** A row of the results: one food, or the branded foods of one name, listed under it (D-61). */
export type ResultRow = { kind: 'one'; result: Result } | { kind: 'brands'; key: string; name: string; members: Result[] };

/**
 * The results as rows (D-61): branded foods (brand labels and packaged foods) with the same name,
 * their brands left out and ignoring case and punctuation, are one row where the first of them was;
 * a name only one brand has stays a row of its own. Every other food, and the order, are unchanged.
 */
export function groupBrands(results: readonly Result[]): ResultRow[] {
  const rows: ResultRow[] = [];
  const groups = new Map<string, Extract<ResultRow, { kind: 'brands' }>>();
  for (const result of results) {
    const branded = brandOf(result);
    if (!branded) {
      rows.push({ kind: 'one', result });
      continue;
    }
    const key = matchKey(branded.product);
    const group = groups.get(key);
    if (group) {
      group.members.push(result);
      continue;
    }
    const created = { kind: 'brands' as const, key, name: branded.product, members: [result] };
    groups.set(key, created);
    rows.push(created);
  }
  // A name only one brand has, even under two sources, stays a row for each.
  return rows.flatMap((row): ResultRow[] => (row.kind === 'brands' && brandCount(row.members) < 2 ? row.members.map((result) => ({ kind: 'one', result })) : [row]));
}

/** How many different brands a name's foods have, ignoring case. */
export function brandCount(members: readonly Result[]): number {
  return new Set(members.map((member) => brandOf(member)?.brand.toLowerCase())).size;
}

function keyOf(result: Result): string {
  return result.kind === 'dish'
    ? `dish:${result.dish.code}`
    : result.kind === 'mine'
      ? `mine:${result.food.id}`
      : result.kind === 'packaged'
        ? `packaged:${result.food.barcode}`
        : `${result.food.source}:${result.food.code}`;
}

/**
 * What a result's row says (D-61), with no source tag: its name; under it, a branded food's brand or
 * "Your food" for a My food, then its energy; and all of it as read out.
 */
function describe(result: Result): { name: string; lead: string | null; mine: boolean; detail: string; said: string } {
  const say = (parts: (string | null)[]) => parts.filter((part) => part !== null).join(', ');
  if (result.kind === 'dish') {
    const detail = `${formatKcal(result.dish.kcal)} per ${PORTION_UNIT_LABELS[result.dish.portionUnit]}`;
    return { name: result.dish.name, lead: null, mine: false, detail: `${detail} · estimated`, said: say([result.dish.name, detail, 'estimated']) };
  }
  if (result.kind === 'mine') {
    const detail = `${formatKcal(result.food.kcal)} per ${perOne(result.food)}`;
    return { name: result.food.name, lead: 'Your food', mine: true, detail, said: say([result.food.name, 'your food', detail]) };
  }
  const detail = `${formatKcal(result.food.kcal)} per 100 g`;
  const branded = brandOf(result);
  if (branded) return { name: branded.product, lead: branded.brand, mine: false, detail, said: say([branded.product, branded.brand, detail]) };
  const estimated = result.kind === 'food' && result.food.kcalEstimated;
  return { name: result.food.name, lead: null, mine: false, detail: `${detail}${estimated ? ' · estimated' : ''}`, said: say([result.food.name, detail, estimated ? 'estimated' : null]) };
}

/** The energy of a name's brands: "250 kcal" or "220–274 kcal", and as read out. */
function kcalRange(members: readonly Result[]): { shown: string; said: string } {
  const kcals = members.map((member) => Math.round(member.kind === 'dish' ? member.dish.kcal : member.food.kcal));
  const [low, high] = [Math.min(...kcals), Math.max(...kcals)];
  return low === high ? { shown: formatKcal(low), said: formatKcal(low) } : { shown: `${formatInteger(low)}–${formatKcal(high)}`, said: `${formatInteger(low)} to ${formatKcal(high)}` };
}

/** One line of the results list: a food, a name's brands, or one of those brands while they are open. */
type Line = { kind: 'one'; result: Result } | { kind: 'brands'; row: Extract<ResultRow, { kind: 'brands' }>; open: boolean } | { kind: 'member'; result: Result; group: string };

export function FoodSearchSheet({ today, onAdd, onClose }: { today: IstDay; onAdd(items: MealItem[]): void; onClose(): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const local = useLocalDatabase();
  const { version } = useSync();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [listCached, setListCached] = useState(true);
  // The food whose page is open, and the amount it was last logged in when opened from Recent foods.
  const [chosen, setChosen] = useState<{ result: Result; from?: MealItem['amount'] } | null>(null);
  const [editing, setEditing] = useState<LocalMyFood | null>(null);
  // The food sources' sheet, behind the i (D-44).
  const [sources, setSources] = useState(false);
  // Recent foods (D-60): null until read; the ticked ones by their keys, in the order ticked.
  const [recent, setRecent] = useState<MealItem[] | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  // The names whose brands are open (D-61).
  const [openNames, setOpenNames] = useState<string[]>([]);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    let active = true;
    void recentFoods(local.state.db, addDays(today, -(RECENT_FOOD_DAYS - 1)), today).then((foods) => {
      if (active) setRecent(foods);
    });
    return () => {
      active = false;
    };
  }, [local.state, today, version]);

  const byKey = new Map((recent ?? []).map((item) => [recentFoodKey(item), item]));
  const tickedItems = ticked.flatMap((key) => byKey.get(key) ?? []);
  // From a food's page the ticked foods go in with it, but not its own tick: the page's amount counts.
  const withPage = chosen ? tickedItems.filter((item) => recentFoodKey(item) !== recentFoodKey({ name: nameOf(chosen.result) })) : [];
  const showRecent = query.trim() === '' && recent !== null && recent.length > 0;

  function toggle(item: MealItem) {
    const key = recentFoodKey(item);
    setTicked((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  }

  /** A recent food's page, on its last amount; a food no longer listed has no page, and its name ticks it (MVP default, D-60). */
  async function open(item: MealItem) {
    if (local.state.status !== 'ready') return;
    const result = await listedFoodOf(local.state.db, item);
    if (result) setChosen({ result, from: item.amount });
    else toggle(item);
  }

  function addAll(items: MealItem[]) {
    onAdd(items);
    onClose();
  }

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
          // D-59: home-style foods; D-54: My foods, brand labels, packaged foods, INDB, then dishes and IFCT.
          exactFirst(query, [
            ...listed('home'),
            ...mine.map((food): Result => ({ kind: 'mine', food })),
            ...listed('brand_label'),
            ...packaged.map((food): Result => ({ kind: 'packaged', food })),
            ...listed('indb'),
            ...dishes.map((dish): Result => ({ kind: 'dish', dish })),
            ...listed('ifct2017'),
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

  const lines = groupBrands(results).flatMap((row): Line[] => {
    if (row.kind === 'one') return [row];
    const open = openNames.includes(row.key);
    return [{ kind: 'brands', row, open }, ...(open ? row.members.map((result): Line => ({ kind: 'member', result, group: row.name })) : [])];
  });

  function toggleName(key: string) {
    setOpenNames((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  }

  const tickedKcal = tickedItems.reduce((sum, item) => sum + item.kcal, 0);
  const bar =
    tickedItems.length > 0 ? (
      <View style={styles.bar}>
        <View style={styles.barLine}>
          <Text accessibilityLiveRegion="polite" style={styles.barText}>
            {tickedItems.length} selected · {formatKcal(tickedKcal)}
          </Text>
          <TextButton title="Deselect all" onPress={() => setTicked([])} />
        </View>
        <TextButton title={`Add ${tickedItems.length} ${tickedItems.length === 1 ? 'food' : 'foods'}`} filled onPress={() => addAll(tickedItems)} />
      </View>
    ) : undefined;

  return (
    <FullScreen onClose={onClose} footer={bar}>
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
            <View style={[styles.searchBox, query !== '' && styles.searchBoxClearable]}>
              <Search size={20} color={colors.inkMuted} />
              <TextInput
                // Made again once Recent foods is read, so the keyboard opens by itself only when there are none (D-60).
                key={recent === null ? 'reading' : 'read'}
                accessibilityLabel="Search foods"
                value={query}
                onChangeText={setQuery}
                placeholder="e.g. atta, dal, paneer"
                autoFocus={recent !== null && recent.length === 0}
                style={styles.searchInput}
              />
              {query !== '' ? (
                <IconButton label="Clear search" onPress={() => setQuery('')}>
                  <X size={20} strokeWidth={2.25} color={colors.inkMuted} />
                </IconButton>
              ) : null}
            </View>
            {!listCached ? (
              <Message text={TEXTS.needsInternet('Downloading the food list')} offline />
            ) : query.trim() !== '' && results.length === 0 ? (
              <Text style={styles.empty}>No foods found. Try another word, or enter your own food.</Text>
            ) : query.trim() === '' && recent !== null && recent.length === 0 ? (
              <Text style={styles.empty}>Foods you log show here for {RECENT_FOOD_DAYS} days, so you can add them again with a tap.</Text>
            ) : showRecent ? (
              <View style={styles.recentHead}>
                <View style={styles.recentTitleLine}>
                  <Text accessibilityRole="header" style={styles.recentTitle}>
                    Recent foods
                  </Text>
                  <Text style={styles.detail}>Last {RECENT_FOOD_DAYS} days</Text>
                </View>
                <Text style={styles.detail}>Tick a food to add it as last time. Tap a food to change its amount.</Text>
              </View>
            ) : null}
          </View>
          {showRecent ? (
            <FlatList
              data={recent}
              keyExtractor={recentFoodKey}
              style={[styles.list, styles.listCard]}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const on = ticked.includes(recentFoodKey(item));
                const said = `${item.name}, ${formatAmount(item.amount)}, ${formatKcal(item.kcal)}`;
                return (
                  <View style={[styles.recentRow, on && styles.recentRowOn]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${said}, change the amount`}
                      onPress={() => void open(item)}
                      style={({ pressed }) => [styles.recentText, pressed && styles.pressed]}
                    >
                      <Text style={[styles.name, on && styles.nameOn]}>{item.name}</Text>
                      <Text style={styles.detail}>
                        {formatAmount(item.amount)} · {formatKcal(item.kcal)}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={said}
                      accessibilityState={{ checked: on }}
                      onPress={() => toggle(item)}
                      style={styles.tickArea}
                    >
                      <View style={[styles.tick, on && styles.tickOn]}>{on ? <Check size={18} strokeWidth={3} color={colors.onPrimary} /> : null}</View>
                    </Pressable>
                  </View>
                );
              }}
            />
          ) : (
          <FlatList
            data={lines}
            keyExtractor={(line) => (line.kind === 'brands' ? `brands:${line.row.key}` : line.kind === 'member' ? `member:${keyOf(line.result)}` : keyOf(line.result))}
            style={[styles.list, lines.length > 0 && styles.listCard]}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: line }) => {
              if (line.kind === 'brands') {
                const range = kcalRange(line.row.members);
                const Chevron = line.open ? ChevronUp : ChevronDown;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${line.row.name}, ${brandCount(line.row.members)} brands, ${range.said} per 100 g`}
                    accessibilityState={{ expanded: line.open }}
                    onPress={() => toggleName(line.row.key)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.name}>{line.row.name}</Text>
                      <Text numberOfLines={1} style={styles.detail}>
                        <Text style={styles.lead}>{brandCount(line.row.members)} brands</Text> · {range.shown} per 100 g
                      </Text>
                    </View>
                    <Chevron size={20} strokeWidth={2.25} color={colors.accent} />
                  </Pressable>
                );
              }
              const said = describe(line.result);
              if (line.kind === 'member') {
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${line.group}, ${said.lead ?? said.name}, ${said.detail}`}
                    onPress={() => setChosen({ result: line.result })}
                    style={({ pressed }) => [styles.row, styles.member, pressed && styles.pressed]}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.memberName}>{said.lead ?? said.name}</Text>
                      <Text style={styles.detail}>{said.detail}</Text>
                    </View>
                    <ChevronRight size={20} strokeWidth={2.25} color={colors.accent} />
                  </Pressable>
                );
              }
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={said.said}
                  onPress={() => setChosen({ result: line.result })}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{said.name}</Text>
                    <Text numberOfLines={1} style={styles.detail}>
                      {said.lead ? (
                        <>
                          <Text style={[styles.lead, said.mine && styles.leadMine]}>{said.lead}</Text>
                          {' · '}
                        </>
                      ) : null}
                      {said.detail}
                    </Text>
                  </View>
                  <ChevronRight size={20} strokeWidth={2.25} color={colors.accent} />
                </Pressable>
              );
            }}
          />
          )}
      {sources ? (
        <Sheet title="Food sources" onClose={() => setSources(false)} actions={<TextButton title="Close" wide onPress={() => setSources(false)} />}>
          <Text style={styles.source}>Food values: {IFCT_ACKNOWLEDGEMENT}</Text>
          <Text style={styles.source}>Foods marked INDB: {INDB_ACKNOWLEDGEMENT}</Text>
          <Text style={styles.source}>Foods marked Brand label: {BRAND_LABEL_CREDIT}</Text>
          <Text style={styles.source}>Home-style foods (a bread slice, butter toast and the like): {HOME_FOODS_CREDIT}</Text>
          <Text style={styles.source}>Foods marked Packaged: {OFF_ATTRIBUTION}.</Text>
        </Sheet>
      ) : null}
      {chosen ? (
        <FoodDetail
          result={chosen.result}
          from={chosen.from}
          addTitle={withPage.length > 0 ? `Add ${withPage.length + 1} foods` : 'Add'}
          addNote={withPage.length > 0 ? `Your ${withPage.length === 1 ? '1 ticked food goes' : `${withPage.length} ticked foods go`} in with it.` : undefined}
          onBack={() => setChosen(null)}
          onAdd={(item: MealItem) => addAll([...withPage, item])}
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
  // With the cross (D-57), whose own space fills the rest of the edge.
  searchBoxClearable: { paddingRight: 4 },
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
  // D-61, in place of the source tags: the brand (or "N brands") in the ink, a little heavier; "Your
  // food" in caramel. A name's brands, while open, sit on the sunken colour, set in under it.
  lead: { fontWeight: '600', color: c.ink },
  leadMine: { color: c.accent },
  member: { minHeight: 52, paddingLeft: 30, backgroundColor: c.surfaceSunken },
  memberName: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  source: { fontSize: 15, lineHeight: 22 },
  // Recent foods (D-60): the title in condensed capitals with "Last 5 days" across from it; each food
  // ruled on the raised card, its name opening its page, its tick box on the right; a ticked food's
  // row tinted, its name heavier, its box filled with the check.
  recentHead: { gap: 4 },
  recentTitleLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  recentTitle: { ...TYPE.screenHeader, fontSize: 20, lineHeight: 24 },
  recentRow: { minHeight: 64, flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: c.border },
  recentRowOn: { backgroundColor: c.accentTint },
  recentText: { flex: 1, justifyContent: 'center', gap: 2, paddingVertical: 10, paddingLeft: 14, paddingRight: 4 },
  nameOn: { fontWeight: '600' },
  tickArea: { width: 56, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 2, borderColor: c.inkSubtle },
  tickOn: { borderColor: c.primary, backgroundColor: c.primary },
  // The bar at the foot while foods are ticked.
  bar: { gap: 8 },
  barLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  barText: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
}));
