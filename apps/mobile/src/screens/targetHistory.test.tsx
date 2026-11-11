import type { TargetKind } from '@fitsphere/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { applyServerEntries, saveEntry } from '../local/store';
import type { SqlDb } from '../local/sql';
import { renderInApp } from '../testing/appHarness';
import { TargetHistoryScreen } from './TargetHistoryScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// Target history (REQ-ROLE-018, D-77): every change by date, or one target's values with their
// dates. Today is Wednesday 11 November 2026. Synthetic values only.

const NOW = new Date('2026-11-11T04:30:00Z');
const AT = NOW.toISOString();

beforeEach(() => {
  mockRouter.back.mockClear();
});

async function kept(db: SqlDb, list: [TargetKind, string, number][]) {
  await applyServerEntries(
    db,
    'target',
    list.map(([kind, day, value]) => ({ kind, day, value, setAt: AT, setByUserId: null })),
  );
}

/** Set first on Fri 6 Nov; calories and protein changed on Sun 8 Nov; body weight on Mon 9 Nov; calories today. */
async function history(db: SqlDb) {
  await kept(db, [
    ['calories', '2026-11-06', 1_800],
    ['protein', '2026-11-06', 110],
    ['body_weight', '2026-11-06', 72_000],
    ['calories', '2026-11-08', 2_000],
    ['protein', '2026-11-08', 120],
    ['body_weight', '2026-11-09', 70_000],
    ['calories', '2026-11-11', 2_200],
  ]);
}

describe('REQ-ROLE-018 Target history', () => {
  it('All lists each change under its day, newest first, today marked; a first value reads "Set to"', async () => {
    await renderInApp(<TargetHistoryScreen now={() => NOW} />, () => NOW, history);

    expect(await screen.findByRole('radio', { name: 'All' })).toBeChecked();
    expect(screen.getAllByRole('header').map((header) => header.props.children)).toEqual([
      'Wed 11 Nov · today',
      'Mon 9 Nov',
      'Sun 8 Nov',
      'Fri 6 Nov',
    ]);
    expect(screen.getByLabelText('Daily calories: 2,000 to 2,200 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Target body weight: 72.0 to 70.0 kg')).toBeOnTheScreen();
    expect(screen.getByLabelText('Daily protein: 110 to 120 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Daily calories: set to 1,800 kcal')).toBeOnTheScreen();
    expect(screen.getAllByText('Set to')).toHaveLength(3);
  });

  it('one target shows its value now and since when, then each earlier value with its days, then the days before the first, which had none', async () => {
    await renderInApp(<TargetHistoryScreen now={() => NOW} />, () => NOW, history);

    await fireEvent.press(await screen.findByRole('radio', { name: 'Calories' }));

    expect(screen.getByLabelText('Daily calories now: 2,200 kcal. From today, Wed 11 Nov, set by you')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sun 8 Nov – Tue 10 Nov, 3 days: 2,000 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Fri 6 Nov – Sat 7 Nov, 2 days: 1,800 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Before Fri 6 Nov: no target')).toBeOnTheScreen();
    expect(screen.getByText('Each value holds from its day until the next change.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Body weight' }));

    expect(screen.getByLabelText('Target body weight now: 70.0 kg. Since Mon 9 Nov, set by you')).toBeOnTheScreen();
    expect(screen.getByLabelText('Fri 6 Nov – Sun 8 Nov, 3 days: 72.0 kg')).toBeOnTheScreen();
  });

  it('a target never set says so, and offers to set one', async () => {
    await renderInApp(<TargetHistoryScreen now={() => NOW} />, () => NOW, history);

    await fireEvent.press(await screen.findByRole('radio', { name: 'Fibre' }));

    expect(screen.getByLabelText('Daily fibre: not set')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Set a target' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('leaves out a change that was not saved: it never held', async () => {
    await renderInApp(<TargetHistoryScreen now={() => NOW} />, () => NOW, async (db) => {
      await kept(db, [['steps', '2026-11-06', 8_000]]);
      await saveEntry(db, 'target', { changeId: '00000000-0000-4000-c000-000000000001', data: { kind: 'steps', value: 9_000, day: '2026-11-11', setAt: AT } });
      // The server refused it (ADR-0007 rule 2).
      await db.runAsync(`UPDATE outbox SET status = 'rejected', error_code = 'VALIDATION_FAILED'`, []);
      await db.runAsync(`UPDATE targets SET sync_state = 'rejected' WHERE day = '2026-11-11'`, []);
    });

    await fireEvent.press(await screen.findByRole('radio', { name: 'Steps' }));

    expect(screen.getByLabelText('Daily steps now: 8,000 steps. Since Fri 6 Nov, set by you')).toBeOnTheScreen();
  });

  it('with no targets at all, says how the history fills, and offers to set one', async () => {
    await renderInApp(<TargetHistoryScreen now={() => NOW} />, () => NOW);

    expect(await screen.findByRole('header', { name: 'No targets yet' })).toBeOnTheScreen();
    expect(screen.getByText('When you set a target, each change shows here with its date.')).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'All' })).toBeNull();
  });
});
