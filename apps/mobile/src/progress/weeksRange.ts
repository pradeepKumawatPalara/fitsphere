import type { IstDay } from '@fitsphere/shared';
import { useEffect, useState } from 'react';
import { choiceRange, type DateChoice, type RangeStatus } from '../dateRange';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { dailyNutrition, listEntries } from '../local/store';
import { useDataVersion, useOlderRange } from '../sync/SyncProvider';
import { weekRowsBetween, type WeekRow } from './calculations';

/**
 * The weeks of a year or of dates the user picked (Progress › Week by week): the days before the
 * phone's 90 are read online in chunks and kept in memory while the app is open (`useOlderRange`,
 * ADR-0007 rule 6), then every week's averages are worked out from what the phone holds, with the
 * same sums as the last 90 days' table (`weekRowsBetween`). Last 90 days: no range, no rows here;
 * the screen's own table covers it.
 */
export function useWeeksRange(
  choice: DateChoice,
  today: IstDay,
): { status: RangeStatus; rows: WeekRow[]; retry(): void } {
  const local = useLocalDatabase();
  const version = useDataVersion();
  const range = choiceRange(choice, today);
  const from = range?.from ?? null;
  const to = range?.to ?? null;
  const older = useOlderRange(range, today);
  const [read, setRead] = useState<{ key: string; rows: WeekRow[] } | null>(null);
  const olderReady = older.status === 'onPhone' || older.status === 'loaded';

  useEffect(() => {
    if (from === null || to === null || !olderReady || local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([listEntries(db, 'weighIn', from, to), dailyNutrition(db, from, to), listEntries(db, 'steps', from, to)]).then(
      ([weighIns, nutrition, steps]) => {
        if (!active) return;
        setRead({
          key: `${from}|${to}`,
          rows: weekRowsBetween({
            from,
            to,
            weighIns: weighIns.map(({ day, weightGrams }) => ({ day, weightGrams })),
            nutrition,
            steps: steps.map(({ day, steps: count }) => ({ day, steps: count })),
          }),
        });
      },
    );
    return () => {
      active = false;
    };
  }, [local.state, from, to, olderReady, version]);

  if (from === null || to === null) return { status: 'ready', rows: [], retry: older.retry };
  if (older.status === 'offline' || older.status === 'failed') return { status: older.status, rows: [], retry: older.retry };
  if (!olderReady || read?.key !== `${from}|${to}`) return { status: 'loading', rows: [], retry: older.retry };
  return { status: 'ready', rows: read.rows, retry: older.retry };
}
