import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { FUTURE_DAY, OLDER_DAY } from '../components/CalendarSheet';
import { HeaderActions, HeaderTitle } from '../components/AppHeader';
import { renderInApp } from '../testing/appHarness';
import { AccountScreen } from './AccountScreen';
import { HomeScreen } from './HomeScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// The header's calendar and the 90-day window (REQ-NAV-002, REQ-DATE-001; MVP default, D-23).
// Today is Wednesday 28 October 2026; the window starts on Friday 31 July 2026.

async function renderHome() {
  return renderInApp(
    <>
      <HeaderTitle />
      <HeaderActions />
      <HomeScreen />
    </>,
  );
}

beforeEach(() => {
  mockRouter.replace.mockClear();
  mockRouter.push.mockClear();
});

describe('REQ-NAV-002 calendar', () => {
  it('REQ-NAV-002 opens on the selected month; a future day is greyed and says why it cannot be picked (Q-017, D-34)', async () => {
    await renderHome();

    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    expect(screen.getByText('October 2026')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Wednesday 28 October 2026, today' })).toBeSelected();
    const tomorrow = screen.getByRole('button', { name: 'Thursday 29 October 2026, not available' });
    expect(tomorrow).toBeDisabled();
    await fireEvent.press(tomorrow);
    expect(screen.getByRole('alert')).toHaveTextContent(FUTURE_DAY);
    expect(screen.getByText('October 2026')).toBeOnTheScreen();
    expect(screen.getByLabelText('Selected date: Today · Wed 28 Oct')).toBeOnTheScreen();
  });

  it('D-34 browses up to 12 months ahead, every day there greyed', async () => {
    await renderHome();
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    for (let month = 0; month < 12; month += 1) await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));

    expect(screen.getByText('October 2027')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Friday 1 October 2027, not available' })).toBeDisabled();
  });

  it('D-23 goes back only as far as the 90 days the phone holds', async () => {
    await renderHome();
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    for (let month = 0; month < 3; month += 1) await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));

    expect(screen.getByText('July 2026')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Friday 31 July 2026' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    // An older day is greyed too, and says why (D-34).
    const older = screen.getByRole('button', { name: 'Thursday 30 July 2026, not available' });
    expect(older).toBeDisabled();
    await fireEvent.press(older);
    expect(screen.getByRole('alert')).toHaveTextContent(OLDER_DAY);
  });

  it('REQ-DATE-001 choosing a day closes the calendar and selects it in the header, the banner and the week strip', async () => {
    await renderHome();
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Monday 5 October 2026' }));

    await waitFor(() => expect(screen.queryByText('October 2026')).toBeNull());
    expect(screen.getByLabelText('Selected date: Mon 5 Oct')).toBeOnTheScreen();
    expect(screen.getByText('Showing Mon 5 Oct')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Monday 5 Oct' })).toBeSelected();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to today' }));
    expect(screen.getByLabelText('Selected date: Today · Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Wednesday 28 Oct, today' })).toBeSelected();
  });

  it('REQ-NAV-002 the avatar opens Account', async () => {
    await renderHome();

    await fireEvent.press(await screen.findByRole('button', { name: 'Account' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/account');
  });
});

describe('D-23 date strip limit', () => {
  it('D-23 "Earlier days" stops at the 7 days holding the first of the 90 days', async () => {
    await renderHome();
    const earlier = await screen.findByRole('button', { name: 'Earlier days' });

    for (let span = 0; span < 13; span += 1) await fireEvent.press(earlier);

    expect(screen.getByRole('button', { name: 'Earlier days' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Thursday 30 Jul' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Friday 31 Jul' })).toBeEnabled();
  });
});

describe('REQ-NAV-002 Account', () => {
  it('REQ-ACC-008 shows the email and Log out; the development tools only in development builds', async () => {
    await renderInApp(<AccountScreen showDevTools={false} />);

    expect(await screen.findByText('Signed in as user@example.test')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeOnTheScreen();
    expect(screen.queryByText('Development')).toBeNull();
  });
});
