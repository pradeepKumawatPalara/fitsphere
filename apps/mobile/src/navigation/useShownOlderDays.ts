import { addDays, istWeekStart, syncWindowStart } from '@fitsphere/shared';
import { useOlderDays } from '../sync/SyncProvider';
import { useSelectedDay } from './SelectedDayProvider';

/**
 * The selected day's week and the date strip's week (D-106): the part of each before the phone's
 * 90 days is read from the server when shown. `day` is how the selected day stands, for the banner
 * and the cards: a day of the 90 is on the phone even when its week's older days are still loading.
 * `week` is how the strip's week stands, for Home's week line.
 */
export function useShownOlderDays() {
  const { today, selected, stripStart } = useSelectedDay();
  const monday = istWeekStart(selected);
  const selectedWeek = useOlderDays(monday, addDays(monday, 6), today);
  const week = useOlderDays(stripStart, addDays(stripStart, 6), today);
  const day = selected < syncWindowStart(today) ? selectedWeek : { status: 'onPhone' as const, retry: selectedWeek.retry };
  return { day, week };
}
