import { addDays, istToday, syncWindowStart, type IstDay } from '@fitsphere/shared';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type SelectedDayValue = {
  today: IstDay;
  /** The day every main screen shows (REQ-DATE-001). */
  selected: IstDay;
  /** The earliest day that can be selected: the 90 IST days the phone holds (ADR-0007 rule 1;
   * MVP default, D-23). Older days are viewed in Progress. */
  firstDay: IstDay;
  /** The first of the 7 days the date strip shows; the newest 7 end today (REQ-HOME-002, D-34). */
  stripStart: IstDay;
  /** Selects a day from today back to `firstDay`, and shows the 7 days holding it; other days are ignored. */
  select(day: IstDay): void;
  /** Shows the 7 days from `start`. */
  showDays(start: IstDay): void;
};

const SelectedDayContext = createContext<SelectedDayValue | null>(null);

/**
 * The first of the strip's 7 days holding `day`: the newest 7 end today, and each earlier 7 end the
 * day before the next (D-34).
 */
export function stripStartFor(today: IstDay, day: IstDay): IstDay {
  const back = Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);
  return addDays(today, -6 - 7 * Math.floor(Math.max(0, back) / 7));
}

/** The first days of every 7 the strip can show, oldest first: back to the 7 holding `firstDay`. */
export function stripStarts(firstDay: IstDay, today: IstDay): IstDay[] {
  const starts: IstDay[] = [];
  for (let start = addDays(today, -6); addDays(start, 6) >= firstDay; start = addDays(start, -7)) starts.unshift(start);
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
  const [stripStart, setStripStart] = useState(() => addDays(today, -6));

  const select = useCallback(
    (day: IstDay) => {
      if (day > today || day < firstDay) return;
      setSelected(day);
      setStripStart(stripStartFor(today, day));
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
