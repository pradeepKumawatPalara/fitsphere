import { istToday, istWeekStart, syncWindowStart, type IstDay } from '@fitsphere/shared';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type SelectedDayValue = {
  today: IstDay;
  /** The day every main screen shows (REQ-DATE-001). */
  selected: IstDay;
  /** The earliest day that can be selected: the 90 IST days the phone holds (ADR-0007 rule 1;
   * MVP default, D-23). Older days are viewed in Progress. */
  firstDay: IstDay;
  /** The Monday of the week the Home week strip shows. */
  weekStart: IstDay;
  /** Selects a day from today back to `firstDay`, and shows its week; other days are ignored. */
  select(day: IstDay): void;
  showWeek(weekStart: IstDay): void;
};

const SelectedDayContext = createContext<SelectedDayValue | null>(null);

/**
 * The selected date, shared by the tabs and the header (REQ-NAV-002, REQ-DATE-001). It starts on
 * today in IST each time the app starts (MVP default, D-23).
 */
export function SelectedDayProvider({ children, now = defaultNow }: { children: ReactNode; now?: () => Date }) {
  const today = istToday(now());
  const firstDay = syncWindowStart(today);
  const [selected, setSelected] = useState(today);
  const [weekStart, setWeekStart] = useState(() => istWeekStart(today));

  const select = useCallback(
    (day: IstDay) => {
      if (day > today || day < firstDay) return;
      setSelected(day);
      setWeekStart(istWeekStart(day));
    },
    [today, firstDay],
  );

  return (
    <SelectedDayContext.Provider value={{ today, selected, firstDay, weekStart, select, showWeek: setWeekStart }}>
      {children}
    </SelectedDayContext.Provider>
  );
}

function defaultNow(): Date {
  return new Date();
}

export function useSelectedDay(): SelectedDayValue {
  const value = useContext(SelectedDayContext);
  if (!value) throw new Error('useSelectedDay must be used inside SelectedDayProvider');
  return value;
}
