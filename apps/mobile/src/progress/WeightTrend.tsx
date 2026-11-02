import type { BodyWeightUnit, IstDay } from '@fitsphere/shared';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { Text, TextButton, useChoiceStyles } from '../components/ui';
import { useTheme } from '../theme';
import {
  CHART_RANGES,
  chartPoints,
  mergeWeighIns,
  rangeIsWeekly,
  rangeNeedsServer,
  type ChartRange,
  type WeighInPoint,
} from './calculations';
import { Card } from './Card';
import { fetchOlderWeighIns } from './olderWeighIns';
import { PROGRESS_TEXTS } from './texts';
import { WeightChart } from './WeightChart';

type OnlineRange = '26W' | 'All';

const RANGE_NAMES: Record<ChartRange, string> = {
  '1W': '1 week',
  '4W': '4 weeks',
  '12W': '12 weeks',
  '26W': '26 weeks',
  All: 'All',
};

type Props = {
  /** The phone's weigh-ins of the last 90 days. */
  weighIns: readonly WeighInPoint[];
  today: IstDay;
  accountStart: IstDay | null;
  unit: BodyWeightUnit;
  onAllWeighIns(): void;
};

// The weight trend card (REQ-PRG-004): the range buttons, the chart or its empty state, and "All
// weigh-ins". 1W, 4W and 12W come from the phone. 26W and All also need the older weigh-ins, read
// online once per range and kept in memory only (ADR-0007 rules 1 and 6); offline they show the
// named warning, and choosing the range again tries again.
export function WeightTrend({ weighIns, today, accountStart, unit, onAllWeighIns }: Props) {
  const { deps } = useAuth();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  const [range, setRange] = useState<ChartRange>('4W');
  const [older, setOlder] = useState<Partial<Record<OnlineRange, WeighInPoint[]>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = useRef<ChartRange>('4W');

  async function choose(next: ChartRange) {
    chosen.current = next;
    setRange(next);
    setMessage(null);
    if (next !== '26W' && next !== 'All') return;
    if (older[next] || !rangeNeedsServer(next, today, accountStart)) return;
    setBusy(true);
    const result = await fetchOlderWeighIns(deps, next, today, accountStart);
    setBusy(false);
    if (Array.isArray(result)) setOlder((current) => ({ ...current, [next]: result }));
    else if (chosen.current === next) {
      setMessage(result === 'offline' ? TEXTS.needsInternet(PROGRESS_TEXTS.chartStep[next]) : TEXTS.tryLater);
    }
  }

  const fromServer = range === '26W' || range === 'All' ? older[range] : undefined;
  const waiting = (range === '26W' || range === 'All') && !fromServer && rangeNeedsServer(range, today, accountStart);
  const points = chartPoints(range, fromServer ? mergeWeighIns(weighIns, fromServer) : weighIns, today);
  const text = { color: colors.text };

  return (
    <Card title="Weight trend">
      <View style={styles.ranges}>
        {CHART_RANGES.map((option) => {
          const selected = option === range;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={RANGE_NAMES[option]}
              accessibilityState={{ selected }}
              onPress={() => void choose(option)}
              style={({ pressed }) => [pill.choice, styles.range, selected && pill.chosen, pressed && pill.pressed]}
            >
              <Text style={[pill.choiceText, styles.rangeText, selected && pill.chosenText]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {waiting ? (
        message ? (
          <Text accessibilityRole="alert" style={[styles.body, text]}>
            {message}
          </Text>
        ) : busy ? (
          <Text style={[styles.small, { color: colors.textMuted }]}>{PROGRESS_TEXTS.chartLoading}</Text>
        ) : null
      ) : points.length < 2 ? (
        <Text style={[styles.body, text]}>{PROGRESS_TEXTS.chartEmpty}</Text>
      ) : (
        <WeightChart points={points} unit={unit} weekly={rangeIsWeekly(range)} />
      )}
      <TextButton title="All weigh-ins" onPress={onAllWeighIns} />
    </Card>
  );
}

// The ranges are choice pills sharing the row: the chosen one filled, as the chosen meal and day are
// elsewhere.
const styles = StyleSheet.create({
  ranges: { flexDirection: 'row', gap: 6 },
  range: { flex: 1, paddingHorizontal: 0 },
  rangeText: { fontVariant: ['tabular-nums'] },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
});
