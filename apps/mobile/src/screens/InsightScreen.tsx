import { isIstDay, istToday, MEAL_TYPES, syncWindowStart, type IstDay, type MealType, type TargetKind } from '@fitsphere/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, ChartPie, Check, ChevronDown, ChevronUp, Info, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { MEAL_ICONS } from '../components/MealSheets';
import { Text, TextButton, useChoiceStyles } from '../components/ui';
import { formatDay, formatInteger } from '../format';
import {
  asInsightScope,
  formatInsightGrams,
  INSIGHT_NUTRIENTS,
  INSIGHT_SCOPES,
  kcalByMeal,
  missingNote,
  nutrientLines,
  percentOf,
  scopeKcal,
  TOP_FOOD_KEYS,
  topFoods,
  type InsightScope,
  type TopFoodKey,
} from '../insight';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listMealsOfDay, listTargets, type LocalMeal } from '../local/store';
import { formatAmount, formatKcal, MEAL_TYPE_LABELS } from '../meals';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';

/** Top foods shown before "Show all" (the owner, 2026-11-10). */
const TOP_SHOWN = 5;

function scopeLabel(scope: InsightScope): string {
  return scope === 'day' ? 'Whole day' : MEAL_TYPE_LABELS[scope];
}

// Insight (REQ-NUT-005, REQ-NUT-006; D-70): opened from a logged meal's Insight icon on its meal
// type, for that meal's date. The tiles switch between the whole day and its meals. The calories,
// then protein, carbs, fat and fibre against the daily targets, then the foods that gave the most.
// Only numbers, no advice; read from the phone, so it works offline. The redesign's 3.10 (approved
// by the owner, 2026-11-10).
export function InsightScreen({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; scope?: string }>();
  const today = istToday(now());
  const firstDay = syncWindowStart(today);
  const day: IstDay =
    typeof params.day === 'string' && isIstDay(params.day) && params.day <= today && params.day >= firstDay ? params.day : today;
  const [scope, setScope] = useState<InsightScope>(() => asInsightScope(params.scope));
  const [topKey, setTopKey] = useState<TopFoodKey>('kcal');
  const [showAll, setShowAll] = useState(false);
  const [meals, setMeals] = useState<LocalMeal[] | null>(null);
  const [targets, setTargets] = useState<Partial<Record<TargetKind, number>>>({});

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([listMealsOfDay(db, day), listTargets(db)]).then(([dayMeals, list]) => {
      if (!active) return;
      setMeals(dayMeals);
      setTargets(Object.fromEntries(list.map((target) => [target.kind, target.value])));
    });
    return () => {
      active = false;
    };
  }, [local.state, day, sync.version]);

  function choose(next: InsightScope) {
    setScope(next);
    setShowAll(false);
  }

  if (meals === null) return <View style={styles.screen} />;

  const dayLabel = formatDay(day);
  const byMeal = kcalByMeal(meals);
  const inScope = scope === 'day' ? meals : meals.filter((meal) => meal.mealType === scope);
  const label = scopeLabel(scope);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.date}>{day === today ? `Today · ${dayLabel}` : dayLabel}</Text>

      <View accessibilityRole="radiogroup" accessibilityLabel="Show" style={styles.tiles}>
        {INSIGHT_SCOPES.map((entry) => {
          const chosen = entry === scope;
          const hasFood = entry !== 'day' && byMeal[entry] !== null;
          const Icon = entry === 'day' ? CalendarDays : MEAL_ICONS[entry];
          return (
            <Pressable
              key={entry}
              accessibilityRole="radio"
              accessibilityLabel={scopeLabel(entry)}
              accessibilityState={{ checked: chosen }}
              accessibilityValue={hasFood ? { text: 'has food' } : undefined}
              onPress={() => choose(entry)}
              style={({ pressed }) => [styles.tile, chosen && styles.tileChosen, pressed && pill.pressed]}
            >
              <Icon size={22} strokeWidth={2} color={chosen ? colors.onPrimary : colors.accent} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.tileText, chosen && styles.tileTextChosen]}>
                {entry === 'day' ? 'Day' : MEAL_TYPE_LABELS[entry]}
              </Text>
              {hasFood ? (
                <View testID={`has-food-${entry}`} style={styles.tick}>
                  <Check size={10} strokeWidth={4} color={colors.bg} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {inScope.length === 0 ? (
        <View style={styles.card}>
          <View style={styles.emptyTile}>
            <ChartPie size={26} color={colors.accent} />
          </View>
          <Text style={styles.body}>{scope === 'day' ? `Nothing logged on ${dayLabel}.` : `Nothing logged for ${label} on ${dayLabel}.`}</Text>
          <TextButton
            title={scope === 'day' ? 'Log meal' : `Add to ${label}`}
            outlined
            wide
            icon={Plus}
            onPress={() => router.push({ pathname: '/log-meal', params: { day, ...(scope === 'day' ? {} : { slot: scope }) } })}
          />
        </View>
      ) : (
        <>
          <CaloriesCard meals={meals} scope={scope} target={targets.calories ?? null} byMeal={byMeal} onSetTarget={() => router.push('/targets')} />
          <NutrientsCard meals={meals} scope={scope} targets={targets} onSetTarget={() => router.push('/targets')} />
          <TopFoodsCard
            meals={meals}
            scope={scope}
            topKey={topKey}
            showAll={showAll}
            onKey={(key) => {
              setTopKey(key);
              setShowAll(false);
            }}
            onShowAll={() => setShowAll((value) => !value)}
          />
        </>
      )}
    </ScrollView>
  );
}

/** The scope's kcal, its share of the daily target, and the day split by meal. No meal budget. */
function CaloriesCard({
  meals,
  scope,
  target,
  byMeal,
  onSetTarget,
}: {
  meals: readonly LocalMeal[];
  scope: InsightScope;
  target: number | null;
  byMeal: Record<MealType, number | null>;
  onSetTarget(): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const kcal = scopeKcal(meals, scope);
  const dayKcal = scopeKcal(meals, 'day');
  const label = scopeLabel(scope);
  const chosen = (type: MealType) => scope === 'day' || scope === type;
  // The bar spans the daily target, or the day's eating when that is more (or there is no target).
  const span = Math.max(target ?? 0, dayKcal, 1);
  const over = target !== null && dayKcal > target;
  return (
    <View accessibilityLabel={`${label} calories`} style={styles.card}>
      <Text style={styles.cardTitle}>{label} · calories</Text>
      <View accessible accessibilityLabel={formatKcal(kcal)} style={styles.hero}>
        <Text style={styles.heroNumber}>{formatInteger(Math.round(kcal))}</Text>
        <Text style={styles.heroUnit}>kcal</Text>
      </View>
      {target !== null ? (
        <Text style={styles.body}>
          {scope === 'day' ? '' : `${label}: `}
          {percentOf(kcal, target)}% of your {formatInteger(target)} kcal daily target
        </Text>
      ) : (
        <View style={styles.noTarget}>
          <Text style={styles.small}>No daily target</Text>
          <TextButton title="Set a target" outlined onPress={onSetTarget} />
        </View>
      )}
      <View testID="kcal-bar" style={styles.kcalBar}>
        {MEAL_TYPES.map((type) => {
          const value = byMeal[type];
          if (!value) return null;
          return (
            <View
              key={type}
              testID={`kcal-bar-${type}`}
              style={[styles.kcalPart, { width: `${(value / span) * 100}%`, backgroundColor: chosen(type) ? colors.accent : colors.inkSubtle }]}
            />
          );
        })}
      </View>
      <View>
        {MEAL_TYPES.map((type, index) => {
          const value = byMeal[type];
          const bold = scope === type;
          return (
            <View key={type} accessible accessibilityLabel={`${MEAL_TYPE_LABELS[type]}: ${value === null ? 'nothing logged' : formatKcal(value)}`} style={[styles.mealRow, index > 0 && styles.ruled]}>
              <View style={[styles.swatch, { backgroundColor: value === null ? 'transparent' : chosen(type) ? colors.accent : colors.inkSubtle }]} />
              <Text style={[styles.mealName, !chosen(type) && styles.muted, bold && styles.bold]}>{MEAL_TYPE_LABELS[type]}</Text>
              <Text style={[styles.mealValue, !chosen(type) && styles.muted, bold && styles.bold]}>{value === null ? '–' : formatKcal(value)}</Text>
            </View>
          );
        })}
        {target !== null ? (
          <View accessible accessibilityLabel={`${over ? 'Over today' : 'Left today'}: ${formatKcal(Math.abs(target - dayKcal))}`} style={[styles.mealRow, styles.ruled]}>
            <View style={[styles.swatch, { backgroundColor: colors.track }]} />
            <Text style={[styles.mealName, styles.muted, styles.semibold]}>{over ? 'Over today' : 'Left today'}</Text>
            <Text style={[styles.mealValue, styles.semibold, over && styles.overText]}>{formatKcal(Math.abs(target - dayKcal))}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Protein, carbs, fat and fibre against the daily targets; a meal's part solid, the rest of the day faded. */
function NutrientsCard({
  meals,
  scope,
  targets,
  onSetTarget,
}: {
  meals: readonly LocalMeal[];
  scope: InsightScope;
  targets: Partial<Record<TargetKind, number>>;
  onSetTarget(): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const meal = scope !== 'day';
  return (
    <View accessibilityLabel="Against your daily targets" style={[styles.card, styles.cardTight]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>Against your daily targets</Text>
        {meal ? (
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.key}>
            <View style={styles.keyItem}>
              <View style={[styles.keyMark, { backgroundColor: colors.inkMuted }]} />
              <Text style={styles.keyText}>{scopeLabel(scope)}</Text>
            </View>
            <View style={styles.keyItem}>
              <View style={[styles.keyMark, styles.faded, { backgroundColor: colors.inkMuted }]} />
              <Text style={styles.keyText}>Rest of today</Text>
            </View>
          </View>
        ) : null}
      </View>
      {nutrientLines(meals, scope, targets).map(({ nutrient, amount, dayAmount, target, missing }, index) => {
        const colour = colors[nutrient.colour];
        const eaten = amount ?? 0;
        const day = dayAmount ?? 0;
        const over = target !== null && day > target;
        const mine = target === null ? 0 : Math.min(100, (eaten / target) * 100);
        const rest = target === null || !meal ? 0 : Math.max(0, Math.min(100 - mine, ((day - eaten) / target) * 100));
        const of = target === null ? '' : ` of ${formatInsightGrams(target)}`;
        return (
          <View key={nutrient.key} testID={`nutrient-${nutrient.target}`} style={[styles.nutrient, index > 0 && styles.ruled]}>
            <View accessible accessibilityLabel={`${nutrient.label}: ${formatInsightGrams(amount)}${target === null ? ', no daily target' : of}`} style={styles.nutrientHead}>
              <View style={styles.labelRow}>
                <View style={[styles.swatch, { backgroundColor: colour }]} />
                <Text style={styles.label}>{nutrient.label}</Text>
              </View>
              <Text style={styles.small}>
                <Text style={styles.nutrientValue}>{formatInsightGrams(amount)}</Text>
                {of}
              </Text>
            </View>
            {target !== null ? (
              <>
                <View style={styles.bar}>
                  <View testID={`bar-${nutrient.target}`} style={{ width: `${mine}%`, backgroundColor: over && !meal ? colors.warning : colour }} />
                  {rest > 0 ? <View testID={`rest-${nutrient.target}`} style={[styles.faded, { width: `${rest}%`, backgroundColor: colour }]} /> : null}
                </View>
                <View style={styles.barText}>
                  <Text style={styles.note}>{percentOf(eaten, target)}% of target</Text>
                  <Text style={[styles.note, over && styles.overText]}>
                    {over ? `${formatInsightGrams(day - target)} over today` : `${formatInsightGrams(target - day)} left today`}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.noTarget}>
                <Text style={styles.note}>No daily target</Text>
                <TextButton title="Set a target" outlined onPress={onSetTarget} />
              </View>
            )}
            {missing.length > 0 ? <MissingNote text={missingNote(missing, nutrient.label)} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** The foods that gave the most of the nutrient chosen: five, then "Show all". */
function TopFoodsCard({
  meals,
  scope,
  topKey,
  showAll,
  onKey,
  onShowAll,
}: {
  meals: readonly LocalMeal[];
  scope: InsightScope;
  topKey: TopFoodKey;
  showAll: boolean;
  onKey(key: TopFoodKey): void;
  onShowAll(): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  const chosen = TOP_FOOD_KEYS.find((entry) => entry.key === topKey)!;
  const { foods, total, missing } = topFoods(meals, scope, topKey);
  const shown = showAll ? foods : foods.slice(0, TOP_SHOWN);
  const nutrient = INSIGHT_NUTRIENTS.find((entry) => entry.key === topKey);
  const colour = nutrient ? colors[nutrient.colour] : colors.accent;
  const format = (value: number) => (topKey === 'kcal' ? formatKcal(value) : formatInsightGrams(value));
  return (
    <View accessibilityLabel="Top foods" style={[styles.card, styles.cardTight]}>
      <Text style={styles.cardTitle}>Top foods · {scope === 'day' ? 'whole day' : MEAL_TYPE_LABELS[scope]}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Top foods for" style={styles.pills}>
        {TOP_FOOD_KEYS.map((entry) => (
          <Pressable
            key={entry.key}
            accessibilityRole="radio"
            accessibilityLabel={entry.label}
            accessibilityState={{ checked: entry.key === topKey }}
            onPress={() => onKey(entry.key)}
            style={({ pressed }) => [pill.choice, styles.pill, entry.key === topKey && pill.chosen, pressed && pill.pressed]}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[pill.choiceText, styles.pillText, entry.key === topKey && pill.chosenText]}>
              {entry.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {foods.length === 0 ? <Text style={[styles.small, styles.none]}>No food here has any {chosen.label.toLowerCase()}.</Text> : null}
      {shown.map((food, index) => {
        const share = percentOf(food.value, total);
        const amounts = food.amounts.map(formatAmount).join(' + ');
        const detail = scope === 'day' ? `${food.mealTypes.map((type) => MEAL_TYPE_LABELS[type]).join(', ')} · ${amounts}` : amounts;
        return (
          <View
            key={`${food.name}-${index}`}
            accessible
            accessibilityLabel={`${index + 1}: ${food.name}, ${detail}, ${format(food.value)}, ${share}%`}
            style={[styles.foodRow, index > 0 && styles.ruled]}
          >
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.foodBody}>
              <View style={styles.foodLine}>
                <Text style={styles.foodName}>{food.name}</Text>
                <Text style={styles.foodValue}>{format(food.value)}</Text>
              </View>
              <View style={styles.foodLine}>
                <Text style={[styles.note, styles.shrink]}>{detail}</Text>
                <Text style={styles.note}>{share}%</Text>
              </View>
              <View style={styles.thinBar}>
                <View style={{ width: `${share}%`, backgroundColor: colour }} />
              </View>
            </View>
          </View>
        );
      })}
      {missing.length > 0 ? (
        <MissingNote text={`${missingNote(missing, chosen.label).replace(/\.$/, '')}, so ${missing.length === 1 ? 'it is' : 'they are'} not listed.`} />
      ) : null}
      {foods.length > TOP_SHOWN ? (
        <Pressable accessibilityRole="button" onPress={onShowAll} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
          <Text style={styles.moreText}>{showAll ? `Show the top ${TOP_SHOWN}` : `Show all ${foods.length} foods`}</Text>
          {showAll ? <ChevronUp size={18} color={colors.accent} /> : <ChevronDown size={18} color={colors.accent} />}
        </Pressable>
      ) : null}
    </View>
  );
}

function MissingNote({ text }: { text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.missing}>
      <Info size={16} color={colors.inkMuted} importantForAccessibility="no" accessibilityElementsHidden />
      <Text style={[styles.note, styles.shrink]}>{text}</Text>
    </View>
  );
}

// The redesign's 3.10: cards 12 apart in the 16 gutter, radius 4, on the screen's colour; the
// tiles as Log meal's (D-58), five in a row; numbers in fixed-width digits.
const useStyles = themedStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 12 },
  date: { ...TYPE.label, color: c.accent },
  tiles: { flexDirection: 'row', gap: 6 },
  tile: {
    flex: 1,
    minHeight: 66,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 1,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  tileChosen: { borderColor: c.primary, backgroundColor: c.primary },
  tileText: { ...TYPE.buttonSecondary, fontSize: 13, lineHeight: 15, letterSpacing: 0, color: c.ink },
  tileTextChosen: { color: c.onPrimary },
  tick: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.success,
  },
  card: { gap: 10, padding: 16, borderRadius: 4, backgroundColor: c.surface },
  cardTight: { gap: 0, paddingBottom: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 4 },
  cardTitle: { ...TYPE.label, color: c.inkMuted },
  emptyTile: { width: 56, height: 56, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 14, lineHeight: 20, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  note: { fontSize: 13, lineHeight: 18, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  heroNumber: { ...TYPE.heroNumber, fontSize: 64, lineHeight: 66 },
  heroUnit: { ...TYPE.metric, fontSize: 18, paddingBottom: 12, color: c.accent },
  noTarget: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kcalBar: { flexDirection: 'row', height: 14, borderRadius: 2, overflow: 'hidden', backgroundColor: c.track },
  kcalPart: { height: '100%', borderRightWidth: 2, borderRightColor: c.surface },
  mealRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruled: { borderTopWidth: 1, borderTopColor: c.border },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  mealName: { flex: 1, fontSize: 15, lineHeight: 20 },
  mealValue: { fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] },
  muted: { color: c.inkMuted },
  bold: { fontFamily: 'Barlow_700Bold', color: c.ink },
  semibold: { fontFamily: 'Barlow_600SemiBold' },
  overText: { fontFamily: 'Barlow_700Bold', color: c.warning },
  key: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  keyMark: { width: 12, height: 6, borderRadius: 1 },
  keyText: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
  faded: { opacity: 0.35 },
  nutrient: { gap: 6, paddingVertical: 12 },
  nutrientHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { ...TYPE.label, letterSpacing: 1.2, color: c.inkMuted },
  nutrientValue: { ...TYPE.metric, fontSize: 20, color: c.ink },
  bar: { flexDirection: 'row', height: 8, borderRadius: 2, overflow: 'hidden', backgroundColor: c.track },
  barText: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  missing: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingBottom: 4 },
  shrink: { flexShrink: 1 },
  pills: { flexDirection: 'row', gap: 6, marginTop: 10, marginBottom: 6 },
  pill: { flex: 1, paddingHorizontal: 2 },
  pillText: { fontSize: 14, letterSpacing: 0.3 },
  none: { paddingVertical: 12 },
  foodRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  rank: { ...TYPE.metric, width: 18, fontSize: 20, lineHeight: 22, color: c.inkSubtle },
  foodBody: { flex: 1, minWidth: 0, gap: 4 },
  foodLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  foodName: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontFamily: 'Barlow_500Medium' },
  foodValue: { ...TYPE.metric, fontSize: 18, lineHeight: 22 },
  thinBar: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: c.track },
  more: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  moreText: { ...TYPE.link, color: c.accent },
  pressed: { opacity: 0.6 },
}));
