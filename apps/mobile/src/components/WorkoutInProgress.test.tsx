import type { WorkoutTimer } from '@fitsphere/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { getMeta, saveEntry, setMeta } from '../local/store';
import type { SqlDb } from '../local/sql';
import { NOW, renderInApp } from '../testing/appHarness';
import { sameSets } from '../testing/exercises';
import { cornerPoint, forgetPillCorner, nearestCorner, runningWorkout, WorkoutInProgress } from './WorkoutInProgress';

// "Workout in progress" (D-83, the owner's B): a pill above the tabs while a workout's timer runs or
// is paused. Today is Wed 28 Oct 2026, 09:00 in India (03:30 UTC).

const SQUAT = sameSets('Squat', 3, 10, 40_000);
const running = (startedAt: string): WorkoutTimer => ({ startedAt, countedSeconds: 0, runningSince: startedAt, doneAt: null });
const paused = (startedAt: string, countedSeconds: number): WorkoutTimer => ({ startedAt, countedSeconds, runningSince: null, doneAt: null });
const done = (startedAt: string): WorkoutTimer => ({ startedAt, countedSeconds: 1800, runningSince: null, doneAt: '2026-10-28T03:00:00.000Z' });

const workout = (id: string, day: string, recordedAt: string, timer: WorkoutTimer | null, exercises = [SQUAT]) => ({ id, day, recordedAt, exercises, timer });

describe('D-83 the workout the pill shows', () => {
  it('shows a running timer before a paused one, the latest started, named by its place in its day', () => {
    const list = [
      workout('a', '2026-10-28', '2026-10-28T01:00:00.000Z', done('2026-10-28T01:00:00.000Z')),
      workout('b', '2026-10-28', '2026-10-28T02:00:00.000Z', paused('2026-10-28T02:00:00.000Z', 600)),
      workout('c', '2026-10-28', '2026-10-28T03:00:00.000Z', running('2026-10-28T03:00:00.000Z')),
    ];
    expect(runningWorkout(list, '2026-10-28')).toMatchObject({ id: 'c', name: 'Workout 3' });
    expect(runningWorkout(list.slice(0, 2), '2026-10-28')).toMatchObject({ id: 'b', name: 'Workout 2' });
    expect(runningWorkout(list.slice(0, 1), '2026-10-28')).toBeNull();
  });

  it('keeps yesterday’s (a timer can run past midnight), not older ones', () => {
    expect(runningWorkout([workout('y', '2026-10-27', '2026-10-27T17:00:00.000Z', running('2026-10-27T17:00:00.000Z'))], '2026-10-28')).toMatchObject({ id: 'y' });
    expect(runningWorkout([workout('o', '2026-10-25', '2026-10-25T10:00:00.000Z', paused('2026-10-25T10:00:00.000Z', 60))], '2026-10-28')).toBeNull();
  });

  it('D-108 shows a workout timed before its first exercise, named as its own screen names it', () => {
    expect(runningWorkout([workout('e', '2026-10-28', '2026-10-28T03:00:00.000Z', running('2026-10-28T03:00:00.000Z'), [])], '2026-10-28')).toMatchObject({
      id: 'e',
      name: 'Workout 1',
    });
    // Numbered among the day's workouts with an exercise, itself included; another empty one is not counted.
    const list = [
      workout('a', '2026-10-28', '2026-10-28T01:00:00.000Z', null),
      workout('x', '2026-10-28', '2026-10-28T01:30:00.000Z', null, []),
      workout('e', '2026-10-28', '2026-10-28T03:00:00.000Z', running('2026-10-28T03:00:00.000Z'), []),
    ];
    expect(runningWorkout(list, '2026-10-28')).toMatchObject({ id: 'e', name: 'Workout 2' });
  });

  it('leaves out the workout asking, but still counts it when numbering the others', () => {
    const list = [
      workout('a', '2026-10-28', '2026-10-28T01:00:00.000Z', running('2026-10-28T01:00:00.000Z')),
      workout('b', '2026-10-28', '2026-10-28T02:00:00.000Z', paused('2026-10-28T02:00:00.000Z', 60)),
    ];
    expect(runningWorkout(list, '2026-10-28', 'a')).toMatchObject({ id: 'b', name: 'Workout 2' });
    expect(runningWorkout(list.slice(0, 1), '2026-10-28', 'a')).toBeNull();
  });
});

async function renderPill(timer: WorkoutTimer | null, before?: (db: SqlDb) => Promise<void>) {
  const onOpen = jest.fn();
  let database: SqlDb | null = null;
  await renderInApp(<WorkoutInProgress top={72} bottom={100} onOpen={onOpen} now={() => NOW} />, undefined, async (db) => {
    database = db;
    await before?.(db);
    await saveEntry(db, 'workout', {
      changeId: '00000000-0000-4000-8000-0000000000d1',
      data: { id: '55555555-5555-4555-8555-555555555555', day: '2026-10-28', exercises: [SQUAT], recordedAt: '2026-10-28T03:00:00.000Z', timer },
    });
  });
  return { onOpen, db: () => database! };
}

beforeEach(() => forgetPillCorner());

