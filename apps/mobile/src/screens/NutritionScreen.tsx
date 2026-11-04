import { addDays, type IstDay, type MealTotals, type MealType } from '@fitsphere/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bookmark, ChevronDown, ChevronUp, ClipboardList, History, Plus } from 'lucide-react-native';
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
import { describeItems, formatKcal, MEAL_TYPE_LABELS, MEAL_TYPE_ORDER, suggestedSavedName } from '../meals';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';

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
/** Food names shown in a closed slot, before "+ N more". */
const FOODS_SHOWN = 5;

export function NutritionScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { today, selected, firstDay, stripStart, select, showDays } = useSelectedDay();
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
  // The slots opened to show each meal (D-34): all closed again when the day changes.
  const [open, setOpen] = useState<ReadonlySet<MealType>>(new Set());
  const [openDay, setOpenDay] = useState(selected);
  if (openDay !== selected) {
    setOpenDay(selected);
    setOpen(new Set());
  }

  function toggle(slot: MealType) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([
      listMealsOfDay(db, selected),
      dayNutrition(db, selected),
      mealCounts(db, stripStart, addDays(stripStart, 6)),
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
  }, [local.state, selected, stripStart, sync.version]);

  function logMeal(slot?: MealType) {
    router.push({ pathname: '/log-meal', params: { day: selected, ...(slot ? { slot } : {}) } });
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <WeekStrip
          today={today}
          firstDay={firstDay}
          selected={selected}
          start={stripStart}
          mealDays={mealDays}
          onSelect={select}
          onShow={showDays}
        />
        {selected !== today ? (
          <View style={styles.banner}>
            <History size={20} color={colors.accent} />
            <Text style={styles.bannerText}>Showing {formatDay(selected)}</Text>
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
              const label = MEAL_TYPE_LABELS[slot];
              const slotMeals = meals.filter((meal) => meal.mealType === slot);
              const isOpen = open.has(slot);
              const kcal = slotMeals.reduce((sum, meal) => sum + meal.kcal, 0);
              const names = [...new Set(slotMeals.flatMap((meal) => meal.items.map((item) => item.name)))];
              const foods =
                names.length > FOODS_SHOWN ? `${names.slice(0, FOODS_SHOWN).join(', ')} + ${names.length - FOODS_SHOWN} more` : names.join(', ');
              // A slot with meals opens and closes from its heading or its chevron (D-34); screen
              // readers get the chevron, so they don't hear two controls that do the same.
              return (
                <View key={slot} style={styles.slot}>
                  <View style={styles.slotHeader}>
                    <Pressable accessible={false} disabled={slotMeals.length === 0} onPress={() => toggle(slot)} style={styles.slotHeading}>
                      <Text accessibilityRole="header" style={styles.slotTitle}>
                        {label}
                      </Text>
                      {slotMeals.length > 0 ? (
                        <Text style={styles.slotTotal}>
                          {formatKcal(kcal)} · {slotMeals.length} {slotMeals.length === 1 ? 'meal' : 'meals'}
                        </Text>
                      ) : null}
                    </Pressable>
                    {/* The chevron sits before the "+", next to what it opens. */}
                    {slotMeals.length > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${isOpen ? 'Hide' : 'Show'} ${label} meals`}
                        accessibilityState={{ expanded: isOpen }}
                        onPress={() => toggle(slot)}
                        style={({ pressed }) => [styles.chevron, pressed && styles.pressed]}
                      >
                        {isOpen ? <ChevronUp size={22} color={colors.accent} /> : <ChevronDown size={22} color={colors.accent} />}
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add to ${label}`}
                      onPress={() => logMeal(slot)}
                      hitSlop={4}
                      style={({ pressed }) => [styles.slotAdd, pressed && styles.pressed]}
                    >
                      <Plus size={22} strokeWidth={2.5} color={colors.accent} />
                    </Pressable>
                  </View>
                  {slotMeals.length === 0 ? <Text style={styles.hint}>Tap to add what you ate</Text> : null}
                  {slotMeals.length > 0 && !isOpen ? (
                    <Text numberOfLines={2} style={styles.foods}>
                      {foods}
                    </Text>
                  ) : null}
                  {isOpen
                    ? slotMeals.map((meal) => (
                        <MealCard
                          key={meal.id}
                          title={`${label}: ${describeItems(meal.items)}`}
                          items={meal.items}
                          tags={meal.tags}
                          totals={meal}
                          syncState={meal.syncState}
                          photo={meal.photo ? { mealId: meal.id, photo: meal.photo } : null}
                          savedAt={meal.recordedAt}
                          onEdit={() => router.push({ pathname: '/log-meal', params: { mealId: meal.id } })}
                          onSave={() => setSheet({ kind: 'saveMeal', meal })}
                          onDelete={() => setSheet({ kind: 'deleteMeal', meal })}
                        />
                      ))
                    : null}
                </View>
              );
            })}
          </>
        ) : null}

        {tab === 'plan' ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyTile}>
              <ClipboardList size={26} color={colors.accent} />
            </View>
            <Text style={styles.emptyText}>No diet plan yet. Your coach will add one here.</Text>
          </View>
        ) : null}

        {tab === 'saved' ? (
          saved.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyTile}>
                <Bookmark size={26} color={colors.accent} />
              </View>
              <Text style={styles.emptyText}>No saved meals yet. In Consumed, tap the bookmark on a meal to save it to your meals.</Text>
            </View>
          ) : (
            saved.map((entry) => (
              <MealCard
                key={entry.id}
                title={entry.name}
                name={entry.name}
                standalone
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
// The redesign's 3.1 and 3.3 (locked by the owner, 2026-11-03): cards 12 apart in the 16 gutter,
// radius 4; each meal slot a card with its name in condensed capitals, its chevron and a square "+".
const useStyles = themedStyles((c) => ({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100, gap: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: c.accentTint,
  },
  bannerText: { flex: 1, fontSize: 15, lineHeight: 22 },
  body: { fontSize: 15 },
  tabs: { flexDirection: 'row', gap: 8 },
  // Equal widths, as the meal pills on Log meal: 8 at the sides and one line, which shrinks a little
  // rather than wrap when the phone's text is large.
  tab: { flex: 1, paddingHorizontal: 8 },
  slot: { gap: 10, paddingVertical: 14, paddingLeft: 16, paddingRight: 10, borderRadius: 4, backgroundColor: c.surface },
  slotHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // The heading takes the row's room, so tapping anywhere on it opens or closes the slot.
  slotHeading: { flex: 1, minHeight: 44, justifyContent: 'center', gap: 2 },
  slotTitle: { ...TYPE.metric, lineHeight: 24 },
  slotTotal: { fontSize: 14, lineHeight: 20, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  chevron: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  foods: { paddingRight: 6, fontSize: 15, lineHeight: 22, color: c.inkMuted },
  slotAdd: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  hint: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  emptyCard: { gap: 12, padding: 16, borderRadius: 4, backgroundColor: c.surface },
  emptyTile: { width: 56, height: 56, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  emptyText: { fontSize: 15, lineHeight: 22 },
}));
