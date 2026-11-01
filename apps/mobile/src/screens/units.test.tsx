import { toGrams, type SettingName } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Button } from 'react-native';
import { describeRejected } from '../components/RejectedChanges';
import { WeighInList } from '../components/WeighInList';
import { weightRule } from '../format';
import { applyServerEntries, getEntry, saveWeighIn } from '../local/store';
import { useSettings } from '../settings/SettingsProvider';
import { renderInApp } from '../testing/appHarness';
import { exerciseRules } from '../workouts';
import { HomeScreen } from './HomeScreen';
import { TargetsScreen } from './TargetsScreen';
import { TrainingScreen } from './TrainingScreen';
import { WorkoutScreen } from './WorkoutScreen';

// The units (REQ-ACC-002, REQ-ACC-003; Q-024; MVP defaults, D-31): weights are typed and shown in
// the chosen unit and stored in grams (invariant #6), so changing a unit converts what is shown.
// The body-weight and lifting-weight units are independent. The kg cases are in the other tests.

const mockParams = { id: '' };
const mockRouter = {
  push: jest.fn((path: string) => {
    mockParams.id = path.replace('/workout/', '');
  }),
  back: jest.fn(),
  replace: jest.fn(),
};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

const AT = '2026-10-28T02:00:00.000Z';
const TODAY = '2026-10-28';

beforeEach(() => {
  mockParams.id = '';
  mockRouter.push.mockClear();
});

/** Settings already on the phone, as a pull would leave them. */
function withUnits(units: Partial<Record<SettingName, string>>) {
  return async (db: Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[0]) => {
    await applyServerEntries(
      db,
      'setting',
      Object.entries(units).map(([name, value]) => ({ name: name as SettingName, value, setAt: AT })),
    );
  };
}

/** A button that changes a unit, as the Settings screen will. */
function UnitSwitch({ name, value }: { name: 'body_weight_unit' | 'lifting_weight_unit'; value: 'kg' | 'lb' }) {
  const { saveSetting } = useSettings();
  return <Button title={`${name} → ${value}`} onPress={() => void saveSetting(name, value)} />;
}

async function logWeight(unit: string, text: string) {
  await fireEvent.press(await screen.findByRole('button', { name: /^Weight:/ }));
  await fireEvent.changeText(screen.getByLabelText(`Weight in ${unit}`), text);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
}

describe('REQ-ACC-003 body weight in lb', () => {
  it('Q-024 the Home tile shows lb, and 154.3 lb typed is stored in grams and shown back unchanged', async () => {
    const { db, server } = await renderInApp(<HomeScreen />, undefined, withUnits({ body_weight_unit: 'lb' }));

    await logWeight('lb', '154.3');

    expect(await screen.findByRole('button', { name: 'Weight: 154.3 lb' })).toBeOnTheScreen();
    expect(await getEntry(db, 'weighIn', TODAY)).toMatchObject({ weightGrams: toGrams(154.3, 'lb') });
    await waitFor(() => expect(server.weighIns.get(TODAY)?.weightGrams).toBe(69_989));
  });

  it.each(['44.0', '661.4', '154.25'])('D-31 refuses "%s" lb with the rule in lb and saves nothing', async (text) => {
    const { db } = await renderInApp(<HomeScreen />, undefined, withUnits({ body_weight_unit: 'lb' }));

    await logWeight('lb', text);

    expect(await screen.findByText(weightRule('lb'))).toBeOnTheScreen();
    expect(screen.getByText('Enter a weight from 44.1 to 661.3 lb, with at most one decimal.')).toBeOnTheScreen();
    expect(await getEntry(db, 'weighIn', TODAY)).toBeNull();
  });

  it('REQ-ACC-003 switching to kg converts the weight shown, and the setting syncs', async () => {
    const { server } = await renderInApp(
      <>
        <UnitSwitch name="body_weight_unit" value="kg" />
        <HomeScreen />
      </>,
      undefined,
      async (db) => {
        await withUnits({ body_weight_unit: 'lb' })(db);
        await saveWeighIn(db, { changeId: '00000000-0000-4000-8000-000000000001', day: TODAY, weightGrams: 69_989, recordedAt: AT });
      },
    );
    expect(await screen.findByRole('button', { name: 'Weight: 154.3 lb' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'body_weight_unit → kg' }));

    expect(await screen.findByRole('button', { name: 'Weight: 70.0 kg' })).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('settings').get('body_weight_unit')).toMatchObject({ value: 'kg' }));
  });

  it('REQ-ACC-003 the target body weight is typed and shown in lb', async () => {
    const { server } = await renderInApp(<TargetsScreen />, undefined, withUnits({ body_weight_unit: 'lb' }));

    await fireEvent.press(await screen.findByRole('button', { name: /^Target body weight:/ }));
    await fireEvent.changeText(screen.getByLabelText(/^Target body weight in lb/), '150');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: /^Target body weight: 150\.0 lb/ })).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('targets').get('body_weight')).toMatchObject({ value: toGrams(150, 'lb') }));
  });

  it('REQ-PRG-001 the weight history shows lb', async () => {
    await renderInApp(<WeighInList rows={[{ day: TODAY, weightGrams: 69_989 }]} />, undefined, withUnits({ body_weight_unit: 'lb' }));

    expect(await screen.findByText('154.3 lb')).toBeOnTheScreen();
  });
});

