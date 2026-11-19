import { fromGrams, type BodyWeightUnit, type IstDay } from '@fitsphere/shared';
import { ArrowRight, CalendarDays, CircleGauge, Minus, TrendingDown, TrendingUp, WifiOff, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Banner, Text, useChoiceStyles } from '../components/ui';
import { formatDay } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { CHART_RANGES, fourWeekWeight, type ChartRange, type WeighInPoint } from './calculations';
import { PROGRESS_TEXTS, weeklyRateText, weightChangeText } from './texts';
import { useWeightRange } from './useWeightRange';
import { WeightChart } from './WeightChart';

const RANGE_NAMES: Record<ChartRange, string> = {
  '1W': '1 week',
  '1M': '1 month',
  '3M': '3 months',
  '6M': '6 months',
  All: 'All',
};

type Props = {
  /** The phone's weigh-ins of the last 90 days. */
  weighIns: readonly WeighInPoint[];
  today: IstDay;
  unit: BodyWeightUnit;
  onAllWeighIns(): void;
};

/** "−1.2", "+0.4", or "0.0" when it rounds to nothing; the unit is in the tile's heading. */
function signed(grams: number, unit: BodyWeightUnit): string {
  const size = fromGrams(Math.abs(grams), unit);
  const text = size.toFixed(1);
  return size === 0 ? text : `${grams < 0 ? '−' : '+'}${text}`;
}

