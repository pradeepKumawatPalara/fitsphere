import type { WorkoutExercise } from '@fitsphere/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../auth/AuthProvider';
import { LocalDatabaseProvider } from '../local/LocalDatabaseProvider';
import { getMeta, migrateLocal } from '../local/store';
import { SelectedDayProvider } from '../navigation/SelectedDayProvider';
import { SyncProvider } from '../sync/SyncProvider';
import { deps, fakeAuthClient, fakeSession } from '../testing/fakes';
import { fakeServer } from '../testing/fakeServer';
import { memoryDb } from '../testing/memoryDb';
import { sameSets } from '../testing/exercises';
import { HomeScreen } from './HomeScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// Home's first card turns from Calories into Workout (D-123): a toggle at the left of its header, the
// day's workouts with their calories burned, no burn goal, and the choice kept on the phone.

// Wednesday 28 October 2026, 09:00 IST.
const NOW = new Date('2026-10-28T03:30:00Z');
const clock = () => NOW;
const noNetworkEvents = { watch: () => ({ remove: () => undefined }) };
const burning = (kcal: number, estimated = false): WorkoutExercise => ({ ...sameSets('Squat', 3, 10, 40_000), calories: { kcal, estimated } });

let ids = 0;
function newId() {
  ids += 1;
  return `00000000-0000-4000-a000-${String(ids).padStart(12, '0')}`;
}

beforeEach(() => {
  mockRouter.push.mockClear();
});

type Seed = { day: string; exercises: WorkoutExercise[] };

async function renderHome(seeds: Seed[] = [], saved?: string) {
  const db = memoryDb();
  await migrateLocal(db);
  if (saved) await db.runAsync(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('home_card_view', ?)`, [saved]);
  const server = fakeServer(NOW);
  seeds.forEach((seed) => server.storeWorkoutFromElsewhere(newId(), seed.day, seed.exercises));
  const client = fakeAuthClient(fakeSession({ age_confirmed: true, age_confirmation_text_version: '2026-10-27' }));
  await render(
    <AuthProvider deps={deps(client, server.fetchImpl)}>
      <LocalDatabaseProvider owner="user-1" open={async () => ({ db, cipherVersion: '4.6.1' })}>
        <SyncProvider now={clock} newId={newId} network={noNetworkEvents}>
          <SelectedDayProvider now={clock}>
            <HomeScreen />
          </SelectedDayProvider>
        </SyncProvider>
      </LocalDatabaseProvider>
    </AuthProvider>,
  );
  return { db, server };
}

describe('D-123 Home’s Calories / Workout toggle', () => {
  it('opens on Calories, unchanged, with the toggle at the left of its header', async () => {
    await renderHome();

    expect(await screen.findByText('Calories')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'By meal' })).toBeOnTheScreen();
    expect(screen.getByTestId('nutrient-protein')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Calories eaten', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Workouts', selected: false })).toBeOnTheScreen();
    expect(screen.queryByText('By workout')).toBeNull();
  });

  it('shows the day’s workouts and their calories burned, with no goal', async () => {
    await renderHome([
      { day: '2026-10-28', exercises: [burning(300)] },
      { day: '2026-10-28', exercises: [burning(150), burning(70)] },
    ]);
    await screen.findByText('Calories');
    await waitFor(() => expect(screen.getByTestId('card-view-workout')).toBeOnTheScreen());

    await fireEvent.press(screen.getByRole('radio', { name: 'Workouts' }));

    expect(screen.getByText('Workout')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'By workout' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'By meal' })).toBeNull();
    expect(screen.queryByTestId('nutrient-protein')).toBeNull();
    expect(await screen.findByLabelText('520 kcal burned')).toBeOnTheScreen();
    // The server gave both workouts one start time, so which is "Workout 1" is not asserted here.
    const labels = screen.getAllByLabelText(/^Workout \d: /).map((row) => String(row.props.accessibilityLabel));
    expect(labels).toHaveLength(2);
    expect(labels.some((label) => label.endsWith(': 1 exercise, 300 kcal'))).toBe(true);
    expect(labels.some((label) => label.endsWith(': 2 exercises, 220 kcal'))).toBe(true);
    // The bars: the biggest is full, the other against it.
    const widths = screen.getAllByTestId(/^bar-Workout/).map((bar) => (bar.props.style as { width: string }[]).find((style) => style.width)?.width);
    expect(widths.sort()).toEqual(['100%', '73%']);
    expect(screen.queryByText(/remaining|over|of \d/)).toBeNull();
  });

  it('keeps the choice on the phone, and opens on it next time', async () => {
    const { db } = await renderHome();
    await screen.findByText('Calories');
    await fireEvent.press(screen.getByRole('radio', { name: 'Workouts' }));
    await waitFor(async () => expect(await getMeta(db, 'home_card_view')).toBe('workout'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Calories eaten' }));
    await waitFor(async () => expect(await getMeta(db, 'home_card_view')).toBe('calories'));
  });

  it('opens on Workout when that was kept', async () => {
    await renderHome([], 'workout');

    expect(await screen.findByRole('button', { name: 'By workout' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Workouts', selected: true })).toBeOnTheScreen();
  });

  it('says "No workouts logged" on a day with none, with Log workout on today', async () => {
    await renderHome([], 'workout');

    expect(await screen.findByText('No workouts logged')).toBeOnTheScreen();
    expect(screen.getByLabelText('No calories burned logged')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Log workout' })).toBeOnTheScreen();
  });

  it('shows a workout with no calories as "– kcal" and lists no workout without an exercise', async () => {
    await renderHome(
      [
        { day: '2026-10-28', exercises: [sameSets('Squat', 3, 10, 40_000)] },
        { day: '2026-10-28', exercises: [] },
      ],
      'workout',
    );

    expect(await screen.findByLabelText('Workout 1: 1 exercise, no calories')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/Workout 2/)).toBeNull();
    expect(screen.queryByText('No workouts logged')).toBeNull();
  });

  it('says when part of it is estimated', async () => {
    await renderHome([{ day: '2026-10-28', exercises: [burning(100), burning(40, true)] }], 'workout');

    expect(await screen.findByLabelText('140 kcal burned')).toBeOnTheScreen();
    expect(screen.getByText('Includes estimated calories')).toBeOnTheScreen();
  });

  it('By workout opens Training', async () => {
    await renderHome([], 'workout');

    await fireEvent.press(await screen.findByRole('button', { name: 'By workout' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/training');
  });
});
