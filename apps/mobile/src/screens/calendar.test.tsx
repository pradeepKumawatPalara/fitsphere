import { fireEvent, screen, waitFor } from '@testing-library/react-native';
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
  it('REQ-NAV-002 opens on the selected month; future days cannot be picked (Q-017)', async () => {
    await renderHome();

    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    expect(screen.getByText('October 2026')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Wednesday 28 October 2026, today' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Thursday 29 October 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
  });

  it('D-23 goes back only as far as the 90 days the phone holds', async () => {
    await renderHome();
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    for (let month = 0; month < 3; month += 1) await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));

    expect(screen.getByText('July 2026')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Thursday 30 July 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Friday 31 July 2026' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
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

describe('D-23 week strip limit', () => {
  it('D-23 the previous-week arrow stops at the week holding the first of the 90 days', async () => {
    await renderHome();
    const previous = await screen.findByRole('button', { name: 'Previous week' });

    for (let week = 0; week < 13; week += 1) await fireEvent.press(previous);

    expect(screen.getByRole('button', { name: 'Previous week' })).toBeDisabled();
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
