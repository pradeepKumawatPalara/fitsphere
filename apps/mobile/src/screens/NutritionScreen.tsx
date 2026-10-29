import { addDays, type IstDay, type MealTotals, type MealType } from '@fitsphere/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EatenSummary } from '../components/EatenSummary';
import { LogMealButton } from '../components/LogMealButton';
import { MealCard } from '../components/MealCard';
import { ActionsSheet, ConfirmSheet, RelogSheet, SaveMealSheet } from '../components/MealSheets';
import { WeekStrip } from '../components/WeekStrip';
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

type Tab = 'consumed' | 'plan' | 'saved';
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'consumed', label: 'Consumed' },
  { tab: 'plan', label: 'Diet plan' },
  { tab: 'saved', label: 'Saved' },
];

type Sheet =
  | { kind: 'mealMenu'; meal: LocalMeal }
  | { kind: 'deleteMeal'; meal: LocalMeal }
  | { kind: 'saveMeal'; meal: LocalMeal }
  | { kind: 'savedMenu'; saved: LocalSavedMeal }
  | { kind: 'deleteSaved'; saved: LocalSavedMeal }
  | { kind: 'relog'; saved: LocalSavedMeal };

function asTab(value: string | undefined): Tab | null {
  return TABS.some((entry) => entry.tab === value) ? (value as Tab) : null;
}

// Nutrition (REQ-NUT-001…004, REQ-PLAN-007, REQ-SAVED-001/002): the selected day's meals by slot,
// the Diet plan empty state (D-20) and the saved meals. Shares the selected date with Home.
export function NutritionScreen() {
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
            <Text>Showing {formatDay(selected)}</Text>
            <Button title="Back to today" onPress={() => select(today)} />
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
              style={[styles.tab, tab === entry.tab && styles.tabChosen]}
            >
              <Text style={tab === entry.tab ? styles.tabChosenText : undefined}>{entry.label}</Text>
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
                      style={styles.slotAdd}
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
                      onMenu={() => setSheet({ kind: 'mealMenu', meal })}
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
              No saved meals yet. In Consumed, open a meal&apos;s ••• menu and choose &quot;Save to my meals&quot;.
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
                onMenu={() => setSheet({ kind: 'savedMenu', saved: entry })}
              />
            ))
          )
        ) : null}
      </ScrollView>
      <LogMealButton day={selected} />

      {sheet?.kind === 'mealMenu' ? (
        <ActionsSheet
          title={describeItems(sheet.meal.items)}
          actions={[
            { label: 'Edit', onPress: () => router.push({ pathname: '/log-meal', params: { mealId: sheet.meal.id } }) },
            { label: 'Delete', onPress: () => setSheet({ kind: 'deleteMeal', meal: sheet.meal }) },
            { label: 'Save to my meals', onPress: () => setSheet({ kind: 'saveMeal', meal: sheet.meal }) },
          ]}
          onClose={() => setSheet((current) => (current?.kind === 'mealMenu' ? null : current))}
        />
      ) : null}
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
      {sheet?.kind === 'savedMenu' ? (
        <ActionsSheet
          title={sheet.saved.name}
          actions={[{ label: 'Delete', onPress: () => setSheet({ kind: 'deleteSaved', saved: sheet.saved }) }]}
          onClose={() => setSheet((current) => (current?.kind === 'savedMenu' ? null : current))}
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 96 },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderRadius: 8, backgroundColor: '#fff4d6' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#1565c0' },
  tabChosen: { backgroundColor: '#1565c0' },
  tabChosenText: { color: '#fff', fontWeight: '600' },
  slot: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#f1f5fb' },
  slotHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotTitle: { fontSize: 16, fontWeight: '600' },
  slotAdd: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1565c0', alignItems: 'center', justifyContent: 'center' },
  slotAddText: { color: '#fff', fontSize: 20, lineHeight: 22 },
  hint: { color: '#555' },
  empty: { color: '#555', textAlign: 'center', paddingVertical: 24 },
});
