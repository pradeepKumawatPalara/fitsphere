import { EXERCISE_DEFAULT_VIDEO_URL, type Workout } from '@fitsphere/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { saveEntry } from '../local/store';
import { NOW, renderInApp } from '../testing/appHarness';
import { sameSets, withExerciseList } from '../testing/exercises';
import { WorkoutScreen } from './WorkoutScreen';

// An exercise's page (D-82; the redesign's 4.4): opened from a workout exercise's Progress or from Add
// exercise's How to do it, with Progress, History and How to. Today is Wed 28 Oct 2026. Synthetic
// workouts; the test list's Dumbbell bench press and Push-up have how-to details.

const mockParams = { id: '' };
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

const TODAY_ID = '11111111-1111-4111-8111-111111111111';
const LAST_WEEK_ID = '22222222-2222-4222-8222-222222222222';
const TWO_WEEKS_ID = '33333333-3333-4333-8333-333333333333';
const OLD_ID = '44444444-4444-4444-8444-444444444444';

const BENCH_TODAY = { ...sameSets('Dumbbell bench press', 2, 10, 20_000), sets: [{ reps: 10, weightGrams: 20_000, seconds: null }, { reps: 8, weightGrams: 22_500, seconds: null }] };

let openUrl: jest.SpyInstance;

beforeEach(() => {
  mockParams.id = TODAY_ID;
  mockRouter.push.mockClear();
  openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});

afterEach(() => {
  openUrl.mockRestore();
});

/** Today's workout open, with two earlier ones holding the bench press (one under another of its names). */
async function renderWorkout(extra: Workout['exercises'] = []) {
  return renderInApp(<WorkoutScreen now={() => NOW} />, undefined, async (db, server) => {
    await withExerciseList(db, server);
    const save = (id: string, day: string, exercises: Workout['exercises'], n: number) =>
      saveEntry(db, 'workout', {
        changeId: `00000000-0000-4000-8000-00000000000${n}`,
        data: { id, day, exercises, recordedAt: `${day}T02:00:00.000Z`, timer: null },
      });
    await save(TODAY_ID, '2026-10-28', [BENCH_TODAY, sameSets('Push-up', 3, 15, null), ...extra], 1);
    await save(LAST_WEEK_ID, '2026-10-21', [sameSets('Dumbbell bench press', 3, 10, 20_000)], 2);
    await save(TWO_WEEKS_ID, '2026-10-14', [sameSets('dumbbell press', 3, 10, 17_500)], 3);
  });
}

async function openPage(name: string) {
  await fireEvent.press(await screen.findByRole('button', { name: `${name}: progress, history and how to` }));
  await screen.findByRole('header', { name });
}

