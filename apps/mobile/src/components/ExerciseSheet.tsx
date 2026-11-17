import { EXERCISE_SETS_MAX, exerciseNameKey, type BodyWeightUnit, type IstDay, type ListedExercise, type WorkoutExercise } from '@fitsphere/shared';
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Info, Plus, RotateCcw, Search, Trash } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, Keyboard, Pressable, ScrollView, View, type TextInputProps } from 'react-native';
import { useFieldChecks, type FieldChecks } from '../fieldChecks';
import { formatInteger, parseTwoDecimals, parseWholeNumber } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import {
  exercisePlaceCounts,
  findListedExercise,
  searchExercises,
  weighInOnOrBefore,
  type ExerciseFilter,
  type ExercisePlaceCounts,
} from '../local/store';
import { useLiftingWeightUnit } from '../settings/SettingsProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import {
  caloriesChanged,
  caloriesHelp,
  effortOf,
  EMPTY_EXERCISE,
  estimateCalories,
  exerciseLayout,
  exerciseRules,
  GROUP_LABELS,
  LOG_AS,
  LOG_AS_LABELS,
  LOG_TYPE_LABELS,
  logTypeKind,
  parseExercise,
  speedAndPace,
  toExerciseText,
  type CardioField,
  type ExerciseProblems,
  type ExerciseText,
  type Layout,
  type SetColumn,
  type SetText,
} from '../workouts';
import { ExerciseDetailsPage } from './ExerciseDetailsPage';
import { ExercisePlacePickers, filterLabel } from './ExercisePlacePickers';
import { FullScreen } from './FullScreen';
import { Sheet } from './Sheet';
import { IconButton, Problem, Text, TextButton, TextInput, useChoiceStyles, useFieldLabelStyle } from './ui';

type Props = {
  title: string;
  /** The workout's day: its calories are estimated with the latest weigh-in on or before it. */
  day: IstDay;
  /** The exercise being edited, or null for a new one. */
  editing: WorkoutExercise | null;
  onSave(exercise: WorkoutExercise): Promise<void>;
  /** Shown when editing an exercise already in the workout. */
  onRemove?: () => Promise<void>;
  onClose(): void;
};

const CARDIO_FIELDS: Record<CardioField, { label: string; unit: string; keyboard: TextInputProps['keyboardType'] }> = {
  distance: { label: 'Distance in km (optional)', unit: 'km', keyboard: 'decimal-pad' },
  speed: { label: 'Speed in km/h (optional)', unit: 'km/h', keyboard: 'decimal-pad' },
  incline: { label: 'Incline in % (optional)', unit: '%', keyboard: 'decimal-pad' },
  level: { label: 'Level (optional)', unit: '', keyboard: 'number-pad' },
};

/** The Compendium's citation, as its website asks (D-50; R-011). */
const COMPENDIUM_CREDIT =
  'Activity values: Herrmann SD, Willis EA, Ainsworth BE, et al. 2024 Adult Compendium of Physical Activities: a third update of the energy costs of human activities. Journal of Sport and Health Science, 2024;13(1):6–12. pacompendium.com';

/** e.g. 0.5, 0.75: hours as the estimate's formula reads them. */
function hours(seconds: number): string {
  return String(Number((seconds / 3600).toFixed(2)));
}

/** No category or sub-group chosen (D-67). */
const NO_FILTER: ExerciseFilter = { category: null, subGroup: null };
/**
 * Matches shown while typing with no choice made (D-50); the most a category or sub-group reads; and the
 * most rows drawn, "All exercises" being cut at the first of them (D-67).
 */
const MATCHES_LIMIT = 8;
const FILTERED_LIMIT = 1000;
const SHOWN_MAX = 300;

/** Whether an exercise is one of a category's or sub-group's (D-67); every one with no choice made. */
function inFilter(exercise: ListedExercise, filter: ExerciseFilter): boolean {
  if (filter.category === null && filter.subGroup === null) return true;
  return exercise.places.some(
    (place) => (filter.category === null || place.category === filter.category) && (filter.subGroup === null || place.subGroup === filter.subGroup),
  );
}

/**
 * What a match says under its name (D-67): what the choice made doesn't say. With nothing chosen, its
 * category and sub-group ("Core / Abs · Flexion"); with a category, its sub-group there; with a
 * sub-group, its category; with both, nothing. An exercise of FitSphere's list in no category keeps
 * its group (D-50).
 */
function matchTag(exercise: ListedExercise, filter: ExerciseFilter): string | null {
  if (exercise.places.length === 0) return filter.category === null && filter.subGroup === null ? GROUP_LABELS[exercise.group] : null;
  if (filter.category !== null && filter.subGroup !== null) return null;
  if (filter.category !== null) return exercise.places.find((place) => place.category === filter.category)?.subGroup ?? null;
  if (filter.subGroup !== null) return exercise.places.find((place) => place.subGroup === filter.subGroup)?.category ?? null;
  const [place] = exercise.places;
  return place!.subGroup === null ? place!.category : `${place!.category} · ${place!.subGroup}`;
}

/** A set's column as its header and its fields' names read it. */
function columnLabel(column: SetColumn, required: boolean, unit: BodyWeightUnit): string {
  const label = column === 'reps' ? 'Reps' : column === 'weight' ? `Weight in ${unit}` : 'Time in sec';
  return required ? label : `${label} (optional)`;
}

