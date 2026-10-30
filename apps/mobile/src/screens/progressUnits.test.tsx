import { screen } from '@testing-library/react-native';
import { applyServerEntries } from '../local/store';
import { renderInApp } from '../testing/appHarness';
import { ProgressScreen } from './ProgressScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }));
// The Settings slice's body-weight unit, set to lb (REQ-ACC-003).
jest.mock('../progress/units', () => ({ useProgressWeightUnit: () => 'lb' }));

// Every Progress weight follows the body-weight unit; none is fixed to kg (invariant #6, D-P1).

const AT = '2026-10-20T03:00:00.000Z';

it('REQ-ACC-003 shows every Progress weight in the body-weight unit', async () => {
  await renderInApp(<ProgressScreen />, undefined, async (db) => {
    await applyServerEntries(db, 'weighIn', [
      { day: '2026-09-30', weightGrams: 80_000, recordedAt: AT },
      { day: '2026-10-28', weightGrams: 78_800, recordedAt: AT },
    ]);
    await applyServerEntries(db, 'target', [{ kind: 'body_weight', value: 75_000, setAt: AT, setByUserId: null }]);
  });

  expect(await screen.findByText('173.7 lb')).toBeOnTheScreen();
  expect(screen.getByText('Down 2.6 lb since Wed 30 Sep')).toBeOnTheScreen();
  expect(screen.getByText('Down 0.7 lb a week')).toBeOnTheScreen();
  expect(screen.getByText('Weight (lb)', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.getByLabelText('Target: weight 165.3 lb, no calories, no protein, no steps')).toBeOnTheScreen();
  expect(screen.getByLabelText('This week: weight 173.7 lb, no calories, no protein, no steps')).toBeOnTheScreen();
  expect(screen.queryByText(/kg/, { includeHiddenElements: true })).toBeNull();
});