describe('D-82 an exercise’s page from a workout', () => {
  it('gives each exercise a bar with Progress, Edit and Remove (the owner’s C)', async () => {
    await renderWorkout();
    await screen.findByRole('button', { name: 'Push-up: progress, history and how to' });

    for (const word of ['Progress', 'Edit', 'Remove']) expect(screen.getAllByText(word)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Edit Push-up' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Remove Push-up' })).toBeOnTheScreen();
  });

  it('opens from Progress on the Progress tab, with its records, its workouts in a line and the graph', async () => {
    await renderWorkout();
    await openPage('Dumbbell bench press');

    expect(screen.getByText('Chest · Front delts · Triceps')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Progress' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('Estimated 1RM 28.5 kg, Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getByLabelText('Heaviest 22.5 kg, Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getByLabelText('Best volume 600 kg, Wed 21 Oct')).toBeOnTheScreen();
    expect(screen.getByText('3 workouts · first on Wed 14 Oct · last on Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getByLabelText('Est. 1RM, 3 workouts, 23.5 kg on Wed 14 Oct to 28.5 kg on Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getByText('up 5.0 kg since Wed 14 Oct')).toBeOnTheScreen();
    expect(screen.getByText(/^An estimate from your best set each workout/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: 'Volume' }));

    expect(screen.getByLabelText('Volume, 3 workouts, 525 kg on Wed 14 Oct to 380 kg on Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getByText('down 145 kg since Wed 14 Oct')).toBeOnTheScreen();
    expect(screen.queryByText(/^An estimate from your best set each workout/)).toBeNull();
  });

  it('shows a touched workout’s value in a bubble and its three numbers under the graph (the owner’s C)', async () => {
    await renderWorkout();
    await openPage('Dumbbell bench press');
    const plot = screen.getByTestId('trend-chart-plot');
    await fireEvent(plot, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 280, height: 200 } } });

    // Wed 21 Oct sits in the middle of the three workouts.
    await fireEvent(plot, 'responderGrant', { nativeEvent: { locationX: 140, locationY: 100 } });

    // In the bubble, and as Est. 1RM under the graph.
    expect(screen.getAllByText('26.5 kg')).toHaveLength(2);
    expect(screen.getByText('Wed 21 Oct · this workout')).toBeOnTheScreen();
    expect(screen.getByLabelText('Heaviest 20.0 kg')).toBeOnTheScreen();
    expect(screen.getByLabelText('Volume 600 kg')).toBeOnTheScreen();

    // Sliding to the right picks today's workout; a screen reader steps back to the one before.
    await fireEvent(plot, 'responderMove', { nativeEvent: { locationX: 275, locationY: 100 } });
    expect(screen.getByText('Wed 28 Oct · this workout')).toBeOnTheScreen();
    const chart = screen.getByRole('adjustable');
    await fireEvent(chart, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(chart.props.accessibilityValue).toEqual({ text: 'Wed 21 Oct, 26.5 kg' });

    // Another measure clears it.
    await fireEvent.press(screen.getByRole('tab', { name: 'Volume' }));
    expect(screen.queryByText(/· this workout$/)).toBeNull();
  });

  it('lists each workout on History, the three bests on top and as tags, a card opening its workout, and Load older', async () => {
    const { server } = await renderWorkout();
    await openPage('Dumbbell bench press');
    await fireEvent.press(screen.getByRole('tab', { name: 'History' }));

    // The three bests on top (the owner's C), each scrolling to its workout; each card's tags on its date's line.
    expect(screen.getByRole('button', { name: 'Best 1RM 28.5 kg, Wed 28 Oct' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Heaviest 22.5 kg, Wed 28 Oct' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Best volume 600 kg, Wed 21 Oct' }));
    expect(screen.getByRole('button', { name: 'Wed 28 Oct: Set 1, 10 × 20.0 kg; Set 2, 8 × 22.5 kg, Best 1RM, Heaviest' })).toBeOnTheScreen();
    expect(screen.getByText('1RM')).toBeOnTheScreen();
    expect(screen.getByText('Volume')).toBeOnTheScreen();
    expect(screen.getByText('Volume 600 kg · Est. 1RM 26.5 kg')).toBeOnTheScreen();

    server.state.olderWorkouts = [
      { id: OLD_ID, day: '2026-07-01', exercises: [sameSets('Dumbbell bench press', 3, 10, 15_000)], timer: null, recordedAt: '2026-07-01T02:00:00.000Z', updatedAt: '2026-07-01T02:00:00.000Z' },
    ];
    await fireEvent.press(screen.getByRole('button', { name: 'Load older' }));
    // An older workout is shown, not opened.
    expect(await screen.findByLabelText('Wed 1 Jul: 3 sets, 10 × 15.0 kg')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Wed 1 Jul: 3 sets, 10 × 15.0 kg' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Wed 21 Oct: 3 sets, 10 × 20.0 kg, Best volume' }));

    expect(mockRouter.push).toHaveBeenCalledWith(`/workout/${LAST_WEEK_ID}`);
    expect(screen.queryByRole('header', { name: 'Dumbbell bench press' })).toBeNull();
  });

  it('shows How to: the steps, what to watch for, the muscles, the equipment, the note and the default video', async () => {
    await renderWorkout();
    await openPage('Dumbbell bench press');
    await fireEvent.press(screen.getByRole('tab', { name: 'How to' }));

    expect(screen.getByText('Lie on a flat bench, a dumbbell in each hand.')).toBeOnTheScreen();
    expect(screen.getByText('Arching the back. Bouncing at the bottom.')).toBeOnTheScreen();
    expect(screen.getByText('Front delts')).toBeOnTheScreen();
    expect(screen.getByText('Dumbbell › Chest')).toBeOnTheScreen();
    expect(screen.getByText('General guidance, not personal advice. Stop if anything hurts.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('link', { name: 'Watch the video, opens youtube.com' }));

    expect(openUrl).toHaveBeenCalledWith(EXERCISE_DEFAULT_VIDEO_URL);
  });

  it('opens an exercise’s own video when it has one', async () => {
    await renderWorkout();
    await openPage('Push-up');
    await fireEvent.press(screen.getByRole('tab', { name: 'How to' }));

    await fireEvent.press(screen.getByRole('link', { name: 'Watch the video, opens youtube.com' }));

    expect(openUrl).toHaveBeenCalledWith('https://www.youtube.com/watch?v=pushup');
  });

  it('gives a name of the user’s own its progress, and no how-to or video', async () => {
    await renderWorkout([sameSets('My stretch', 2, 12, null)]);
    await openPage('My stretch');

    expect(screen.getByText('Your own exercise')).toBeOnTheScreen();
    expect(screen.getByLabelText('Most reps 12 reps, Wed 28 Oct')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: 'How to' }));

    expect(screen.getByText("There's no how-to for this exercise yet. Your progress and history are in the other tabs.")).toBeOnTheScreen();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('D-82 How to do it in Add exercise', () => {
  it('opens a picked exercise’s page on How to, and the back arrow returns to the form', async () => {
    await renderWorkout();
    await fireEvent.press(await screen.findByRole('button', { name: 'Add exercise' }));
    await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'plank');
    await fireEvent.press(await screen.findByRole('button', { name: /^Plank, / }));

    await fireEvent.press(screen.getByRole('button', { name: 'How to do Plank' }));

    expect(await screen.findByRole('header', { name: 'Plank' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'How to' }).props.accessibilityState).toEqual({ selected: true });
    // The test list's Plank has no details: no steps, but the default video.
    expect(screen.getByText('No how-to yet')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Watch the video, opens youtube.com' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: 'Progress' }));
    expect(screen.getByText('Log this exercise in a workout to see your progress.')).toBeOnTheScreen();

    // The page's back arrow, not Add exercise's "Back to the workout".
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(screen.queryByRole('header', { name: 'Plank' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save exercise' })).toBeOnTheScreen();
  });
});
