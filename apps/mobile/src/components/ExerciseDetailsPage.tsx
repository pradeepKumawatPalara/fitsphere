import { addDays, exerciseVideoUrl, istToday, syncWindowStart, type BodyWeightUnit, type IstDay, type ListedExercise } from '@fitsphere/shared';
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ClockArrowDown,
  Dumbbell,
  ExternalLink,
  Gauge,
  History,
  Info,
  Layers,
  Play,
  Pointer,
  Repeat,
  Ruler,
  Timer,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Weight,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Linking, Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import {
  effortKindOf,
  effortKindOfLogType,
  exerciseBests,
  exerciseRecords,
  exerciseSessions,
  GRAPH_METRIC_LABELS,
  GRAPH_METRICS,
  GRAPH_RANGES,
  graphChange,
  graphPoints,
  graphValueText,
  historyCard,
  rangeStart,
  sessionsSummary,
  workoutNumbers,
  type EffortKind,
  type ExerciseBest,
  type ExerciseWorkout,
  type GraphMetric,
  type GraphPoint,
  type GraphRange,
  type Session,
} from '../exerciseStats';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { findListedExercise, listEntries } from '../local/store';
import { fetchOlderWorkouts, OLDER_CHUNK_DAYS } from '../olderWorkouts';
import { chartGeometry } from '../progress/chartGeometry';
import { useLiftingWeightUnit } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { GROUP_LABELS } from '../workouts';
import { FullScreen } from './FullScreen';
import { WorkoutInProgress } from './WorkoutInProgress';
import { Banner, IconButton, Text, TextButton, useChoiceStyles } from './ui';

// An exercise's page (D-82; the redesign's 4.4, locked 2026-11-11): Progress, History and How to, a
// whole page over the workout or Add exercise, as the exercise page (D-67), with a back arrow. It opens
// on Progress for an exercise logged before, otherwise on How to. Progress and History read the
// workouts on the phone (the last 90 days) and older ones loaded on History, matched by the
// exercise's name or other names; How to shows the library's details (D-81), the owner's file's as
// written, and its video, or the owner's default one, opened outside the app. A name of the user's own
// has its progress and history, and no how-to or video.

export type ExerciseTab = 'progress' | 'history' | 'howto';

const TABS: { tab: ExerciseTab; label: string; icon: LucideIcon }[] = [
  { tab: 'progress', label: 'Progress', icon: TrendingUp },
  { tab: 'history', label: 'History', icon: History },
  { tab: 'howto', label: 'How to', icon: BookOpen },
];

/** The site a video's address is on, as the card names it: "youtube.com". */
function siteOf(url: string): string {
  return /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(url)?.[1] ?? url;
}

/** What "Load older" says: that a range was empty, or why it could not load. */
type Message = { text: string; tone: 'info' | 'error' };

type Props = {
  /** The exercise's name as saved in a workout or picked in Add exercise. */
  name: string;
  onClose(): void;
  /** Opens a workout on the phone from its History card; none from Add exercise, where it would lose the form. */
  onOpenWorkout?(id: string): void;
  /** The tab to open on; by default Progress for an exercise logged before, otherwise How to. */
  initialTab?: ExerciseTab;
  now?: () => Date;
};

