import { addDays, type IstDay } from '@fitsphere/shared';
import { useEffect, useState } from 'react';
import type { CalendarActivity } from './components/CalendarSheet';
import { useLocalDatabase } from './local/LocalDatabaseProvider';
import { listEntries, mealCounts } from './local/store';
import { useDataVersion } from './sync/SyncProvider';
import { workoutsPerDay } from './workouts';

/**
 * The date strip's week (D-103): meals and listed workouts per day, for the apple and the dumbbell under
 * each date, as the header's calendar (D-84). Home's line counting the week's workouts is gone (D-110).
 */
export type WeekActivity = CalendarActivity;

/** The week from Monday `start` on the phone, read again after each sync; null while it loads. */
export function useWeekActivity(start: IstDay): WeekActivity | null {
  const local = useLocalDatabase();
  const version = useDataVersion();
  const [read, setRead] = useState<{ start: IstDay; activity: WeekActivity } | null>(null);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    const end = addDays(start, 6);
    void Promise.all([mealCounts(db, start, end), listEntries(db, 'workout', start, end)]).then(([meals, workouts]) => {
      if (!active) return;
      setRead({ start, activity: { meals, workouts: workoutsPerDay(workouts) } });
    });
    return () => {
      active = false;
    };
  }, [local.state, start, version]);

  // Another week's, while this one loads, is not this week's.
  return read && read.start === start ? read.activity : null;
}
