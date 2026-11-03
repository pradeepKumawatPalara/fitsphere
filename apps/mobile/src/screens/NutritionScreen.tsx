import { addDays, type IstDay, type MealTotals, type MealType } from '@fitsphere/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { EatenSummary } from '../components/EatenSummary';
import { LogMealButton } from '../components/LogMealButton';
import { MealCard } from '../components/MealCard';
import { ConfirmSheet, RelogSheet, SaveMealSheet } from '../components/MealSheets';
import { WeekStrip } from '../components/WeekStrip';
import { Text, TextButton, useChoiceStyles } from '../components/ui';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import {
  dayNutrition,
  listMealsOfDay,
  listSavedMeals,
  mealCounts,
  type LocalMeal,
  type LocalSavedMeal,
} from '../local/store';
import { describeItems, MEAL_TYPE_LABELS, MEAL_TYPE_ORDER, suggestedSavedName } from '../meals';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles } from '../theme';

type Tab = 'consumed' | 'plan' | 'saved';
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'consumed', label: 'Consumed' },
  { tab: 'plan', label: 'Diet plan' },
  { tab: 'saved', label: 'Saved' },
];

type Sheet =
  | { kind: 'deleteMeal'; meal: LocalMeal }
  | { kind: 'saveMeal'; meal: LocalMeal }
  | { kind: 'deleteSaved'; saved: LocalSavedMeal }
  | { kind: 'relog'; saved: LocalSavedMeal };

function asTab(value: string | undefined): Tab | null {
  return TABS.some((entry) => entry.tab === value) ? (value as Tab) : null;
}

