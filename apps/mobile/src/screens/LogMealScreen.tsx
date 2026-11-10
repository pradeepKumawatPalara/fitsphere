import {
  isIstDay,
  istToday,
  MAX_MEAL_ITEMS,
  mealTotals,
  MEAL_TYPES,
  syncWindowStart,
  type IstDay,
  type MealItem,
  type MealTag,
  type MealType,
} from '@fitsphere/shared';
import { useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import {
  ArrowDown,
  Bookmark,
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  PenLine,
  ScanBarcode,
  Search,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { BarcodeSheet } from '../components/BarcodeSheet';
import { CalendarSheet } from '../components/CalendarSheet';
import { FoodSearchSheet } from '../components/FoodSearchSheet';
import { MealFoodRows, useMealFoods } from '../components/MealFoods';
import { MealPhotoField, type PhotoDraft } from '../components/MealPhotoField';
import { ActionsSheet, SlotPicker } from '../components/MealSheets';
import { OwnFoodSheet } from '../components/OwnFoodSheet';
import { Sheet as BottomSheet } from '../components/Sheet';
import { Text, TextButton } from '../components/ui';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, listMealsOfDay, listSavedMeals, mealCounts, type LocalMeal, type LocalSavedMeal } from '../local/store';
import { describeItems, formatGrams, formatKcal, MEAL_TYPE_LABELS, MEAL_TYPE_ORDER } from '../meals';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';

type Params = { day?: string; slot?: string; mealId?: string; savedId?: string };
type Sheet = 'day' | 'search' | 'barcode' | 'own' | 'saved';
/** A meal's foods and photo on this screen, as they are now (D-68). */
type Draft = { items: MealItem[]; photo: PhotoDraft };
/** What asked about changes not saved: going back (its `repeat` goes on), or another date. */
type Leaving = { repeat(): void } | { day: IstDay };

// Log meal (REQ-LOG-001…003, REQ-LOG-006…008, REQ-LOG-010; REQ-ACC-005): the date, the meal type,
// foods added by search, barcode, your own food or a saved meal, an optional photo or image link,
// and a review before saving. The tags "Before training" and "Dessert" are hidden until coaches
// (D-40): a meal edited here keeps the tags it has.
// Works offline and with AI off, except the barcode lookup, which needs the internet. Opened from "+" with the selected date (Q-011) and a slot, or from Edit
// with a meal, whose date then stays the same (MVP default, D-26), or from a saved meal's "Change
// amounts first" with its foods (D-69): what is changed here is this day's meal only.
// The foods are added and changed as in a saved meal (MealFoods.tsx; D-34, D-64).
// Logging (D-68): the screen holds the date's four meals. A meal tapped shows its foods on that date,
// saved before or added now, to add to or remove from; each meal keeps its changes until Save, which
// saves every meal changed and stays here; a meal left with no foods is removed. A meal with food has
// a green tick. Back, or another date, with changes not saved asks first.
// Editing a meal (from its pencil) changes that one meal, and Save goes back, as before.
export function LogMealScreen({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  // The fixed footer clears the phone's navigation bar; none outside the app (tests).
  const insets = useContext(SafeAreaInsetsContext);
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const today = istToday(now());
  const firstDay = syncWindowStart(today);
  const editing = typeof params.mealId === 'string' && params.mealId !== '';
  const savedId = !editing && typeof params.savedId === 'string' && params.savedId !== '' ? params.savedId : null;

  const [id] = useState(() => (editing ? params.mealId! : sync.newId()));
  const [day, setDay] = useState<IstDay>(() =>
    typeof params.day === 'string' && isIstDay(params.day) && params.day <= today && params.day >= firstDay ? params.day : today,
  );
  const [mealType, setMealType] = useState<MealType | null>(() =>
    MEAL_TYPES.includes(params.slot as MealType) ? (params.slot as MealType) : null,
  );
  const [tags, setTags] = useState<MealTag[]>([]);
  const { items, setItems, addItems, change, sheets } = useMealFoods();
  // The saved meal whose foods this meal started from (D-69), named in a note over the steps.
  const [fromSaved, setFromSaved] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PhotoDraft>(null);
  const [missing, setMissing] = useState(false);
  const [counts, setCounts] = useState<Record<IstDay, number>>({});
  const [saved, setSaved] = useState<LocalSavedMeal[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [ownName, setOwnName] = useState('');
  const [busy, setBusy] = useState(false);

  // Logging (D-68): the date's meals as saved (null while they load); the changes of the meals not on
  // show (the one on show is `items` and `photo`); what was last saved, said until the next change.
  const [dayMeals, setDayMeals] = useState<LocalMeal[] | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<MealType, Draft>>>({});
  const [note, setNote] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const [leaveOk, setLeaveOk] = useState(false);
  // Each saved food's meal, so a meal with two saved for it keeps each food in its own on Save. A food
  // changed or added has none and goes to the newest.
  const origin = useRef(new WeakMap<MealItem, string>());
  // An ID for each meal not saved yet, made once, so its photo keeps the meal it is for.
  const newIds = useRef<Partial<Record<MealType, string>>>({});
  // Edit: the meal as loaded, to tell whether it changed.
  const [loaded, setLoaded] = useState<LocalMeal | null>(null);
  // The meal on show, for the date's meals when they come.
  const mealTypeNow = useRef(mealType);
  useEffect(() => {
    mealTypeNow.current = mealType;
  }, [mealType]);

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
      setLoaded(meal);
      setDay(meal.day);
      setMealType(meal.mealType);
      setTags(meal.tags);
      setItems(meal.items);
      setPhoto(photoDraftOf(meal));
    });
    return () => {
      active = false;
    };
  }, [editing, id, local.state, setItems]);

  // Logging (D-68): the date's meals. The meal on show takes its saved foods, before any added already.
  useEffect(() => {
    if (editing || local.state.status !== 'ready') return;
    let active = true;
    void listMealsOfDay(local.state.db, day).then((meals) => {
      if (!active) return;
      for (const meal of meals) for (const item of meal.items) origin.current.set(item, meal.id);
      setDayMeals(meals);
      const slot = mealTypeNow.current;
      if (slot) {
        // Foods from saved meals already on show (a second load) are replaced, not added again.
        setItems((current) => [...itemsOf(meals, slot), ...current.filter((item) => !origin.current.has(item))].slice(0, MAX_MEAL_ITEMS));
        setPhoto((current) => current ?? photoDraftOf(newestOf(meals, slot)));
      }
    });
    return () => {
      active = false;
    };
  }, [editing, local.state, day, setItems]);

  // "Change amounts first" (D-69): the saved meal's foods, once, after any the meal has; the saved meal
  // itself is not changed.
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  useEffect(() => {
    if (!savedId || filledFrom === savedId || local.state.status !== 'ready') return;
    let active = true;
    void getEntry(local.state.db, 'savedMeal', savedId).then((saved) => {
      if (!active) return;
      setFilledFrom(savedId);
      if (!saved) return;
      setItems((current) => [...current, ...saved.items].slice(0, MAX_MEAL_ITEMS));
      setTags(saved.tags);
      setFromSaved(saved.name);
    });
    return () => {
      active = false;
    };
  }, [savedId, filledFrom, local.state, setItems]);

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

  const meals = dayMeals ?? [];

  /** A meal's foods and photo as they are now: on show, changed earlier, or as saved (D-68). */
  function draftOf(slot: MealType): Draft {
    if (slot === mealType) return { items, photo };
    return drafts[slot] ?? { items: itemsOf(meals, slot), photo: photoDraftOf(newestOf(meals, slot)) };
  }

  /** Whether a meal has something to save: its foods or photo are not as saved; a new meal needs a food. */
  function changed(slot: MealType): boolean {
    const draft = draftOf(slot);
    const ofType = mealsOfType(meals, slot);
    if (ofType.length === 0) return draft.items.length > 0;
    return !sameItems(draft.items, itemsOf(meals, slot)) || !samePhoto(draft.photo, photoDraftOf(ofType[ofType.length - 1]));
  }

  // Logging: the meals with changes to save. Editing: whether the meal changed.
  const pending = editing || dayMeals === null ? [] : MEAL_TYPE_ORDER.filter(changed);
  const editChanged =
    editing && loaded !== null && (mealType !== loaded.mealType || !sameItems(items, loaded.items) || !samePhoto(photo, photoDraftOf(loaded)));
  // Foods added before a meal is chosen.
  const unassigned = !editing && mealType === null && items.length > 0;
  // Back with changes not saved asks first (the owner, 2026-11-10).
  const allowLeave = usePreventRemove(!leaveOk && (pending.length > 0 || editChanged || unassigned), ({ repeat }) => setLeaving({ repeat }));

  /** Logging: shows a meal's foods; foods added before any meal was chosen join it (D-68). */
  function chooseMeal(slot: MealType) {
    if (editing) {
      setMealType(slot);
      return;
    }
    if (slot === mealType) return;
    setNote(null);
    const carried = mealType === null ? items : [];
    if (mealType !== null) setDrafts((current) => ({ ...current, [mealType]: { items, photo } }));
    const next = draftOf(slot);
    setItems([...next.items, ...carried].slice(0, MAX_MEAL_ITEMS));
    setPhoto(mealType === null && photo !== null ? photo : next.photo);
    setMealType(slot);
  }

  /** Logging: another date; its meals as saved, the changes on this one left (D-68). */
  function goToDay(next: IstDay) {
    setNote(null);
    setDrafts({});
    newIds.current = {};
    if (mealType !== null) {
      setItems([]);
      setPhoto(null);
    }
    setDayMeals(null);
    setDay(next);
  }

  function chooseDay(next: IstDay) {
    if (next === day) return;
    if (pending.length > 0) setLeaving({ day: next });
    else goToDay(next);
  }

  /** Logging: saves every meal changed, and stays (D-68). */
  async function saveMeals() {
    if (local.state.status !== 'ready' || pending.length === 0) return;
    const db = local.state.db;
    setBusy(true);
    const done: { slot: MealType; items: MealItem[] }[] = [];
    for (const slot of pending) {
      const draft = draftOf(slot);
      const ofType = mealsOfType(meals, slot);
      const newest = ofType[ofType.length - 1];
      // Each saved food goes back to its meal; a food added or changed goes to the newest.
      const kept = new Map<string, MealItem[]>(ofType.map((meal) => [meal.id, []]));
      for (const item of draft.items) {
        const from = origin.current.get(item);
        kept.get(from !== undefined && kept.has(from) ? from : (newest?.id ?? ''))?.push(item);
      }
      if (!newest) {
        await sync.save(
          'meal',
          { id: newIdFor(slot), day, mealType: slot, tags, items: draft.items, photo: mealPhotoOf(draft.photo) },
          newPhotoOf(draft.photo),
        );
        delete newIds.current[slot];
      } else {
        for (const meal of ofType) {
          const foods = kept.get(meal.id) ?? [];
          const isNewest = meal === newest;
          const photoNow = isNewest ? draft.photo : photoDraftOf(meal);
          if (foods.length === 0) await sync.remove('meal', meal.id);
          else if (!sameItems(foods, meal.items) || !samePhoto(photoNow, photoDraftOf(meal))) {
            await sync.save(
              'meal',
              { id: meal.id, day, mealType: slot, tags: meal.tags, items: foods, photo: mealPhotoOf(photoNow) },
              isNewest ? newPhotoOf(draft.photo) : undefined,
            );
          }
        }
      }
      done.push({ slot, items: draft.items });
    }
    const fresh = await listMealsOfDay(db, day);
    for (const meal of fresh) for (const item of meal.items) origin.current.set(item, meal.id);
    setDayMeals(fresh);
    setDrafts({});
    if (mealType !== null) {
      setItems(itemsOf(fresh, mealType));
      setPhoto(photoDraftOf(newestOf(fresh, mealType)));
    }
    setNote(savedNote(done));
    setBusy(false);
  }

  /** Editing: saves the one meal. */
  async function saveMeal() {
    if (!mealType || items.length === 0) return;
    setBusy(true);
    await sync.save('meal', { id, day, mealType, tags, items, photo: mealPhotoOf(photo) }, newPhotoOf(photo));
    setBusy(false);
  }

  /** The ID of the meal on show not saved yet, made once (its photo is kept for it). */
  function newIdFor(slot: MealType): string {
    return (newIds.current[slot] ??= sync.newId());
  }

  function leave() {
    setLeaveOk(true);
    allowLeave();
    router.back();
  }

  /** The leave question's Save: saves, then goes on to where the user was going. */
  async function saveAndGo(target: Leaving) {
    if (editing) await saveMeal();
    else await saveMeals();
    setLeaving(null);
    if ('repeat' in target) {
      setLeaveOk(true);
      target.repeat();
    } else goToDay(target.day);
  }

  /** The leave question's other answer: leaves the changes. */
  function dropAndGo(target: Leaving) {
    setLeaving(null);
    if ('repeat' in target) {
      setLeaveOk(true);
      target.repeat();
    } else goToDay(target.day);
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
  const mealName = mealType ? MEAL_TYPE_LABELS[mealType] : null;
  // Save names the meal it saves, or how many (D-68).
  const saveTitle = pending.length === 1 ? `Save ${MEAL_TYPE_LABELS[pending[0]!].toLowerCase()}` : `Save ${pending.length} meals`;
  // The meal on show had foods saved and has none now: Save removes it.
  const removing = mealType !== null && items.length === 0 && pending.includes(mealType);
  // The steps (D-58): the meal, then its foods, then review and save; the one to do now says what to
  // tap. None turns green: green is for the meals with food (D-68).
  const steps: Record<'meal' | 'food' | 'review', StepState> = editing
    ? { meal: mealType ? 'later' : 'now', food: items.length > 0 ? 'later' : 'now', review: items.length > 0 ? 'now' : 'later' }
    : {
        meal: mealType === null || (note !== null && pending.length === 0) ? 'now' : 'later',
        food: mealType !== null && note === null && pending.length === 0 ? 'now' : 'later',
        review: pending.length > 0 ? 'now' : 'later',
      };
  const mealCue = unassigned ? STEP_CUES.mealToSave : note !== null ? STEP_CUES.another : STEP_CUES.meal;
  const reviewCue = editing ? STEP_CUES.review : removing ? `Last: ${saveTitle} to remove it` : `Last: check your foods, then ${saveTitle}`;
  const logged = new Set(editing ? [] : MEAL_TYPE_ORDER.filter((slot) => draftOf(slot).items.length > 0));
  // The meal the photo is for: the one edited, the newest of the meal on show, or a new one.
  const photoMealId = editing || mealType === null ? id : (newestOf(meals, mealType)?.id ?? newIdFor(mealType));
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
            <Calendar size={18} color={colors.accent} />
            <Text style={styles.chipText}>{day === today ? `Today, ${formatDay(day)}` : formatDay(day)}</Text>
            <ChevronDown size={18} strokeWidth={2.25} color={colors.accent} />
          </Pressable>
        )}

        {fromSaved ? (
          <View style={styles.fromSaved}>
            <Bookmark size={20} color={colors.warning} />
            <View style={styles.fromSavedWords}>
              <Text style={styles.fromSavedTitle}>From {fromSaved}</Text>
              <Text style={styles.fromSavedText}>Change what you need for this day. Your saved meal stays as it is.</Text>
            </View>
          </View>
        ) : null}

        <Step number={1} title="Meal" state={steps.meal} cue={editing ? (items.length > 0 ? STEP_CUES.mealToSave : STEP_CUES.meal) : mealCue} cueBelow>
          <SlotPicker value={mealType} onChange={chooseMeal} logged={logged} />
        </Step>

        {/* "AI meal reading is coming soon" is left out for now (D-68); AI meal reading is slice 7. */}

        <Step number={2} title="Add food" state={steps.food} cue={STEP_CUES.food}>
          <View testID="add-food-ways" style={styles.methods}>
            <MethodTile icon={Search} name="Search foods" label={'Search\nfoods'} tint={colors.accentTint} ink={colors.accent} onPress={() => setSheet('search')} />
            <MethodTile icon={ScanBarcode} name="Scan barcode" label={'Scan\nbarcode'} tint={colors.fatTint} ink={colors.fat} onPress={() => setSheet('barcode')} />
            <MethodTile
              icon={PenLine}
              name="Enter your own food"
              label={'Own\nfood'}
              tint={colors.successTint}
              ink={colors.success}
              onPress={() => {
                setOwnName('');
                setSheet('own');
              }}
            />
            <MethodTile icon={Bookmark} name="Saved meals" label={'Saved\nmeals'} tint={colors.warningTint} ink={colors.warning} onPress={() => setSheet('saved')} />
          </View>
          <Text style={styles.tips}>
            Tips: give amounts in grams; say whether a food is raw or cooked; add each food separately.
          </Text>
        </Step>

        <MealPhotoField mealId={photoMealId} value={photo} onChange={setPhoto} newId={sync.newId} />

        <Step number={3} title="Review and save" state={steps.review} cue={reviewCue}>
          <MealFoodRows
            items={items}
            empty={editing ? undefined : mealName ? `No foods in ${mealName}.` : 'Tap a meal to see its foods.'}
            onChange={(index) => void change(index)}
          />
        </Step>
      </ScrollView>

      {/* Fixed below the list, so the total and Save stay in reach however many foods are added. Every
          text field here is in a sheet, which opens above it. */}
      <View style={[styles.footer, { paddingBottom: 12 + (insets?.bottom ?? 0) }]}>
        {items.length > 0 && (editing || unassigned || pending.length > 0) ? (
          <View
            accessible
            accessibilityLabel={`${!editing && mealName ? `${mealName} total` : 'Total'}: ${formatKcal(totals.kcal)}, ${formatGrams(totals.proteinG)} protein`}
            style={styles.total}
          >
            <Text style={styles.totalLabel}>{!editing && mealName ? `${mealName} total` : 'Total'}</Text>
            <Text style={styles.totalKcal}>{formatKcal(totals.kcal)}</Text>
            <Text style={styles.totalProtein}>· {formatGrams(totals.proteinG)} protein</Text>
          </View>
        ) : null}
        {editing ? (
          <>
            <TextButton
              title="Save meal"
              filled
              disabled={!mealType || items.length === 0}
              busy={busy}
              onPress={() => void saveMeal().then(leave)}
            />
            {items.length === 0 ? <Text style={styles.hint}>Add at least one food to save the meal.</Text> : null}
          </>
        ) : pending.length > 0 ? (
          <>
            {removing ? (
              <View style={styles.problem}>
                <CircleAlert size={16} color={colors.danger} />
                <Text accessibilityRole="alert" style={styles.problemText}>
                  {mealName} has no foods now. Saving removes it from {formatDay(day)}.
                </Text>
              </View>
            ) : null}
            <TextButton title={saveTitle} filled busy={busy} onPress={() => void saveMeals()} />
          </>
        ) : unassigned ? (
          <>
            <TextButton title="Save meal" filled disabled onPress={() => undefined} />
            <Text style={styles.hint}>Choose the meal: Breakfast, Lunch, Snack or Dinner.</Text>
          </>
        ) : (
          <>
            {note !== null ? (
              <View accessibilityLiveRegion="polite" style={styles.saved}>
                <CircleCheck size={20} strokeWidth={2.25} color={colors.success} />
                <Text accessibilityRole="text" style={styles.savedText}>
                  {note}
                </Text>
              </View>
            ) : null}
            {/* Nothing to save: Save waits for a change; the back arrow leaves (no Done, the owner, 2026-11-10). */}
            <TextButton title="Save meal" filled disabled onPress={() => undefined} />
            {note === null && items.length === 0 ? <Text style={styles.hint}>Add at least one food to save the meal.</Text> : null}
          </>
        )}
      </View>

      {sheet === 'day' ? (
        <CalendarSheet
          title="Log this meal to"
          today={today}
          firstDay={firstDay}
          selected={day}
          counts={counts}
          onSelect={chooseDay}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'search' ? <FoodSearchSheet today={today} onAdd={addItems} onClose={() => setSheet(null)} /> : null}
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
            // A saved meal has no meal of its own (D-69): its foods join the meal being logged.
            onPress: () => addItems(entry.items),
          }))}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheets}
      {leaving ? (
        <LeaveSheet
          {...leavePrompt({ editing, mealName, pending, unassigned, back: 'repeat' in leaving })}
          canSave={editing ? items.length > 0 : pending.length > 0}
          saveTitle={editing ? 'Save meal' : saveTitle}
          busy={busy}
          back={'repeat' in leaving}
          onSave={() => void saveAndGo(leaving)}
          onDrop={() => dropAndGo(leaving)}
          onStay={() => setLeaving(null)}
        />
      ) : null}
    </View>
  );
}

