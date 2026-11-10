import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TargetProgressCard } from '../components/TargetProgressCard';
import { WorkoutTracker } from '../components/WorkoutTracker';
import { getEntry } from '../local/store';
import { renderInApp } from '../testing/appHarness';
import { LIGHT_COLORS } from '../theme';
import { HomeScreen } from './HomeScreen';
import { TargetsScreen } from './TargetsScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// Own targets (REQ-ROLE-007, D-20), the calories and protein cards (REQ-HOME-003, REQ-HOME-004) and
// the workout tracker (REQ-HOME-007). Nothing is eaten until slice 3 and no workout is logged until
// slice 4, so the screens show 0; the card logic is tested with other amounts directly.

beforeEach(() => {
  mockRouter.replace.mockClear();
  mockRouter.push.mockClear();
});

async function setTarget(label: string, text: string) {
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${label}:`) }));
  await fireEvent.changeText(screen.getByLabelText(new RegExp(`^${label} in `)), text);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
}

describe('REQ-ROLE-007 Your targets', () => {
  it('REQ-ROLE-007 lists the eight targets in two groups, none set at first (D-70)', async () => {
    await renderInApp(<TargetsScreen />);

    expect(await screen.findByRole('header', { name: 'Food' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Activity and body' })).toBeOnTheScreen();
    const labels = ['Daily calories', 'Daily protein', 'Daily carbs', 'Daily fat', 'Daily fibre', 'Daily steps', 'Weekly workouts', 'Target body weight'];
    for (const label of labels) {
      expect(await screen.findByRole('button', { name: `${label}: Not set` })).toBeOnTheScreen();
    }
    // In that order: the food targets first.
    expect(screen.getAllByRole('button', { name: /: Not set$/ }).map((tile) => tile.props.accessibilityLabel)).toEqual(
      labels.map((label) => `${label}: Not set`),
    );
    // The calories and the body weight take their rows.
    expect(screen.getByRole('button', { name: 'Daily calories: Not set' })).toHaveStyle({ flexBasis: '100%' });
    expect(screen.getByRole('button', { name: 'Target body weight: Not set' })).toHaveStyle({ flexBasis: '100%' });
    expect(screen.getByRole('button', { name: 'Daily carbs: Not set' })).toHaveStyle({ flexBasis: '40%' });
  });

  it('each target shows a caramel pencil at its top right, and the tile says it opens the target to edit', async () => {
    await renderInApp(<TargetsScreen />);

    const tile = await screen.findByRole('button', { name: 'Daily calories: Not set' });
    expect(tile).toHaveProp('accessibilityHint', 'Opens it to edit');
    // In the tile's first row, opposite its icon, the name under them (6.2); hidden from screen readers,
    // the tile being the button.
    const pencil = within(tile).getByTestId('edit-calories', { includeHiddenElements: true });
    expect(pencil).toHaveProp('stroke', LIGHT_COLORS.accent);
    expect(pencil.parent!.children).toHaveLength(2);
    expect(within(pencil.parent!).queryByText('Daily calories')).toBeNull();
    expect(within(tile).getByText('Daily calories')).toBeOnTheScreen();
    for (const kind of ['protein', 'carbs', 'fat', 'fibre', 'steps', 'weekly_workouts', 'body_weight']) {
      expect(screen.getByTestId(`edit-${kind}`, { includeHiddenElements: true })).toBeOnTheScreen();
    }
  });

  it('REQ-ROLE-007 sets each target, labelled "Set by you", and syncs it with the user as its setter', async () => {
    const { db, server } = await renderInApp(<TargetsScreen />);

    await setTarget('Daily calories', '2000');
    await setTarget('Daily protein', '120');
    await setTarget('Daily carbs', '250');
    await setTarget('Daily fat', '60');
    await setTarget('Daily fibre', '30');
    await setTarget('Daily steps', '10,000');
    await setTarget('Weekly workouts', '4');
    await setTarget('Target body weight', '68.5');

    for (const name of [
      'Daily calories: 2,000 kcal',
      'Daily protein: 120 g',
      'Daily carbs: 250 g',
      'Daily fat: 60 g',
      'Daily fibre: 30 g',
      'Daily steps: 10,000 steps',
      'Weekly workouts: 4 workouts',
      'Target body weight: 68.5 kg',
    ]) {
      const row = await screen.findByRole('button', { name });
      await waitFor(() => expect(within(row).getByText('Set by you')).toBeOnTheScreen());
    }
    await waitFor(() => expect(server.entries('targets').get('body_weight')).toMatchObject({ value: 68_500 }));
    expect(server.entries('targets').get('fibre')).toMatchObject({ value: 30 });
    expect(await getEntry(db, 'target', 'calories')).toMatchObject({ value: 2_000, syncState: 'synced', setByUserId: expect.any(String) });
  });

  it('REQ-ROLE-007 a new value replaces the old one', async () => {
    await renderInApp(<TargetsScreen />);
    await setTarget('Daily calories', '2000');
    await screen.findByRole('button', { name: 'Daily calories: 2,000 kcal' });

    await setTarget('Daily calories', '1800');

    expect(await screen.findByRole('button', { name: 'Daily calories: 1,800 kcal' })).toBeOnTheScreen();
  });

  it.each([
    ['Daily calories', '499'],
    ['Daily calories', '10001'],
    ['Daily protein', '9'],
    ['Daily carbs', '9'],
    ['Daily carbs', '1001'],
    ['Daily fat', '4'],
    ['Daily fat', '501'],
    ['Daily fibre', '4'],
    ['Daily fibre', '101'],
    ['Daily fibre', '30.5'],
    ['Daily steps', '0'],
    ['Weekly workouts', '15'],
    ['Weekly workouts', '2.5'],
    ['Target body weight', '19.9'],
  ])('D-23 refuses %s "%s" and saves nothing', async (label, text) => {
    const { db } = await renderInApp(<TargetsScreen />);

    await setTarget(label, text);

    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(await db.getFirstAsync('SELECT * FROM targets', [])).toBeNull();
  });
});

describe('REQ-HOME-003 and REQ-HOME-004 calories and protein cards', () => {
  it('REQ-ROLE-007 with no target, shows the amount eaten without a percentage, and "Set a target" opens the targets', async () => {
    await renderInApp(<HomeScreen />);

    // Calories is Home's hero: its number and words are read out as one.
    expect(await screen.findByLabelText('0 kcal eaten')).toBeOnTheScreen();
    expect(screen.getByText('0 g eaten')).toBeOnTheScreen();
    expect(screen.queryByText(/%$/)).toBeNull();

    await fireEvent.press(screen.getAllByRole('button', { name: 'Set a target' })[0]!);
    expect(mockRouter.push).toHaveBeenCalledWith('/targets');
  });

  it('REQ-ROLE-007 with targets set, Home shows each card against its target', async () => {
    const { db } = await renderInApp(<HomeScreen />);
    await db.runAsync(
      `INSERT INTO targets (kind, value, set_at, set_by_user_id, sync_state) VALUES
       ('calories', 2000, '2026-10-28T03:00:00.000Z', null, 'synced'),
       ('protein', 120, '2026-10-28T03:00:00.000Z', null, 'synced'),
       ('weekly_workouts', 4, '2026-10-28T03:00:00.000Z', null, 'synced')`,
      [],
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct' }));

    // A target applies to past days too (Q-014 MVP default, D-23).
    expect(await screen.findByText('0 of 2,000 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('2,000 kcal remaining')).toBeOnTheScreen();
    expect(screen.getByText('120 g remaining')).toBeOnTheScreen();
    expect(screen.getByText('0 of 4 · 4 left')).toBeOnTheScreen();
  });

  it('REQ-HOME-003 target 2000 and 1500 eaten: 75% and 500 kcal remaining', async () => {
    await render(<TargetProgressCard title="Calories" unit="kcal" eaten={1_500} target={2_000} onSetTarget={jest.fn()} />);

    expect(screen.getByText('75%')).toBeOnTheScreen();
    expect(screen.getByText('500 kcal remaining')).toBeOnTheScreen();
    // Plates: 10 here, 8 of them caramel.
    expect(screen.getByTestId('Calories-bar')).toHaveAccessibilityValue({ min: 0, max: 100, now: 75 });
    const plates = screen.getAllByTestId('Calories-plate');
    expect(plates).toHaveLength(10);
    expect(plates.filter((plate) => StyleSheet.flatten(plate.props.style).backgroundColor === LIGHT_COLORS.primary)).toHaveLength(8);
  });

  it('D-35 as the hero, what is left is the big number, with 20 plates', async () => {
    await render(<TargetProgressCard title="Calories" unit="kcal" eaten={1_500} target={2_000} onSetTarget={jest.fn()} hero />);

    expect(screen.getByLabelText('500 kcal remaining')).toBeOnTheScreen();
    expect(screen.getByText('500')).toBeOnTheScreen();
    expect(screen.getByText('1,500 of 2,000 kcal')).toBeOnTheScreen();
    expect(screen.getAllByTestId('Calories-plate')).toHaveLength(20);
  });

  it('Q-022 over the target: the bar is full in the warning colour, with "X kcal over"', async () => {
    await render(<TargetProgressCard title="Calories" unit="kcal" eaten={2_300} target={2_000} onSetTarget={jest.fn()} />);

    expect(screen.getByText('300 kcal over')).toBeOnTheScreen();
    expect(screen.getByTestId('Calories-bar')).toHaveAccessibilityValue({ now: 100 });
    for (const plate of screen.getAllByTestId('Calories-plate')) expect(plate).toHaveStyle({ backgroundColor: LIGHT_COLORS.warning });
  });

  it('REQ-HOME-004 protein over the target reads "X g over"', async () => {
    await render(<TargetProgressCard title="Protein" unit="g" eaten={135} target={120} onSetTarget={jest.fn()} />);

    expect(screen.getByText('15 g over')).toBeOnTheScreen();
  });
});

describe('REQ-HOME-007 workout tracker', () => {
  it('REQ-HOME-007 counts against the weekly target, with Mon–Sun dots', async () => {
    await render(
      <WorkoutTracker
        day="2026-10-28"
        today="2026-10-28"
        dayCounts={{ '2026-10-26': 1 }}
        count={1}
        target={5}
        onSetTarget={jest.fn()}
        onDay={jest.fn()}
      />,
    );

    expect(screen.getByText('1 of 5 · 4 left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monday 26 Oct: 1 workout')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tuesday 27 Oct: no workout')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sunday 1 Nov: future')).toBeOnTheScreen();
  });

  it('D-41 reads "N workouts · target achieved" once the target is met or passed', async () => {
    await render(
      <WorkoutTracker day="2026-10-28" today="2026-10-28" dayCounts={{}} count={7} target={5} onSetTarget={jest.fn()} onDay={jest.fn()} />,
    );
    expect(screen.getByText('7 workouts · target achieved')).toBeOnTheScreen();

    await render(
      <WorkoutTracker day="2026-10-28" today="2026-10-28" dayCounts={{}} count={1} target={1} onSetTarget={jest.fn()} onDay={jest.fn()} />,
    );
    expect(screen.getByText('1 workout · target achieved')).toBeOnTheScreen();
  });

  it('REQ-ROLE-007 with no target, offers to set one', async () => {
    const onSetTarget = jest.fn();
    await render(
      <WorkoutTracker day="2026-10-28" today="2026-10-28" dayCounts={{}} count={0} target={null} onSetTarget={onSetTarget} onDay={jest.fn()} />,
    );

    expect(screen.getByText('0 workouts this week')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Set a weekly workout target' }));
    expect(onSetTarget).toHaveBeenCalled();
  });
});
