// Health Connect on this phone (D-121, ADR-0013, docs/plans/health-connect.md): whether it is connected,
// the read when the app opens or comes back to the foreground (never in the background), and Connect,
// Read now and Disconnect for the Connections screen. What is read goes through `importFromHealth` and the
// same saves as a typed value, so it syncs like one.
import { istToday } from '@fitsphere/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { countImported, getMeta, setMeta } from '../local/store';
import { useSync } from '../sync/SyncProvider';
import { healthSource } from './healthSource';
import { importFromHealth, type ImportSummary } from './importHealth';
import type { HealthAvailability } from './types';

/** Why a read or a connect did not give values: the user said no, or the store failed (never the user's fault). */
export type HealthProblem = 'denied' | 'withdrawn' | 'failed' | null;

export type HealthState = {
  /** `checking` until the store answers. */
  availability: HealthAvailability | 'checking';
  connectedAt: string | null;
  readAt: string | null;
  /** What the last read in this app session did. */
  last: ImportSummary | null;
  reading: boolean;
  problem: HealthProblem;
  /** The days on this phone that came from Health Connect: what Disconnect asks Keep or Remove about. */
  imported: { steps: number; weights: number };
};

type HealthActions = {
  connect(): Promise<void>;
  readNow(): Promise<void>;
  /** Stops reading at once; `remove` deletes the values read, here and on the server. */
  disconnect(remove: boolean): Promise<void>;
  openInstall(): void;
};

const INITIAL: HealthState = {
  availability: 'checking',
  connectedAt: null,
  readAt: null,
  last: null,
  reading: false,
  problem: null,
  imported: { steps: 0, weights: 0 },
};

const StateContext = createContext<HealthState>(INITIAL);
const ActionsContext = createContext<HealthActions | null>(null);

/**
 * The clock when none is given. A function made once: a default written in the parameter list is a new
 * function on every render, and the read below depends on it, so each render started another read (a loop).
 */
const systemNow = (): Date => new Date();

export function HealthSyncProvider({ children, now = systemNow }: { children: ReactNode; now?: () => Date }) {
  const { state: local } = useLocalDatabase();
  const db = local.status === 'ready' ? local.db : null;
  const sync = useSync();
  const [state, setState] = useState<HealthState>(INITIAL);
  const reading = useRef(false);
  const patch = useCallback((next: Partial<HealthState>) => setState((current) => ({ ...current, ...next })), []);

  const refreshImported = useCallback(async () => {
    if (db) patch({ imported: await countImported(db) });
  }, [db, patch]);

  const read = useCallback(async () => {
    if (!db || reading.current) return;
    if ((await getMeta(db, 'health_connect_connected_at')) === null) return;
    reading.current = true;
    patch({ reading: true, problem: null });
    try {
      const source = healthSource();
      // Access withdrawn in Android's settings: shown as Not connected; what was read stays.
      if (!(await source.hasAccess())) {
        await setMeta(db, 'health_connect_connected_at', null);
        patch({ connectedAt: null, problem: 'withdrawn' });
        return;
      }
      const last = await importFromHealth({
        db,
        source,
        today: istToday(now()),
        saves: {
          saveSteps: (day, steps) => sync.save('steps', { day, steps, source: 'health_connect' }),
          saveWeight: (day, weightGrams) => sync.save('weighIn', { day, weightGrams, source: 'health_connect' }),
        },
      });
      const readAt = now().toISOString();
      await setMeta(db, 'health_connect_read_at', readAt);
      patch({ last, readAt });
      await refreshImported();
    } catch {
      // The old values stay; logging by hand is not affected (invariant #4). No detail is kept (invariant #7).
      patch({ problem: 'failed' });
    } finally {
      reading.current = false;
      patch({ reading: false });
    }
  }, [db, now, patch, refreshImported, sync]);

  // The phone's own record of the connection, and the store's answer, once the database is open.
  useEffect(() => {
    if (!db) return;
    let active = true;
    void (async () => {
      const [connectedAt, readAt, availability] = await Promise.all([
        getMeta(db, 'health_connect_connected_at'),
        getMeta(db, 'health_connect_read_at'),
        healthSource().availability().catch((): HealthAvailability => 'not_supported'),
      ]);
      if (!active) return;
      patch({ connectedAt, readAt, availability });
      await refreshImported();
      if (connectedAt) void read();
    })();
    return () => {
      active = false;
    };
  }, [db, patch, read, refreshImported]);

  // Read again each time the app comes back to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void read();
    });
    return () => subscription.remove();
  }, [read]);

  const connect = useCallback(async () => {
    if (!db) return;
    patch({ problem: null });
    const source = healthSource();
    const availability = await source.availability().catch((): HealthAvailability => 'not_supported');
    patch({ availability });
    if (availability !== 'available') return;
    const allowed = await source.requestAccess().catch(() => false);
    if (!allowed) {
      patch({ problem: 'denied' });
      return;
    }
    const connectedAt = now().toISOString();
    await setMeta(db, 'health_connect_connected_at', connectedAt);
    patch({ connectedAt });
    await read();
  }, [db, now, patch, read]);

  const disconnect = useCallback(
    async (remove: boolean) => {
      if (!db) return;
      await setMeta(db, 'health_connect_connected_at', null);
      await setMeta(db, 'health_connect_read_at', null);
      patch({ connectedAt: null, readAt: null, last: null, problem: null });
      if (remove) await sync.removeImported();
      await refreshImported();
    },
    [db, patch, refreshImported, sync],
  );

  const actions = useMemo<HealthActions>(
    () => ({ connect, readNow: read, disconnect, openInstall: () => healthSource().openInstall() }),
    [connect, read, disconnect],
  );
  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useHealth(): HealthState & HealthActions {
  const state = useContext(StateContext);
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error('useHealth must be used inside HealthSyncProvider');
  return { ...state, ...actions };
}
