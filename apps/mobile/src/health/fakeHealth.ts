// A made-up health store for trying the Connections flow from a development build that has no Health
// Connect module (D-121). It is used only when the app runs in development AND
// EXPO_PUBLIC_FAKE_HEALTH=1 is set in apps/mobile/.env; a build for release can never use it
// (`__DEV__` is false there). Every value is invented: no real data is read.
import { addDays, type IstDay } from '@fitsphere/shared';
import type { DaySteps, HealthSource, WeightReading } from './types';

/** The fake is on: development only, and asked for by name. */
export function fakeHealthWanted(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_FAKE_HEALTH === '1';
}

/** Steps for each of the last 7 days up to `to` (today's the least, as a day still in progress). */
export function fakeSteps(from: IstDay, to: IstDay): DaySteps[] {
  const days: DaySteps[] = [];
  for (let back = 0; back < 7; back += 1) {
    const day = addDays(to, -back);
    if (day >= from) days.push({ day, steps: back === 0 ? 2_400 : 4_000 + back * 650 });
  }
  return days;
}

/** Three weigh-ins in the last week, each at 07:30 India time. */
export function fakeWeights(to: IstDay): WeightReading[] {
  return [
    { back: 5, grams: 70_400 },
    { back: 2, grams: 70_100 },
    { back: 0, grams: 69_900 },
  ].map(({ back, grams }) => ({ at: new Date(`${addDays(to, -back)}T07:30:00+05:30`).toISOString(), grams }));
}

/** Allowed or not is kept while the app runs, so Connect, then withdrawing, behaves like the real store. */
export function fakeHealthSource(): HealthSource {
  let allowed = false;
  return {
    availability: async () => 'available',
    hasAccess: async () => allowed,
    requestAccess: async () => {
      allowed = true;
      return true;
    },
    readSteps: async (from, to) => fakeSteps(from, to),
    readWeights: async (_from, to) => fakeWeights(to),
    openInstall: () => undefined,
  };
}