/** "A", "A and B", "A, B and C". */
function list(names: readonly string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** What the leave question says (D-68): which meals are not saved, and where the user was going. */
function leavePrompt({
  editing,
  mealName,
  pending,
  unassigned,
  back,
}: {
  editing: boolean;
  mealName: string | null;
  pending: readonly MealType[];
  unassigned: boolean;
  back: boolean;
}): { title: string; message: string; stayTitle: string } {
  const before = back ? 'before you leave' : 'before you change the date';
  if (unassigned) {
    return { title: "Your foods aren't saved", message: 'Choose the meal for them first, or leave without saving.', stayTitle: 'Choose the meal' };
  }
  if (editing) return { title: `${mealName ?? 'This meal'} isn't saved`, message: `You changed this meal. Save it ${before}?`, stayTitle: 'Stay' };
  const names = pending.map((slot) => MEAL_TYPE_LABELS[slot]);
  return names.length === 1
    ? { title: `${names[0]} isn't saved`, message: `You changed ${names[0]}. Save it ${before}?`, stayTitle: 'Stay' }
    : { title: `${names.length} meals aren't saved`, message: `You changed ${list(names)}. Save them ${before}?`, stayTitle: 'Stay' };
}

/**
 * The leave question (D-68): save and go on, or go on without saving; closing it stays. Its icon and
 * title in one line, and both buttons the sheet's width, centred (the owner, 2026-11-10).
 */
function LeaveSheet({
  title,
  message,
  stayTitle,
  canSave,
  saveTitle,
  busy,
  back,
  onSave,
  onDrop,
  onStay,
}: {
  title: string;
  message: string;
  stayTitle: string;
  canSave: boolean;
  saveTitle: string;
  busy: boolean;
  back: boolean;
  onSave(): void;
  onDrop(): void;
  onStay(): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <BottomSheet
      header={
        <View testID="leave-heading" style={styles.leaveHeading}>
          <View style={styles.leaveTile}>
            <Utensils size={24} color={colors.accent} />
          </View>
          <Text accessibilityRole="header" style={styles.leaveTitle}>
            {title}
          </Text>
        </View>
      }
      onClose={onStay}
      actions={
        <>
          {canSave ? <TextButton title={saveTitle} filled busy={busy} onPress={onSave} /> : <TextButton title={stayTitle} filled onPress={onStay} />}
          <TextButton title={back ? 'Leave without saving' : "Don't save"} outlined wide destructive onPress={onDrop} />
        </>
      }
    >
      <Text style={styles.leaveText}>{message}</Text>
    </BottomSheet>
  );
}

/** A saved meal's photo or image link, as the photo field holds it. */
function photoDraftOf(meal: LocalMeal | undefined): PhotoDraft {
  const photo = meal?.photo;
  return photo?.kind === 'photo' ? { kind: 'photo', mediaId: photo.mediaId, files: null } : (photo ?? null);
}

/** Whether two drafts are the same photo, the same link, or both none. */
function samePhoto(a: PhotoDraft, b: PhotoDraft): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === 'photo') return b.kind === 'photo' && a.mediaId === b.mediaId;
  return b.kind === 'link' && a.url === b.url;
}

