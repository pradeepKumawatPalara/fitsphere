import { syncWindowStart, type IstDay, type LengthUnit, type TargetKind } from '@fitsphere/shared';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { dailyNutrition, getMeta, listEntries, listTargets, type LocalMeasurements } from '../local/store';
import { useSync } from '../sync/SyncProvider';
import { accountStartDay } from './account';
import type { DayNutrition, WeighInPoint } from './calculations';

export type ProgressData = {
  /** The phone's weigh-ins of the last 90 IST days, newest first. */
  weighIns: WeighInPoint[];
  /** Each day's kcal and protein, for days with at least one meal. */
  nutrition: Record<IstDay, DayNutrition>;
  steps: { day: IstDay; steps: number }[];
  /** Newest first. */
  measurements: LocalMeasurements[];
  /** One current value per target, applying to every day shown (Q-014, E-11). */
  targets: Partial<Record<TargetKind, number>>;
  /** The cm/in choice last made on this phone (D-23). */
  lengthUnit: LengthUnit;
};

/**
 * What Progress shows from the phone (ADR-0007 rule 1): the last 90 IST days, read again after
 * each sync and whenever `refresh` changes. Every entry counts, including those waiting to sync.
 */
export function useProgressData(today: IstDay, refresh: unknown): ProgressData | null {
  const local = useLocalDatabase();
  const { version } = useSync();
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    const from = syncWindowStart(today);
    let active = true;
    void Promise.all([
      listEntries(db, 'weighIn', from, today),
      dailyNutrition(db, from, today),
      listEntries(db, 'steps', from, today),
      listEntries(db, 'measurements', from, today),
      listTargets(db),
      getMeta(db, 'measurement_unit'),
    ]).then(([weighIns, nutrition, steps, measurements, targets, unit]) => {
      if (!active) return;
      setData({
        weighIns: weighIns.map(({ day, weightGrams }) => ({ day, weightGrams })),
        nutrition,
        steps: steps.map(({ day, steps: count }) => ({ day, steps: count })),
        measurements,
        targets: Object.fromEntries(targets.map((target) => [target.kind, target.value])),
        lengthUnit: unit === 'in' ? 'in' : 'cm',
      });
    });
    return () => {
      active = false;
    };
  }, [local.state, today, version, refresh]);

  return data;
}

/** The IST day the account was created (Q-044), or null until it can be read online. */
export function useAccountStart(): IstDay | null {
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const { version } = useSync();
  const [day, setDay] = useState<IstDay | null>(null);

  useEffect(() => {
    if (local.state.status !== 'ready' || day !== null) return;
    let active = true;
    void accountStartDay(local.state.db, deps).then((start) => {
      if (active && start) setDay(start);
    });
    return () => {
      active = false;
    };
  }, [local.state, deps, version, day]);

  return day;
}
