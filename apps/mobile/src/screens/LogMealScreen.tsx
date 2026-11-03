import {
  isIstDay,
  istToday,
  MAX_MEAL_ITEMS,
  mealTotals,
  MEAL_TAGS,
  MEAL_TYPES,
  syncWindowStart,
  type IstDay,
  type MealItem,
  type MealTag,
  type MealType,
} from '@fitsphere/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { BarcodeSheet } from '../components/BarcodeSheet';
import { CalendarSheet } from '../components/CalendarSheet';
import { FoodSearchSheet } from '../components/FoodSearchSheet';
import { MealPhotoField, type PhotoDraft } from '../components/MealPhotoField';
import { ActionsSheet, DuplicateFoodSheet, SlotPicker } from '../components/MealSheets';
import { OwnFoodSheet } from '../components/OwnFoodSheet';
import { PortionStepper } from '../components/PortionStepper';
import { Text, TextButton, TextInput, useFieldInputStyle } from '../components/ui';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, listSavedMeals, mealCounts, type LocalSavedMeal } from '../local/store';
import { addAmount, amountLimit, GRAMS_RULE, parseGrams, sameFood, withGrams, withPortions } from '../mealItems';
import { describeItems, formatAmount, formatGrams, formatKcal, formatPortions, MEAL_TAG_LABELS } from '../meals';
import { useSync } from '../sync/SyncProvider';
import { themedStyles } from '../theme';

type Params = { day?: string; slot?: string; mealId?: string };
type Sheet = 'day' | 'search' | 'barcode' | 'own' | 'saved' | { change: number };

