import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Button } from 'react-native';
import { applyServerEntries, setMeta } from '../local/store';
import type { SqlDb } from '../local/sql';
import { useSync } from '../sync/SyncProvider';
import { renderInApp } from '../testing/appHarness';
import { ProgressScreen } from './ProgressScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// The weight trend chart (REQ-PRG-004; ADR-0007 rules 1 and 6; D-30). Today is Wednesday
// 28 October 2026; the phone holds 31 July to today. Synthetic values only.

const AT = '2026-10-20T03:00:00.000Z';

async function seed(db: SqlDb, entries: Record<string, number>, accountStart = '2026-01-01') {
  await setMeta(db, 'account_created_day', accountStart);
  await applyServerEntries(
    db,
    'weighIn',
    Object.entries(entries).map(([day, weightGrams]) => ({ day, weightGrams, recordedAt: AT })),
  );
}

const PHONE = { '2026-08-10': 81_500, '2026-10-01': 80_000, '2026-10-14': 79_000, '2026-10-25': 79_300, '2026-10-28': 78_800 };

/** The dots the chart draws: its SVG circles in the rendered tree (filled; the icons' rings are not). */
function dotsDrawn(): number {
  type Node = { type: string; props?: object; children: (Node | string)[] | null };
  const count = (node: Node | string | null): number =>
    node === null || typeof node === 'string' ? 0 : (node.type === 'RNSVGCircle' && (node.props as { fill?: unknown } | undefined)?.fill != null ? 1 : 0) + (node.children ?? []).reduce((sum, child) => sum + count(child), 0);
  const tree = screen.toJSON() as Node | Node[] | null;
  return Array.isArray(tree) ? tree.reduce((sum, node) => sum + count(node), 0) : count(tree);
}

/** Saves a weigh-in on the phone, as Home or Profile does: the phone's data changes. */
function SaveWeighIn() {
  const sync = useSync();
  return <Button title="Save a weigh-in" onPress={() => void sync.saveWeight('2026-10-27', 79_000)} />;
}

function range(name: string) {
  return screen.getByRole('button', { name });
}