// A page for one exercise (REQ-TRN-003; D-50), opened over the workout with a back arrow, as Search foods
// (the owner, 2026-11-10: the sheet's matches had too little room; D-67). The name searches FitSphere's exercise list on
// the phone, offline: up to 8 matches under it, each with its group; picking one shows its type's
// fields. A list exercise done with a weight asks for it on every set; a bodyweight one shows no
// weight (the owner, 2026-11-04); cardio asks for a time, with a distance, a treadmill's speed and
// incline or a machine's level. A name of the user's own asks "Log as". Each set has its own reps,
// weight and time; Add set copies the last. Weights are in the lifting-weight unit setting
// (REQ-TRN-005, REQ-ACC-002). Nothing is saved until every field is valid; Cancel closes without
// saving (as Q-029). Above the name, Category and Sub-group narrow the search (D-67): with either
// chosen, its exercises show before a word is typed, every match of the words typed after, each
// tagged with what is not chosen yet; the choice is not saved with the exercise, and Edit shows the
// exercise's place in the list (the owner, 2026-11-16). A picked exercise
// of the list has How to do it, which opens its page on How to (D-82).
export function ExerciseSheet({ title, day, editing, onSave, onRemove, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const choice = useChoiceStyles();
  const labelStyle = useFieldLabelStyle();
  const unit = useLiftingWeightUnit();
  const local = useLocalDatabase();
  const [text, setText] = useState<ExerciseText>(() => (editing ? toExerciseText(editing, unit) : EMPTY_EXERCISE));
  // The list exercise the name is, ignoring case, hyphens and doubled letters; and its matches while typing.
  const [listed, setListed] = useState<ListedExercise | null>(null);
  const [matches, setMatches] = useState<ListedExercise[]>([]);
  const [typingName, setTypingName] = useState(editing === null);
  // Set when an exercise is picked, so the first field of its type takes the keyboard.
  const [picked, setPicked] = useState(false);
  const [busy, setBusy] = useState(false);
  // The weight calories are estimated with, and the i's explanation open (D-50).
  const [weightGrams, setWeightGrams] = useState<number | null>(null);
  const [explaining, setExplaining] = useState(false);
  // The category and sub-group the search is narrowed to, the picker open, and the list's counts (D-67).
  const [filter, setFilter] = useState<ExerciseFilter>(NO_FILTER);
  const [picking, setPicking] = useState<'category' | 'subGroup' | null>(null);
  const [counts, setCounts] = useState<ExercisePlaceCounts | null>(null);
  // The name's chevron, as Category's (D-67): the list closed with it, until typed in or opened again;
  // and, opened with nothing typed or chosen, every exercise.
  const [listClosed, setListClosed] = useState(false);
  const [showingAll, setShowingAll] = useState(false);
  // The chevron opened on an exercise of the list already picked (the owner, 2026-11-17: it listed only
  // that exercise, the name being its own search, under a large empty space): the choice's exercises, or
  // every one, the picked one highlighted and scrolled to; typing in the name searches again.
  const [browsingPicked, setBrowsingPicked] = useState(false);
  const matchesView = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrolledToPicked = useRef(false);
  // The picked exercise's page, opened on How to (D-82); the form waits under it.
  const [howTo, setHowTo] = useState(false);
  const filtered = filter.category !== null || filter.subGroup !== null;
  const unnamed = text.name.trim() === '';
  // The whole choice shows, not a search: with no name yet, or opened on the exercise picked.
  const wholeChoice = unnamed || browsingPicked;
  const browsingAll = showingAll && !filtered && wholeChoice;
  const browsing = (filtered || browsingAll) && wholeChoice;

  /**
   * A new category or sub-group (D-67). An exercise of the list already picked that it does not hold
   * leaves the name (the owner, 2026-11-10), so the choice's exercises show to pick from; a name of the
   * user's own stays.
   */
  function chooseFilter(next: ExerciseFilter) {
    setFilter(next);
    setListClosed(false);
    if (listed !== null && !inFilter(listed, next)) {
      change({ name: '' });
      setListed(null);
      setPicked(false);
    }
  }

  // Editing (the owner, 2026-11-16: they were empty, though chosen when it was added): Category and
  // Sub-group show where the list holds the exercise. The choice itself is not saved (D-67), so it is
  // the exercise's place: its only one, or the first of its places (66 exercises have several). A
  // name of the user's own has none, and shows none.
  const editingName = editing?.name ?? null;
  useEffect(() => {
    if (editingName === null || local.state.status !== 'ready') return;
    let active = true;
    void findListedExercise(local.state.db, editingName).then((found) => {
      const place = found?.places[0];
      if (active && place) setFilter({ category: place.category, subGroup: place.subGroup });
    });
    return () => {
      active = false;
    };
  }, [local.state, editingName]);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    let active = true;
    void exercisePlaceCounts(local.state.db).then((read) => {
      if (active) setCounts(read);
    });
    return () => {
      active = false;
    };
  }, [local.state]);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    let active = true;
    void weighInOnOrBefore(local.state.db, day).then((grams) => {
      if (active) setWeightGrams(grams);
    });
    return () => {
      active = false;
    };
  }, [local.state, day]);

  // Closing the keyboard ends the search, so the fields show for a name of the user's own: Android's
  // back button closes it without leaving the name field.
  useEffect(() => {
    const hidden = Keyboard.addListener('keyboardDidHide', () => setTypingName(false));
    return () => hidden.remove();
  }, []);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    const searching = !listClosed && (typingName || browsing);
    void Promise.all([
      findListedExercise(db, text.name),
      searching
        ? searchExercises(db, browsingPicked ? '' : text.name, browsingAll ? SHOWN_MAX : filtered ? FILTERED_LIMIT : MATCHES_LIMIT, filter, browsingAll)
        : [],
    ]).then(([found, list]) => {
      if (!active) return;
      setListed(found);
      setMatches(list);
    });
    return () => {
      active = false;
    };
  }, [local.state, text.name, typingName, browsing, browsingAll, browsingPicked, listClosed, filtered, filter]);

  // An exercise saved as cardio, now listed as done in sets or the other way round, keeps its own
  // fields while it keeps its name, as a name of the user's own.
  const savedOtherwise =
    editing !== null && listed !== null && exerciseNameKey(text.name) === exerciseNameKey(editing.name) && logTypeKind(listed.logType) !== editing.kind;
  const match = savedOtherwise ? null : listed;
  const layout = exerciseLayout(match, text.logAs, editing);
  const named = text.name.trim() !== '';
  const choosing = !listClosed && (typingName || browsing) && matches.length > 0;
  // A list fills the page under the fields: a choice's, or the matches.
  const listing = picking !== null || choosing;
  // Words typed in a category or sub-group that match none of its exercises (D-67).
  const noMatch = filtered && named && typingName && !listClosed && matches.length === 0 && listed === null;
  const firstMatches = matches.slice(0, SHOWN_MAX);
  const shownMatches =
    browsingPicked && listed !== null && !firstMatches.some((exercise) => exercise.code === listed.code) ? [listed, ...firstMatches] : firstMatches;
  const listTitle = browsingAll
    ? `All exercises · ${formatInteger(counts?.total ?? matches.length)}`
    : !filtered
    ? 'Matches'
    : browsing
      ? `${filterLabel(filter)} · ${matches.length} ${matches.length === 1 ? 'exercise' : 'exercises'}`
      : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'} in ${filterLabel(filter)}`;
  const estimated = estimateCalories(match, effortOf(text, layout), weightGrams);
  const estimate = 'estimate' in estimated ? estimated.estimate : null;
  // The user's own number, or an empty box, where there is an estimate to go back to (D-107).
  const changed = caloriesChanged(text.kcal, estimated);

  function change(fields: Partial<ExerciseText>) {
    setText((current) => ({ ...current, ...fields }));
  }

  /** The arrow (D-107): the estimate again, which then follows the time and distance as before. */
  function backToEstimate() {
    if (changed === null) return;
    change({ kcal: null });
    AccessibilityInfo.announceForAccessibility(`Calories burned: the estimate, ${formatInteger(changed.kcal)} kcal`);
  }

  function changeSet(index: number, column: SetColumn, value: string) {
    setText((current) => ({ ...current, sets: current.sets.map((set, at) => (at === index ? { ...set, [column]: value } : set)) }));
  }

  /** The name's chevron (D-67): closes the list open, or opens it: the matches, the choice's exercises, or every exercise. */
  function toggleList() {
    if (choosing) {
      setListClosed(true);
      setBrowsingPicked(false);
      Keyboard.dismiss();
      return;
    }
    setListClosed(false);
    // An exercise of the list picked: its choice's exercises, or every one, with it highlighted.
    if (listed !== null && !unnamed) {
      scrolledToPicked.current = false;
      setBrowsingPicked(true);
      if (!filtered) setShowingAll(true);
      return;
    }
    if (unnamed && !filtered) setShowingAll(true);
    else setTypingName(true);
  }

  function pick(exercise: ListedExercise) {
    change({ name: exercise.name });
    setListed(exercise);
    setMatches([]);
    setTypingName(false);
    setBrowsingPicked(false);
    setPicked(true);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    await action();
    setBusy(false);
    onClose();
  }

  // Each problem worked out from what is typed now; each shows once its field settles: typing in it
  // has paused, or it was left (an empty one only once left). Save waits while there is one (D-99).
  const parsed = parseExercise(text, layout, unit, estimated, editing);
  const typed: ExerciseProblems = 'problems' in parsed ? parsed.problems : { refused: [] };
  const checks = useFieldChecks(exerciseTexts(text, layout));
  const problems = shownProblems(typed, checks, text, layout, unit, choosing);
  const saveHint = 'problems' in parsed ? whatToFix(typed, problems) : null;
  /** Focus and blur for a field, for its checks. */
  const watch = (name: string) => ({ onFocus: () => checks.focus(name), onBlur: () => checks.blur(name) });

  function save() {
    if ('problems' in parsed) return;
    void run(() => onSave(parsed.exercise));
  }

  return (
    <FullScreen
      onClose={onClose}
      footer={
        listing ? undefined : (
          <>
            <TextButton title="Save exercise" filled disabled={busy || 'problems' in parsed} onPress={save} />
            {saveHint ? <Text style={styles.saveHint}>{saveHint}</Text> : null}
          </>
        )
      }
    >
      <View style={styles.header}>
        <IconButton label="Back to the workout" onPress={onClose}>
          <ChevronLeft size={24} strokeWidth={2.25} color={colors.accent} />
        </IconButton>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      </View>
      {/* One scrolling page while the form shows, the fields at its top scrolling with it (the owner,
          2026-11-10: the time and calories had too little room); while a list shows it fills the page
          under the fields and scrolls on its own. The fields stay the same views, so typing keeps the
          keyboard. While a list shows, the page's content is held to the page's height (`listing`):
          inside a scroll view a list's `flex: 1` alone does not hold it, so the list grew to its full
          length and nothing scrolled (the owner, 2026-11-13). */}
      <ScrollView
        style={styles.fill}
        contentContainerStyle={listing ? styles.listing : undefined}
        scrollEnabled={!listing}
        keyboardShouldPersistTaps="handled"
        testID="exercise-page"
      >
      <View style={[styles.top, picking !== null && styles.fill]}>
        <ExercisePlacePickers filter={filter} counts={counts} open={picking} onOpen={setPicking} onChange={chooseFilter} />
        {picking === null ? (
      <View style={styles.field}>
        {/* D-111 (the owner's B, with How to do it beside the name, 2026-11-17): How to do it at the label's
            right, only while the name holds an exercise of the list. */}
        <View style={styles.nameLabelRow}>
          <Text style={[labelStyle, styles.nameLabel]}>Exercise name</Text>
          {match ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`How to do ${match.name}`}
              onPress={() => setHowTo(true)}
              hitSlop={8}
              testID="exercise-how-to"
              style={({ pressed }) => [styles.howTo, pressed && styles.howToPressed]}
            >
              <BookOpen size={17} strokeWidth={2.25} color={colors.accent} />
              <Text style={styles.howToText}>How to do it</Text>
              <ChevronRight size={16} strokeWidth={2.5} color={colors.accent} />
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.box, styles.nameBox, (typingName || choosing) && styles.focused, problems.name ? styles.refused : null]}>
          <Search size={20} color={colors.inkMuted} />
          <TextInput
            accessibilityLabel="Exercise name"
            value={text.name}
            onChangeText={(name) => {
              change({ name });
              setTypingName(true);
              setListClosed(false);
              setBrowsingPicked(false);
            }}
            placeholder={filtered ? `Search ${filterLabel(filter)}` : 'Search or type an exercise'}
            autoCapitalize="sentences"
            autoFocus={editing === null}
            onFocus={() => {
              setTypingName(true);
              setListClosed(false);
              checks.focus('name');
            }}
            onBlur={() => {
              setTypingName(false);
              checks.blur('name');
            }}
            style={styles.value}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exercise list"
            accessibilityState={{ expanded: choosing }}
            onPress={toggleList}
            hitSlop={4}
            style={({ pressed }) => [styles.nameChevron, pressed && styles.pressed]}
          >
            {choosing ? (
              <ChevronUp size={20} strokeWidth={2.25} color={colors.accent} />
            ) : (
              <ChevronDown size={20} strokeWidth={2.25} color={colors.accent} />
            )}
          </Pressable>
        </View>
        {problems.name ? <Problem text={problems.name} /> : null}
      </View>
        ) : null}
      </View>

      {picking !== null ? null : choosing ? (
        <View style={styles.listArea}>
          <Text style={labelStyle}>{listTitle}</Text>
          {/* A plain list, not a FlatList: it sits in the page's scroll view, which may not hold a
              virtualized list; at most SHOWN_MAX rows are drawn. */}
          <View style={[styles.matches, styles.fill]}>
            <ScrollView ref={matchesView} nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.fill} testID="exercise-matches">
              {shownMatches.map((exercise, index) => {
                const tag = matchTag(exercise, filter);
                const isPicked = browsingPicked && listed !== null && exercise.code === listed.code;
                return (
                  <Pressable
                    key={exercise.code}
                    accessibilityRole="button"
                    accessibilityLabel={`${tag ? `${exercise.name}, ${tag}` : exercise.name}${isPicked ? ', picked' : ''}`}
                    accessibilityState={{ selected: isPicked }}
                    onPress={() => pick(exercise)}
                    // The picked one is scrolled to once the list opens, a row of the others above it.
                    onLayout={
                      isPicked
                        ? (event) => {
                            if (scrolledToPicked.current) return;
                            scrolledToPicked.current = true;
                            matchesView.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 52), animated: false });
                          }
                        : undefined
                    }
                    style={({ pressed }) => [styles.match, index > 0 && styles.divided, isPicked && styles.matchPicked, pressed && styles.pressed]}
                  >
                    <View style={styles.matchText}>
                      <Text style={[styles.matchName, isPicked && styles.matchNamePicked]}>{exercise.name}</Text>
                      {tag ? <Text style={styles.matchLine}>{tag}</Text> : null}
                    </View>
                    {isPicked ? <Check size={20} strokeWidth={2.5} color={colors.accent} /> : null}
                  </Pressable>
                );
              })}
              {matches.length > SHOWN_MAX || (browsingAll && counts !== null && counts.total > matches.length) ? (
                <Text style={[styles.help, styles.more]}>
                  The first {SHOWN_MAX} are shown: type a name or pick a category to find the others.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      ) : (
        <View style={styles.form}>
      {!named && !filtered ? (
        <Text style={styles.help}>
          Pick a category to see its exercises, or type to search all of them, for example dumbbell, push-up or running. Not in the list?
          Enter your own name.
        </Text>
      ) : null}

      {noMatch ? (
        <View style={styles.listed}>
          <Text style={styles.help}>
            No exercise in {filterLabel(filter)} matches “{text.name.trim()}”. Search them all, or keep your own name.
          </Text>
          <View style={styles.addSet}>
            <TextButton title="Search all categories" icon={Search} onPress={() => chooseFilter(NO_FILTER)} />
          </View>
        </View>
      ) : null}

      {named && !choosing ? (
        <>
          {match ? (
            // The tag, how it is logged and How to do it wrap onto the next line when they don't fit
            // (the owner's report, 2026-11-17): a long tag, "Olympic Weightlifting · Jerk Family", left
            // "Weight and reps" almost no width, so it stood one letter a line, hundreds of points tall,
            // and the row's other two sat in the middle of a large gap.
            <View testID="exercise-type-line" style={styles.typeLine}>
              <Text style={[styles.tag, styles.typeTag]}>{matchTag(match, NO_FILTER)}</Text>
              <Text testID="exercise-log-type" style={[styles.help, styles.typeLabel]}>
                {LOG_TYPE_LABELS[match.logType]}
              </Text>
            </View>
          ) : (
            <View style={styles.field}>
              <Text style={labelStyle}>Log as</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel="Log as" style={styles.choices}>
                {LOG_AS.map((logAs) => {
                  const checked = logAs === text.logAs;
                  return (
                    <Pressable
                      key={logAs}
                      accessibilityRole="radio"
                      accessibilityLabel={`Log as: ${LOG_AS_LABELS[logAs]}`}
                      accessibilityState={{ checked }}
                      onPress={() => change({ logAs })}
                      style={({ pressed }) => [choice.choice, styles.choice, checked && choice.chosen, pressed && choice.pressed]}
                    >
                      <Text style={[choice.choiceText, styles.choiceText, checked && choice.chosenText]}>{LOG_AS_LABELS[logAs]}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.help}>Not in the exercise list: choose how to log it.</Text>
            </View>
          )}

          {layout.kind === 'sets' ? (
            <View style={styles.field}>
              <Text style={labelStyle}>Sets</Text>
              <View style={styles.setRow}>
                <View style={styles.numberSpace} />
                {layout.columns.map(({ column, required }) => (
                  <Text key={column} style={styles.columnLabel}>
                    {columnLabel(column, required, unit)}
                  </Text>
                ))}
                <View style={styles.binSpace} />
              </View>
              {text.sets.map((set, index) => (
                <SetRow
                  key={index}
                  index={index}
                  set={set}
                  columns={layout.columns}
                  unit={unit}
                  refused={problems.refused}
                  autoFocus={picked && index === 0}
                  onChange={changeSet}
                  watch={watch}
                  {...(text.sets.length > 1 ? { onRemove: () => change({ sets: text.sets.filter((_, at) => at !== index) }) } : {})}
                />
              ))}
              {problems.sets ? <Problem text={problems.sets} /> : null}
              {text.sets.length < EXERCISE_SETS_MAX ? (
                <View style={styles.addSet}>
                  <TextButton title="Add set" icon={Plus} onPress={() => change({ sets: [...text.sets, { ...text.sets.at(-1)! }] })} />
                </View>
              ) : (
                <Text style={styles.help}>An exercise holds up to {EXERCISE_SETS_MAX} sets.</Text>
              )}
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={labelStyle}>Time</Text>
                <View style={styles.pair}>
                  <Box
                    accessibilityLabel="Time, minutes"
                    value={text.timeMinutes}
                    onChangeText={(timeMinutes) => change({ timeMinutes })}
                    keyboardType="number-pad"
                    unit="min"
                    refused={problems.time !== undefined}
                    autoFocus={picked}
                    compact
                    {...watch('timeMinutes')}
                  />
                  <Box
                    accessibilityLabel="Time, seconds"
                    value={text.timeSeconds}
                    onChangeText={(timeSeconds) => change({ timeSeconds })}
                    keyboardType="number-pad"
                    unit="sec"
                    refused={problems.time !== undefined}
                    compact
                    {...watch('timeSeconds')}
                  />
                </View>
                {problems.time ? <Problem text={problems.time} /> : null}
              </View>
              {layout.fields.map((field) => (
                <View key={field} style={styles.field}>
                  <Text style={labelStyle}>{CARDIO_FIELDS[field].label}</Text>
                  <Box
                    accessibilityLabel={CARDIO_FIELDS[field].label}
                    value={text[field]}
                    onChangeText={(value) => change({ [field]: value })}
                    keyboardType={CARDIO_FIELDS[field].keyboard}
                    unit={CARDIO_FIELDS[field].unit}
                    refused={problems[field] !== undefined}
                    {...watch(field)}
                  />
                  {problems[field] ? (
                    <Problem text={problems[field]} />
                  ) : field === 'distance' && !layout.fields.includes('speed') ? (
                    <AverageSpeed text={text} />
                  ) : null}
                </View>
              ))}
            </>
          )}

          <View style={styles.rule} />
          {/* D-111 (the owner's B): the optional fields two to a row, with short labels; screen readers
              still hear each field's whole name. Sets: Time spent beside Calories; cardio: Calories alone. */}
          {/* The labels in one row and the boxes in the next, so the two boxes line up whatever the labels
              hold: Calories' info button and its tag made its label taller than Time spent's, and its box
              sat lower (the owner, 2026-11-17: "the two input field is not align"). */}
          <View testID="exercise-effort" style={styles.field}>
            <View testID="exercise-effort-labels" style={[styles.pair, styles.pairLabels]}>
              {layout.kind === 'sets' ? (
                <View style={styles.half}>
                  <Text style={labelStyle}>Time spent</Text>
                </View>
              ) : null}
              {/* Changed by the user while there is an estimate (D-107, canvas "Calories burned changed by
                  you", B locked): an Edited tag beside the label, and an arrow at the box's end that puts
                  the estimate back. */}
              <View style={[styles.half, styles.labelRow]}>
                {/* The estimate says so beside the label, not in the box, where it left the number too
                    little room once the box was half the width (the owner, 2026-11-17). */}
                <View style={styles.labelWithTag}>
                  <Text style={labelStyle}>Calories</Text>
                  {changed ? (
                    <Text style={styles.editedTag}>Edited</Text>
                  ) : text.kcal === null && estimate ? (
                    <Text testID="calories-estimated" style={styles.tag}>
                      Estimated
                    </Text>
                  ) : null}
                </View>
                <IconButton label="How calories are estimated" onPress={() => setExplaining(true)}>
                  <Info size={20} color={colors.accent} />
                </IconButton>
              </View>
            </View>
            <View testID="exercise-effort-boxes" style={styles.pair}>
              {layout.kind === 'sets' ? (
                <View style={styles.half}>
                  <Box
                    accessibilityLabel="Time spent in min (optional)"
                    value={text.spentMinutes}
                    onChangeText={(spentMinutes) => change({ spentMinutes })}
                    keyboardType="number-pad"
                    unit="min"
                    refused={problems.spent !== undefined}
                    {...watch('spentMinutes')}
                  />
                </View>
              ) : null}
              <View style={styles.half}>
                <Box
                  accessibilityLabel="Calories burned (optional)"
                  value={text.kcal ?? (estimate ? String(estimate.kcal) : '')}
                  onChangeText={(kcal) => change({ kcal })}
                  keyboardType="number-pad"
                  unit="kcal"
                  refused={problems.kcal !== undefined}
                  {...watch('kcal')}
                  after={
                    changed ? (
                      <>
                        <View style={styles.divider} />
                        <IconButton label={`Use the estimate, ${formatInteger(changed.kcal)} kcal`} onPress={backToEstimate}>
                          <RotateCcw size={20} strokeWidth={2.25} color={colors.accent} />
                        </IconButton>
                      </>
                    ) : null
                  }
                />
              </View>
            </View>
          </View>
          {problems.spent ? <Problem text={problems.spent} /> : null}
          {problems.kcal ? <Problem text={problems.kcal} /> : <Text style={styles.afterPair}>{caloriesHelp(text.kcal, estimated, layout.kind)}</Text>}
          <View style={styles.pair}>
            {(['averageHeartRate', 'highestHeartRate'] as const).map((key) => (
              <View key={key} style={[styles.field, styles.half]}>
                <Text style={labelStyle}>{key === 'averageHeartRate' ? 'Average HR' : 'Highest HR'}</Text>
                <Box
                  accessibilityLabel={key === 'averageHeartRate' ? 'Average heart rate (optional)' : 'Highest heart rate (optional)'}
                  value={text[key]}
                  onChangeText={(value) => change({ [key]: value })}
                  keyboardType="number-pad"
                  unit="bpm"
                  refused={problems[key] !== undefined}
                  {...watch(key)}
                />
              </View>
            ))}
          </View>
          {problems.averageHeartRate || problems.highestHeartRate ? <Problem text={(problems.averageHeartRate ?? problems.highestHeartRate)!} /> : null}
        </>
      ) : null}

      <View style={styles.field}>
        {/* D-111: one line, growing as it is typed, under its label (the owner, 2026-11-17: keep the label,
            not the name inside the box). */}
        <Text style={labelStyle}>Note (optional)</Text>
        <Box
          accessibilityLabel="Note (optional)"
          value={text.note}
          onChangeText={(note) => change({ note })}
          multiline
          note
          refused={problems.note !== undefined}
          {...watch('note')}
        />
        {problems.note ? <Problem text={problems.note} /> : null}
      </View>
      {onRemove ? <TextButton title="Remove exercise" destructive icon={Trash} disabled={busy} onPress={() => void run(onRemove)} /> : null}
        </View>
      )}
      </ScrollView>
      {explaining ? (
        <Sheet title="Calories burned" onClose={() => setExplaining(false)} actions={<TextButton title="Close" wide onPress={() => setExplaining(false)} />}>
          <Text style={styles.body}>
            FitSphere estimates the calories an exercise burns as its activity value (MET) × your weight in kg × the time in hours.
          </Text>
          {estimate ? (
            <View style={styles.example}>
              <Text style={styles.help}>{text.name.trim()}</Text>
              <Text style={styles.formula}>
                {`${estimate.met.toFixed(1)} MET × ${(estimate.weightGrams / 1000).toFixed(1)} kg × ${hours(estimate.seconds)} h = ${estimate.kcal} kcal`}
              </Text>
            </View>
          ) : null}
          <Text style={styles.body}>
            Running, walking and cycling use the activity value for their speed: the faster, the more. Your weight is your latest weigh-in on
            or before the workout&apos;s day. A MET is the average for an activity, not for you, so the estimate is a guide: the number from
            your machine or watch replaces it. Exercises without an activity value, such as your own, have no estimate.
          </Text>
          <Text style={styles.help}>{COMPENDIUM_CREDIT}</Text>
        </Sheet>
      ) : null}
      {howTo && match ? <ExerciseDetailsPage name={match.name} initialTab="howto" onClose={() => setHowTo(false)} /> : null}
    </FullScreen>
  );
}

/** A set's field, by name, for its checks (D-99): "set:0:reps"; the problems name it "0:reps". */
function setField(index: number, column: SetColumn): string {
  return `set:${index}:${column}`;
}

/** Each typed field's text, by name, for its checks (D-99). */
function exerciseTexts(text: ExerciseText, layout: Layout): Record<string, string> {
  const texts: Record<string, string> = {
    name: text.name,
    timeMinutes: text.timeMinutes,
    timeSeconds: text.timeSeconds,
    distance: text.distance,
    speed: text.speed,
    incline: text.incline,
    level: text.level,
    spentMinutes: text.spentMinutes,
    kcal: text.kcal ?? '',
    averageHeartRate: text.averageHeartRate,
    highestHeartRate: text.highestHeartRate,
    note: text.note,
  };
  if (layout.kind === 'sets') {
    text.sets.forEach((set, index) => {
      for (const { column } of layout.columns) texts[setField(index, column)] = set[column];
    });
  }
  return texts;
}

/**
 * The problems that show now (D-99): each field's once its checks say so; the name's not while the
 * exercise list is open; the time's, as one field of minutes and seconds, once neither is being typed
 * in; the sets', the first shown set's problem, as "Set 2: enter reps from 1 to 200.".
 */
function shownProblems(
  typed: ExerciseProblems,
  checks: FieldChecks,
  text: ExerciseText,
  layout: Layout,
  unit: BodyWeightUnit,
  choosing: boolean,
): ExerciseProblems {
  const rules = exerciseRules(unit);
  const shown = <K extends keyof ExerciseProblems>(key: K, field: string, also = true) =>
    typed[key] !== undefined && also && checks.shows(field) ? { [key]: typed[key] } : {};
  const timeFields = ['timeMinutes', 'timeSeconds'];
  const timeTyped = text.timeMinutes.trim() !== '' || text.timeSeconds.trim() !== '';
  const timeShows =
    typed.time !== undefined &&
    timeFields.every((field) => checks.isSettled(field)) &&
    (timeTyped || (timeFields.some((field) => checks.wasLeft(field)) && !timeFields.includes(checks.focused ?? '')));
  const refused = typed.refused.filter((cell) => checks.shows(`set:${cell}`));
  const first = refused[0]?.split(':');
  const column = first?.[1] as SetColumn | undefined;
  const required = layout.kind === 'sets' && layout.columns.some((entry) => entry.column === column && entry.required);
  const setRule = column === 'weight' ? (required ? rules.weight : rules.optionalWeight) : column ? rules[column] : null;
  return {
    refused,
    ...(first && setRule ? { sets: `Set ${Number(first[0]) + 1}: ${setRule}` } : {}),
    ...shown('name', 'name', !choosing),
    ...(timeShows ? { time: typed.time } : {}),
    ...shown('distance', 'distance'),
    ...shown('speed', 'speed'),
    ...shown('incline', 'incline'),
    ...shown('level', 'level'),
    ...shown('spent', 'spentMinutes'),
    ...shown('kcal', 'kcal'),
    ...shown('averageHeartRate', 'averageHeartRate'),
    ...shown('highestHeartRate', 'highestHeartRate', checks.isSettled('averageHeartRate')),
    ...shown('note', 'note'),
  };
}

/** Under Save exercise while it waits (D-99): what to fix, or what is still missing. */
function whatToFix(typed: ExerciseProblems, shown: ExerciseProblems): string {
  const anyShown = Object.entries(shown).some(([key, value]) => (key === 'refused' ? (value as string[]).length > 0 : value !== undefined));
  if (anyShown) return 'Fix the fields in red to save.';
  if (typed.name) return "Enter the exercise's name to save.";
  if (typed.time) return 'Enter the time to save.';
  if (typed.refused.length > 0) return 'Fill in each set to save.';
  return 'Fix the fields in red to save.';
}

/** One set: its number, a field for each of the type's columns, and a bin while there is another set. */
function SetRow({
  index,
  set,
  columns,
  unit,
  refused,
  autoFocus,
  onChange,
  watch,
  onRemove,
}: {
  index: number;
  set: SetText;
  columns: { column: SetColumn; required: boolean }[];
  unit: BodyWeightUnit;
  refused: readonly string[];
  autoFocus: boolean;
  onChange(index: number, column: SetColumn, value: string): void;
  /** Focus and blur for a field, by its name, for its checks (D-99). */
  watch(name: string): { onFocus(): void; onBlur(): void };
  onRemove?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.setRow}>
      <Text style={styles.setNumber}>{index + 1}</Text>
      {columns.map(({ column, required }, position) => (
        <Box
          key={column}
          accessibilityLabel={`Set ${index + 1}, ${columnLabel(column, required, unit)}`}
          value={set[column]}
          onChangeText={(value) => onChange(index, column, value)}
          keyboardType={column === 'weight' ? 'decimal-pad' : 'number-pad'}
          unit={column === 'weight' ? unit : column === 'seconds' ? 'sec' : ''}
          refused={refused.includes(`${index}:${column}`)}
          autoFocus={autoFocus && position === 0}
          compact
          {...watch(setField(index, column))}
        />
      ))}
      {onRemove ? (
        <IconButton label={`Remove set ${index + 1}`} onPress={onRemove}>
          <Trash size={20} color={colors.danger} />
        </IconButton>
      ) : (
        <View style={styles.binSpace} />
      )}
    </View>
  );
}

