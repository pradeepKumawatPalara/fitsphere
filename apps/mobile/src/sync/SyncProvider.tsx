import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { discardRejected, saveEntry, type ChangeData, type EntryKind } from '../local/store';
import { syncNow, type SyncOutcome } from './syncClient';

/** Calls `onReconnect` when the phone's connection comes back. */
export type NetworkWatcher = { watch(onReconnect: () => void): { remove(): void } };

const expoNetwork: NetworkWatcher = {
  watch(onReconnect) {
    let connected = true;
    const subscription = Network.addNetworkStateListener((state) => {
      const now = state.isConnected === true && state.isInternetReachable !== false;
      if (now && !connected) onReconnect();
      connected = now;
    });
    return { remove: () => subscription.remove() };
  },
};

/** What the user enters for each kind; the time it was saved is added when it is saved. */
export type EntryInput = {
  [K in EntryKind]: K extends 'target' ? Omit<ChangeData[K], 'setAt'> : Omit<ChangeData[K], 'recordedAt'>;
};

type SyncContextValue = {
  /** Changes whenever local data may have changed; screens read again. */
  version: number;
  status: SyncOutcome | 'idle' | 'syncing';
  save<K extends EntryKind>(kind: K, input: EntryInput[K]): Promise<void>;
  saveWeight(day: string, weightGrams: number): Promise<void>;
  discard(changeId: string): Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

/**
 * Writes go to the phone first and the outbox, then sync (ADR-0007). Sync also runs when the app
 * starts, when it comes back to the foreground and when the connection returns.
 */
export function SyncProvider({
  children,
  now = defaultNow,
  newId = Crypto.randomUUID,
  network = expoNetwork,
}: {
  children: ReactNode;
  now?: () => Date;
  newId?: () => string;
  network?: NetworkWatcher;
}) {
  const { deps } = useAuth();
  const { state } = useLocalDatabase();
  const db = state.status === 'ready' ? state.db : null;
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<SyncContextValue['status']>('idle');
  const running = useRef(false);
  const again = useRef(false);

  const run = useCallback(async () => {
    if (!db) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus('syncing');
    try {
      do {
        again.current = false;
        const outcome = await syncNow(db, deps, now).catch((): SyncOutcome => 'failed');
        setStatus(outcome);
        setVersion((value) => value + 1);
      } while (again.current);
    } finally {
      running.current = false;
    }
  }, [db, deps, now]);

  useEffect(() => {
    if (!db) return;
    const start = setTimeout(() => void run(), 0);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void run();
    });
    const reconnect = network.watch(() => void run());
    return () => {
      clearTimeout(start);
      appState.remove();
      reconnect.remove();
    };
  }, [db, run, network]);

  const save = useCallback(
    async <K extends EntryKind>(kind: K, input: EntryInput[K]) => {
      if (!db) throw new Error('The phone database is not open');
      const savedAt = now().toISOString();
      const data = (kind === 'target' ? { ...input, setAt: savedAt } : { ...input, recordedAt: savedAt }) as ChangeData[K];
      await saveEntry(db, kind, { changeId: newId(), data });
      setVersion((value) => value + 1);
      void run();
    },
    [db, newId, now, run],
  );

  const saveWeight = useCallback(
    (day: string, weightGrams: number) => save('weighIn', { day, weightGrams }),
    [save],
  );

  const discard = useCallback(
    async (changeId: string) => {
      if (!db) return;
      await discardRejected(db, changeId);
      setVersion((value) => value + 1);
      void run();
    },
    [db, run],
  );

  return <SyncContext.Provider value={{ version, status, save, saveWeight, discard }}>{children}</SyncContext.Provider>;
}

function defaultNow(): Date {
  return new Date();
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside SyncProvider');
  return value;
}
