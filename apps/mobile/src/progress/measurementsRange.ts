import { addDays, EARLIEST_DAY, MAX_LIST_LIMIT, syncWindowStart, type IstDay, type MeasurementsPage } from '@fitsphere/shared';
import { useEffect, useState } from 'react';
import { callApi, type ApiResult } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import type { AuthDeps } from '../auth/service';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listEntries, type LocalMeasurements } from '../local/store';
import { useDataVersion } from '../sync/SyncProvider';
import { callMe } from './account';

// Progress › Measurements by dates (D-114, the owner's B on the canvas): the last 90 days come from
// the phone, as before; dates the user picks, a year or From and To, are read from the phone and,
// for the days older than the 90 it holds (ADR-0007 rule 1), from GET /v1/users/{id}/measurements,
// kept in memory only (ADR-0007 rule 6). An entry on the phone wins over the server's for its day:
// it may be a change waiting to sync, or one just made on an older day.

/** Dates, both included. */
export type DayRange = { from: IstDay; to: IstDay };

/** A year's dates, up to today in this year (D-114's year choices). */
export function yearRange(year: number, today: IstDay): DayRange {
  const from = `${year}-01-01` < EARLIEST_DAY ? EARLIEST_DAY : `${year}-01-01`;
  const to = `${year}-12-31` > today ? today : `${year}-12-31`;
  return { from, to };
}

/** The years to choose from, this year first, back to EARLIEST_DAY's. */
export function rangeYears(today: IstDay): number[] {
  const years: number[] = [];
  for (let year = Number(today.slice(0, 4)); year >= Number(EARLIEST_DAY.slice(0, 4)); year -= 1) years.push(year);
  return years;
}

/** At most this many pages of 500, so a server that keeps sending a cursor cannot loop forever. */
const MAX_PAGES = 20;

/** The user's measurements from `from` to `to`, read online page by page; offline or failed otherwise. */
export async function fetchMeasurements(deps: AuthDeps, from: IstDay, to: IstDay): Promise<LocalMeasurements[] | 'offline' | 'failed'> {
  const call = await callMe(deps);
  if (call.kind !== 'ok') return call.kind;
  const entries: LocalMeasurements[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: string = `from=${from}&to=${to}&limit=${MAX_LIST_LIMIT}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const result: ApiResult<MeasurementsPage> = await callApi<MeasurementsPage>(deps.apiUrl, `/users/${call.me.user.id}/measurements?${query}`, call.options);
    if (result.kind !== 'ok') return result.kind === 'offline' ? 'offline' : 'failed';
    for (const { updatedAt, ...entry } of result.body.items) {
      void updatedAt;
      entries.push({ ...entry, syncState: 'synced' });
    }
    cursor = result.body.nextCursor;
    if (!cursor) return entries;
  }
  return 'failed';
}

export type RangeStatus = 'ready' | 'loading' | 'offline' | 'failed';

/**
 * The measurements of `range`, newest first, read again after each sync and whenever `refresh`
 * changes; the online part is read once per range, and again on `retry`. No range, none.
 */
export function useMeasurementsRange(range: DayRange | null, today: IstDay, refresh: unknown): { status: RangeStatus; entries: LocalMeasurements[]; retry(): void } {
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const version = useDataVersion();
  const from = range?.from ?? null;
  const to = range?.to ?? null;
  // The days before the phone's 90, read online.
  const phoneStart = syncWindowStart(today);
  const onlineTo = from !== null && to !== null && from < phoneStart ? (to < phoneStart ? to : addDays(phoneStart, -1)) : null;
  const [attempt, setAttempt] = useState(0);
  // The read's dates and its attempt: Try again shows Loading until its answer comes.
  const onlineKey = onlineTo !== null ? `${from}|${onlineTo}|${attempt}` : null;

  const [phone, setPhone] = useState<{ key: string; entries: LocalMeasurements[] } | null>(null);
  const [online, setOnline] = useState<{ key: string; result: LocalMeasurements[] | 'offline' | 'failed' } | null>(null);

  useEffect(() => {
    if (from === null || to === null || local.state.status !== 'ready') return;
    let active = true;
    void listEntries(local.state.db, 'measurements', from, to).then((entries) => {
      if (active) setPhone({ key: `${from}|${to}`, entries });
    });
    return () => {
      active = false;
    };
  }, [local.state, from, to, version, refresh]);

  useEffect(() => {
    if (from === null || onlineTo === null || onlineKey === null) return;
    let active = true;
    void fetchMeasurements(deps, from, onlineTo).then((result) => {
      if (active) setOnline({ key: onlineKey, result });
    });
    return () => {
      active = false;
    };
  }, [deps, from, onlineTo, onlineKey]);

  const retry = () => setAttempt((count) => count + 1);
  if (from === null || to === null) return { status: 'ready', entries: [], retry };
  const phoneEntries = phone?.key === `${from}|${to}` ? phone.entries : null;
  const onlineResult = onlineKey === null ? [] : online?.key === onlineKey ? online.result : null;
  if (onlineResult === 'offline' || onlineResult === 'failed') return { status: onlineResult, entries: [], retry };
  if (phoneEntries === null || onlineResult === null) return { status: 'loading', entries: [], retry };

  const byDay = new Map<IstDay, LocalMeasurements>();
  for (const entry of onlineResult) byDay.set(entry.day, entry);
  for (const entry of phoneEntries) byDay.set(entry.day, entry);
  const entries = [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
  return { status: 'ready', entries, retry };
}
