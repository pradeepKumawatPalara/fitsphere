import { addDays, EARLIEST_DAY, MAX_LIST_LIMIT, syncWindowStart, type IstDay } from '@fitsphere/shared';
import { useEffect, useState } from 'react';
import { callApi, type ApiResult } from './api/client';
import { useAuth } from './auth/AuthProvider';
import type { AuthDeps } from './auth/service';
import { useLocalDatabase } from './local/LocalDatabaseProvider';
import type { SqlDb } from './local/sql';
import { holdsServerDay } from './local/store';
import { callMe } from './progress/account';
import { useDataVersion } from './sync/SyncProvider';

// Lists by dates (D-114 for Progress's measurements; D-116 for Training's All workouts, Weight history
// and an exercise's History): the last 90 days come from the phone (ADR-0007 rule 1); a year or dates
// the user picks are read from the phone and, for the days older than the 90 it holds, from the
// server, kept in memory only (rule 6). An entry on the phone wins over the server's: it may be a
// change waiting to sync, or one made on an older day opened meanwhile (D-106).

/** Dates, both included. */
export type DayRange = { from: IstDay; to: IstDay };

/** The dates a list shows: the last 90 days (the phone's), a year, or dates picked. */
export type DateChoice = { kind: 'last90' } | { kind: 'year'; year: number } | { kind: 'picked'; range: DayRange };

export const LAST_90_DAYS: DateChoice = { kind: 'last90' };

/** A year's dates, up to today in this year. */
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

/** The dates a choice reads beyond the phone's list; null for the last 90 days. */
export function choiceRange(choice: DateChoice, today: IstDay): DayRange | null {
  return choice.kind === 'year' ? yearRange(choice.year, today) : choice.kind === 'picked' ? choice.range : null;
}

/** The dates a choice shows: the last 90 days are the phone's, today included. */
export function shownRange(choice: DateChoice, today: IstDay): DayRange {
  return choiceRange(choice, today) ?? { from: syncWindowStart(today), to: today };
}

/** At most this many pages of 500, so a server that keeps sending a cursor cannot loop forever. */
const MAX_PAGES = 20;

/**
 * Every item of GET /v1/users/{id}/{list} from `from` to `to`, read page by page, as the server sends
 * them (oldest first); offline or failed otherwise.
 */
export async function fetchDatedPages<T>(
  deps: AuthDeps,
  list: 'workouts' | 'weigh-ins' | 'measurements',
  from: IstDay,
  to: IstDay,
): Promise<T[] | 'offline' | 'failed'> {
  const call = await callMe(deps);
  if (call.kind !== 'ok') return call.kind;
  const items: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: string = `from=${from}&to=${to}&limit=${MAX_LIST_LIMIT}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const result: ApiResult<{ items: T[]; nextCursor: string | null }> = await callApi<{ items: T[]; nextCursor: string | null }>(
      deps.apiUrl,
      `/users/${call.me.user.id}/${list}?${query}`,
      call.options,
    );
    if (result.kind !== 'ok') return result.kind === 'offline' ? 'offline' : 'failed';
    items.push(...result.body.items);
    cursor = result.body.nextCursor;
    if (!cursor) return items;
  }
  return 'failed';
}

/** Where a list's entries come from: the phone, the server, and what makes two the same entry. */
export type DatedSource<T extends { day: IstDay }> = {
  phone(db: SqlDb, from: IstDay, to: IstDay): Promise<T[]>;
  online(deps: AuthDeps, from: IstDay, to: IstDay): Promise<T[] | 'offline' | 'failed'>;
  key(entry: T): string;
};

export type RangeStatus = 'ready' | 'loading' | 'offline' | 'failed';

/**
 * The entries of `range`, newest day first, read again after each sync and whenever `refresh`
 * changes; the online part (the days before the phone's 90) is read once per range, and again on
 * `retry`. No range, none. `source` must not change between renders (a constant).
 */
export function useDatedList<T extends { day: IstDay }>(
  range: DayRange | null,
  today: IstDay,
  refresh: unknown,
  source: DatedSource<T>,
): { status: RangeStatus; entries: T[]; retry(): void } {
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

  const [phone, setPhone] = useState<{ key: string; entries: T[] } | null>(null);
  const [online, setOnline] = useState<{ key: string; result: T[] | 'offline' | 'failed' } | null>(null);

  useEffect(() => {
    if (from === null || to === null || local.state.status !== 'ready') return;
    let active = true;
    void source.phone(local.state.db, from, to).then((entries) => {
      if (active) setPhone({ key: `${from}|${to}`, entries });
    });
    return () => {
      active = false;
    };
  }, [local.state, from, to, version, refresh, source]);

  useEffect(() => {
    if (from === null || onlineTo === null || onlineKey === null) return;
    let active = true;
    void source.online(deps, from, onlineTo).then((result) => {
      if (active) setOnline({ key: onlineKey, result });
    });
    return () => {
      active = false;
    };
  }, [deps, from, onlineTo, onlineKey, source]);

  const retry = () => setAttempt((count) => count + 1);
  if (from === null || to === null) return { status: 'ready', entries: [], retry };
  const phoneEntries = phone?.key === `${from}|${to}` ? phone.entries : null;
  const onlineResult = onlineKey === null ? [] : online?.key === onlineKey ? online.result : null;
  if (onlineResult === 'offline' || onlineResult === 'failed') return { status: onlineResult, entries: [], retry };
  if (phoneEntries === null || onlineResult === null) return { status: 'loading', entries: [], retry };

  const db = local.state.status === 'ready' ? local.state.db : null;
  const byKey = new Map<string, T>();
  for (const entry of onlineResult) if (!db || !holdsServerDay(db, entry.day)) byKey.set(source.key(entry), entry);
  for (const entry of phoneEntries) byKey.set(source.key(entry), entry);
  const entries = [...byKey.values()].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  return { status: 'ready', entries, retry };
}