/** Under a distance: the average speed and pace, once the time and the distance are both typed. */
function AverageSpeed({ text }: { text: ExerciseText }) {
  const styles = useStyles();
  const minutes = parseWholeNumber(text.timeMinutes.trim() || '0', 0, 1440);
  const seconds = parseWholeNumber(text.timeSeconds.trim() || '0', 0, 59);
  const km = parseTwoDecimals(text.distance);
  const total = minutes === null || seconds === null ? 0 : minutes * 60 + seconds;
  if (total === 0 || km === null || km <= 0) return null;
  return <Text style={styles.help}>Average speed {speedAndPace(Math.round(km * 1000), total)}</Text>;
}

/**
 * A sunken box for one value, its unit after it, and `after` the unit a button of the box's own (the
 * calories' arrow, D-107); the outline caramel while typing and red when refused. ("estimated" moved
 * from the box to the calories' label, D-111.)
 */
function Box({
  unit,
  after,
  refused,
  compact = false,
  note = false,
  onFocus,
  onBlur,
  ...input
}: { unit?: string; after?: ReactNode; refused: boolean; compact?: boolean; note?: boolean } & TextInputProps) {
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[styles.box, compact && styles.compact, note && styles.noteBox, after ? styles.withAfter : null, focused && styles.focused, refused && styles.refused]}
    >
      <TextInput
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.value, !note && styles.number, note && styles.note]}
        {...input}
      />
      {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      {after}
    </View>
  );
}