/** The photo as a meal stores it. */
function mealPhotoOf(draft: PhotoDraft) {
  return draft === null ? null : draft.kind === 'photo' ? { kind: 'photo' as const, mediaId: draft.mediaId } : draft;
}

/** The files of a photo just taken, saved with its meal (REQ-LOG-006). */
function newPhotoOf(draft: PhotoDraft) {
  return draft?.kind === 'photo' && draft.files ? { id: draft.mediaId, files: draft.files } : undefined;
}

/** The same foods, the very same items in the same order: nothing changed. */
function sameItems(a: readonly MealItem[], b: readonly MealItem[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** A date's meals of one type, in the order saved. */
function mealsOfType(meals: readonly LocalMeal[], slot: MealType): LocalMeal[] {
  return meals.filter((meal) => meal.mealType === slot);
}

/** The foods of a date's meals of one type, as one list. */
function itemsOf(meals: readonly LocalMeal[], slot: MealType): MealItem[] {
  return mealsOfType(meals, slot).flatMap((meal) => meal.items);
}

/** The newest of a date's meals of one type: the one new foods join. */
function newestOf(meals: readonly LocalMeal[], slot: MealType): LocalMeal | undefined {
  const ofType = mealsOfType(meals, slot);
  return ofType[ofType.length - 1];
}

/** What the footer says after Save (D-68): the meal, its foods and kcal; a meal removed; or the meals. */
function savedNote(done: readonly { slot: MealType; items: readonly MealItem[] }[]): string {
  if (done.length === 1) {
    const { slot, items } = done[0]!;
    const name = MEAL_TYPE_LABELS[slot];
    if (items.length === 0) return `${name} removed`;
    return `${name} saved · ${items.length} ${items.length === 1 ? 'food' : 'foods'} · ${formatKcal(mealTotals(items).kcal)}`;
  }
  return `${list(done.map(({ slot }) => MEAL_TYPE_LABELS[slot]))} saved`;
}

type StepState = 'now' | 'later';

/** What to tap, with the step to do now (D-58; D-68). */
export const STEP_CUES = {
  meal: 'Start here: tap your meal',
  mealToSave: 'Choose the meal to save',
  another: 'Next: tap another meal',
  food: 'Next: tap how to add your food',
  review: 'Last: check your foods, then Save meal',
} as const;

/**
 * A step of logging a meal (D-58): numbered, the number on caramel for the one to do now, with a line
 * saying what to tap (above its content, or below it with cueBelow). No step turns green: green is for
 * the meals with food (D-68, the owner's option A). No frame (the owner, 2026-11-06). Every step can
 * still be used whatever its state.
 */
function Step({
  number,
  title,
  state,
  cue,
  cueBelow = false,
  children,
}: {
  number: number;
  title: string;
  state: StepState;
  cue: string;
  cueBelow?: boolean;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const now = state === 'now';
  const cueLine = now ? (
    <View accessibilityLiveRegion="polite" style={styles.cue}>
      {cueBelow ? <ChevronUp size={18} strokeWidth={2.25} color={colors.accent} /> : <ArrowDown size={18} strokeWidth={2.25} color={colors.accent} />}
      <Text style={styles.cueText}>{cue}</Text>
    </View>
  ) : null;
  return (
    <View testID={`step-${number}`} style={styles.step}>
      <View style={styles.stepHead}>
        <View accessible accessibilityLabel={`Step ${number}`} style={[styles.badge, now && styles.badgeNow]}>
          <Text style={[styles.badgeText, now && styles.badgeTextNow]}>{number}</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.stepTitle, now && styles.stepTitleNow]}>
          {title}
        </Text>
      </View>
      {cueBelow ? null : cueLine}
      {children}
      {cueBelow ? cueLine : null}
    </View>
  );
}

/** A way to add food (D-58): its icon on its own tint, its name in two short lines. */
function MethodTile({
  icon: Icon,
  name,
  label,
  tint,
  ink,
  onPress,
}: {
  icon: LucideIcon;
  name: string;
  label: string;
  tint: string;
  ink: string;
  onPress(): void;
}) {
  const styles = useStyles();
  // Named by its two lines ("Search foods"), or in full when they are shorter than its name ("Own
  // food" is read as "Enter your own food"). Not labelled otherwise: Search foods' box has its name.
  const shown = label.replace(/\s+/g, ' ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shown === name ? undefined : name}
      onPress={onPress}
      style={({ pressed }) => [styles.method, pressed && styles.pressed]}
    >
      <View style={[styles.methodIcon, { backgroundColor: tint }]}>
        <Icon size={24} color={ink} />
      </View>
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.methodText}>
        {label}
      </Text>
    </Pressable>
  );
}