describe('D-83 the pill', () => {
  it('shows a running workout’s time counting and opens the workout', async () => {
    const { onOpen } = await renderPill(running('2026-10-28T03:17:26.000Z'));

    const pill = await screen.findByRole('button', { name: 'Workout 1, running, 12 minutes 34 seconds' });
    expect(screen.getByText('12:34')).toBeOnTheScreen();
    await fireEvent.press(pill);

    expect(onOpen).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555');
  });

  it('shows a paused one with its time held', async () => {
    await renderPill(paused('2026-10-28T02:00:00.000Z', 1868));

    expect(await screen.findByRole('button', { name: 'Workout 1, paused, 31 minutes 8 seconds' })).toBeOnTheScreen();
  });

  it('shows nothing once the workout is done, or with no timer', async () => {
    await renderPill(done('2026-10-28T02:00:00.000Z'));
    // Let the phone's workouts be read before looking for the pill.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(screen.queryByRole('button', { name: /^Workout 1, / })).toBeNull();
  });
});

describe('D-105 the pill moved to a corner (the owner’s A, locked 2026-11-16)', () => {
  const AREA = { width: 400, height: 800 };
  const PILL = { width: 180, height: 48 };

  it('settles in the corner of the screen’s quarter it is let go in', () => {
    expect(nearestCorner({ x: 100, y: 100 }, AREA)).toBe('top-left');
    expect(nearestCorner({ x: 300, y: 100 }, AREA)).toBe('top-right');
    expect(nearestCorner({ x: 100, y: 700 }, AREA)).toBe('bottom-left');
    expect(nearestCorner({ x: 300, y: 700 }, AREA)).toBe('bottom-right');
    expect(nearestCorner({ x: 200, y: 400 }, AREA)).toBe('bottom-right');
  });

  it('sits 16 from the sides, below the header and above the tabs', () => {
    const edges = { top: 72, bottom: 100 };
    expect(cornerPoint('top-left', AREA, PILL, edges)).toEqual({ x: 16, y: 72 });
    expect(cornerPoint('top-right', AREA, PILL, edges)).toEqual({ x: 204, y: 72 });
    expect(cornerPoint('bottom-left', AREA, PILL, edges)).toEqual({ x: 16, y: 652 });
    expect(cornerPoint('bottom-right', AREA, PILL, edges)).toEqual({ x: 204, y: 652 });
  });

  it('starts at the bottom right, and offers to move to the other three corners', async () => {
    await renderPill(running('2026-10-28T03:17:26.000Z'));

    const pill = await screen.findByRole('button', { name: /^Workout 1, running/ });
    expect(screen.getByTestId('workout-in-progress')).toHaveStyle({ bottom: 100, right: 16 });
    expect(pill.props.accessibilityActions.map((action: { label: string }) => action.label)).toEqual([
      'Move to the top left',
      'Move to the top right',
      'Move to the bottom left',
    ]);
  });

  it('moves to a corner, keeps it on this phone, and still opens the workout', async () => {
    const { onOpen, db } = await renderPill(running('2026-10-28T03:17:26.000Z'));
    const pill = await screen.findByRole('button', { name: /^Workout 1, running/ });

    await fireEvent(pill, 'accessibilityAction', { nativeEvent: { actionName: 'top-left' } });

    expect(screen.getByTestId('workout-in-progress')).toHaveStyle({ top: 72, left: 16 });
    expect(await getMeta(db(), 'workout_pill_corner')).toBe('top-left');
    await fireEvent.press(screen.getByRole('button', { name: /^Workout 1, running/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens in the corner kept on this phone', async () => {
    await renderPill(running('2026-10-28T03:17:26.000Z'), (db) => setMeta(db, 'workout_pill_corner', 'bottom-left'));

    await screen.findByRole('button', { name: /^Workout 1, running/ });
    expect(await screen.findByTestId('workout-in-progress')).toHaveStyle({ bottom: 100, left: 16 });
  });

  it('dragged and let go in the top left quarter, it settles there and is kept', async () => {
    const { db } = await renderPill(running('2026-10-28T03:17:26.000Z'));
    await screen.findByRole('button', { name: /^Workout 1, running/ });
    const view = screen.getByTestId('workout-in-progress');
    // Laid out: the screen 400 by 800, the pill at the bottom right.
    await act(async () => screen.getByTestId('workout-in-progress-area').props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } }));
    await act(async () => view.props.onLayout({ nativeEvent: { layout: { x: 204, y: 652, width: 180, height: 48 } } }));
    const at = (pageX: number, pageY: number) => ({ nativeEvent: { pageX, pageY, touches: [] }, touchHistory: { touchBank: [] } });

    // The touch system calls these in turn (the test helper fires no touch on a view that leaves taps to its child).
    await act(async () => view.props.onTouchStart(at(300, 670)));
    // A finger that has hardly moved leaves the tap to the pill.
    expect(view.props.onMoveShouldSetResponder(at(303, 668))).toBe(false);
    expect(view.props.onMoveShouldSetResponder(at(290, 660))).toBe(true);
    await act(async () => view.props.onResponderGrant(at(290, 660)));
    await act(async () => screen.getByTestId('workout-in-progress').props.onResponderMove(at(60, 120)));
    await act(async () => screen.getByTestId('workout-in-progress').props.onResponderRelease(at(60, 120)));

    expect(screen.getByTestId('workout-in-progress')).toHaveStyle({ top: 72, left: 16 });
    expect(await getMeta(db(), 'workout_pill_corner')).toBe('top-left');
  });

  it('a tap is the pill’s: only a finger that moves drags it', async () => {
    await renderPill(running('2026-10-28T03:17:26.000Z'));
    await screen.findByRole('button', { name: /^Workout 1, running/ });

    const handlers = screen.getByTestId('workout-in-progress').props;
    expect(handlers.onStartShouldSetResponder({ nativeEvent: { touches: [] }, touchHistory: { touchBank: [], numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: 0 } })).toBe(false);
  });
});
