import { addDays, type IstDay } from '@fitsphere/shared';
import { useEffect, useState } from 'react';
import type { CalendarActivity } from './components/CalendarSheet';
import { useLocalDatabase } from './local/LocalDatabaseProvider';
import { listEntries, mealCounts } from './local/store';
import { useSync } from './sync/SyncProvider';
import { workoutsPerDay } from './workouts';

/**
 * The date strip's week (D-103): meals and listed workouts per day, for the apple and the dumbbell under
 * each date, as the header's calendar (D-84); and the workouts that count toward the week, those with an
 * exercise (D-41), for Home's line under the strip.
 */
export type WeekActivity = CalendarActivity & { counted: number };

/** The week from Monday `start` on the phone, read again after each sync; null while it loads. */
export function useWeekActivity(start: IstDay): WeekActivity | null {
  const local = useLocalDatabase();
  const sync = useSync();
  const [read, setRead] = useState<{ start: IstDay; activity: WeekActivity } | null>(null);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    const end = addDays(start, 6);
    void Promise.all([mealCounts(db, start, end), listEntries(db, 'workout', start, end)]).then(([meals, workouts]) => {
      if (!active) return;
      const counted = workouts.filter((workout) => workout.exercises.length > 0).length;
      setRead({ start, activity: { meals, workouts: workoutsPerDay(workouts), counted } });
    });
    return () => {
      active = false;
    };
  }, [local.state, start, sync.version]);

  // Another week's, while this one loads, is not this week's.
  return read && read.start === start ? read.activity : null;
}