// Spacing as on Home: 24 between groups, 12 within one.
// The redesign's 3.5 (locked by the owner, 2026-11-03), in steps since D-58 ("3.5 Log meal in steps",
// locked 2026-11-06, its frame removed the same day): the date a raised chip; three numbered steps,
// 22 apart, the one to do now saying what to tap; the meals and the ways to add food four tiles each
// in one row; the foods ruled on a card; the total in condensed figures over Save. Since D-68 ("3.5 Log
// meal · save and stay", locked 2026-11-10): no AI box; after Save, what was saved in green over Save,
// greyed until the next change (its Done removed the same day).
const useStyles = themedStyles((c) => ({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 22 },
  missing: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  date: TYPE.metric,
  chip: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  chipText: { ...TYPE.buttonSecondary, fontSize: 16, letterSpacing: 1 },
  step: { gap: 10 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 24, height: 24, borderRadius: 4, borderWidth: 1.5, borderColor: c.inkSubtle, alignItems: 'center', justifyContent: 'center' },
  badgeNow: { borderColor: c.primary, backgroundColor: c.primary },
  badgeText: { ...TYPE.buttonSecondary, fontSize: 15, lineHeight: 18, letterSpacing: 0, color: c.inkMuted },
  badgeTextNow: { color: c.onPrimary },
  stepTitle: { ...TYPE.label, fontSize: 15, lineHeight: 18, color: c.inkMuted },
  stepTitleNow: { color: c.ink },
  cue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cueText: { ...TYPE.link, flexShrink: 1, letterSpacing: 0.5, color: c.accent },
  // "Change amounts first" (D-69): which saved meal the foods came from, on the saved meals' gold tint.
  fromSaved: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 4, backgroundColor: c.warningTint },
  fromSavedWords: { flex: 1, gap: 2 },
  fromSavedTitle: { ...TYPE.label, fontSize: 15, lineHeight: 18, letterSpacing: 1, color: c.ink },
  fromSavedText: TYPE.small,
  methods: { flexDirection: 'row', gap: 6 },
  method: {
    flex: 1,
    minHeight: 100,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  methodIcon: { width: 44, height: 44, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  methodText: { ...TYPE.buttonSecondary, fontSize: 14, lineHeight: 16, letterSpacing: 0.3, textAlign: 'center' },
  pressed: { opacity: 0.6 },
  tips: { ...TYPE.small, color: c.inkMuted },
  hint: { ...TYPE.small, color: c.inkMuted, textAlign: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
  total: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  totalLabel: { ...TYPE.label, color: c.inkMuted },
  totalKcal: TYPE.metric,
  totalProtein: { fontSize: 14, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  problem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  problemText: { ...TYPE.small, flexShrink: 1, color: c.danger },
  saved: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  savedText: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '600', color: c.success, fontVariant: ['tabular-nums'] },
  // The leave question (D-68): its icon tile beside its title, in one line.
  leaveHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leaveTile: { width: 48, height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  leaveTitle: { ...TYPE.sheetTitle, flexShrink: 1 },
  leaveText: { fontSize: 16, lineHeight: 24 },
}));
