import { istToday, syncWindowStart, type IstDay, type WeighInsPage } from '@fitsphere/shared';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DateChoices, RangeStatusView } from '../components/DateChoices';
import { WeighInList, type HistoryRow } from '../components/WeighInList';
import { Text } from '../components/ui';
import { choiceRange, fetchDatedPages, LAST_90_DAYS, shownRange, useDatedList, type DatedSource, type DateChoice } from '../dateRange';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listWeighIns, type LocalWeighIn } from '../local/store';
import { useDataVersion } from '../sync/SyncProvider';
import { themedStyles } from '../theme';

/** What Weight history says while older dates are read, or why they could not be (D-116). */
export const WEIGH_INS_STATUS = {
  loading: 'Loading weigh-ins…',
  offline: 'Weigh-ins older than 90 days need an internet connection.',
  failed: 'Couldn’t load these weigh-ins.',
};

/** A weigh-in of the list: the phone's, with its sync state, or one read from the server (synced). */
type Weighed = Pick<LocalWeighIn, 'day' | 'weightGrams' | 'syncState'>;

/** The weigh-ins by dates (`useDatedList`): the phone's, then the server's older ones; one per day. */
const WEIGH_INS: DatedSource<Weighed> = {
  phone: listWeighIns,
  online: async (deps, from, to) => {
    const items = await fetchDatedPages<WeighInsPage['items'][number]>(deps, 'weigh-ins', from, to);
    return typeof items === 'string' ? items : items.map(({ day, weightGrams }) => ({ day, weightGrams, syncState: 'synced' as const }));
  },
  key: (entry) => entry.day,
};

/** A list row: a weigh-in waiting to sync, or refused, says so (ADR-0007 rule 2). */
function toRow(entry: Weighed): HistoryRow {
  return {
    day: entry.day,
    weightGrams: entry.weightGrams,
    ...(entry.syncState === 'pending' ? { note: 'waiting to sync' } : {}),
    ...(entry.syncState === 'rejected' ? { note: 'not saved' } : {}),
  };
}

/** "1 weigh-in" or "N weigh-ins". */
function weighInCount(count: number): string {
  return count === 1 ? '1 weigh-in' : `${count} weigh-ins`;
}

// Weight history (REQ-PRG-001; ADR-0007 rule 1): the last 90 IST days from the phone; since D-116 (the
// owner's A) a row of choices above them, as Progress's measurements (D-114), picks other dates: a
// year or Pick dates, the days older than the phone's read from the server online (rule 6), shown,
// not stored, with a count line naming the dates. It replaces "Load older".
export function HistoryScreen({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const local = useLocalDatabase();
  const version = useDataVersion();
  const today = istToday(now());
  const windowStart = syncWindowStart(today);
  const [recent, setRecent] = useState<Weighed[]>([]);
  const [choice, setChoice] = useState<DateChoice>(LAST_90_DAYS);
  const range = choiceRange(choice, today);
  const chosen = useDatedList(range, today, null, WEIGH_INS);
  const status = range ? chosen.status : 'ready';
  const dates = shownRange(choice, today);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    let active = true;
    void listWeighIns(local.state.db, windowStart, today).then((entries) => {
      if (active) setRecent(entries);
    });
    return () => {
      active = false;
    };
  }, [local.state, windowStart, today, version]);

  const rows = status === 'ready' ? (range ? chosen.entries : recent).map(toRow) : [];
  const day = (value: IstDay) => formatDay(value, today);

  return (
    <WeighInList
      rows={rows}
      today={today}
      header={
        <View style={styles.header}>
          <DateChoices today={today} choice={choice} onChoose={setChoice} online="Weigh-ins older than 90 days load online." />
          {status !== 'ready' ? (
            <RangeStatusView status={status} texts={WEIGH_INS_STATUS} onRetry={chosen.retry} />
          ) : rows.length > 0 ? (
            <Text style={styles.count}>{`${weighInCount(rows.length)} · ${day(dates.from)} – ${day(dates.to)}`}</Text>
          ) : null}
        </View>
      }
      empty={
        status === 'ready' ? (
          <Text style={styles.none}>{range ? `No weigh-ins from ${day(dates.from)} to ${day(dates.to)}.` : 'No weigh-ins in the last 90 days.'}</Text>
        ) : null
      }
    />
  );
}

// The redesign's 5.2 (locked by the owner, 2026-11-03), with D-116's choices on top (the owner's A,
// 2026-11-18): the row of choices edge to edge, a muted count line, a sunken box when there are none.
const useStyles = themedStyles((c) => ({
  header: { gap: 12, paddingBottom: 12 },
  count: { marginTop: -4, fontSize: 13, lineHeight: 18, color: c.inkMuted },
  none: { padding: 16, borderRadius: 4, backgroundColor: c.surfaceSunken, fontSize: 15, lineHeight: 22, color: c.inkMuted },
}));
