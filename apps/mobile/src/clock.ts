import { useEffect, useState } from 'react';

/**
 * The time now, from `now`; while `ticking`, the screen draws again once a second, so a running
 * workout timer counts on screen (D-71). Nothing ticks while no timer runs. The time itself comes
 * from the clock, never from counting ticks, so a screen left and opened again shows it right.
 */
export function useNow(now: () => Date, ticking: boolean): Date {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(id);
  }, [ticking]);
  return now();
}
