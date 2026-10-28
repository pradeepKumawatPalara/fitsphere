import { fireEvent, render, screen } from '@testing-library/react-native';
import { AuthProvider } from '../auth/AuthProvider';
import { LocalDatabaseProvider } from '../local/LocalDatabaseProvider';
import { migrateLocal, saveWeighIn } from '../local/store';
import { deps, fakeApi, fakeAuthClient, fakeSession } from '../testing/fakes';
import { memoryDb } from '../testing/memoryDb';
import { LogOut } from './LogOut';

const mockRouter = { replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

async function renderLogOut(pendingEntries: number) {
  const db = memoryDb();
  await migrateLocal(db);
  for (let index = 0; index < pendingEntries; index += 1) {
    await saveWeighIn(db, {
      changeId: `00000000-0000-4000-8000-00000000000${index}`,
      day: `2026-10-2${index}`,
      weightGrams: 70_000,
      recordedAt: '2026-10-28T03:00:00.000Z',
    });
  }
  const client = fakeAuthClient(fakeSession());
  const remove = jest.fn(async () => undefined);
  await render(
    <AuthProvider deps={deps(client, fakeApi({}).fetchImpl)}>
      <LocalDatabaseProvider owner="user-1" open={async () => ({ db, cipherVersion: '4.6.1' })} remove={remove}>
        <LogOut />
      </LocalDatabaseProvider>
    </AuthProvider>,
  );
  return { client, remove };
}

beforeEach(() => {
  mockRouter.replace.mockClear();
});

describe('REQ-ACC-008 Log out', () => {
  it('REQ-ACC-008 with nothing waiting, deletes the phone database and signs out', async () => {
    const { client, remove } = await renderLogOut(0);

    await fireEvent.press(await screen.findByRole('button', { name: 'Log out' }));

    expect(remove).toHaveBeenCalled();
    expect(client.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('REQ-ACC-008 with entries waiting, warns first; "Stay signed in" keeps everything', async () => {
    const { client, remove } = await renderLogOut(2);

    await fireEvent.press(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByText(/2 entries are not on the server yet/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Stay signed in' }));

    expect(remove).not.toHaveBeenCalled();
    expect(client.signOut).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeOnTheScreen();
  });

  it('REQ-ACC-008 deletes the waiting entries only when the user confirms', async () => {
    const { client, remove } = await renderLogOut(1);

    await fireEvent.press(await screen.findByRole('button', { name: 'Log out' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Log out and delete them' }));

    expect(remove).toHaveBeenCalled();
    expect(client.signOut).toHaveBeenCalled();
  });
});
