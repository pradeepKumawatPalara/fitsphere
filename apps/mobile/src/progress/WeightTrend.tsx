import type { BodyWeightUnit, IstDay } from '@fitsphere/shared';
import { WifiOff } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { Banner, Text, TextButton, useChoiceStyles } from '../components/ui';
import { themedStyles, useTheme } from '../theme';
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

type OnlineRange = '6M' | 'All';

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
  accountStart: IstDay | null;
  unit: BodyWeightUnit;
  onAllWeighIns(): void;
};

// The weight trend card (REQ-PRG-004): the range buttons, the chart or its empty state, and "All
// weigh-ins" (D-34: calendar months; it opens on 1M). 1W, 1M and 3M come from the phone, 3M cut to
// its 90 days. 6M and All also need the older weigh-ins, read
// online once per range and kept in memory only (ADR-0007 rules 1 and 6); offline they show the
// named warning, and choosing the range again tries again.
export function WeightTrend({ weighIns, today, accountStart, unit, onAllWeighIns }: Props) {
  const styles = useStyles();
  const { deps } = useAuth();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  const [range, setRange] = useState<ChartRange>('1M');
  const [older, setOlder] = useState<Partial<Record<OnlineRange, WeighInPoint[]>>>({});
  const [message, setMessage] = useState<{ text: string; offline: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = useRef<ChartRange>('1M');

  async function choose(next: ChartRange) {
    chosen.current = next;
    setRange(next);
    setMessage(null);
    if (next !== '6M' && next !== 'All') return;
    if (older[next] || !rangeNeedsServer(next, today, accountStart)) return;
    setBusy(true);
    const result = await fetchOlderWeighIns(deps, next, today, accountStart);
    setBusy(false);
    if (Array.isArray(result)) setOlder((current) => ({ ...current, [next]: result }));
    else if (chosen.current === next) {
      setMessage(
        result === 'offline' ? { text: TEXTS.needsInternet(PROGRESS_TEXTS.chartStep[next]), offline: true } : { text: TEXTS.tryLater, offline: false },
      );
    }
  }

  const fromServer = range === '6M' || range === 'All' ? older[range] : undefined;
  const waiting = (range === '6M' || range === 'All') && !fromServer && rangeNeedsServer(range, today, accountStart);
  const points = chartPoints(range, fromServer ? mergeWeighIns(weighIns, fromServer) : weighIns, today);

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
          <Banner tone="error" text={message.text} {...(message.offline ? { icon: WifiOff } : {})} />
        ) : busy ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>{PROGRESS_TEXTS.chartLoading}</Text>
          </View>
        ) : null
      ) : points.length < 2 ? (
        <Text style={styles.empty}>{PROGRESS_TEXTS.chartEmpty}</Text>
      ) : (
        <WeightChart points={points} unit={unit} weekly={rangeIsWeekly(range)} />
      )}
      <TextButton title="All weigh-ins" arrow onPress={onAllWeighIns} />
    </Card>
  );
}

// The ranges are choice blocks sharing the row: the chosen one filled, as the chosen meal and day are
// elsewhere. The redesign's 5.1 (locked by the owner, 2026-11-03): a range still loading waits in a
// sunken box, one with too few weigh-ins says so in a dashed box, and a range that cannot load
// says why in a banner.
const useStyles = themedStyles((c) => ({
  ranges: { flexDirection: 'row', gap: 6 },
  range: { flex: 1, paddingHorizontal: 0 },
  rangeText: { fontVariant: ['tabular-nums'] },
  loading: { height: 160, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 4, backgroundColor: c.surfaceSunken },
  loadingText: { fontSize: 14, color: c.inkMuted },
  empty: {
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
}));