// Nutrition (REQ-NUT-001…004, REQ-PLAN-007, REQ-SAVED-001/002): the selected day's meals by slot,
// the Diet plan empty state (D-20) and the saved meals. Shares the selected date with Home.
export function NutritionScreen() {
  const styles = useStyles();
  const pill = useChoiceStyles();
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { today, selected, firstDay, weekStart, select, showWeek } = useSelectedDay();
  const [tab, setTab] = useState<Tab>(asTab(params.tab) ?? 'consumed');
  // "By meal" on Home opens Consumed (Q-023), even when another tab was open here.
  const [paramTab, setParamTab] = useState(params.tab);
  if (params.tab !== paramTab) {
    setParamTab(params.tab);
    const next = asTab(params.tab);
    if (next) setTab(next);
  }
  const [meals, setMeals] = useState<LocalMeal[]>([]);
  const [totals, setTotals] = useState<MealTotals | null>(null);
  const [mealDays, setMealDays] = useState<ReadonlySet<IstDay>>(new Set());
  const [saved, setSaved] = useState<LocalSavedMeal[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([
      listMealsOfDay(db, selected),
      dayNutrition(db, selected),
      mealCounts(db, weekStart, addDays(weekStart, 6)),
      listSavedMeals(db),
    ]).then(([dayMeals, nutrition, counts, savedMeals]) => {
      if (!active) return;
      setMeals(dayMeals);
      setTotals(nutrition);
      setMealDays(new Set(Object.keys(counts)));
      setSaved(savedMeals);
    });
    return () => {
      active = false;
    };
  }, [local.state, selected, weekStart, sync.version]);

  function logMeal(slot?: MealType) {
    router.push({ pathname: '/log-meal', params: { day: selected, ...(slot ? { slot } : {}) } });
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <WeekStrip
          today={today}
          firstDay={firstDay}
          selected={selected}
          weekStart={weekStart}
          mealDays={mealDays}
          onSelect={select}
          onWeekChange={showWeek}
        />
        {selected !== today ? (
          <View style={styles.banner}>
            <Text style={styles.body}>Showing {formatDay(selected)}</Text>
            <TextButton title="Back to today" onPress={() => select(today)} />
          </View>
        ) : null}
        <View accessibilityRole="tablist" style={styles.tabs}>
          {TABS.map((entry) => (
            <Pressable
              key={entry.tab}
              accessibilityRole="tab"
              accessibilityLabel={entry.label}
              accessibilityState={{ selected: tab === entry.tab }}
              onPress={() => setTab(entry.tab)}
              style={({ pressed }) => [pill.choice, styles.tab, tab === entry.tab && pill.chosen, pressed && pill.pressed]}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[pill.choiceText, tab === entry.tab && pill.chosenText]}>
                {entry.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'consumed' ? (
          <>
            <EatenSummary totals={totals} />
            {MEAL_TYPE_ORDER.map((slot) => {
              const slotMeals = meals.filter((meal) => meal.mealType === slot);
              return (
                <View key={slot} style={styles.slot}>
                  <View style={styles.slotHeader}>
                    <Text accessibilityRole="header" style={styles.slotTitle}>
                      {MEAL_TYPE_LABELS[slot]}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add to ${MEAL_TYPE_LABELS[slot]}`}
                      onPress={() => logMeal(slot)}
                      hitSlop={4}
                      style={({ pressed }) => [styles.slotAdd, pressed && styles.pressed]}
                    >
                      <Text style={styles.slotAddText}>+</Text>
                    </Pressable>
                  </View>
                  {slotMeals.length === 0 ? <Text style={styles.hint}>Tap to add what you ate</Text> : null}
                  {slotMeals.map((meal) => (
                    <MealCard
                      key={meal.id}
                      title={`${MEAL_TYPE_LABELS[slot]}: ${describeItems(meal.items)}`}
                      items={meal.items}
                      tags={meal.tags}
                      totals={meal}
                      syncState={meal.syncState}
                      photo={meal.photo ? { mealId: meal.id, photo: meal.photo } : null}
                      onEdit={() => router.push({ pathname: '/log-meal', params: { mealId: meal.id } })}
                      onSave={() => setSheet({ kind: 'saveMeal', meal })}
                      onDelete={() => setSheet({ kind: 'deleteMeal', meal })}
                    />
                  ))}
                </View>
              );
            })}
          </>
        ) : null}

        {tab === 'plan' ? <Text style={styles.empty}>No diet plan yet. Your coach will add one here.</Text> : null}

        {tab === 'saved' ? (
          saved.length === 0 ? (
            <Text style={styles.empty}>
              No saved meals yet. In Consumed, tap the bookmark on a meal to save it to your meals.
            </Text>
          ) : (
            saved.map((entry) => (
              <MealCard
                key={entry.id}
                title={entry.name}
                items={entry.items}
                tags={entry.tags}
                totals={entry}
                syncState={entry.syncState}
                onPress={() => setSheet({ kind: 'relog', saved: entry })}
                onDelete={() => setSheet({ kind: 'deleteSaved', saved: entry })}
              />
            ))
          )
        ) : null}
      </ScrollView>
      <LogMealButton day={selected} />

      {sheet?.kind === 'deleteMeal' ? (
        <ConfirmSheet
          title="Delete this meal?"
          confirmLabel="Delete"
          onConfirm={() => void sync.remove('meal', sheet.meal.id)}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet?.kind === 'saveMeal' ? (
        <SaveMealSheet
          initialName={suggestedSavedName(sheet.meal.items)}
          onSave={(name) =>
            void sync.save('savedMeal', {
              id: sync.newId(),
              name,
              mealType: sheet.meal.mealType,
              tags: sheet.meal.tags,
              items: sheet.meal.items,
            })
          }
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet?.kind === 'deleteSaved' ? (
        <ConfirmSheet
          title="Delete this saved meal?"
          confirmLabel="Delete"
          onConfirm={() => void sync.remove('savedMeal', sheet.saved.id)}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet?.kind === 'relog' ? (
        <RelogSheet
          name={sheet.saved.name}
          dayLabel={formatDay(selected)}
          slot={sheet.saved.mealType}
          onLog={(slot) =>
            void sync.save('meal', {
              id: sync.newId(),
              day: selected,
              mealType: slot,
              tags: sheet.saved.tags,
              items: sheet.saved.items,
            })
          }
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

// As Home: 24 between groups, 12 within one, the banner the same. The tabs are choice pills (the
// chosen one filled); each meal slot is a panel, its + outlined so the filled Log meal button stays
// the screen's main action.
const useStyles = themedStyles((c) => ({
  screen: { flex: 1 },
  content: { padding: 16, gap: 24, paddingBottom: 96 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: c.warningSurface,
  },
  body: { fontSize: 15 },
  tabs: { flexDirection: 'row', gap: 8 },
  // Equal widths, as the meal pills on Log meal: 8 at the sides and one line, which shrinks a little
  // rather than wrap when the phone's text is large.
  tab: { flex: 1, paddingHorizontal: 8 },
  slot: { gap: 12, padding: 16, borderRadius: 12, backgroundColor: c.surface },
  slotHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotTitle: { fontSize: 15, fontWeight: '600' },
  slotAdd: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  slotAddText: { color: c.primary, fontSize: 20, fontWeight: '600', lineHeight: 24 },
  pressed: { opacity: 0.6 },
  hint: { fontSize: 15, color: c.textMuted },
  empty: { fontSize: 15, color: c.textMuted, textAlign: 'center', paddingVertical: 24 },
}));
