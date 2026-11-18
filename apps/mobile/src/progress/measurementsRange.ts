import type { IstDay, MeasurementsPage } from '@fitsphere/shared';
import type { AuthDeps } from '../auth/service';
import { fetchDatedPages, useDatedList, type DatedSource, type DayRange, type RangeStatus } from '../dateRange';
import { listEntries, type LocalMeasurements } from '../local/store';

// Progress › Measurements by dates (D-114, the owner's B on the canvas): the last 90 days come from
// the phone, as before; dates the user picks, a year or From and To, are read from the phone and,
// for the days older than the 90 it holds (ADR-0007 rule 1), from GET /v1/users/{id}/measurements,
// kept in memory only (ADR-0007 rule 6). The choices and the reading are shared with D-116's lists
// (`dateRange.ts`).

/** The user's measurements from `from` to `to`, read online page by page; offline or failed otherwise. */
export async function fetchMeasurements(deps: AuthDeps, from: IstDay, to: IstDay): Promise<LocalMeasurements[] | 'offline' | 'failed'> {
  const items = await fetchDatedPages<MeasurementsPage['items'][number]>(deps, 'measurements', from, to);
  if (typeof items === 'string') return items;
  return items.map(({ updatedAt, ...entry }) => {
    void updatedAt;
    return { ...entry, syncState: 'synced' as const };
  });
}

const MEASUREMENTS: DatedSource<LocalMeasurements> = {
  phone: (db, from, to) => listEntries(db, 'measurements', from, to),
  online: fetchMeasurements,
  key: (entry) => entry.day,
};

/**
 * The measurements of `range`, newest first, read again after each sync and whenever `refresh`
 * changes; the online part is read once per range, and again on `retry`. No range, none.
 */
export function useMeasurementsRange(range: DayRange | null, today: IstDay, refresh: unknown): { status: RangeStatus; entries: LocalMeasurements[]; retry(): void } {
  return useDatedList(range, today, refresh, MEASUREMENTS);
}