// Weight in one tile (the owner's B, 2026-11-18): the latest weigh-in (REQ-PRG-001) large, with the
// trend as a sparkline beside it (REQ-PRG-004: touching it shows a weigh-in), the range buttons under
// them, then the change and the weekly rate (Q-043, D-30). The sums and the ranges are the old cards':
// `fourWeekWeight` and `useWeightRange`. The change is in the text colour, not green or red: losing
// weight is not every user's goal.
export function WeightTile({ weighIns, today, unit, onAllWeighIns }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  const result = fourWeekWeight(weighIns);
  const trend = useWeightRange(weighIns, today);

  const heading = (
    <View style={styles.head}>
      <Text accessibilityRole="header" style={styles.title}>
        Weight over 4 weeks · {unit}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="All weigh-ins"
        onPress={onAllWeighIns}
        hitSlop={10}
        style={({ pressed }) => [styles.all, pressed && pill.pressed]}
      >
        <Text style={styles.allText}>All weigh-ins</Text>
        <ArrowRight size={14} strokeWidth={2.5} color={colors.accent} />
      </Pressable>
    </View>
  );

  if (!result) {
    return (
      <View style={styles.tile}>
        {heading}
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <CircleGauge size={24} color={colors.accent} />
          </View>
          <Text style={styles.emptyText}>{PROGRESS_TEXTS.noWeighIns}</Text>
        </View>
      </View>
    );
  }

  const rate = result.weeklyRateGrams;
  const changeIcon = result.changeGrams === null ? Minus : result.changeGrams < 0 ? TrendingDown : result.changeGrams > 0 ? TrendingUp : Minus;
  const latest = fromGrams(result.latest.weightGrams, unit).toFixed(1);

  return (
    <View style={styles.tile}>
      {heading}
      <View style={styles.top}>
        <View accessible accessibilityLabel={`Latest weigh-in · ${formatDay(result.latest.day)}: ${latest} ${unit}`} style={styles.latest}>
          <Text numberOfLines={1} style={styles.figure}>
            {latest}
          </Text>
          <Text style={styles.sub}>{formatDay(result.latest.day)}</Text>
        </View>
        <View style={styles.spark}>
          {trend.waiting ? (
            trend.busy ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.sub}>{PROGRESS_TEXTS.chartLoading}</Text>
              </View>
            ) : null
          ) : trend.points.length < 2 ? (
            <Text style={styles.sub}>{PROGRESS_TEXTS.chartEmpty}</Text>
          ) : (
            // A new chart for each range, so the point touched in another is forgotten.
            <WeightChart key={trend.range} points={trend.points} unit={unit} compact />
          )}
        </View>
      </View>
      {trend.waiting && trend.message ? <Banner tone="error" text={trend.message.text} {...(trend.message.offline ? { icon: WifiOff } : {})} /> : null}
      <View style={styles.ranges}>
        {CHART_RANGES.map((option) => {
          const selected = option === trend.range;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={RANGE_NAMES[option]}
              accessibilityState={{ selected }}
              onPress={() => void trend.choose(option)}
              hitSlop={4}
              style={({ pressed }) => [pill.choice, styles.range, selected && pill.chosen, pressed && pill.pressed]}
            >
              <Text style={[pill.choiceText, styles.rangeText, selected && pill.chosenText]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.cols}>
        {result.changeGrams !== null && result.earlier ? (
          <Cell
            icon={changeIcon}
            head="Since"
            figure={signed(result.changeGrams, unit)}
            note={`since ${formatDay(result.earlier.day)}`}
            label={weightChangeText(result.changeGrams, result.earlier.day, unit)}
          />
        ) : null}
        <Cell
          icon={CalendarDays}
          head="Week"
          figure={rate === null ? '–' : signed(Math.round(rate), unit)}
          note={rate === null ? 'needs a week' : 'a week'}
          label={rate === null ? PROGRESS_TEXTS.notEnoughForRate : weeklyRateText(rate, unit)}
          divided={result.changeGrams !== null && result.earlier !== null}
        />
      </View>
    </View>
  );
}

/** One of the two cells under the ranges, read out as the whole sentence (`label`). */
function Cell({ icon: Icon, head, figure, note, label, divided = false }: { icon: LucideIcon; head: string; figure: string; note: string; label: string; divided?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={[styles.cell, divided && styles.divided]}>
      <View style={styles.cellHead}>
        <Icon size={13} strokeWidth={2.25} color={colors.accent} />
        <Text style={styles.cellHeadText}>{head}</Text>
      </View>
      <Text numberOfLines={1} style={styles.cellFigure}>
        {figure}
      </Text>
      <Text numberOfLines={1} style={styles.sub}>
        {note}
      </Text>
    </View>
  );
}

// The owner's B (2026-11-18): one tile, 12 inside, the figure at 48, the sparkline taking the rest of
// its row, the ranges as a slim row of 36, the two cells ruled apart under them.
const useStyles = themedStyles((c) => ({
  tile: { padding: 12, paddingHorizontal: 16, borderRadius: 4, gap: 10, backgroundColor: c.surface },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { ...TYPE.label, flexShrink: 1, color: c.inkMuted },
  all: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allText: { ...TYPE.label, color: c.accent },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  latest: { flexShrink: 0, gap: 2 },
  figure: { ...TYPE.metric, fontSize: 48, lineHeight: 52, fontVariant: ['tabular-nums'], color: c.ink },
  sub: { fontSize: 11, lineHeight: 14, color: c.inkMuted },
  spark: { flex: 1, minWidth: 0, justifyContent: 'center' },
  loading: { height: 64, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 4, backgroundColor: c.surfaceSunken },
  ranges: { flexDirection: 'row', gap: 6 },
  range: { flex: 1, height: 36, minHeight: 36, paddingHorizontal: 0, paddingVertical: 0 },
  rangeText: { fontVariant: ['tabular-nums'] },
  cols: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0, gap: 2, alignItems: 'flex-start' },
  divided: { paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: c.border },
  cellHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cellHeadText: { ...TYPE.label, fontSize: 11, lineHeight: 13, letterSpacing: 1.2, color: c.inkMuted },
  cellFigure: { ...TYPE.metric, fontSize: 26, lineHeight: 32, fontVariant: ['tabular-nums'], color: c.ink },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyIcon: { width: 48, height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  emptyText: { flexShrink: 1, fontSize: 15, lineHeight: 22, color: c.ink },
}));
