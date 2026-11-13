import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { applyServerEntries, setMeta } from '../local/store';
import type { SqlDb } from '../local/sql';
import { renderInApp } from '../testing/appHarness';
import { LIGHT_COLORS } from '../theme';
import { HomeScreen } from './HomeScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// The measurements card (REQ-HOME-008; always shown, D-24) and sheet (REQ-MEAS-001…006). Today is
// Wednesday 28 October 2026; its week is Mon 26 Oct – Sun 1 Nov.

const NO_OPTIONAL = { chestMm: null, hipsMm: null, armMm: null, thighMm: null, notes: null };
const RECORDED_AT = '2026-10-20T03:00:00.000Z';

async function openSheet() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Add measurements' }));
}

async function openEdit() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit measurements' }));
}

async function type(label: string, text: string) {
  await fireEvent.changeText(screen.getByLabelText(label), text);
}

function save() {
  return screen.getByRole('button', { name: 'Save measurements' });
}

describe('REQ-HOME-008 measurements card', () => {
  it('REQ-HOME-008 with no entry for the date, "Add measurements" opens the sheet on the selected date', async () => {
    await renderInApp(<HomeScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Tuesday 27 Oct' }));

    expect(await screen.findByText('No measurements for Tue 27 Oct.')).toBeOnTheScreen();
    await openSheet();

    expect(screen.getByLabelText('Date: Tue 27 Oct')).toBeOnTheScreen();
  });

  it('D-24 stays after saving and shows the date’s values and notes, with "Edit measurements"', async () => {
    const { server } = await renderInApp(<HomeScreen />);
    await openSheet();
    await type('Upper waist (cm)', '81.2');
    await type('Lower waist (cm)', '84.5');
    await fireEvent.press(screen.getByRole('button', { name: 'More measurements' }));
    await type('Chest (cm)', '99');
    await type('Notes', 'Synthetic note');

    await fireEvent.press(save());

    expect(await screen.findByLabelText('Upper waist: 81.2 cm')).toBeOnTheScreen();
    expect(screen.getByLabelText('Lower waist: 84.5 cm')).toBeOnTheScreen();
    expect(screen.getByLabelText('Chest: 99.0 cm')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Hips:/)).toBeNull();
    expect(screen.getByLabelText('Notes: Synthetic note')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Edit measurements' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add measurements' })).toBeNull();
    await waitFor(() =>
      expect(server.entries('measurements').get('2026-10-28')).toMatchObject({ upperWaistMm: 812, lowerWaistMm: 845, chestMm: 990 }),
    );
  });

  it('D-24 each date shows its own entry, or "Add measurements" when it has none', async () => {
    const { db } = await renderInApp(<HomeScreen />);
    await applyServerEntries(db, 'measurements', [
      { day: '2026-10-26', upperWaistMm: 800, lowerWaistMm: 830, ...NO_OPTIONAL, recordedAt: RECORDED_AT },
    ]);

    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct' }));
    expect(await screen.findByLabelText('Upper waist: 80.0 cm')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Tuesday 27 Oct' }));
    expect(await screen.findByRole('button', { name: 'Add measurements' })).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Upper waist:/)).toBeNull();
  });

  it('D-24 shows the values in the cm/in unit last chosen on this phone', async () => {
    const { db } = await renderInApp(<HomeScreen />);
    await applyServerEntries(db, 'measurements', [
      { day: '2026-10-28', upperWaistMm: 813, lowerWaistMm: 846, ...NO_OPTIONAL, recordedAt: RECORDED_AT },
    ]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back to today' }));
    expect(await screen.findByLabelText('Upper waist: 81.3 cm')).toBeOnTheScreen();

    await openEdit();
    await fireEvent.press(screen.getByRole('button', { name: 'in' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close without saving' }));

    expect(await screen.findByLabelText('Upper waist: 32.0 in')).toBeOnTheScreen();
    expect(screen.getByLabelText('Lower waist: 33.3 in')).toBeOnTheScreen();
  });

  it('D-24 an entry the server has not received yet shows "Waiting to sync"', async () => {
    const { server } = await renderInApp(<HomeScreen />);
    server.state.offline = true;
    await openSheet();
    await type('Upper waist (cm)', '81.2');
    await type('Lower waist (cm)', '84.5');

    await fireEvent.press(save());

    expect(await screen.findByLabelText('Upper waist: 81.2 cm')).toBeOnTheScreen();
    expect(await screen.findByText('Waiting to sync')).toBeOnTheScreen();
  });
});

// Today's card says when measurements were last logged, and "Due" once more than 7 days have passed
// (D-85; canvas "2.3 Home · Measurements due", C locked). Today is Wed 28 Oct; the phone's 90 days
// start on Fri 31 Jul.

/** Home, with measurements on these days already on the phone, and the account's first day when known. */
function renderHomeWith(days: string[], accountDay?: string) {
  return renderInApp(<HomeScreen />, undefined, async (db: SqlDb) => {
    await applyServerEntries(
      db,
      'measurements',
      days.map((day) => ({ day, upperWaistMm: 800, lowerWaistMm: 830, ...NO_OPTIONAL, recordedAt: RECORDED_AT })),
    );
    if (accountDay) await setMeta(db, 'account_created_day', accountDay);
  });
}

describe('D-85 measurements due on today', () => {
  it('D-85 more than 7 days since the last: when, the "Due" badge and "Add measurements" filled', async () => {
    await renderHomeWith(['2026-10-12', '2026-10-20']);

    expect(await screen.findByText('Last logged 8 days ago, on Tue 20 Oct.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Due')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add measurements' })).toHaveStyle({ backgroundColor: LIGHT_COLORS.primary });
    expect(screen.queryByText('No measurements for Wed 28 Oct.')).toBeNull();
  });

  it('D-85 exactly 7 days since the last: when, and not due', async () => {
    await renderHomeWith(['2026-10-21']);

    expect(await screen.findByText('Last logged 7 days ago, on Wed 21 Oct.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Due')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add measurements' })).not.toHaveStyle({ backgroundColor: LIGHT_COLORS.primary });
  });

  it('D-85 measured yesterday says "yesterday"', async () => {
    await renderHomeWith(['2026-10-27']);

    expect(await screen.findByText('Last logged yesterday, on Tue 27 Oct.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Due')).toBeNull();
  });

  it('D-85 none yet on an account younger than the 90 days: "No measurements logged yet." and due', async () => {
    await renderHomeWith([], '2026-10-01');

    expect(await screen.findByText('No measurements logged yet.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Due')).toBeOnTheScreen();
  });

  it('D-85 none on the phone and an older account, or one not known yet: "None in the last 90 days." and due', async () => {
    await renderHomeWith([], '2026-05-01');

    expect(await screen.findByText('None in the last 90 days.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Due')).toBeOnTheScreen();
  });

  it('D-85 a past date keeps "No measurements for <date>", with no badge', async () => {
    await renderHomeWith(['2026-10-12']);
    expect(await screen.findByLabelText('Due')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Tuesday 27 Oct' }));

    expect(await screen.findByText('No measurements for Tue 27 Oct.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Due')).toBeNull();
  });

  it('D-85 saving today’s measurements shows them, and the badge goes', async () => {
    await renderHomeWith(['2026-10-12']);
    expect(await screen.findByLabelText('Due')).toBeOnTheScreen();
    await openSheet();
    await type('Upper waist (cm)', '81.2');
    await type('Lower waist (cm)', '84.5');

    await fireEvent.press(save());

    expect(await screen.findByLabelText('Upper waist: 81.2 cm')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Due')).toBeNull();
  });
});

describe('D-24 editing a date’s measurements', () => {
  async function renderWithEntries() {
    const app = await renderInApp(<HomeScreen />);
    await applyServerEntries(app.db, 'measurements', [
      {
        day: '2026-10-26',
        upperWaistMm: 800,
        lowerWaistMm: 830,
        chestMm: 950,
        hipsMm: null,
        armMm: 320,
        thighMm: null,
        notes: 'Synthetic past',
        recordedAt: RECORDED_AT,
      },
      { day: '2026-10-28', upperWaistMm: 812, lowerWaistMm: 845, ...NO_OPTIONAL, recordedAt: RECORDED_AT },
    ]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct' }));
    await screen.findByLabelText('Upper waist: 80.0 cm');
    return app;
  }

  it('D-24 Edit pre-fills both waist values, the optional values and notes, with "More measurements" open', async () => {
    await renderWithEntries();

    await openEdit();

    await waitFor(() => expect(screen.getByLabelText('Upper waist (cm)')).toHaveDisplayValue('80.0'));
    expect(screen.getByLabelText('Lower waist (cm)')).toHaveDisplayValue('83.0');
    expect(screen.getByLabelText('Chest (cm)')).toHaveDisplayValue('95.0');
    expect(screen.getByLabelText('Hips (cm)')).toHaveDisplayValue('');
    expect(screen.getByLabelText('Arms (cm)')).toHaveDisplayValue('32.0');
    expect(screen.getByLabelText('Notes')).toHaveDisplayValue('Synthetic past');
  });

  it('D-24 in Edit the date is fixed: no "Previous day" or "Next day"', async () => {
    await renderWithEntries();

    await openEdit();

    expect(screen.getByLabelText('Date: Mon 26 Oct')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Previous day' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next day' })).toBeNull();
  });

  it('D-24 saving an edit updates that date’s entry, with no second entry, and leaves today’s alone', async () => {
    const { db, server } = await renderWithEntries();
    await openEdit();
    await waitFor(() => expect(screen.getByLabelText('Upper waist (cm)')).toHaveDisplayValue('80.0'));

    await type('Upper waist (cm)', '79.5');
    await type('Notes', 'Synthetic corrected');
    await fireEvent.press(save());

    expect(await screen.findByLabelText('Upper waist: 79.5 cm')).toBeOnTheScreen();
    expect(screen.getByLabelText('Chest: 95.0 cm')).toBeOnTheScreen();
    expect(screen.getByLabelText('Notes: Synthetic corrected')).toBeOnTheScreen();
    await waitFor(() =>
      expect(server.entries('measurements').get('2026-10-26')).toMatchObject({
        upperWaistMm: 795,
        lowerWaistMm: 830,
        chestMm: 950,
        armMm: 320,
        notes: 'Synthetic corrected',
      }),
    );
    expect(server.entries('measurements').has('2026-10-28')).toBe(false);
    expect(await db.getAllAsync('SELECT day, upper_waist_mm FROM measurements ORDER BY day', [])).toEqual([
      { day: '2026-10-26', upper_waist_mm: 795 },
      { day: '2026-10-28', upper_waist_mm: 812 },
    ]);
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
    await openEdit();
    await waitFor(() => expect(screen.getByRole('button', { name: 'in' })).toBeSelected());
    expect(screen.getByLabelText('Upper waist (in)')).toHaveDisplayValue('32.0');
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

describe('REQ-MEAS-001…006 what the sheet says', () => {
  it('Save waits for both waists and says so; the notes give their limit', async () => {
    await renderInApp(<HomeScreen />);
    await openSheet();

    expect(save()).toBeDisabled();
    expect(screen.getByText('Enter both waist values to save.')).toBeOnTheScreen();
    await type('Upper waist (cm)', '81.0');
    expect(screen.getByText('Enter both waist values to save.')).toBeOnTheScreen();
    await type('Lower waist (cm)', '85.0');
    expect(screen.queryByText('Enter both waist values to save.')).toBeNull();
    expect(save()).toBeEnabled();

    await fireEvent.press(screen.getByRole('button', { name: 'More measurements' }));
    expect(screen.getByText('Up to 500 characters.')).toBeOnTheScreen();
  });

  it('D-98 notes over 500 characters say so at once, in red, and Save waits until they are shorter', async () => {
    const { server } = await renderInApp(<HomeScreen />);
    await openSheet();
    await type('Upper waist (cm)', '81.0');
    await type('Lower waist (cm)', '85.0');
    await fireEvent.press(screen.getByRole('button', { name: 'More measurements' }));

    // Nothing is cut off: the box takes the 501st character, and the message shows with it.
    await type('Notes', 'x'.repeat(501));
    expect(screen.getByLabelText('Notes')).toHaveDisplayValue('x'.repeat(501));
    expect(screen.getByRole('alert')).toHaveTextContent('Notes can be up to 500 characters. Remove 1 character.');
    expect(screen.getByLabelText('Notes')).toHaveStyle({ borderColor: LIGHT_COLORS.danger });
    expect(screen.queryByText('Up to 500 characters.')).toBeNull();
    expect(save()).toBeDisabled();
    expect(screen.getByText('Shorten the notes to save.')).toBeOnTheScreen();
    await type('Notes', 'x'.repeat(512));
    expect(screen.getByRole('alert')).toHaveTextContent('Notes can be up to 500 characters. Remove 12 characters.');

    // Spaces at either end are not saved, so they do not count.
    await type('Notes', `  ${'x'.repeat(500)}  `);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Up to 500 characters.')).toBeOnTheScreen();
    expect(screen.queryByText('Shorten the notes to save.')).toBeNull();
    expect(save()).toBeEnabled();
    await fireEvent.press(save());

    await waitFor(() => expect(server.entries('measurements').get('2026-10-28')).toMatchObject({ notes: 'x'.repeat(500) }));
  });
});
