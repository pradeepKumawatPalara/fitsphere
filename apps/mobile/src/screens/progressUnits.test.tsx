import { fireEvent, screen } from '@testing-library/react-native';
import { Button } from 'react-native';
import { applyServerEntries, getEntry, setMeta } from '../local/store';
import type { SqlDb } from '../local/sql';
import { useSettings } from '../settings/SettingsProvider';
import { renderInApp } from '../testing/appHarness';
import { ProgressScreen } from './ProgressScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }));

// Every Progress weight follows the Settings slice's body-weight unit setting; none is fixed to kg
// (REQ-ACC-003, invariant #6, D-30). The setting changes only what is shown: weights stay stored
// in grams. Today is Wednesday 28 October 2026. Synthetic values only.

const AT = '2026-10-20T03:00:00.000Z';

async function weighInsAndTarget(db: SqlDb, weighIns: Record<string, number>) {
  await applyServerEntries(
    db,
    'weighIn',
    Object.entries(weighIns).map(([day, weightGrams]) => ({ day, weightGrams, recordedAt: AT })),
  );
  await applyServerEntries(db, 'target', [{ kind: 'body_weight', value: 75_000, setAt: AT, setByUserId: null }]);
}

/** A button that changes the body-weight unit, as the Settings screen does. */
function BodyWeightUnitSwitch({ value }: { value: 'kg' | 'lb' }) {
  const { saveSetting } = useSettings();
  return <Button title="Change the body-weight unit" onPress={() => void saveSetting('body_weight_unit', value)} />;
}

it('REQ-ACC-003 shows every Progress weight in the body-weight unit setting', async () => {
  await renderInApp(<ProgressScreen />, undefined, async (db) => {
    await applyServerEntries(db, 'setting', [{ name: 'body_weight_unit', value: 'lb', setAt: AT }]);
    await weighInsAndTarget(db, { '2026-09-30': 80_000, '2026-10-28': 78_800 });
  });

  // On the card, and as the lowest value on the chart's scale (1M reaches back to 28 Sep, D-34).
  expect(await screen.findAllByText('173.7 lb')).toHaveLength(2);
  expect(screen.getByText('Down 2.6 lb since Wed 30 Sep')).toBeOnTheScreen();
  expect(screen.getByText('Down 0.7 lb a week')).toBeOnTheScreen();
  expect(screen.getByText('Weight (lb)', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.getByLabelText('Target: weight 165.3 lb, no calories, no protein, no steps')).toBeOnTheScreen();
  expect(screen.getByLabelText('This week: weight 173.7 lb, no calories, no protein, no steps')).toBeOnTheScreen();
  expect(screen.queryByText(/kg/, { includeHiddenElements: true })).toBeNull();
});

it('REQ-ACC-003 changing the body-weight unit while Progress is open converts every weight at once; the stored grams stay', async () => {
  const { db } = await renderInApp(
    <>
      <BodyWeightUnitSwitch value="lb" />
      <ProgressScreen />
    </>,
    undefined,
    async (db) => {
      await setMeta(db, 'account_created_day', '2026-08-01');
      await weighInsAndTarget(db, { '2026-09-30': 80_000, '2026-10-14': 79_000, '2026-10-28': 78_800 });
    },
  );

  // Nothing chosen yet: kg.
  expect(await screen.findByText('Down 1.2 kg since Wed 30 Sep')).toBeOnTheScreen();
  expect(screen.getByText('Down 0.3 kg a week')).toBeOnTheScreen();
  // 1M, the range shown first, reaches back to 28 Sep (D-34).
  expect(screen.getByLabelText('3 weigh-ins, 80.0 kg on Wed 30 Sep to 78.8 kg on Wed 28 Oct')).toBeOnTheScreen();
  expect(screen.getByText('Weight (kg)', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.getByLabelText('Target: weight 75.0 kg, no calories, no protein, no steps')).toBeOnTheScreen();
  expect(screen.getByLabelText('This week: weight 78.8 kg, no calories, no protein, no steps')).toBeOnTheScreen();
  expect(screen.getByLabelText('12 Oct: weight 79.0 kg, no calories, no protein, no steps')).toBeOnTheScreen();
  expect(screen.getByLabelText('28 Sep: weight 80.0 kg, no calories, no protein, no steps')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Change the body-weight unit' }));

  // The card, the chart, the table's heading, Target row and weeks: all in lb at once.
  expect(await screen.findByText('Down 2.6 lb since Wed 30 Sep')).toBeOnTheScreen();
  expect(screen.getByText('Down 0.7 lb a week')).toBeOnTheScreen();
  // On the card, and as the lowest value on the chart's scale.
  expect(screen.getAllByText('173.7 lb')).toHaveLength(2);
  expect(screen.getByLabelText('3 weigh-ins, 176.4 lb on Wed 30 Sep to 173.7 lb on Wed 28 Oct')).toBeOnTheScreen();
  expect(screen.getByText('Weight (lb)', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.getByLabelText('Target: weight 165.3 lb, no calories, no protein, no steps')).toBeOnTheScreen();
  expect(screen.getByLabelText('This week: weight 173.7 lb, no calories, no protein, no steps')).toBeOnTheScreen();
  expect(screen.getByLabelText('12 Oct: weight 174.2 lb, no calories, no protein, no steps')).toBeOnTheScreen();
  expect(screen.getByLabelText('28 Sep: weight 176.4 lb, no calories, no protein, no steps')).toBeOnTheScreen();
  expect(screen.queryByText(/kg/, { includeHiddenElements: true })).toBeNull();

  // Only the display changed (invariant #6).
  expect(await getEntry(db, 'weighIn', '2026-10-28')).toMatchObject({ weightGrams: 78_800 });
  expect(await getEntry(db, 'weighIn', '2026-09-30')).toMatchObject({ weightGrams: 80_000 });
  expect(await getEntry(db, 'target', 'body_weight')).toMatchObject({ value: 75_000 });
});