describe('REQ-ACC-002 lifting weight in lb, independent of the body-weight unit', () => {
  async function startWorkout() {
    const app = await renderInApp(
      <>
        <UnitSwitch name="lifting_weight_unit" value="kg" />
        <WeighInList rows={[{ day: TODAY, weightGrams: 70_000 }]} />
        <TrainingScreen />
        <WorkoutScreen />
      </>,
      undefined,
      withUnits({ lifting_weight_unit: 'lb' }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Start an empty workout' }));
    await screen.findByText(/^Workout · /);
    return app;
  }

  async function addExercise(weight: string) {
    await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
    await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'Squat');
    await fireEvent.changeText(screen.getByLabelText('Sets'), '3');
    await fireEvent.changeText(screen.getByLabelText('Reps'), '10');
    await fireEvent.changeText(screen.getByLabelText('Weight in lb (optional)'), weight);
    await fireEvent.press(screen.getByRole('button', { name: 'Save exercise' }));
  }

  it('REQ-TRN-005 a weight typed in lb is stored in grams; switching to kg converts it; body weight stays in kg', async () => {
    const { db } = await startWorkout();
    await addExercise('88.2');

    expect(await screen.findByRole('button', { name: 'Squat: 3 × 10 × 88.2 lb' })).toBeOnTheScreen();
    expect(screen.getByText('70.0 kg')).toBeOnTheScreen();
    expect((await getEntry(db, 'workout', mockParams.id))?.exercises[0]?.weightGrams).toBe(toGrams(88.2, 'lb'));

    await fireEvent.press(screen.getByRole('button', { name: 'lifting_weight_unit → kg' }));

    expect(await screen.findByRole('button', { name: 'Squat: 3 × 10 × 40.0 kg' })).toBeOnTheScreen();
    expect(screen.getByText('70.0 kg')).toBeOnTheScreen();
  });

  it.each(['0.2', '1102.4'])('D-31 refuses "%s" lb with the rule in lb', async (text) => {
    await startWorkout();
    await addExercise(text);

    expect(await screen.findByText(exerciseRules('lb').weight)).toBeOnTheScreen();
    expect(screen.getByText('Enter a weight from 0.3 to 1102.3 lb, with at most one decimal, or leave it empty.')).toBeOnTheScreen();
  });
});

describe('ADR-0007 rule 2 a rejected setting', () => {
  it('D-31 says which setting was not saved', () => {
    const entry = {
      changeId: '00000000-0000-4000-8000-000000000009',
      type: 'setting.set',
      data: { name: 'lifting_weight_unit', value: 'lb', setAt: AT },
      createdAt: AT,
      attempts: 1,
      status: 'rejected' as const,
      errorCode: 'VALIDATION_FAILED',
    };
    expect(describeRejected(entry, 'kg')).toEqual({ what: 'Lifting weight unit', notSaved: "This setting wasn't saved" });
  });
});
