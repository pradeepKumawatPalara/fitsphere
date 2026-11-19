import type { IstDay } from '@fitsphere/shared';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { useDataVersion } from '../sync/SyncProvider';
import { chartPoints, mergeWeighIns, rangeNeedsServer, type ChartRange, type WeighInPoint } from './calculations';
import { fetchOlderWeighIns } from './olderWeighIns';
import { PROGRESS_TEXTS } from './texts';

type OnlineRange = '6M' | 'All';

/**
 * The weight trend's range and its points (REQ-PRG-004): 1W, 1M and 3M come from the phone, 3M cut to
 * its 90 days. Every range plots each weigh-in (the owner, 2026-11-16). 6M and All also need the older
 * weigh-ins, read online once per range and kept in memory only (ADR-0007 rules 1 and 6), whatever the
 * account's age: any past day can hold a weigh-in (D-106). After a change saved or synced, the range
 * shown is read again, its points kept meanwhile, so a weigh-in logged on an older day joins it. Offline
 * they give the named warning, and choosing the range again tries again.
 */
export function useWeightRange(weighIns: readonly WeighInPoint[], today: IstDay) {
  const { deps } = useAuth();
  const [range, setRange] = useState<ChartRange>('1M');
  const version = useDataVersion();
  // Each online range's older weigh-ins, with the phone's data version when they were read.
  const [older, setOlder] = useState<Partial<Record<OnlineRange, { points: WeighInPoint[]; version: number }>>>({});
  const [message, setMessage] = useState<{ text: string; offline: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = useRef<ChartRange>('1M');

  async function choose(next: ChartRange) {
    chosen.current = next;
    setRange(next);
    setMessage(null);
    if (next !== '6M' && next !== 'All') return;
    // Read before: the effect below reads it again if anything has changed since.
    if (older[next] || !rangeNeedsServer(next, today)) return;
    setBusy(true);
    const at = version;
    const result = await fetchOlderWeighIns(deps, next, today);
    setBusy(false);
    if (Array.isArray(result)) setOlder((current) => ({ ...current, [next]: { points: result, version: at } }));
    else if (chosen.current === next) {
      setMessage(
        result === 'offline' ? { text: TEXTS.needsInternet(PROGRESS_TEXTS.chartStep[next]), offline: true } : { text: TEXTS.tryLater, offline: false },
      );
    }
  }

  const read = range === '6M' || range === 'All' ? older[range] : undefined;
  const fromServer = read?.points;
  const waiting = (range === '6M' || range === 'All') && !fromServer && rangeNeedsServer(range, today);
  // A change saved or synced since the range shown was read (a weigh-in on an older day, D-106): read it
  // again, quietly, keeping its points; offline, they stay as read.
  const stale = read !== undefined && read.version !== version;
  useEffect(() => {
    if (!stale || (range !== '6M' && range !== 'All')) return;
    const which: OnlineRange = range;
    const at = version;
    let active = true;
    void fetchOlderWeighIns(deps, which, today).then((result) => {
      if (active && Array.isArray(result)) setOlder((current) => ({ ...current, [which]: { points: result, version: at } }));
    });
    return () => {
      active = false;
    };
  }, [stale, range, version, deps, today]);
  const points = chartPoints(range, fromServer ? mergeWeighIns(weighIns, fromServer) : weighIns, today);
  return { range, choose, points, waiting, message, busy };
}
