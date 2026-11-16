// Older days (D-106): any day back to EARLIEST_DAY can be chosen; a day before the phone's 90
// (ADR-0007 rule 1) is read from the server when it is shown, and kept on the phone while the app is
// open (`replaceDays`, `holdDays` in local/store.ts).
import { addDays, daysResponseSchema, EARLIEST_DAY, syncWindowStart, type DaysResponse, type IstDay } from '@fitsphere/shared';
import { callApi, LIST_TIMEOUT_MS } from '../api/client';
import type { AuthDeps } from '../auth/service';
import { callMe } from '../progress/account';

/**
 * How the days a screen shows stand: on the phone (the 90 days), or older ones loading, loaded,
 * not loaded while offline, or not loaded otherwise.
 */
export type OlderDaysStatus = 'onPhone' | 'loading' | 'loaded' | 'offline' | 'failed';

export type DayRange = { from: IstDay; to: IstDay };

/** The part of `from`–`to` before the phone's 90 days and from EARLIEST_DAY on; null when there is none. */
export function olderPart(from: IstDay, to: IstDay, today: IstDay): DayRange | null {
  const lastOlder = addDays(syncWindowStart(today), -1);
  const start = from < EARLIEST_DAY ? EARLIEST_DAY : from;
  const end = to > lastOlder ? lastOlder : to;
  return start <= end ? { from: start, to: end } : null;
}

/** The days of a month, "2025-03", first to last. */
export function monthRange(month: string): DayRange {
  const [year, number] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function rangeKey(range: DayRange): string {
  return `${range.from}..${range.to}`;
}

/**
 * The user's day data from `from` to `to` (at most MAX_DAYS_RANGE days), read online from
 * GET /v1/users/{id}/days; offline or failed otherwise.
 */
export async function fetchDays(auth: AuthDeps, from: IstDay, to: IstDay): Promise<DaysResponse | 'offline' | 'failed'> {
  const call = await callMe(auth);
  if (call.kind !== 'ok') return call.kind;
  const result = await callApi<unknown>(auth.apiUrl, `/users/${call.me.user.id}/days?from=${from}&to=${to}`, {
    ...call.options,
    timeoutMs: LIST_TIMEOUT_MS,
  });
  if (result.kind === 'offline') return 'offline';
  if (result.kind !== 'ok') return 'failed';
  const parsed = daysResponseSchema.safeParse(result.body);
  return parsed.success ? parsed.data : 'failed';
}
