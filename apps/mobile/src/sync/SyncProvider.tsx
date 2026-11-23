import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { addDays, istToday, MAX_DAYS_RANGE, type IstDay } from '@fitsphere/shared';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { insertNewPhoto, type PhotoFiles } from '../local/photos';
import { deleteEntry, discardRejected, holdDays, PROFILE_KEY, removeImportedValues, replaceDays, saveEntry, type ChangeData, type DeletableKind, type EntryKind } from '../local/store';
import type { SqlDb } from '../local/sql';
import { useScreenInView } from '../navigation/screenInView';
import { fetchDays, olderPart, rangeKey, type OlderDaysStatus } from './olderDays';
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

export type SyncStatus = SyncOutcome | 'idle' | 'syncing';

/**
 * What screens do with the phone's data (`useSync`). The same functions for as long as the database is
 * open, so a screen that only saves never draws again because a sync started or ended.
 */
type SyncContextValue = {
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
  /** Disconnect, then Remove (D-121): the steps and weights read from Health Connect leave this phone and the server. */
  removeImported(): Promise<void>;
  /** Reads the days `from` to `to`, all before the phone's 90, from the server onto the phone (D-106). */
  loadOlder(from: IstDay, to: IstDay): Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);
/** The last sync's outcome, or 'syncing' (`useSyncStatus`): only what shows it draws again. */
const SyncStatusContext = createContext<SyncStatus>('idle');
/** The older days asked for this app session, by `rangeKey`, and how each stands (D-106). */
const OlderDaysContext = createContext<Readonly<Record<string, OlderDaysStatus>>>({});

/**
 * A number that changes whenever the phone's data may have changed: a save, a deletion, a sync, older
 * days read. Screens read their data again when it changes (`useDataVersion`). Kept outside React's
 * state, so a change reaches only the screens in view.
 */
type DataVersion = { get(): number; subscribe(onChange: () => void): () => void; changed(): void };

function dataVersion(): DataVersion {
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => version,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    changed() {
      version += 1;
      for (const listener of [...listeners]) listener();
    },
  };
}

// Without a provider (a part tested on its own), a version that never changes.
const DataVersionContext = createContext<DataVersion>(dataVersion());

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
  const [phoneData] = useState(dataVersion);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const running = useRef(false);
  const again = useRef(false);
  // The older days asked for, for the database open now: a new one (another sign-in) starts afresh.
  const [older, setOlder] = useState<{ db: SqlDb | null; ranges: Record<string, OlderDaysStatus> }>({ db: null, ranges: {} });
  const olderRanges = older.db === db ? older.ranges : NO_RANGES;
  // Older days not read while offline: read once a sync reaches the server.
  const offline = useRef(new Map<string, { db: SqlDb; from: IstDay; to: IstDay }>());
  // The older days being read now: Home, Nutrition and Training ask for the same week at once.
  const reading = useRef(new Set<string>());

  const loadOlder = useCallback(
    async (from: IstDay, to: IstDay) => {
      if (!db) return;
      const key = rangeKey({ from, to });
      if (reading.current.has(key)) return;
      reading.current.add(key);
      const mark = (state: OlderDaysStatus) =>
        setOlder((current) => ({ db, ranges: { ...(current.db === db ? current.ranges : {}), [key]: state } }));
      mark('loading');
      // Held from the start: an entry logged there meanwhile is not pruned by the next sync.
      holdDays(db, from, to);
      try {
        const days = await fetchDays(deps, from, to).catch((): 'failed' => 'failed');
        if (days === 'offline') offline.current.set(key, { db, from, to });
        else offline.current.delete(key);
        if (typeof days === 'string') {
          mark(days);
          return;
        }
        const stored = await replaceDays(db, from, to, days).then(
          () => true,
          () => false,
        );
        mark(stored ? 'loaded' : 'failed');
        if (stored) phoneData.changed();
      } finally {
        reading.current.delete(key);
      }
    },
    [db, deps, phoneData],
  );

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
          for (const range of [...offline.current.values()]) if (range.db === db) void loadOlder(range.from, range.to);
        }
        setStatus(outcome);
        phoneData.changed();
      } while (again.current);
    } finally {
      running.current = false;
    }
  }, [db, deps, now, loadOlder, phoneData]);

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
      phoneData.changed();
      void run();
    },
    [db, newId, now, run, phoneData],
  );

  const remove = useCallback(
    async (kind: DeletableKind, id: string) => {
      if (!db) throw new Error('The phone database is not open');
      await deleteEntry(db, kind, { changeId: newId(), data: { id, deletedAt: now().toISOString() } });
      phoneData.changed();
      void run();
    },
    [db, newId, now, run, phoneData],
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
      phoneData.changed();
      void run();
    },
    [db, run, phoneData],
  );

  const removeImported = useCallback(async () => {
    if (!db) return;
    await removeImportedValues(db, { changeId: newId(), removedAt: now().toISOString() });
    phoneData.changed();
    void run();
  }, [db, newId, now, run, phoneData]);

  const actions = useMemo(
    () => ({ save, remove, newId, saveWeight, startWorkout, discard, removeImported, loadOlder }),
    [save, remove, newId, saveWeight, startWorkout, discard, removeImported, loadOlder],
  );
  return (
    <SyncContext.Provider value={actions}>
      <DataVersionContext.Provider value={phoneData}>
        <SyncStatusContext.Provider value={status}>
          <OlderDaysContext.Provider value={olderRanges}>{children}</OlderDaysContext.Provider>
        </SyncStatusContext.Provider>
      </DataVersionContext.Provider>
    </SyncContext.Provider>
  );
}

