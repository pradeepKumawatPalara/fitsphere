import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { istToday } from '@fitsphere/shared';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { insertNewPhoto, type PhotoFiles } from '../local/photos';
import { deleteEntry, discardRejected, PROFILE_KEY, saveEntry, type ChangeData, type DeletableKind, type EntryKind } from '../local/store';
import { uploadPhotos } from './photoSync';
import { refreshExerciseList, refreshFoodList, syncNow, type SyncOutcome } from './syncClient';

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

/**
 * What the user enters for each kind; the time it was saved is added when it is saved, and a
 * target's start day, the IST day it is saved on (D-77). A workout keeps the ID and start time it
 * was given by `startWorkout`.
 */
export type EntryInput = {
  [K in EntryKind]: K extends 'target'
    ? Omit<ChangeData[K], 'setAt' | 'day'>
    : K extends 'setting' | 'profile'
    ? Omit<ChangeData[K], 'setAt'>
    : K extends 'savedMeal' | 'myFood'
      ? Omit<ChangeData[K], 'savedAt'>
      : K extends 'workout'
        ? ChangeData[K]
        : Omit<ChangeData[K], 'recordedAt'>;
};

type SyncContextValue = {
  /** Changes whenever local data may have changed; screens read again. */
  version: number;
  status: SyncOutcome | 'idle' | 'syncing';
  /** `newPhoto`: the files of a photo just taken for this meal or the profile, saved with it (REQ-LOG-006). */
  save<K extends EntryKind>(kind: K, input: EntryInput[K], newPhoto?: { id: string; files: PhotoFiles }): Promise<void>;
  /** Deletes a meal, saved meal (REQ-NUT-004), workout (REQ-TRN-003) or My food (D-39). */
  remove(kind: DeletableKind, id: string): Promise<void>;
  /** A new ID for a meal or saved meal, made on the phone. */
  newId(): string;
  saveWeight(day: string, weightGrams: number): Promise<void>;
  /** Saves a new workout with no exercises on `day` and returns its ID; it counts once it has one (D-41). */
  startWorkout(day: string): Promise<string>;
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
        // The food list, the exercise list and photo uploads follow a sync that reached the server
        // (ADR-0006 rule 1; D-50; REQ-LOG-006).
        if (outcome === 'synced') {
          await refreshFoodList(db, deps).catch(() => 'failed');
          await refreshExerciseList(db, deps).catch(() => 'failed');
          await uploadPhotos(db, deps).catch(() => 'offline');
        }
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
    async <K extends EntryKind>(kind: K, input: EntryInput[K], newPhoto?: { id: string; files: PhotoFiles }) => {
      if (!db) throw new Error('The phone database is not open');
      const savedAt = now().toISOString();
      const stamp =
        kind === 'target' || kind === 'setting' || kind === 'profile' ? 'setAt' : kind === 'savedMeal' || kind === 'myFood' ? 'savedAt' : 'recordedAt';
      // A workout keeps the start time `startWorkout` gave it; a target starts on the day it is set (D-77).
      const day = kind === 'target' ? { day: istToday(new Date(savedAt)) } : {};
      const data = (kind === 'workout' ? input : { ...input, ...day, [stamp]: savedAt }) as unknown as ChangeData[K];
      // The photo belongs to the meal, or to the profile.
      const mealId = kind === 'profile' ? PROFILE_KEY : (input as { id?: string }).id;
      await saveEntry(
        db,
        kind,
        { changeId: newId(), data },
        newPhoto && mealId ? () => insertNewPhoto(db, { id: newPhoto.id, mealId, createdAt: savedAt, files: newPhoto.files }) : undefined,
      );
      setVersion((value) => value + 1);
      void run();
    },
    [db, newId, now, run],
  );

  const remove = useCallback(
    async (kind: DeletableKind, id: string) => {
      if (!db) throw new Error('The phone database is not open');
      await deleteEntry(db, kind, { changeId: newId(), data: { id, deletedAt: now().toISOString() } });
      setVersion((value) => value + 1);
      void run();
    },
    [db, newId, now, run],
  );

  const saveWeight = useCallback(
    (day: string, weightGrams: number) => save('weighIn', { day, weightGrams }),
    [save],
  );

  const startWorkout = useCallback(
    async (day: string) => {
      const id = newId();
      await save('workout', { id, day, exercises: [], recordedAt: now().toISOString(), timer: null });
      return id;
    },
    [newId, now, save],
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

  return (
    <SyncContext.Provider value={{ version, status, save, remove, newId, saveWeight, startWorkout, discard }}>
      {children}
    </SyncContext.Provider>
  );
}

function defaultNow(): Date {
  return new Date();
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside SyncProvider');
  return value;
}
