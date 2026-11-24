import {
  DEFAULT_SETTINGS,
  SETTING_NAMES,
  SETTING_VALUES,
  type BodyWeightUnit,
  type SettingName,
  type Settings,
  type ThemePreference,
} from '@fitsphere/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import type { SqlDb } from '../local/sql';
import { listSettings, type LocalSetting } from '../local/store';
import { sameData } from '../sameData';
import { readDeviceTheme, writeDeviceTheme } from './deviceTheme';
import { type EntryInput, useDataVersion, useSync } from '../sync/SyncProvider';

// The user's settings (REQ-ACC-001…003; MVP default, D-31): kept on the phone and synced like
// targets, so a change applies at once, offline too, and follows the account to another phone.
// Before sign-in, and until the user chooses, the defaults apply: the phone's theme, kg and kg.

type SettingsValue = {
  settings: Settings;
  /** Saves one setting on the phone and queues it for the server. */
  saveSetting<N extends SettingName>(name: N, value: Settings[N]): Promise<void>;
};

// Without a provider (signed out, or a screen tested on its own) the defaults apply.
const SettingsContext = createContext<SettingsValue>({
  settings: DEFAULT_SETTINGS,
  saveSetting: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { state } = useLocalDatabase();
  const db = state.status === 'ready' ? state.db : null;
  const { save } = useSync();
  const version = useDataVersion();
  // The settings read from this database; another user's, or none, never apply. `themeStored` says whether
  // this user has chosen an Appearance yet.
  const [loaded, setLoaded] = useState<{ db: SqlDb; settings: Settings; themeStored: boolean } | null>(null);
  // The last Appearance choice kept on the phone (deviceTheme.ts): it applies when no database is open (after
  // log out, on the sign-in screens) and until this user's own choice is read; null until it is read.
  const [deviceTheme, setDeviceTheme] = useState<ThemePreference | null>(null);
  useEffect(() => {
    let active = true;
    void readDeviceTheme().then((saved) => {
      if (active && saved) setDeviceTheme((current) => current ?? saved);
    });
    return () => {
      active = false;
    };
  }, []);
  const fallbackTheme = deviceTheme ?? DEFAULT_SETTINGS.theme;
  const settings = useMemo<Settings>(() => {
    if (db && loaded?.db === db) return loaded.themeStored ? loaded.settings : { ...loaded.settings, theme: fallbackTheme };
    return { ...DEFAULT_SETTINGS, theme: fallbackTheme };
  }, [db, loaded, fallbackTheme]);

  // Read again whenever local data may have changed, e.g. after a sync brought another phone's choice.
  useEffect(() => {
    if (!db) return;
    let active = true;
    void listSettings(db).then((rows) => {
      if (!active) return;
      const read = toSettings(rows);
      const themeStored = rows.some((row) => row.name === 'theme' && toSettings([row]).theme === row.value);
      // The user's own choice, once known, is the one kept on the phone for the next log out (deviceTheme.ts).
      if (themeStored) {
        setDeviceTheme(read.theme);
        void writeDeviceTheme(read.theme);
      }
      // Unchanged, the settings already shown stay, so nothing that reads them draws again.
      setLoaded((current) =>
        current?.db === db && current.themeStored === themeStored && sameData(current.settings, read) ? current : { db, settings: read, themeStored },
      );
    });
    return () => {
      active = false;
    };
  }, [db, version]);


  const saveSetting = useCallback(
    async <N extends SettingName>(name: N, value: Settings[N]) => {
      if (!db) return;
      // Shown at once; the stored value is read back after the save.
      setLoaded((current) => ({
        db,
        settings: { ...(current?.db === db ? current.settings : DEFAULT_SETTINGS), [name]: value },
        themeStored: name === 'theme' || (current?.db === db && current.themeStored),
      }));
      if (name === 'theme') {
        setDeviceTheme(value as ThemePreference);
        void writeDeviceTheme(value as ThemePreference);
      }
      await save('setting', { name, value } as EntryInput['setting']);
    },
    [db, save],
  );

  const value = useMemo(() => ({ settings, saveSetting }), [settings, saveSetting]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** The stored values over the defaults; a value this version of the app does not know is ignored. */
function toSettings(rows: LocalSetting[]): Settings {
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (SETTING_NAMES.includes(row.name) && (SETTING_VALUES[row.name] as readonly string[]).includes(row.value)) {
      settings[row.name] = row.value;
    }
  }
  return settings as Settings;
}

export function useSettings(): SettingsValue {
  return useContext(SettingsContext);
}

/** The body-weight unit (REQ-ACC-003): weigh-ins, the weight target and progress. */
export function useBodyWeightUnit(): BodyWeightUnit {
  return useSettings().settings.body_weight_unit;
}

/** The lifting-weight unit (REQ-ACC-002): workout weights, on their own unit. */
export function useLiftingWeightUnit(): BodyWeightUnit {
  return useSettings().settings.lifting_weight_unit;
}

export function useThemePreference(): ThemePreference {
  return useSettings().settings.theme;
}