function defaultNow(): Date {
  return new Date();
}

const NO_RANGES: Readonly<Record<string, OlderDaysStatus>> = {};

/**
 * The days `from` to `to` a screen shows (D-106): the part before the phone's 90 days is read from
 * the server once this app session, the first screen to show it asking; offline, it is asked again
 * once a sync reaches the server (SyncProvider). `retry` asks again (Try again).
 */
export function useOlderDays(from: IstDay, to: IstDay, today: IstDay): { status: OlderDaysStatus; retry(): void } {
  const { loadOlder } = useSync();
  const older = useContext(OlderDaysContext);
  const range = olderPart(from, to, today);
  const olderFrom = range?.from ?? null;
  const olderTo = range?.to ?? null;
  const state = range ? older[rangeKey(range)] : undefined;

  useEffect(() => {
    if (olderFrom === null || olderTo === null || state !== undefined) return;
    void loadOlder(olderFrom, olderTo);
  }, [olderFrom, olderTo, state, loadOlder]);

  return {
    status: range ? (state ?? 'loading') : 'onPhone',
    retry: () => {
      if (olderFrom !== null && olderTo !== null) void loadOlder(olderFrom, olderTo);
    },
  };
}

/**
 * The older days of `from`–`to` (any length, the part before the phone's 90 days), read in chunks of
 * MAX_DAYS_RANGE and kept as `useOlderDays` keeps them: one status for the whole range, the worst of
 * its chunks (offline, failed), else loading until every chunk is in. No range, or none older: onPhone.
 */
export function useOlderRange(range: { from: IstDay; to: IstDay } | null, today: IstDay): { status: OlderDaysStatus; retry(): void } {
  const { loadOlder } = useSync();
  const older = useContext(OlderDaysContext);
  const from = range?.from ?? null;
  const to = range?.to ?? null;
  const part = from !== null && to !== null ? olderPart(from, to, today) : null;
  const partFrom = part?.from ?? null;
  const partTo = part?.to ?? null;
  const chunks = useMemo(() => {
    if (partFrom === null || partTo === null) return [];
    const list: { from: IstDay; to: IstDay }[] = [];
    for (let start = partFrom; start <= partTo; ) {
      const end = addDays(start, MAX_DAYS_RANGE - 1);
      const last = end > partTo ? partTo : end;
      list.push({ from: start, to: last });
      start = addDays(last, 1);
    }
    return list;
  }, [partFrom, partTo]);
  const states = chunks.map((chunk) => older[rangeKey(chunk)]);

  useEffect(() => {
    chunks.forEach((chunk, index) => {
      if (states[index] === undefined) void loadOlder(chunk.from, chunk.to);
    });
    // `states` is read through `older`, which is a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, older, loadOlder]);

  const status: OlderDaysStatus =
    chunks.length === 0
      ? 'onPhone'
      : states.includes('offline')
      ? 'offline'
      : states.includes('failed')
      ? 'failed'
      : states.every((state) => state === 'loaded')
      ? 'loaded'
      : 'loading';
  return {
    status,
    retry: () => {
      chunks.forEach((chunk, index) => {
        if (states[index] !== 'loaded') void loadOlder(chunk.from, chunk.to);
      });
    },
  };
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside SyncProvider');
  return value;
}

/** The last sync's outcome, or 'syncing' (Settings shows it). */
export function useSyncStatus(): SyncStatus {
  return useContext(SyncStatusContext);
}

const notWatching = () => () => undefined;

/**
 * The phone's data version, for a screen's reads: put it among an effect's dependencies, and the
 * effect reads again whenever the data may have changed. Out of view (`useScreenInView`), the screen
 * keeps the version it last read: it reads nothing after a save or sync, and reads once when it comes
 * back into view, if anything changed meanwhile.
 */
export function useDataVersion(): number {
  const data = useContext(DataVersionContext);
  const inView = useScreenInView();
  const latest = useSyncExternalStore(inView ? data.subscribe : notWatching, data.get);
  // The version this screen last read while in view.
  const [read, setRead] = useState(latest);
  if (inView && read !== latest) setRead(latest);
  return inView ? latest : read;
}