export function ExerciseDetailsPage({ name, onClose, onOpenWorkout, initialTab, now = () => new Date() }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  const local = useLocalDatabase();
  const sync = useSync();
  const { deps } = useAuth();
  const unit = useLiftingWeightUnit();
  const today = istToday(now());
  const firstDay = syncWindowStart(today);
  const [listed, setListed] = useState<ListedExercise | null | undefined>(undefined);
  const [phone, setPhone] = useState<ExerciseWorkout[] | null>(null);
  const [older, setOlder] = useState<ExerciseWorkout[]>([]);
  const [oldestLoaded, setOldestLoaded] = useState(firstDay);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [tab, setTab] = useState<ExerciseTab | null>(initialTab ?? null);
  const [range, setRange] = useState<GraphRange>('12W');
  const [metric, setMetric] = useState<GraphMetric | null>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([findListedExercise(db, name), listEntries(db, 'workout', firstDay, today)]).then(([found, workouts]) => {
      if (!active) return;
      setListed(found);
      setPhone(workouts.map(({ id, day, recordedAt, exercises }) => ({ id, day, recordedAt, exercises })));
    });
    return () => {
      active = false;
    };
  }, [local.state, name, firstDay, today, sync.version]);

  const loaded = listed !== undefined && phone !== null;
  const names = listed ? [listed.name, ...listed.aliases] : [name];
  const sessions = loaded ? exerciseSessions([...phone, ...older], names) : [];
  const kind: EffortKind = listed ? effortKindOfLogType(listed.logType) : sessions[0] ? effortKindOf(sessions[0].exercise) : 'weight_reps';
  const shown: ExerciseTab = tab ?? (sessions.length > 0 ? 'progress' : 'howto');
  if (loaded && tab === null) setTab(shown);
  const phoneIds = new Set((phone ?? []).map((workout) => workout.id));
  const details = listed?.details ?? null;
  const subtitle = details
    ? details.musclesWorked.join(' · ')
    : listed
      ? listed.places[0]
        ? [listed.places[0].category, listed.places[0].subGroup].filter(Boolean).join(' · ')
        : GROUP_LABELS[listed.group]
      : 'Your own exercise';

  async function loadOlder() {
    setLoadingOlder(true);
    setMessage(null);
    const to = addDays(oldestLoaded, -1);
    const from = addDays(to, -(OLDER_CHUNK_DAYS - 1));
    const result = await fetchOlderWorkouts(deps, from, to);
    setLoadingOlder(false);
    if (result === 'offline') return setMessage({ text: TEXTS.needsInternet('Loading older workouts'), tone: 'error' });
    if (result === 'failed') return setMessage({ text: TEXTS.tryLater, tone: 'error' });
    setOlder((rows) => [...rows, ...result]);
    setOldestLoaded(from);
    const found = exerciseSessions(result, names).length;
    if (found === 0) setMessage({ text: `No workouts with this exercise from ${formatDay(from)} to ${formatDay(to)}.`, tone: 'info' });
  }

  return (
    <FullScreen onClose={onClose}>
      <View style={styles.header}>
        <IconButton label="Back" onPress={onClose}>
          <ChevronLeft size={24} strokeWidth={2.25} color={colors.accent} />
        </IconButton>
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={styles.title}>
            {listed?.name ?? name}
          </Text>
          {loaded ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {TABS.map(({ tab: value, label, icon: Icon }) => {
          const chosen = shown === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: chosen }}
              onPress={() => setTab(value)}
              style={({ pressed }) => [pill.choice, styles.tab, chosen && pill.chosen, pressed && pill.pressed]}
            >
              <Icon size={17} strokeWidth={2.25} color={chosen ? colors.onPrimary : colors.ink} />
              <Text numberOfLines={1} style={[pill.choiceText, chosen && pill.chosenText]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {loaded ? (
        <ScrollView ref={scroller} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {shown === 'progress' ? (
            <ProgressTab
              sessions={sessions}
              kind={kind}
              unit={unit}
              today={today}
              range={range}
              onRange={setRange}
              metric={metric !== null && GRAPH_METRICS[kind].includes(metric) ? metric : GRAPH_METRICS[kind][0]!}
              onMetric={setMetric}
              onHowTo={() => setTab('howto')}
            />
          ) : null}
          {shown === 'history' ? (
            <>
              {sessions.length === 0 ? <Text style={styles.empty}>No workouts with this exercise yet.</Text> : null}
              <HistoryCards
                sessions={sessions}
                kind={kind}
                unit={unit}
                onOpen={onOpenWorkout}
                phoneIds={phoneIds}
                onGoTo={(y) => scroller.current?.scrollTo({ y: Math.max(0, y - 8), animated: true })}
              />
              {message ? <Banner text={message.text} tone={message.tone} /> : null}
              <TextButton title="Load older" outlined wide icon={ClockArrowDown} disabled={loadingOlder} onPress={() => void loadOlder()} />
            </>
          ) : null}
          {shown === 'howto' ? <HowToTab listed={listed} /> : null}
        </ScrollView>
      ) : null}
      <WorkoutInProgress bottom={16} now={now} onOpen={(id) => (onOpenWorkout ? onOpenWorkout(id) : onClose())} />
    </FullScreen>
  );
}

function ProgressTab({
  sessions,
  kind,
  unit,
  today,
  range,
  onRange,
  metric,
  onMetric,
  onHowTo,
}: {
  sessions: readonly Session[];
  kind: EffortKind;
  unit: BodyWeightUnit;
  today: IstDay;
  range: GraphRange;
  onRange(range: GraphRange): void;
  metric: GraphMetric;
  onMetric(metric: GraphMetric): void;
  onHowTo(): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  // The workout touched on the graph (D-82, the owner's C): kept after the finger lifts, until a touch
  // elsewhere on the tab or another measure or range.
  const [touched, setTouched] = useState<number | null>(null);
  const shownFor = `${metric}:${range}`;
  const [touchedFor, setTouchedFor] = useState(shownFor);
  if (touchedFor !== shownFor) {
    setTouchedFor(shownFor);
    setTouched(null);
  }
  if (sessions.length === 0) {
    return (
      <View style={styles.none}>
        <View style={styles.noneTile}>
          <TrendingUp size={28} color={colors.accent} />
        </View>
        <Text accessibilityRole="header" style={styles.noneTitle}>
          No progress yet
        </Text>
        <Text style={styles.noneText}>Log this exercise in a workout to see your progress.</Text>
        <TextButton title="How to do it" outlined icon={BookOpen} onPress={onHowTo} />
      </View>
    );
  }
  const records = exerciseRecords(sessions, kind, unit);
  const metrics = GRAPH_METRICS[kind];
  const points = graphPoints(sessions, kind, metric, rangeStart(range, today), unit);
  const last = points.at(-1);
  const point = touched === null ? undefined : points[touched];
  return (
    <Pressable accessible={false} onPress={() => setTouched(null)} style={styles.progress}>
      <View style={styles.records}>
        {records.map((record) => (
          <View key={record.label} accessible accessibilityLabel={`${record.label} ${record.value} ${record.unit}, ${record.day}`} style={styles.record}>
            <Text style={styles.recordLabel}>{record.label}</Text>
            <View style={styles.recordValueLine}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.recordValue}>
                {record.value}
              </Text>
              {record.unit ? <Text style={styles.recordUnit}>{record.unit}</Text> : null}
            </View>
            <Text style={styles.recordDay}>{record.day}</Text>
          </View>
        ))}
      </View>
      <View style={styles.summary}>
        <CalendarDays size={16} color={colors.accent} />
        <Text style={styles.summaryText}>{sessionsSummary(sessions)}</Text>
      </View>
      <View style={styles.card}>
        {metrics.length > 1 ? (
          <View accessibilityRole="tablist" style={styles.metrics}>
            {metrics.map((value) => {
              const chosen = value === metric;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityLabel={GRAPH_METRIC_LABELS[value]}
                  accessibilityState={{ selected: chosen }}
                  onPress={() => onMetric(value)}
                  style={[styles.metric, chosen && styles.metricChosen]}
                >
                  <Text style={[styles.metricText, chosen && styles.metricTextChosen]}>{GRAPH_METRIC_LABELS[value]}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.label}>{GRAPH_METRIC_LABELS[metric]}</Text>
        )}
        <View style={styles.ranges}>
          {GRAPH_RANGES.map((value) => {
            const chosen = value === range;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={value}
                accessibilityState={{ selected: chosen }}
                onPress={() => onRange(value)}
                style={({ pressed }) => [pill.choice, styles.range, chosen && pill.chosen, pressed && pill.pressed]}
              >
                <Text style={[pill.choiceText, chosen && pill.chosenText]}>{value}</Text>
              </Pressable>
            );
          })}
        </View>
        {points.length >= 2 && last ? (
          <>
            <View style={styles.latestLine}>
              <Text style={styles.latest}>{graphValueText(metric, last.value, unit)}</Text>
              <Text style={styles.change}>{graphChange(points, metric, unit)}</Text>
            </View>
            <TrendChart points={points} metric={metric} unit={unit} touched={touched} onTouch={setTouched} />
            {point ? (
              <View accessibilityLiveRegion="polite" style={styles.touchedWorkout}>
                <Text style={styles.label}>{`${formatDay(point.day)} · this workout`}</Text>
                <View style={styles.touchedNumbers}>
                  {workoutNumbers(point.session, kind, unit).map((number) => (
                    <View key={number.label} accessible accessibilityLabel={`${number.label} ${number.value}`} style={styles.touchedNumber}>
                      <Text style={[styles.recordLabel, number.metric === metric && styles.touchedLabelChosen]}>{number.label}</Text>
                      <Text style={styles.touchedValue}>{number.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.hint}>
              <Pointer size={16} color={colors.accent} />
              <Text style={styles.note}>Touch the graph and slide to see each workout&apos;s value.</Text>
            </View>
          </>
        ) : (
          <Text style={styles.chartEmpty}>A graph needs two workouts with this exercise in this range.</Text>
        )}
        {metric === 'oneRm' ? (
          <Text style={styles.note}>An estimate from your best set each workout (weight × reps). It is a guide to the trend, not a lift to attempt.</Text>
        ) : null}
      </View>
      <Text style={styles.note}>Your last 90 days. Load older in History adds earlier workouts.</Text>
    </Pressable>
  );
}

const CHART_HEIGHT = 160;
/** Room above the graph for the touched workout's bubble (the owner's C). */
const BUBBLE_ROOM = 40;
const DOT = 3.5;
const LATEST = 5;
const TOUCHED = 7;

/**
 * The graph (D-82), drawn as the weight trend is (REQ-PRG-004): the highest and lowest values on the
 * left, the first and last days below. Pressing it and sliding picks the nearest workout (the owner's
 * C, 2026-11-12): its dot ringed, a dashed line down from a bubble with its value and day at the top.
 * A screen reader moves from workout to workout by swiping up or down.
 */
function TrendChart({
  points,
  metric,
  unit,
  touched,
  onTouch,
}: {
  points: readonly GraphPoint[];
  metric: GraphMetric;
  unit: BodyWeightUnit;
  touched: number | null;
  onTouch(index: number | null): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [bubbleWidth, setBubbleWidth] = useState(0);
  const geometry = chartGeometry(
    points.map((point) => ({ day: point.day, weightGrams: point.value })),
    width,
    CHART_HEIGHT,
    TOUCHED + 2,
  );
  const first = points[0]!;
  const last = points.at(-1)!;
  const line = geometry.dots.map((dot) => `${dot.x},${dot.y}`).join(' ');
  const firstDot = geometry.dots[0]!;
  const lastDot = geometry.dots.at(-1)!;
  const point = touched === null ? undefined : points[touched];
  const dot = touched === null ? undefined : geometry.dots[touched];
  const said = (index: number) => `${formatDay(points[index]!.day)}, ${graphValueText(metric, points[index]!.value, unit)}`;
  /** The workout whose dot is nearest across. */
  function pick(x: number) {
    let nearest = 0;
    geometry.dots.forEach((each, index) => {
      if (Math.abs(each.x - x) < Math.abs(geometry.dots[nearest]!.x - x)) nearest = index;
    });
    onTouch(nearest);
  }
  const bubbleLeft = dot ? Math.min(Math.max(dot.x - bubbleWidth / 2, 0), Math.max(width - bubbleWidth, 0)) : 0;
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${GRAPH_METRIC_LABELS[metric]}, ${points.length} workouts, ${graphValueText(metric, first.value, unit)} on ${formatDay(
        first.day,
      )} to ${graphValueText(metric, last.value, unit)} on ${formatDay(last.day)}`}
      accessibilityValue={{ text: touched === null ? 'Swipe up or down to hear each workout' : said(touched) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
        const from = touched ?? (step > 0 ? -1 : points.length);
        onTouch(Math.min(Math.max(from + step, 0), points.length - 1));
      }}
      style={styles.chart}
    >
      <View style={styles.chartBody}>
        <View style={styles.scale}>
          <Text style={styles.scaleText}>{graphValueText(metric, geometry.highest, unit)}</Text>
          <Text style={styles.scaleText}>{graphValueText(metric, geometry.lowest, unit)}</Text>
        </View>
        <View
          testID="trend-chart-plot"
          style={styles.plot}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(event) => pick(event.nativeEvent.locationX)}
          onResponderMove={(event) => pick(event.nativeEvent.locationX)}
        >
          {width > 0 ? (
            <Svg width={width} height={CHART_HEIGHT} style={styles.plotSvg}>
              <Line x1={0} y1={0.5} x2={width} y2={0.5} stroke={colors.track} strokeWidth={1} />
              <Line x1={0} y1={CHART_HEIGHT / 2} x2={width} y2={CHART_HEIGHT / 2} stroke={colors.track} strokeWidth={1} strokeDasharray="3 4" />
              <Line x1={0} y1={CHART_HEIGHT - 0.5} x2={width} y2={CHART_HEIGHT - 0.5} stroke={colors.track} strokeWidth={1} />
              <Polygon points={`${line} ${lastDot.x},${CHART_HEIGHT} ${firstDot.x},${CHART_HEIGHT}`} fill={colors.accentTint} opacity={0.7} />
              <Polyline points={line} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {dot ? <Line x1={dot.x} y1={0} x2={dot.x} y2={CHART_HEIGHT} stroke={colors.ink} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} /> : null}
              {geometry.dots.map((each, index) => {
                const isTouched = index === touched;
                return (
                  <Circle
                    key={index}
                    cx={each.x}
                    cy={each.y}
                    r={isTouched ? TOUCHED : index === geometry.dots.length - 1 ? LATEST : DOT}
                    fill={isTouched ? colors.bg : colors.primary}
                    stroke={isTouched ? colors.primary : colors.surface}
                    strokeWidth={isTouched ? 3.5 : 2}
                  />
                );
              })}
            </Svg>
          ) : null}
          {point && dot ? (
            <View
              pointerEvents="none"
              onLayout={(event) => setBubbleWidth(event.nativeEvent.layout.width)}
              style={[styles.bubble, { left: bubbleLeft }]}
            >
              <Text style={styles.bubbleValue}>{graphValueText(metric, point.value, unit)}</Text>
              <Text style={styles.bubbleDay}>{formatDay(point.day)}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.days}>
        <Text style={styles.scaleText}>{formatDay(first.day)}</Text>
        <Text style={styles.scaleText}>{formatDay(last.day)}</Text>
      </View>
    </View>
  );
}

/** The icon of each best (D-82): a trophy for the 1RM, a weight, a stack for volume, a ruler or a timer, a bolt, a gauge. */
function bestIcon(best: ExerciseBest): LucideIcon {
  switch (best.key) {
    case 'oneRm':
      return Trophy;
    case 'heaviest':
      return Weight;
    case 'volume':
    case 'repsSession':
    case 'timeSession':
      return Layers;
    case 'mostReps':
      return Repeat;
    case 'longest':
      return best.unit === 'km' ? Ruler : Timer;
    case 'fastest':
      return Zap;
    case 'level':
      return Gauge;
  }
}

/**
 * History (D-82; the owner's C, locked 2026-11-12): the exercise's bests on top, each with its value
 * and day, tapping one scrolling to its workout; then a card per workout, newest first, the bests it
 * holds as tags at its top right, on the date's line.
 */
function HistoryCards({
  sessions,
  kind,
  unit,
  onOpen,
  phoneIds,
  onGoTo,
}: {
  sessions: readonly Session[];
  kind: EffortKind;
  unit: BodyWeightUnit;
  onOpen?: (id: string) => void;
  phoneIds: ReadonlySet<string>;
  /** Scrolls to a workout's card, from where it was laid out. */
  onGoTo(y: number): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bests = exerciseBests(sessions, kind, unit);
  const placed = useRef(new Map<Session, number>());
  return (
    <>
      {bests.length > 0 ? (
        <View style={styles.tiles}>
          {bests.map((best) => {
            const Icon = bestIcon(best);
            return (
              <Pressable
                key={best.key}
                accessibilityRole="button"
                accessibilityLabel={`${best.label} ${best.value} ${best.unit}, ${best.day}`}
                accessibilityHint="Shows that workout"
                onPress={() => onGoTo(placed.current.get(best.session) ?? 0)}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              >
                <View style={styles.tileLabelLine}>
                  <Icon size={13} strokeWidth={2.25} color={colors.success} />
                  <Text numberOfLines={1} style={styles.tileLabel}>
                    {best.label}
                  </Text>
                </View>
                <View style={styles.recordValueLine}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.tileValue}>
                    {best.value}
                  </Text>
                  {best.unit ? <Text style={styles.recordUnit}>{best.unit}</Text> : null}
                </View>
                <Text style={styles.recordDay}>{best.day}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {sessions.map((session, index) => {
        const card = historyCard(session, kind, unit, bests);
        const opens = onOpen && phoneIds.has(session.workoutId);
        const body = (
          <>
            <View style={styles.cardTop}>
              <Text style={[styles.label, styles.cardDate]}>{card.title}</Text>
              {card.tags.length > 0 ? (
                <View style={styles.tags}>
                  {card.tags.map((tag) => {
                    const Icon = bestIcon(tag);
                    return (
                      <View key={tag.key} style={styles.best}>
                        <Icon size={13} strokeWidth={2.25} color={colors.success} />
                        <Text style={styles.bestText}>{tag.short}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
            {card.rows.map((row) => (
              <View key={row.label} style={styles.setRow}>
                <Text style={styles.setLabel}>{row.label}</Text>
                <Text style={[styles.setValue, !row.best && styles.setValueOther]}>{row.value}</Text>
              </View>
            ))}
            {card.main ? <Text style={styles.setValue}>{card.main}</Text> : null}
            {card.footer ? <Text style={styles.footer}>{card.footer}</Text> : null}
          </>
        );
        const key = `${session.workoutId}:${index}`;
        const place = (event: LayoutChangeEvent) => placed.current.set(session, event.nativeEvent.layout.y);
        return opens ? (
          <Pressable
            key={key}
            onLayout={place}
            accessibilityRole="button"
            accessibilityLabel={card.aria}
            accessibilityHint="Opens the workout"
            onPress={() => onOpen(session.workoutId)}
            style={({ pressed }) => [styles.card, styles.historyCard, pressed && styles.pressed]}
          >
            {body}
          </Pressable>
        ) : (
          <View key={key} onLayout={place} accessible accessibilityLabel={card.aria} style={[styles.card, styles.historyCard]}>
            {body}
          </View>
        );
      })}
    </>
  );
}

function HowToTab({ listed }: { listed: ListedExercise | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const details = listed?.details ?? null;
  const video = listed ? exerciseVideoUrl(listed) : null;
  return (
    <>
      {video ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Watch the video, opens ${siteOf(video)}`}
          onPress={() => void Linking.openURL(video)}
          style={({ pressed }) => [styles.video, pressed && styles.pressed]}
        >
          <View style={styles.videoPlay}>
            <Play size={28} color={colors.onPrimary} fill={colors.onPrimary} />
          </View>
          <Text style={styles.videoTitle}>Watch the video</Text>
          <View style={styles.videoSiteLine}>
            <Text style={styles.videoSite}>{siteOf(video)} · opens outside FitSphere</Text>
            <ExternalLink size={14} color={colors.onScrim} />
          </View>
        </Pressable>
      ) : null}
      {details ? (
        <>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              How to do it
            </Text>
            {details.howTo.map((step, index) => (
              <View key={index} style={styles.step}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <View style={styles.cardTitleLine}>
              <TriangleAlert size={19} color={colors.warning} />
              <Text accessibilityRole="header" style={styles.cardTitle}>
                Watch for
              </Text>
            </View>
            <Text style={styles.stepText}>{details.watchFor}</Text>
          </View>
          <Text style={styles.label}>Muscles worked</Text>
          <View style={styles.chips}>
            {details.musclesWorked.map((muscle, index) => (
              <View key={muscle} style={[styles.chip, index === 0 && styles.chipPrimary]}>
                <Text style={[styles.chipText, index === 0 && styles.chipTextPrimary]}>{muscle}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.label}>Equipment</Text>
          <View style={styles.chips}>
            <View style={[styles.chip, styles.chipWithIcon]}>
              <Dumbbell size={16} color={colors.accent} />
              <Text style={styles.chipText}>{details.equipment}</Text>
            </View>
          </View>
          <Text style={styles.place}>
            In the library: <Text style={styles.placeName}>{[details.place.category, details.place.subGroup].filter(Boolean).join(' › ')}</Text>
          </Text>
          <View style={styles.advice}>
            <Info size={16} color={colors.inkMuted} />
            <Text style={styles.adviceText}>General guidance, not personal advice. Stop if anything hurts.</Text>
          </View>
        </>
      ) : (
        <View style={styles.none}>
          <View style={styles.noneTile}>
            <BookOpen size={28} color={colors.accent} />
          </View>
          <Text accessibilityRole="header" style={styles.noneTitle}>
            No how-to yet
          </Text>
          <Text style={styles.noneText}>There's no how-to for this exercise yet. Your progress and history are in the other tabs.</Text>
        </View>
      )}
    </>
  );
}

const useStyles = themedStyles((c) => ({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: 8, paddingBottom: 10, paddingLeft: 6, paddingRight: 16 },
  titles: { flex: 1, minWidth: 0, gap: 2, paddingTop: 7 },
  title: { ...TYPE.screenHeader, fontSize: 28, lineHeight: 30, color: c.ink },
  subtitle: { fontSize: 15, lineHeight: 21, color: c.inkMuted },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  tab: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  // Room at the foot for the Workout in progress pill (D-83).
  content: { gap: 12, padding: 16, paddingBottom: 88 },
  empty: { fontSize: 15, lineHeight: 22, color: c.inkMuted, textAlign: 'center', paddingVertical: 24 },
  records: { flexDirection: 'row', gap: 8 },
  record: { flex: 1, minWidth: 0, gap: 4, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 4, backgroundColor: c.surface },
  recordLabel: { ...TYPE.label, fontSize: 12, lineHeight: 15, letterSpacing: 1, color: c.inkMuted },
  recordValueLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  recordValue: { ...TYPE.metric, fontSize: 24, lineHeight: 26, color: c.ink, flexShrink: 1 },
  recordUnit: { ...TYPE.link, fontSize: 12, color: c.accent },
  recordDay: { fontSize: 13, lineHeight: 18, color: c.inkMuted },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { flex: 1, fontSize: 15, lineHeight: 22, color: c.inkMuted },
  card: { gap: 12, padding: 16, borderRadius: 4, backgroundColor: c.surface },
  historyCard: { gap: 6, paddingVertical: 12, paddingHorizontal: 14 },
  pressed: { opacity: 0.7 },
  label: { ...TYPE.label, color: c.inkMuted },
  metrics: { flexDirection: 'row', gap: 18 },
  metric: { minHeight: 32, paddingBottom: 4, borderBottomWidth: 2.5, borderBottomColor: 'transparent', justifyContent: 'center' },
  metricChosen: { borderBottomColor: c.accent },
  metricText: { ...TYPE.link, color: c.inkMuted },
  metricTextChosen: { color: c.ink },
  ranges: { flexDirection: 'row', gap: 6 },
  range: { flex: 1 },
  latestLine: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 10 },
  latest: { ...TYPE.heroNumber, fontSize: 34, lineHeight: 36, color: c.ink },
  change: { fontSize: 14, lineHeight: 20, color: c.success },
  chart: { gap: 6 },
  chartBody: { flexDirection: 'row', gap: 8, height: CHART_HEIGHT + BUBBLE_ROOM },
  scale: { width: 60, justifyContent: 'space-between', paddingTop: BUBBLE_ROOM },
  scaleText: { ...TYPE.label, fontSize: 13, letterSpacing: 0.5, color: c.inkMuted },
  plot: { flex: 1 },
  plotSvg: { marginTop: BUBBLE_ROOM },
  // D-82, the owner's C: the touched workout's bubble at the top, its numbers under the graph.
  bubble: { position: 'absolute', top: 0, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4, backgroundColor: c.ink, elevation: 3 },
  bubbleValue: { ...TYPE.metric, fontSize: 17, lineHeight: 19, color: c.bg },
  bubbleDay: { fontSize: 12, lineHeight: 15, color: c.bg },
  touchedWorkout: { gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 4, backgroundColor: c.surfaceSunken },
  touchedNumbers: { flexDirection: 'row', gap: 6 },
  touchedNumber: { flex: 1, minWidth: 0, gap: 1 },
  touchedLabelChosen: { color: c.accent },
  touchedValue: { ...TYPE.metric, fontSize: 19, lineHeight: 21, color: c.ink },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progress: { gap: 12 },
  days: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 68 },
  chartEmpty: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: c.border,
    fontSize: 15,
    lineHeight: 22,
    color: c.inkMuted,
    textAlign: 'center',
  },
  note: { fontSize: 13, lineHeight: 19, color: c.inkMuted },
  // D-82, the owner's C: the date on the left, the bests it holds as tags at the top right, on its line.
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardDate: { paddingTop: 3 },
  tags: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 },
  best: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 4, backgroundColor: c.successTint },
  bestText: { ...TYPE.link, fontSize: 12, letterSpacing: 1.2, color: c.success },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, gap: 4, padding: 10, borderRadius: 4, borderTopWidth: 3, borderTopColor: c.success, backgroundColor: c.surface },
  tileLabelLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileLabel: { ...TYPE.label, fontSize: 12, lineHeight: 15, letterSpacing: 1, color: c.success, flexShrink: 1 },
  tileValue: { ...TYPE.metric, fontSize: 22, lineHeight: 24, color: c.ink, flexShrink: 1 },
  setRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  setLabel: { ...TYPE.label, fontSize: 14, lineHeight: 24, letterSpacing: 1, width: 54, color: c.inkMuted },
  setValue: { ...TYPE.metric, fontSize: 21, lineHeight: 24, textTransform: 'uppercase', color: c.ink },
  setValueOther: { fontFamily: 'BarlowCondensed_700Bold', color: c.inkMuted },
  footer: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  video: { height: 200, justifyContent: 'flex-end', gap: 2, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 4, backgroundColor: c.scrimStrong, overflow: 'hidden' },
  videoPlay: {
    position: 'absolute',
    top: 66,
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    backgroundColor: c.primary,
  },
  videoTitle: { ...TYPE.button, color: c.onScrim },
  videoSiteLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  videoSite: { fontSize: 14, lineHeight: 20, color: c.onScrim, opacity: 0.85 },
  cardTitle: { ...TYPE.buttonSecondary, fontSize: 19, letterSpacing: 1, color: c.ink },
  cardTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { flexDirection: 'row', gap: 14 },
  stepNumber: { ...TYPE.metric, fontSize: 20, lineHeight: 23, width: 18, color: c.accent },
  stepText: { flex: 1, fontSize: 16, lineHeight: 23, color: c.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5, borderColor: c.border },
  chipWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipPrimary: { borderColor: c.accent, backgroundColor: c.accentTint },
  chipText: { fontSize: 15, color: c.ink, fontFamily: 'Barlow_500Medium' },
  chipTextPrimary: { color: c.accent },
  place: { fontSize: 15, lineHeight: 22, color: c.inkMuted },
  placeName: { color: c.ink },
  advice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  adviceText: { flex: 1, fontSize: 13, lineHeight: 19, color: c.inkMuted },
  none: { marginTop: 28, alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  noneTile: { width: 56, height: 56, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  noneTitle: { ...TYPE.screenHeader, color: c.ink, marginTop: 6 },
  noneText: { fontSize: 15, lineHeight: 22, color: c.inkMuted, textAlign: 'center' },
}));