// Log meal (REQ-LOG-001…003, REQ-LOG-006…008, REQ-LOG-010; REQ-ACC-005): the date, the meal type
// and tags, foods added by search, barcode, your own food or a saved meal, an optional photo or
// image link, and a review before saving.
// Works offline and with AI off, except the barcode lookup, which needs the internet. Opened from "+" with the selected date (Q-011) and a slot, or from Edit
// with a meal, whose date then stays the same (MVP default, D-26).
export function LogMealScreen({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const fieldInput = useFieldInputStyle();
  // The fixed footer clears the phone's navigation bar; none outside the app (tests).
  const insets = useContext(SafeAreaInsetsContext);
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const today = istToday(now());
  const firstDay = syncWindowStart(today);
  const editing = typeof params.mealId === 'string' && params.mealId !== '';

  const [id] = useState(() => (editing ? params.mealId! : sync.newId()));
  const [day, setDay] = useState<IstDay>(() =>
    typeof params.day === 'string' && isIstDay(params.day) && params.day <= today && params.day >= firstDay ? params.day : today,
  );
  const [mealType, setMealType] = useState<MealType | null>(() =>
    MEAL_TYPES.includes(params.slot as MealType) ? (params.slot as MealType) : null,
  );
  const [tags, setTags] = useState<MealTag[]>([]);
  const [items, setItems] = useState<MealItem[]>([]);
  // Foods being added that the meal already has, while "Already in this meal" asks (D-34).
  const [duplicate, setDuplicate] = useState<MealItem[] | null>(null);
  const [photo, setPhoto] = useState<PhotoDraft>(null);
  const [missing, setMissing] = useState(false);
  const [counts, setCounts] = useState<Record<IstDay, number>>({});
  const [saved, setSaved] = useState<LocalSavedMeal[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [ownName, setOwnName] = useState('');
  const [gramsText, setGramsText] = useState('');
  const [portions, setPortions] = useState(1);
  const [busy, setBusy] = useState(false);

  // Edit: the meal as it is on the phone.
  useEffect(() => {
    if (!editing || local.state.status !== 'ready') return;
    let active = true;
    void getEntry(local.state.db, 'meal', id).then((meal) => {
      if (!active) return;
      if (!meal) {
        setMissing(true);
        return;
      }
      setDay(meal.day);
      setMealType(meal.mealType);
      setTags(meal.tags);
      setItems(meal.items);
      setPhoto(meal.photo?.kind === 'photo' ? { kind: 'photo', mediaId: meal.photo.mediaId, files: null } : (meal.photo ?? null));
    });
    return () => {
      active = false;
    };
  }, [editing, id, local.state]);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([mealCounts(db, firstDay, today), listSavedMeals(db)]).then(([dayCounts, savedMeals]) => {
      if (!active) return;
      setCounts(dayCounts);
      setSaved(savedMeals);
    });
    return () => {
      active = false;
    };
  }, [local.state, firstDay, today, sync.version]);

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

  function toggleTag(tag: MealTag) {
    setTags((current) => (current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag]));
  }

  async function save() {
    if (!mealType || items.length === 0) return;
    setBusy(true);
    const mealPhoto = photo === null ? null : photo.kind === 'photo' ? { kind: 'photo' as const, mediaId: photo.mediaId } : photo;
    const newPhoto = photo?.kind === 'photo' && photo.files ? { id: photo.mediaId, files: photo.files } : undefined;
    await sync.save('meal', { id, day, mealType, tags, items, photo: mealPhoto }, newPhoto);
    setBusy(false);
    router.back();
  }

  if (missing) {
    return (
      <View style={styles.missing}>
        <Text accessibilityRole="alert">This meal is no longer on this phone.</Text>
        <TextButton title="Back" outlined onPress={() => router.back()} />
      </View>
    );
  }

  const totals = mealTotals(items);
  const changing = typeof sheet === 'object' && sheet !== null ? items[sheet.change] : undefined;
  const newGrams = parseGrams(gramsText);
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {editing ? (
          <Text accessibilityLabel={`Date: ${formatDay(day)}`} style={styles.date}>
            {formatDay(day)}
          </Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Date: ${formatDay(day)}`}
            onPress={() => setSheet('day')}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Text style={styles.chipText}>{day === today ? `Today, ${formatDay(day)}` : formatDay(day)} ▾</Text>
          </Pressable>
        )}

        <View style={styles.group}>
          <Text accessibilityRole="header" style={styles.heading}>
            Meal
          </Text>
          <SlotPicker value={mealType} onChange={setMealType} />
          <View style={styles.tags}>
            {MEAL_TAGS.map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="checkbox"
                accessibilityLabel={MEAL_TAG_LABELS[tag]}
                accessibilityState={{ checked: tags.includes(tag) }}
                onPress={() => toggleTag(tag)}
                style={[styles.tag, tags.includes(tag) && styles.tagOn]}
              >
                <Text style={[styles.tagText, tags.includes(tag) && styles.tagOnText]}>{MEAL_TAG_LABELS[tag]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Typed, spoken and photo reading come with AI meal reading (slice 7; D-26). */}
        <View style={styles.ai}>
          <Text style={styles.aiTitle}>AI meal reading is coming soon</Text>
          <Text style={styles.aiText}>For now, add foods by search, barcode, your own food or a saved meal.</Text>
        </View>

        <View style={styles.group}>
          <Text accessibilityRole="header" style={styles.heading}>
            Add food
          </Text>
          <View style={styles.methods}>
            <MethodTile title="Search foods" onPress={() => setSheet('search')} />
            <MethodTile title="Scan barcode" onPress={() => setSheet('barcode')} />
            <MethodTile
              title="Enter your own food"
              onPress={() => {
                setOwnName('');
                setSheet('own');
              }}
            />
            <MethodTile title="Saved meals" onPress={() => setSheet('saved')} />
          </View>
          <Text style={styles.tips}>
            Tips: give amounts in grams; say whether a food is raw or cooked; add each food separately.
          </Text>
        </View>

        <MealPhotoField mealId={id} value={photo} onChange={setPhoto} newId={sync.newId} />

        <View style={styles.group}>
          <Text accessibilityRole="header" style={styles.heading}>
            Review
          </Text>
          <View style={styles.review}>
            {items.length === 0 ? <Text style={styles.empty}>No foods yet.</Text> : null}
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
                  onPress={() => {
                    setGramsText(item.amount.unit === 'g' ? String(item.amount.value) : '');
                    setPortions(item.amount.unit === 'portion' ? item.amount.value : 1);
                    setSheet({ change: index });
                  }}
                  style={styles.itemAction}
                >
                  <Text style={styles.itemActionText}>•••</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Fixed below the list, so the total and Save stay in reach however many foods are added. Every
          text field here is in a sheet, which opens above it. */}
      <View style={[styles.footer, { paddingBottom: 12 + (insets?.bottom ?? 0) }]}>
        {items.length > 0 ? (
          <Text accessibilityLabel={`Total: ${formatKcal(totals.kcal)}, ${formatGrams(totals.proteinG)} protein`} style={styles.total}>
            Total: {formatKcal(totals.kcal)} · {formatGrams(totals.proteinG)} protein
          </Text>
        ) : null}
        <TextButton title="Save meal" filled disabled={!mealType || items.length === 0 || busy} onPress={() => void save()} />
        {!mealType && items.length > 0 ? <Text style={styles.hint}>Choose the meal: Breakfast, Lunch, Snack or Dinner.</Text> : null}
        {items.length === 0 ? <Text style={styles.hint}>Add at least one food to save the meal.</Text> : null}
      </View>

      {sheet === 'day' ? (
        <CalendarSheet
          title="Log this meal to"
          today={today}
          firstDay={firstDay}
          selected={day}
          counts={counts}
          onSelect={setDay}
          onClose={() => setSheet(null)}
        />
      ) : null}
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
      {sheet === 'search' ? <FoodSearchSheet onAdd={(item) => addItems([item])} onClose={() => setSheet(null)} /> : null}
      {sheet === 'barcode' ? (
        <BarcodeSheet
          onAdd={(item) => addItems([item])}
          onOwnFood={(name) => {
            setOwnName(name);
            setSheet('own');
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'own' ? <OwnFoodSheet initialName={ownName} onAdd={(item) => addItems([item])} onClose={() => setSheet(null)} /> : null}
      {sheet === 'saved' ? (
        <ActionsSheet
          title={saved.length === 0 ? 'No saved meals yet' : 'Add a saved meal'}
          actions={saved.map((entry) => ({
            label: `${entry.name} (${describeItems(entry.items)})`,
            onPress: () => {
              addItems(entry.items);
              setMealType((current) => current ?? entry.mealType);
            },
          }))}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {changing ? (
        <ActionsSheet
          title={changing.name}
          actions={[
            ...(changing.amount.unit === 'g' && newGrams !== null && newGrams !== changing.amount.value
              ? [
                  {
                    label: `Change to ${newGrams} g`,
                    onPress: () =>
                      setItems((current) => current.map((item, index) => (index === (sheet as { change: number }).change ? withGrams(item, newGrams) : item))),
                  },
                ]
              : []),
            ...(changing.amount.unit === 'portion' && portions !== changing.amount.value
              ? [
                  {
                    label: `Change to ${formatPortions(portions)}`,
                    onPress: () =>
                      setItems((current) =>
                        current.map((item, index) => (index === (sheet as { change: number }).change ? withPortions(item, portions) : item)),
                      ),
                  },
                ]
              : []),
            {
              label: 'Remove',
              destructive: true,
              onPress: () => setItems((current) => current.filter((_, index) => index !== (sheet as { change: number }).change)),
            },
          ]}
          onClose={() => setSheet(null)}
        >
          {changing.amount.unit === 'g' ? (
            <View style={styles.changeRow}>
              <TextInput
                accessibilityLabel="New grams"
                value={gramsText}
                onChangeText={setGramsText}
                keyboardType="number-pad"
                style={[fieldInput, styles.input]}
              />
              <Text style={styles.unit}>g</Text>
              {newGrams === null ? <Text style={styles.problem}>{GRAMS_RULE}</Text> : null}
            </View>
          ) : (
            <PortionStepper value={portions} onChange={setPortions} />
          )}
        </ActionsSheet>
      ) : null}
    </View>
  );
}

/** One way to add food, as a tile like Home's quick tiles. */
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

function MethodTile({ title, onPress }: { title: string; onPress(): void }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.method, pressed && styles.pressed]}>
      <Text style={styles.methodText}>{title}</Text>
    </Pressable>
  );
}

// Spacing as on Home: 24 between groups, 12 within one.
const useStyles = themedStyles((c) => ({
  screen: { flex: 1 },
  content: { padding: 16, gap: 24, paddingBottom: 24 },
  missing: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  group: { gap: 12 },
  date: { fontSize: 15, fontWeight: '600' },
  chip: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: c.surfaceSelected,
  },
  chipText: { fontSize: 15, fontWeight: '600', color: c.primaryStrong },
  heading: { fontSize: 15, fontWeight: '600' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5, borderColor: c.textFaint },
  // A tag is ticked, not chosen: lighter than a chosen meal.
  tagOn: { backgroundColor: c.surfaceSelected, borderColor: c.primaryStrong },
  tagText: { fontSize: 13, color: c.textMuted },
  tagOnText: { color: c.primaryStrong, fontWeight: '600' },
  ai: { padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.neutralLight, gap: 4 },
  aiTitle: { fontSize: 15, fontWeight: '600', color: c.neutral },
  aiText: { fontSize: 13, color: c.textMuted },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  method: { flexGrow: 1, flexBasis: '40%', minHeight: 64, justifyContent: 'center', padding: 14, borderRadius: 12, backgroundColor: c.surface },
  methodText: { fontSize: 15, fontWeight: '600', color: c.primary },
  pressed: { opacity: 0.6 },
  tips: { color: c.textMuted, fontSize: 13 },
  hint: { fontSize: 13, color: c.textMuted },
  // The meal's foods, ruled like Home's measurements.
  review: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 16, backgroundColor: c.surface },
  empty: { paddingVertical: 12, color: c.textMuted },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  itemRuled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  itemText: { flex: 1, gap: 2 },
  itemName: { fontSize: 15, fontWeight: '600' },
  itemDetail: { fontSize: 13, color: c.textMuted, fontVariant: ['tabular-nums'] },
  itemAction: { width: 44, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
  itemActionText: { color: c.textMuted, fontWeight: '700' },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.background },
  total: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  // The change-grams field in its sheet, as Field, beside its unit.
  input: { flex: 1, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 15, color: c.textMuted },
  problem: { fontSize: 13, color: c.error },
}));
