import { fireEvent, screen } from '@testing-library/react-native';
import { applyServerEntries, setMeta } from '../local/store';
import type { SqlDb } from '../local/sql';
import { renderInApp } from '../testing/appHarness';
import { ProgressScreen } from './ProgressScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// The weight trend chart (REQ-PRG-004; ADR-0007 rules 1 and 6; D-P1). Today is Wednesday
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

function range(name: string) {
  return screen.getByRole('button', { name });
}

describe('REQ-PRG-004 weight trend chart', () => {
  it('shows 4 weeks first, with every weigh-in in the range', async () => {
    await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));

    expect(await screen.findByLabelText('4 weigh-ins, 80.0 kg on Thu 1 Oct to 78.8 kg on Wed 28 Oct')).toBeOnTheScreen();
    expect(range('4 weeks')).toBeSelected();
    expect(screen.getByText('80.0 kg')).toBeOnTheScreen();
  });

  it('switches between the ranges the phone holds without asking the server', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));
    await screen.findByLabelText(/^4 weigh-ins/);

    await fireEvent.press(range('1 week'));
    expect(screen.getByLabelText('2 weigh-ins, 79.3 kg on Sun 25 Oct to 78.8 kg on Wed 28 Oct')).toBeOnTheScreen();
    expect(range('1 week')).toBeSelected();
    expect(range('4 weeks')).not.toBeSelected();

    await fireEvent.press(range('12 weeks'));
    expect(screen.getByLabelText('5 weigh-ins, 81.5 kg on Mon 10 Aug to 78.8 kg on Wed 28 Oct')).toBeOnTheScreen();
    expect(server.state.weighInQueries).toHaveLength(0);
  });

  it('shows the empty state with fewer than 2 weigh-ins in the range', async () => {
    await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, { '2026-10-28': 78_800 }));

    expect(await screen.findByText('Your trend shows once you have 2 weigh-ins in this range.')).toBeOnTheScreen();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('26W reads the older weigh-ins online and plots weekly averages; the phone’s days come from the phone', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));
    server.state.older = [
      { day: '2026-03-01', weightGrams: 85_000 },
      { day: '2026-05-10', weightGrams: 82_000 },
      { day: '2026-05-12', weightGrams: 81_000 },
    ];
    await screen.findByLabelText(/^4 weigh-ins/);

    await fireEvent.press(range('26 weeks'));

    expect(await screen.findByLabelText('7 weekly averages, 82.0 kg on Mon 4 May to 78.8 kg on Mon 26 Oct')).toBeOnTheScreen();
    expect(screen.getByText('Weekly averages')).toBeOnTheScreen();
    expect(server.state.weighInQueries).toEqual([{ from: '2026-04-30', to: '2026-07-30', cursor: null }]);

    // Read once: choosing it again uses what was read.
    await fireEvent.press(range('4 weeks'));
    await fireEvent.press(range('26 weeks'));
    expect(screen.getByLabelText(/^7 weekly averages/)).toBeOnTheScreen();
    expect(server.state.weighInQueries).toHaveLength(1);
  });

  it('All starts at the day the account was created and follows the server’s pages', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE, '2026-02-02'));
    server.state.older = [
      { day: '2026-02-03', weightGrams: 86_000 },
      { day: '2026-06-01', weightGrams: 83_000 },
    ];
    server.state.olderPageSize = 1;
    await screen.findByLabelText(/^4 weigh-ins/);

    await fireEvent.press(range('All'));

    expect(await screen.findByLabelText('7 weekly averages, 86.0 kg on Mon 2 Feb to 78.8 kg on Mon 26 Oct')).toBeOnTheScreen();
    expect(server.state.weighInQueries).toEqual([
      { from: '2026-02-02', to: '2026-07-30', cursor: null },
      { from: '2026-02-02', to: '2026-07-30', cursor: '1' },
    ]);
  });

  it('offline, 26W and All show the named warning; choosing again online shows the chart', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));
    await screen.findByLabelText(/^4 weigh-ins/);
    server.state.offline = true;

    await fireEvent.press(range('26 weeks'));
    expect(await screen.findByText('Showing 26 weeks of weight needs an internet connection.')).toBeOnTheScreen();
    expect(screen.queryByRole('image')).toBeNull();

    await fireEvent.press(range('All'));
    expect(await screen.findByText('Showing all your weight needs an internet connection.')).toBeOnTheScreen();

    server.state.offline = false;
    await fireEvent.press(range('26 weeks'));
    expect(await screen.findByLabelText(/^5 weekly averages/)).toBeOnTheScreen();
  });

  it('says to try later when the server fails', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));
    await screen.findByLabelText(/^4 weigh-ins/);
    server.state.failWith = 500;

    await fireEvent.press(range('26 weeks'));

    expect(await screen.findByText('Something went wrong. Try again later.')).toBeOnTheScreen();
  });

  it('an account newer than 90 days has nothing older, so 26W works offline from the phone', async () => {
    const { server } = await renderInApp(<ProgressScreen />, undefined, (db) =>
      seed(db, { '2026-10-14': 79_000, '2026-10-28': 78_800 }, '2026-10-01'),
    );
    await screen.findByLabelText(/^2 weigh-ins/);
    server.state.offline = true;

    await fireEvent.press(range('26 weeks'));

    expect(screen.getByLabelText('2 weekly averages, 79.0 kg on Mon 12 Oct to 78.8 kg on Mon 26 Oct')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('"All weigh-ins" opens the weight history', async () => {
    await renderInApp(<ProgressScreen />, undefined, (db) => seed(db, PHONE));

    await fireEvent.press(await screen.findByRole('button', { name: 'All weigh-ins' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/weight-history');
  });
});
