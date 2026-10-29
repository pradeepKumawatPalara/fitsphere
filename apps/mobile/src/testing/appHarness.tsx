import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AuthProvider } from '../auth/AuthProvider';
import { LocalDatabaseProvider } from '../local/LocalDatabaseProvider';
import type { SqlDb } from '../local/sql';
import { migrateLocal } from '../local/store';
import { SelectedDayProvider } from '../navigation/SelectedDayProvider';
import { SyncProvider } from '../sync/SyncProvider';
import { deps, fakeAuthClient, fakeSession } from './fakes';
import { fakeServer } from './fakeServer';
import { memoryDb } from './memoryDb';

// Renders a screen inside the app's providers, with an in-memory phone database, the fake API and
// a fixed clock. Test files mock expo-router themselves (jest.mock is per file).

/** Wednesday 28 October 2026, 09:00 IST. The week shown is Mon 26 Oct – Sun 1 Nov. */
export const NOW = new Date('2026-10-28T03:30:00Z');

const noNetworkEvents = { watch: () => ({ remove: () => undefined }) };
let ids = 0;

function newId() {
  ids += 1;
  return `00000000-0000-4000-9000-${String(ids).padStart(12, '0')}`;
}

export async function renderInApp(element: ReactElement, now: () => Date = () => NOW) {
  const db: SqlDb = memoryDb();
  await migrateLocal(db);
  const server = fakeServer(now());
  const client = fakeAuthClient(fakeSession({ age_confirmed: true, age_confirmation_text_version: '2026-10-27' }));
  await render(
    <AuthProvider deps={deps(client, server.fetchImpl)}>
      <LocalDatabaseProvider owner="user-1" open={async () => ({ db, cipherVersion: '4.6.1' })}>
        <SyncProvider now={now} newId={newId} network={noNetworkEvents}>
          <SelectedDayProvider now={now}>{element}</SelectedDayProvider>
        </SyncProvider>
      </LocalDatabaseProvider>
    </AuthProvider>,
  );
  return { db, server };
}