describe('REQ-PRG-004 weight trend chart', () => {
  it('D-34 shows 1 month first, with every weigh-in in the range', async () => {
    await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));

    expect(await screen.findByLabelText('4 weigh-ins, 80.0 kg on Thu 1 Oct to 78.8 kg on Wed 28 Oct')).toBeOnTheScreen();
    expect(range('1 month')).toBeSelected();
    for (const name of ['1 week', '3 months', '6 months', 'All']) expect(range(name)).not.toBeSelected();
    expect(screen.getByText('80.0 kg')).toBeOnTheScreen();
  });

  it('switches between the ranges the phone holds without asking the server', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));
    await screen.findByLabelText(/^4 weigh-ins/);

    await fireEvent.press(range('1 week'));
    expect(screen.getByLabelText('2 weigh-ins, 79.3 kg on Sun 25 Oct to 78.8 kg on Wed 28 Oct')).toBeOnTheScreen();
    expect(range('1 week')).toBeSelected();
    expect(range('1 month')).not.toBeSelected();

    await fireEvent.press(range('3 months'));
    expect(screen.getByLabelText('5 weigh-ins, 81.5 kg on Mon 10 Aug to 78.8 kg on Wed 28 Oct')).toBeOnTheScreen();
    expect(server.state.weighInQueries).toHaveLength(0);
  });

  it('shows the empty state with fewer than 2 weigh-ins in the range', async () => {
    await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, { '2026-10-28': 78_800 }));

    expect(await screen.findByText('Your trend shows once you have 2 weigh-ins in this range.')).toBeOnTheScreen();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('6M reads the older weigh-ins online and plots each one on its day; the phone’s days come from the phone', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));
    server.state.older = [
      { day: '2026-03-01', weightGrams: 85_000 },
      { day: '2026-05-10', weightGrams: 82_000 },
      { day: '2026-05-12', weightGrams: 81_000 },
    ];
    await screen.findByLabelText(/^4 weigh-ins/);

    await fireEvent.press(range('6 months'));

    // Every weigh-in, as 1M and 3M (the owner, 2026-11-16; they were weekly averages on their Mondays).
    expect(await screen.findByLabelText('7 weigh-ins, 82.0 kg on Sun 10 May to 78.8 kg on Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.queryByText('Weekly averages')).toBeNull();
    // Six calendar months back: from 28 April.
    expect(server.state.weighInQueries).toEqual([{ from: '2026-04-28', to: '2026-07-30', cursor: null }]);

    // Read once: choosing it again uses what was read.
    await fireEvent.press(range('1 month'));
    await fireEvent.press(range('6 months'));
    expect(screen.getByLabelText(/^7 weigh-ins/)).toBeOnTheScreen();
    expect(server.state.weighInQueries).toHaveLength(1);
  });

  it('D-106 All starts at the earliest day, before the account was created, and follows the server’s pages', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE, '2026-02-02'));
    server.state.older = [
      { day: '2026-02-03', weightGrams: 86_000 },
      { day: '2026-06-01', weightGrams: 83_000 },
    ];
    server.state.olderPageSize = 1;
    await screen.findByLabelText(/^4 weigh-ins/);

    await fireEvent.press(range('All'));

    expect(await screen.findByLabelText('7 weigh-ins, 86.0 kg on Tue 3 Feb to 78.8 kg on Wed 28 Oct')).toBeOnTheScreen();
    expect(server.state.weighInQueries).toEqual([
      { from: '2000-01-01', to: '2026-07-30', cursor: null },
      { from: '2000-01-01', to: '2026-07-30', cursor: '1' },
    ]);
  });

  it('offline, 6M and All show the named warning; choosing again online shows the chart', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));
    await screen.findByLabelText(/^4 weigh-ins/);
    server.state.offline = true;

    await fireEvent.press(range('6 months'));
    expect(await screen.findByText('Showing 6 months of weight needs an internet connection.')).toBeOnTheScreen();
    expect(screen.queryByRole('image')).toBeNull();

    await fireEvent.press(range('All'));
    expect(await screen.findByText('Showing all your weight needs an internet connection.')).toBeOnTheScreen();

    server.state.offline = false;
    await fireEvent.press(range('6 months'));
    expect(await screen.findByLabelText(/^5 weigh-ins/)).toBeOnTheScreen();
  });

  it('says to try later when the server fails', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));
    await screen.findByLabelText(/^4 weigh-ins/);
    server.state.failWith = 500;

    await fireEvent.press(range('6 months'));

    expect(await screen.findByText('Something went wrong. Try again later.')).toBeOnTheScreen();
  });

  it('D-106 an account newer than 90 days still reads 6M and All online: a weigh-in logged on an older day shows', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) =>
      seed(db, { '2026-10-14': 79_000, '2026-10-28': 78_800 }, '2026-10-01'),
    );
    // Logged for 20 July, before the account was created on 1 October.
    server.state.older = [{ day: '2026-07-20', weightGrams: 80_500 }];
    await screen.findByLabelText(/^2 weigh-ins/);

    await fireEvent.press(range('6 months'));
    expect(await screen.findByLabelText('3 weigh-ins, 80.5 kg on Mon 20 Jul to 78.8 kg on Wed 28 Oct')).toBeOnTheScreen();

    await fireEvent.press(range('All'));
    expect(await screen.findByLabelText('3 weigh-ins, 80.5 kg on Mon 20 Jul to 78.8 kg on Wed 28 Oct')).toBeOnTheScreen();
    expect(server.state.weighInQueries.map((query) => query.from)).toEqual(['2026-04-28', '2000-01-01']);
  });

  it('D-106 a change saved after 6M was read reads it again, keeping the chart meanwhile, so an older weigh-in joins it', async () => {
    const { server } = await renderInApp(
      <>
        <ProgressScreen />
        <SaveWeighIn />
      </>,
      undefined,
      (db) => seed(db, PHONE, '2026-10-01'),
    );
    await screen.findByLabelText(/^4 weigh-ins/);
    await fireEvent.press(range('6 months'));
    expect(await screen.findByLabelText(/^5 weigh-ins/)).toBeOnTheScreen();

    server.state.older = [{ day: '2026-07-20', weightGrams: 80_500 }];
    await fireEvent.press(screen.getByRole('button', { name: 'Save a weigh-in' }));

    expect(await screen.findByLabelText('7 weigh-ins, 80.5 kg on Mon 20 Jul to 78.8 kg on Wed 28 Oct')).toBeOnTheScreen();
    expect(server.state.weighInQueries.length).toBeGreaterThanOrEqual(2);
  });

  it('with more than 120 points, only the latest dot, and the touched one', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE, '2025-01-01'));
    // A weigh-in every day from 1 February to 30 July on the server: 180, with the phone's 5.
    server.state.older = Array.from({ length: 180 }, (_, index) => ({
      day: new Date(Date.UTC(2026, 1, 1 + index)).toISOString().slice(0, 10),
      weightGrams: 84_000 - index * 10,
    }));
    await screen.findByLabelText(/^4 weigh-ins/);

    await fireEvent.press(range('All'));
    expect(await screen.findByLabelText(/^185 weigh-ins/)).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('weight-chart-plot'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } } });
    expect(dotsDrawn()).toBe(1);

    await act(async () => screen.getByTestId('weight-chart-plot').props.onResponderGrant({ nativeEvent: { locationX: 0 } }));
    expect(dotsDrawn()).toBe(2);
  });

  it('"All weigh-ins" opens the weight history', async () => {
    await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));

    await fireEvent.press(await screen.findByRole('button', { name: 'All weigh-ins' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/weight-history');
  });
});

