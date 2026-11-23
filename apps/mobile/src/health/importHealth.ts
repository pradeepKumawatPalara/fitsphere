// What is imported from a health store, and what is left alone (D-121, ADR-0013, plan "The rules for
// what is imported"). Pure of any store: it is given what the adapter read, and the phone's own values.
import {
  addDays,
  istDayOf,
  STEPS_MAX,
  STEPS_MIN,
  WEIGHT_GRAMS_MAX,
  WEIGHT_GRAMS_MIN,
  type IstDay,
} from '@fitsphere/shared';
import type { SqlDb } from '../local/sql';
import { getEntry } from '../local/store';
import type { HealthSource } from './types';

/** The days read each time, today included: late-arriving data from a watch is picked up too. */
export const IMPORT_DAYS = 30;

/** What one read did, by day: added, updated (an earlier import), unchanged, or left alone. */
export type ImportCounts = { added: number; updated: number; unchanged: number; typedKept: number; skipped: number };
export type ImportSummary = { steps: ImportCounts; weights: ImportCounts };

const none = (): ImportCounts => ({ added: 0, updated: 0, unchanged: 0, typedKept: 0, skipped: 0 });

/** The days that hold a value read now, for "Read just now: 12 days of steps, 3 weigh-ins". */
export function daysRead(counts: ImportCounts): number {
  return counts.added + counts.updated + counts.unchanged + counts.typedKept;
}

type Saves = {
  saveSteps(day: IstDay, steps: number): Promise<void>;
  saveWeight(day: IstDay, weightGrams: number): Promise<void>;
};

/**
 * Reads the last IMPORT_DAYS days from the store and saves what is new. A day the user typed is never
 * changed (the API refuses it too); a day with an earlier import is updated, as steps grow through the
 * day; a day with no value gets one. A day over the limits, or in the future, is skipped, not clipped.
 * The same read twice changes nothing.
 */
export async function importFromHealth({
  db,
  source,
  today,
  saves,
}: {
  db: SqlDb;
  source: HealthSource;
  today: IstDay;
  saves: Saves;
}): Promise<ImportSummary> {
  const from = addDays(today, -(IMPORT_DAYS - 1));
  const summary: ImportSummary = { steps: none(), weights: none() };

  for (const { day, steps } of await source.readSteps(from, today)) {
    if (day < from || day > today || !Number.isInteger(steps) || steps < STEPS_MIN || steps > STEPS_MAX) {
      summary.steps.skipped += 1;
      continue;
    }
    const kept = await getEntry(db, 'steps', day);
    const outcome = decide(kept, kept?.steps === steps);
    summary.steps[outcome] += 1;
    if (outcome === 'added' || outcome === 'updated') await saves.saveSteps(day, steps);
  }

  // Several weigh-ins in a day: the latest of the day is kept.
  const latest = new Map<IstDay, { at: string; grams: number }>();
  for (const reading of await source.readWeights(from, today)) {
    const taken = new Date(reading.at);
    if (Number.isNaN(taken.getTime())) {
      summary.weights.skipped += 1;
      continue;
    }
    const day = istDayOf(taken);
    const grams = Math.round(reading.grams);
    if (day < from || day > today || !(grams >= WEIGHT_GRAMS_MIN && grams <= WEIGHT_GRAMS_MAX)) {
      summary.weights.skipped += 1;
      continue;
    }
    const earlier = latest.get(day);
    if (!earlier || earlier.at < reading.at) latest.set(day, { at: reading.at, grams });
  }
  for (const [day, { grams }] of [...latest].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const kept = await getEntry(db, 'weighIn', day);
    const outcome = decide(kept, kept?.weightGrams === grams);
    summary.weights[outcome] += 1;
    if (outcome === 'added' || outcome === 'updated') await saves.saveWeight(day, grams);
  }
  return summary;
}

function decide(kept: { source?: string } | null, same: boolean): 'added' | 'updated' | 'unchanged' | 'typedKept' {
  if (!kept) return 'added';
  if (kept.source !== 'health_connect') return 'typedKept';
  return same ? 'unchanged' : 'updated';
}
