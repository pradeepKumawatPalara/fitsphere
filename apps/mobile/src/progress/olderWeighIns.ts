import {
  addDays,
  EARLIEST_DAY,
  MAX_LIST_LIMIT,
  syncWindowStart,
  type IstDay,
  type WeighInsPage,
} from '@fitsphere/shared';
import { callApi, type ApiResult } from '../api/client';
import type { AuthDeps } from '../auth/service';
import { callMe } from './account';
import { rangeStart, type WeighInPoint } from './calculations';

/** At most this many pages of 500 are read, so a server that keeps sending a cursor cannot loop forever. */
const MAX_PAGES = 20;

/**
 * The weigh-ins older than the 90 days the phone holds, for the 6M and All chart ranges
 * (REQ-PRG-004; ADR-0007 rules 1 and 6): read online from GET /v1/users/{id}/weigh-ins, page by
 * page, and kept in memory only. 6M reaches back six calendar months; All, to EARLIEST_DAY, as any
 * past day can hold a weigh-in, before the account was created too (D-106; it was the account's first
 * day). Offline or failed otherwise.
 */
export async function fetchOlderWeighIns(deps: AuthDeps, range: '6M' | 'All', today: IstDay): Promise<WeighInPoint[] | 'offline' | 'failed'> {
  const call = await callMe(deps);
  if (call.kind !== 'ok') return call.kind;
  const to = addDays(syncWindowStart(today), -1);
  const from = range === '6M' ? rangeStart('6M', today)! : EARLIEST_DAY;

  const points: WeighInPoint[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: string = `from=${from}&to=${to}&limit=${MAX_LIST_LIMIT}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const path = `/users/${call.me.user.id}/weigh-ins?${query}`;
    const result: ApiResult<WeighInsPage> = await callApi<WeighInsPage>(deps.apiUrl, path, call.options);
    if (result.kind !== 'ok') return result.kind === 'offline' ? 'offline' : 'failed';
    points.push(...result.body.items.map(({ day, weightGrams }) => ({ day, weightGrams })));
    cursor = result.body.nextCursor;
    if (!cursor) return points;
  }
  return 'failed';
}
