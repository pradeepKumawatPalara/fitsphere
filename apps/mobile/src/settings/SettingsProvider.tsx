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
import { useSync, type EntryInput } from '../sync/SyncProvider';

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
  const { version, save } = useSync();
  // The settings read from this database; another user's, or none, never apply.
  const [loaded, setLoaded] = useState<{ db: SqlDb; settings: Settings } | null>(null);
  const settings = db && loaded?.db === db ? loaded.settings : DEFAULT_SETTINGS;

  // Read again whenever local data may have changed, e.g. after a sync brought another phone's choice.
  useEffect(() => {
    if (!db) return;
    let active = true;
    void listSettings(db).then((rows) => {
      if (active) setLoaded({ db, settings: toSettings(rows) });
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
      }));
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
