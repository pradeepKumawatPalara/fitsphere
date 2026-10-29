import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { applyServerEntries } from '../local/store';
import { renderInApp } from '../testing/appHarness';
import { HomeScreen } from './HomeScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// The measurements card (REQ-HOME-008) and sheet (REQ-MEAS-001…006). Today is Wednesday 28 October
// 2026; its week is Mon 26 Oct – Sun 1 Nov.

const NO_OPTIONAL = { chestMm: null, hipsMm: null, armMm: null, thighMm: null, notes: null };

async function openSheet() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Add measurements' }));
}

async function type(label: string, text: string) {
  await fireEvent.changeText(screen.getByLabelText(label), text);
}

function save() {
  return screen.getByRole('button', { name: 'Save measurements' });
}

describe('REQ-HOME-008 measurements card', () => {
  it('REQ-HOME-008 shows until the selected week has an entry, and opens the sheet on the selected date', async () => {
    await renderInApp(<HomeScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Tuesday 27 Oct' }));

    await openSheet();

    expect(screen.getByLabelText('Date: Tue 27 Oct')).toBeOnTheScreen();
  });

  it('Q-026 is hidden once the week has an entry, and shows again for a week without one', async () => {
    const { server } = await renderInApp(<HomeScreen />);
    await openSheet();
    await type('Upper waist (cm)', '81.2');
    await type('Lower waist (cm)', '84.5');

    await fireEvent.press(save());

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Add measurements' })).toBeNull());
    await waitFor(() =>
      expect(server.entries('measurements').get('2026-10-28')).toMatchObject({ upperWaistMm: 812, lowerWaistMm: 845, ...NO_OPTIONAL }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Previous week' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Monday 19 Oct' }));
    expect(await screen.findByRole('button', { name: 'Add measurements' })).toBeOnTheScreen();
  });
});

describe('REQ-MEAS-001…006 measurements sheet', () => {
  it('REQ-MEAS-004 shows both waist fields with their guidance', async () => {
    await renderInApp(<HomeScreen />);
    await openSheet();

    expect(screen.getByText('2 fingers above the navel')).toBeOnTheScreen();
    expect(screen.getByText('2 fingers below the navel')).toBeOnTheScreen();
  });

  it('REQ-MEAS-006 Save stays disabled with only the upper waist, or an invalid value', async () => {
    await renderInApp(<HomeScreen />);
    await openSheet();
    expect(save()).toBeDisabled();

    await type('Upper waist (cm)', '81.2');
    expect(save()).toBeDisabled();
    await type('Lower waist (cm)', '9.9');
    expect(save()).toBeDisabled();
    expect(screen.getByText('Enter 10.0 to 250.0 cm.')).toBeOnTheScreen();

    await type('Lower waist (cm)', '84.5');
    expect(save()).toBeEnabled();
  });

  it('Q-029 X after typing closes without saving and without a warning', async () => {
    const { db } = await renderInApp(<HomeScreen />);
    await openSheet();
    await type('Upper waist (cm)', '81.2');
    await type('Lower waist (cm)', '84.5');

    await fireEvent.press(screen.getByRole('button', { name: 'Close without saving' }));

    expect(screen.queryByText('2 fingers above the navel')).toBeNull();
    expect(await db.getFirstAsync('SELECT * FROM measurements', [])).toBeNull();
    expect(await db.getFirstAsync('SELECT * FROM outbox', [])).toBeNull();
  });

  it('REQ-MEAS-003 inches are stored as millimetres, and the choice is remembered on this phone (D-23)', async () => {
    const { server } = await renderInApp(<HomeScreen />);
    await openSheet();
    await fireEvent.press(screen.getByRole('button', { name: 'in' }));
    expect(screen.getByText('Upper waist')).toBeOnTheScreen();
    await type('Upper waist (in)', '32.0');
    await type('Lower waist (in)', '33.3');

    await fireEvent.press(save());

    await waitFor(() => expect(server.entries('measurements').get('2026-10-28')).toMatchObject({ upperWaistMm: 813, lowerWaistMm: 846 }));
    await fireEvent.press(screen.getByRole('button', { name: 'Previous week' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Monday 19 Oct' }));
    await openSheet();
    await waitFor(() => expect(screen.getByRole('button', { name: 'in' })).toBeSelected());
    expect(screen.getByLabelText('Upper waist (in)')).toBeOnTheScreen();
  });

  it('REQ-MEAS-003 switching the unit converts what is typed', async () => {
    await renderInApp(<HomeScreen />);
    await openSheet();
    await type('Upper waist (cm)', '81.2');

    await fireEvent.press(screen.getByRole('button', { name: 'in' }));

    expect(screen.getByLabelText('Upper waist (in)')).toHaveDisplayValue('32.0');
  });

  it('REQ-MEAS-005 the optional fields and notes are under "More measurements"; a filled one must be valid', async () => {
    const { server } = await renderInApp(<HomeScreen />);
    await openSheet();
    expect(screen.queryByLabelText('Chest (cm)')).toBeNull();
    await type('Upper waist (cm)', '81.2');
    await type('Lower waist (cm)', '84.5');

    await fireEvent.press(screen.getByRole('button', { name: 'More measurements' }));
    await type('Chest (cm)', '250.1');
    expect(save()).toBeDisabled();
    await type('Chest (cm)', '99.0');
    await type('Arms (cm)', '33');
    await type('Notes', '  After a rest day  ');
    await fireEvent.press(save());

    await waitFor(() =>
      expect(server.entries('measurements').get('2026-10-28')).toMatchObject({
        chestMm: 990,
        armMm: 330,
        hipsMm: null,
        thighMm: null,
        notes: 'After a rest day',
      }),
    );
  });

  it('REQ-MEAS-002 the date can move to past days only, and a day’s entry fills the sheet', async () => {
    const { db } = await renderInApp(<HomeScreen />);
    await applyServerEntries(db, 'measurements', [
      { day: '2026-10-20', upperWaistMm: 800, lowerWaistMm: 830, ...NO_OPTIONAL, notes: 'Synthetic', recordedAt: '2026-10-20T03:00:00.000Z' },
    ]);
    await openSheet();
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled();

    for (let day = 0; day < 8; day += 1) await fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));

    expect(screen.getByLabelText('Date: Tue 20 Oct')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText('Upper waist (cm)')).toHaveDisplayValue('80.0'));
    expect(screen.getByLabelText('Notes')).toHaveDisplayValue('Synthetic');
    await fireEvent.press(screen.getByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(screen.getByLabelText('Upper waist (cm)')).toHaveDisplayValue(''));
  });

  it('ADR-0007 rule 2 rejected measurements say so, and Edit opens them to fix', async () => {
    const { server } = await renderInApp(<HomeScreen />);
    server.state.rejectWith = 'VALIDATION_FAILED';
    await openSheet();
    await type('Upper waist (cm)', '81.2');
    await type('Lower waist (cm)', '84.5');
    await fireEvent.press(save());

    expect(await screen.findByText("These measurements weren't saved: the value is not valid. Edit or discard it.")).toBeOnTheScreen();
    server.state.rejectWith = null;
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByLabelText('Upper waist (cm)')).toHaveDisplayValue('81.2'));
    await type('Lower waist (cm)', '85.0');
    await fireEvent.press(save());

    await waitFor(() => expect(screen.queryByText(/weren't saved/)).toBeNull());
    await waitFor(() => expect(server.entries('measurements').get('2026-10-28')).toMatchObject({ lowerWaistMm: 850 }));
  });
});
