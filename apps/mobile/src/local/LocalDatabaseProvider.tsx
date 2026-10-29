import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { deleteLocalDatabase, openLocalDatabase, SqlCipherMissingError, type LocalDatabase } from './database';

export type LocalState =
  | { status: 'closed' }
  | { status: 'opening' }
  | ({ status: 'ready' } & LocalDatabase)
  | { status: 'failed'; reason: 'sqlcipherMissing' | 'error' };

type LocalContextValue = { state: LocalState; remove(): Promise<void> };

const LocalContext = createContext<LocalContextValue | null>(null);

/** Opens the signed-in user's encrypted database at start; `owner` is null when signed out. */
export function LocalDatabaseProvider({
  owner,
  open = openLocalDatabase,
  remove = deleteLocalDatabase,
  children,
}: {
  owner: string | null;
  open?: typeof openLocalDatabase;
  remove?: typeof deleteLocalDatabase;
  children: ReactNode;
}) {
  // The result of opening, for the owner it was opened for.
  const [opened, setOpened] = useState<{ owner: string; state: LocalState } | null>(null);
  const state = useMemo<LocalState>(
    () => (!owner ? { status: 'closed' } : opened?.owner === owner ? opened.state : { status: 'opening' }),
    [owner, opened],
  );

  useEffect(() => {
    if (!owner) return;
    let active = true;
    let database: LocalDatabase | null = null;
    open(owner).then(
      (result) => {
        database = result;
        if (active) setOpened({ owner, state: { status: 'ready', ...result } });
        else void result.db.closeAsync().catch(() => undefined);
      },
      (error: unknown) => {
        const reason = error instanceof SqlCipherMissingError ? 'sqlcipherMissing' : 'error';
        if (active) setOpened({ owner, state: { status: 'failed', reason } });
      },
    );
    return () => {
      active = false;
      void database?.db.closeAsync().catch(() => undefined);
    };
  }, [owner, open]);

  const removeDatabase = useCallback(async () => {
    await remove(state.status === 'ready' ? state.db : undefined);
    if (owner) setOpened({ owner, state: { status: 'closed' } });
  }, [remove, state, owner]);

  return <LocalContext.Provider value={{ state, remove: removeDatabase }}>{children}</LocalContext.Provider>;
}

export function useLocalDatabase(): LocalContextValue {
  const value = useContext(LocalContext);
  if (!value) throw new Error('useLocalDatabase must be used inside LocalDatabaseProvider');
  return value;
}
