import type { BodyWeightUnit, IstDay, TargetKind } from '@fitsphere/shared';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DateChoices, RangeStatusView } from '../components/DateChoices';
import { Text } from '../components/ui';
import { LAST_90_DAYS, shownRange, type DateChoice } from '../dateRange';
import { formatDay } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import type { WeekRow } from './calculations';
import { PROGRESS_TEXTS } from './texts';
import { useWeeksRange } from './weeksRange';
import { WeekTable } from './WeekTable';

/** The table lists at most this many of the newest weeks of a long range. */
const MAX_TABLE_ROWS = 104;

type Props = {
  /** This week and the 11 before it (`weekRows`): the last 90 days' weeks. */
  lastWeeks: readonly WeekRow[];
  targets: Partial<Record<TargetKind, number>>;
  unit: BodyWeightUnit;
  today: IstDay;
  /** This week's Monday. */
  thisWeek: IstDay;
};

// "Week by week" as a tile (the owner's B on the canvas, 2026-11-18): Pick dates (dates or years) and
// Last 90 days, a count line, and the whole table unfolded under "Show table"; no graph (the owner,
// 2026-11-18: it was confusing). Last 90 days is the phone's 12 weeks; picked dates read the older days
// online first (D-106's days route), the sums the same.
export function WeeksTile({ lastWeeks, targets, unit, today, thisWeek }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [choice, setChoice] = useState<DateChoice>(LAST_90_DAYS);
  const [open, setOpen] = useState(false);
  const picked = useWeeksRange(choice, today);
  const onLast90 = choice.kind === 'last90';
  const status = onLast90 ? 'ready' : picked.status;
  const rows = onLast90 ? lastWeeks : picked.rows;
  const shown = shownRange(choice, today);
  const weeks = rows.length;
  const count = `${weeks} ${weeks === 1 ? 'week' : 'weeks'} · ${formatDay(shown.from, today)} – ${formatDay(shown.to, today)}`;
  const tableRows = rows.slice(0, MAX_TABLE_ROWS);

  return (
    <View style={styles.tile}>
      <Text accessibilityRole="header" style={styles.title}>
        Week by week
      </Text>
      <DateChoices today={today} choice={choice} onChoose={setChoice} online={PROGRESS_TEXTS.weeksOnline} forWhat="weeks" byYears yearChoices={false} />
      {status !== 'ready' ? (
        <RangeStatusView
          status={status}
          texts={{ loading: PROGRESS_TEXTS.weeksLoading, offline: PROGRESS_TEXTS.weeksOffline, failed: PROGRESS_TEXTS.weeksFailed }}
          onRetry={picked.retry}
        />
      ) : (
        <>
          <Text style={styles.count}>{count}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={open ? 'Hide table' : 'Show table'}
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((value) => !value)}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>{open ? 'Hide table' : 'Show table'}</Text>
            <ChevronDown size={18} strokeWidth={2.5} color={colors.accent} style={open ? styles.flipped : undefined} />
          </Pressable>
          {open ? (
            <>
              <WeekTable bare rows={tableRows} targets={targets} unit={unit} thisWeek={thisWeek} />
              {rows.length > tableRows.length ? <Text style={styles.count}>{`The newest ${MAX_TABLE_ROWS} of ${rows.length} weeks.`}</Text> : null}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

// The owner's B (2026-11-18): the tile as the others, 12 inside.
const useStyles = themedStyles((c) => ({
  tile: { padding: 12, borderRadius: 4, gap: 10, backgroundColor: c.surface },
  title: { ...TYPE.label, color: c.inkMuted },
  count: { fontSize: 13, lineHeight: 18, color: c.inkMuted },
  toggle: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  toggleText: { ...TYPE.link, color: c.accent },
  flipped: { transform: [{ rotate: '180deg' }] },
}));
