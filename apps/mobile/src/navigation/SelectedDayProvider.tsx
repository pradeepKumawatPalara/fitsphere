import { addDays, istToday, istWeekStart, syncWindowStart, type IstDay } from '@fitsphere/shared';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type SelectedDayValue = {
  today: IstDay;
  /** The day every main screen shows (REQ-DATE-001). */
  selected: IstDay;
  /** The earliest day that can be selected: the 90 IST days the phone holds (ADR-0007 rule 1;
   * MVP default, D-23). Older days are viewed in Progress. */
  firstDay: IstDay;
  /** The Monday of the Monday-to-Sunday week the date strip shows (REQ-HOME-002, D-79). */
  stripStart: IstDay;
  /** Selects a day from today back to `firstDay`, and shows the week holding it; other days are ignored. */
  select(day: IstDay): void;
  /** Shows the week from its Monday, `start`. */
  showDays(start: IstDay): void;
};

const SelectedDayContext = createContext<SelectedDayValue | null>(null);

/** The Monday of the week, Monday to Sunday, the strip shows for `day` (D-79). */
export function stripStartFor(day: IstDay): IstDay {
  return istWeekStart(day);
}

/** The Mondays of every week the strip can show, oldest first: from the week holding `firstDay` to this week. */
export function stripStarts(firstDay: IstDay, today: IstDay): IstDay[] {
  const starts: IstDay[] = [];
  for (let start = istWeekStart(firstDay); start <= today; start = addDays(start, 7)) starts.push(start);
  return starts;
}

/**
 * The selected date, shared by the tabs and the header (REQ-NAV-002, REQ-DATE-001). It starts on
 * today in IST each time the app starts (MVP default, D-23).
 */
export function SelectedDayProvider({ children, now = defaultNow }: { children: ReactNode; now?: () => Date }) {
  const today = istToday(now());
  const firstDay = syncWindowStart(today);
  const [selected, setSelected] = useState(today);
  const [stripStart, setStripStart] = useState(() => stripStartFor(today));

  const select = useCallback(
    (day: IstDay) => {
      if (day > today || day < firstDay) return;
      setSelected(day);
      setStripStart(stripStartFor(day));
    },
    [today, firstDay],
  );

  return (
    <SelectedDayContext.Provider value={{ today, selected, firstDay, stripStart, select, showDays: setStripStart }}>
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