// The redesign's 4.3 (locked by the owner, 2026-11-03; the exercise list, sets and cardio locked
// 2026-11-05, D-50): fields as Field's (2.4); the matches under the name as Search foods' rows, each
// with its group as a tag; the sets as rows of sunken boxes with a bin, Add set a caramel link; Remove
// exercise a red link at the foot of the form, away from Save, the one filled action.
const useStyles = themedStyles((c) => ({
  saveHint: { ...TYPE.small, color: c.inkMuted, textAlign: 'center' },
  // D-111 (the owner's B, 2026-11-17: too much scrolling): boxes 44 high (54 before), labels 6 above them,
  // fields 12 apart (14), numbers 20 (24), the note one line.
  field: { gap: 6 },
  box: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.inkSubtle,
    backgroundColor: c.surfaceSunken,
  },
  compact: { flex: 1, gap: 8, paddingHorizontal: 12 },
  // A button at the box's end keeps its own room (D-107).
  withAfter: { paddingRight: 4 },
  divider: { width: 1, height: 28, backgroundColor: c.border },
  // The calories' label and, once changed by the user, the caramel Edited tag (D-107), as Home's Due badge.
  // On a narrow phone the tag goes under the label rather than squeezing it (D-111: the box is half wide).
  labelWithTag: { flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 2 },
  editedTag: {
    ...TYPE.label,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    color: c.onPrimary,
    backgroundColor: c.primary,
  },
  noteBox: { alignItems: 'flex-start' },
  focused: { borderColor: c.accent },
  refused: { borderColor: c.danger },
  value: { ...TYPE.input, flex: 1, paddingVertical: 8, fontVariant: ['tabular-nums'] },
  number: { ...TYPE.metric, fontSize: 20, lineHeight: 24 },
  note: { textAlignVertical: 'top', lineHeight: 24 },
  unit: { ...TYPE.label, fontSize: 15, lineHeight: 20, letterSpacing: 1, color: c.inkMuted },
  help: { ...TYPE.small, flexShrink: 1, color: c.inkMuted },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 8 },
  title: { ...TYPE.screenHeader, flex: 1 },
  // The fields at the page's top; under them the open list, the matches or the form, each scrolling on its own.
  top: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  fill: { flex: 1 },
  // Exactly the page's height, not at least it (`flexGrow`): a scroll view's content has no height of its
  // own, so only this gives the open list a height to scroll in.
  listing: { flex: 1 },
  listArea: { flex: 1, gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  form: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 12 },
  listed: { gap: 8 },
  // The name's chevron, as Category's (D-67), at the box's end.
  nameBox: { paddingRight: 4 },
  nameChevron: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  matches: { borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised },
  // What a match's choice doesn't say, on a second, muted line under its name (the owner chose A, 2026-11-10).
  matchText: { flex: 1, minWidth: 0, gap: 2 },
  matchLine: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  more: { paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: c.border },
  match: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 14, paddingRight: 12 },
  divided: { borderTopWidth: 1, borderTopColor: c.border },
  pressed: { opacity: 0.6 },
  matchName: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  // The exercise picked, when the list opens on it: the accent's tint, its name bold, a tick at its end.
  matchPicked: { backgroundColor: c.accentTint },
  matchNamePicked: { fontWeight: '700' },
  // A group, as Search foods' source tags: the muted ink on the sunken colour.
  tag: {
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
  // A line that wraps: a tag too long for the line takes it, wrapping inside its box; how the exercise
  // is logged never shrinks, so it moves on rather than standing a letter a line.
  typeLine: { marginTop: -6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2 },
  typeTag: { flexShrink: 1 },
  typeLabel: { flexShrink: 0 },
  // How to do it at the name label's right (D-111): 28 high in the label's row, 44 to the touch.
  nameLabelRow: { minHeight: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameLabel: { flex: 1 },
  howTo: { minHeight: 28, marginVertical: -6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  howToPressed: { opacity: 0.7 },
  howToText: { ...TYPE.link, color: c.accent },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { paddingHorizontal: 12 },
  choiceText: { fontSize: 15, letterSpacing: 0.5 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setNumber: { ...TYPE.metric, fontSize: 18, width: 24, textAlign: 'center', color: c.accent },
  numberSpace: { width: 24 },
  columnLabel: { ...TYPE.label, flex: 1, fontSize: 12, lineHeight: 14, letterSpacing: 1, color: c.inkMuted },
  binSpace: { width: 40 },
  addSet: { alignItems: 'flex-start' },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  rule: { height: 1, backgroundColor: c.border },
  // The calories' line, under Time spent and Calories, closer to them than the next pair.
  afterPair: { ...TYPE.small, color: c.inkMuted, marginTop: -6 },
  // Time spent's label beside Calories', centred on it: Calories' row holds a 44-high info button.
  pairLabels: { alignItems: 'center' },
  labelRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: -10 },
  body: { fontSize: 15, lineHeight: 22 },
  example: { gap: 2, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 4, backgroundColor: c.surfaceSunken },
  formula: { ...TYPE.metric, fontVariant: ['tabular-nums'] },
}));
