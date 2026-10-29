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
import { useEffect, useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BarcodeSheet } from '../components/BarcodeSheet';
import { DaySheet } from '../components/DaySheet';
import { FoodSearchSheet } from '../components/FoodSearchSheet';
import { ActionsSheet, SlotPicker } from '../components/MealSheets';
import { OwnFoodSheet } from '../components/OwnFoodSheet';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, listSavedMeals, mealCounts, type LocalSavedMeal } from '../local/store';
import { GRAMS_RULE, parseGrams, withGrams } from '../mealItems';
import { describeItems, formatAmount, formatGrams, formatKcal, MEAL_TAG_LABELS } from '../meals';
import { useSync } from '../sync/SyncProvider';

type Params = { day?: string; slot?: string; mealId?: string };
type Sheet = 'day' | 'search' | 'barcode' | 'own' | 'saved' | { change: number };

// Log meal (REQ-LOG-001…003, REQ-LOG-007, REQ-LOG-008; REQ-ACC-005): the date, the meal type and
// tags, foods added by search, barcode, your own food or a saved meal, and a review before saving.
// Works offline and with AI off, except the barcode lookup, which needs the internet. Opened from "+" with the selected date (Q-011) and a slot, or from Edit
// with a meal, whose date then stays the same (MVP default, D-26).
export function LogMealScreen({ now = () => new Date() }: { now?: () => Date }) {
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
  const [missing, setMissing] = useState(false);
  const [counts, setCounts] = useState<Record<IstDay, number>>({});
  const [saved, setSaved] = useState<LocalSavedMeal[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [ownName, setOwnName] = useState('');
  const [gramsText, setGramsText] = useState('');
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
    setItems((current) => [...current, ...added].slice(0, MAX_MEAL_ITEMS));
  }

  function toggleTag(tag: MealTag) {
    setTags((current) => (current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag]));
  }

  async function save() {
    if (!mealType || items.length === 0) return;
    setBusy(true);
    await sync.save('meal', { id, day, mealType, tags, items });
    setBusy(false);
    router.back();
  }

  if (missing) {
    return (
      <View style={styles.missing}>
        <Text accessibilityRole="alert">This meal is no longer on this phone.</Text>
        <Button title="Back" onPress={() => router.back()} />
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
          <Pressable accessibilityRole="button" accessibilityLabel={`Date: ${formatDay(day)}`} onPress={() => setSheet('day')} style={styles.chip}>
            <Text style={styles.chipText}>{day === today ? `Today, ${formatDay(day)}` : formatDay(day)} ▾</Text>
          </Pressable>
        )}

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
              <Text style={tags.includes(tag) ? styles.tagOnText : undefined}>{MEAL_TAG_LABELS[tag]}</Text>
            </Pressable>
          ))}
        </View>

        {/* Typed, spoken and photo reading come with AI meal reading (slice 7; D-26). */}
        <View style={styles.ai}>
          <Text style={styles.aiTitle}>AI meal reading is coming soon</Text>
          <Text style={styles.aiText}>For now, add foods by search, barcode, your own food or a saved meal.</Text>
        </View>

        <Text accessibilityRole="header" style={styles.heading}>
          Add food
        </Text>
        <View style={styles.methods}>
          <Button title="Search foods" onPress={() => setSheet('search')} />
          <Button title="Scan barcode" onPress={() => setSheet('barcode')} />
          <Button
            title="Enter your own food"
            onPress={() => {
              setOwnName('');
              setSheet('own');
            }}
          />
          <Button title="Saved meals" onPress={() => setSheet('saved')} />
        </View>
        <Text style={styles.tips}>
          Tips: give amounts in grams; say whether a food is raw or cooked (cooked rice weighs about 3 times raw);
          add each food separately.
        </Text>

        <Text accessibilityRole="header" style={styles.heading}>
          Review
        </Text>
        {items.length === 0 ? <Text style={styles.hint}>No foods yet.</Text> : null}
        {items.map((item, index) => (
          <View key={index} style={styles.item}>
            <View style={styles.itemText}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text accessibilityLabel={`${item.name}: ${formatAmount(item.amount)}, ${formatKcal(item.kcal)}, ${formatGrams(item.proteinG)} protein`}>
                {formatAmount(item.amount)} · {formatKcal(item.kcal)} · {formatGrams(item.proteinG)} protein
                {item.estimated ? ' · estimated' : ''}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Change ${item.name}`}
              onPress={() => {
                setGramsText(item.amount.unit === 'g' ? String(item.amount.value) : '');
                setSheet({ change: index });
              }}
              style={styles.itemAction}
            >
              <Text>•••</Text>
            </Pressable>
          </View>
        ))}
        {items.length > 0 ? (
          <Text accessibilityLabel={`Total: ${formatKcal(totals.kcal)}, ${formatGrams(totals.proteinG)} protein`} style={styles.total}>
            Total: {formatKcal(totals.kcal)} · {formatGrams(totals.proteinG)} protein
          </Text>
        ) : null}
        <Button title="Save meal" disabled={!mealType || items.length === 0 || busy} onPress={() => void save()} />
        {!mealType && items.length > 0 ? <Text style={styles.hint}>Choose the meal: Breakfast, Lunch, Snack or Dinner.</Text> : null}
      </ScrollView>

      {sheet === 'day' ? (
        <DaySheet today={today} firstDay={firstDay} selected={day} counts={counts} onSelect={setDay} onClose={() => setSheet(null)} />
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
            {
              label: 'Remove',
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
                style={styles.input}
              />
              <Text>g</Text>
              {newGrams === null ? <Text style={styles.problem}>{GRAMS_RULE}</Text> : null}
            </View>
          ) : null}
        </ActionsSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  missing: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  date: { fontSize: 16, fontWeight: '600' },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#e3ecf8' },
  chipText: { fontWeight: '600', color: '#0d47a1' },
  heading: { fontSize: 16, fontWeight: '600' },
  tags: { flexDirection: 'row', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#999' },
  tagOn: { backgroundColor: '#455a64', borderColor: '#455a64' },
  tagOnText: { color: '#fff' },
  ai: { padding: 12, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#90a4ae', gap: 4 },
  aiTitle: { fontWeight: '600', color: '#455a64' },
  aiText: { color: '#555' },
  methods: { gap: 8 },
  tips: { color: '#555', fontSize: 13 },
  hint: { color: '#555' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: '#f1f5fb', gap: 8 },
  itemText: { flex: 1, gap: 2 },
  itemName: { fontWeight: '600' },
  itemAction: { paddingHorizontal: 8, paddingVertical: 4 },
  total: { fontWeight: '600' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  input: { flex: 1, borderWidth: 1, borderColor: '#999', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  problem: { color: '#b00020' },
});