// The owner, 2026-11-16: with many points the values could not be read. As an exercise's graph (D-82,
// the owner's C): pressing the chart picks the nearest point, ringed, with a bubble of its weight and date.
describe('REQ-PRG-004 touching the weight chart', () => {
  const WIDTH = 300;

  async function laidOut() {
    const plot = await screen.findByTestId('weight-chart-plot');
    await fireEvent(plot, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 200 } } });
    return plot;
  }

  async function touch(x: number, how: 'onResponderGrant' | 'onResponderMove' = 'onResponderGrant') {
    await act(async () => screen.getByTestId('weight-chart-plot').props[how]({ nativeEvent: { locationX: x } }));
  }

  function bubble() {
    return within(screen.getByTestId('weight-chart-bubble'));
  }

  it('a press shows the nearest weigh-in’s weight and date; sliding moves to the next; a tap beside the line hides it', async () => {
    await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));
    await laidOut();
    expect(screen.queryByTestId('weight-chart-bubble')).toBeNull();
    expect(dotsDrawn()).toBe(4);

    await touch(0);
    expect(bubble().getByText('80.0 kg')).toBeOnTheScreen();
    expect(bubble().getByText('Thu 1 Oct')).toBeOnTheScreen();

    await touch(WIDTH, 'onResponderMove');
    expect(bubble().getByText('78.8 kg')).toBeOnTheScreen();
    expect(bubble().getByText('Wed 28 Oct')).toBeOnTheScreen();
    // Kept after the finger lifts, for the screen reader too.
    expect(screen.getByLabelText(/^4 weigh-ins/)).toHaveAccessibilityValue({ text: 'Wed 28 Oct, 78.8 kg' });

    await fireEvent.press(screen.getByLabelText(/^4 weigh-ins/));
    expect(screen.queryByTestId('weight-chart-bubble')).toBeNull();
  });

  it('another range forgets the point; 6M’s points are weigh-ins on their own days', async () => {
    await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE, '2026-07-01'));
    await laidOut();
    await touch(0);
    expect(screen.getByTestId('weight-chart-bubble')).toBeOnTheScreen();

    await fireEvent.press(range('6 months'));
    await laidOut();
    expect(screen.queryByTestId('weight-chart-bubble')).toBeNull();

    await touch(0);
    expect(bubble().getByText('81.5 kg')).toBeOnTheScreen();
    expect(bubble().getByText('Mon 10 Aug')).toBeOnTheScreen();
  });

  it('a screen reader moves from point to point by swiping up or down', async () => {
    await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));
    await laidOut();
    const chart = screen.getByLabelText(/^4 weigh-ins/);
    expect(chart).toHaveAccessibilityValue({ text: 'Swipe up or down to hear each point' });

    await act(async () => chart.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    expect(screen.getByLabelText(/^4 weigh-ins/)).toHaveAccessibilityValue({ text: 'Thu 1 Oct, 80.0 kg' });
    await act(async () => screen.getByLabelText(/^4 weigh-ins/).props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    expect(screen.getByLabelText(/^4 weigh-ins/)).toHaveAccessibilityValue({ text: 'Wed 14 Oct, 79.0 kg' });
  });
});
