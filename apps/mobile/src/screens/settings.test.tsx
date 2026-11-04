import { AI_CONSENT_TEXT, AI_CONSENT_TEXT_VERSION } from '@fitsphere/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { useEffect } from 'react';
import { TEXTS } from '../auth/texts';
import { getEntry, getMeta, setMeta } from '../local/store';
import { renderInApp } from '../testing/appHarness';
import { OFFLINE } from '../testing/fakes';
import { useSettings } from '../settings/SettingsProvider';
import { AccountScreen } from './AccountScreen';
import { ChangePasswordScreen } from './ChangePasswordScreen';
import { DeleteAccountScreen } from './DeleteAccountScreen';
import { SignInScreen } from './SignInScreen';

// The Settings screen (REQ-ACC-001…009; MVP defaults, D-31), change password (REQ-ACC-007) and
// delete account (REQ-ACC-009). The units on the other screens are in units.test.tsx; the theme in
// theme.test.tsx.

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockParams: { notice?: string } = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  delete mockParams.notice;
});

describe('REQ-ACC-001…006 the Settings screen', () => {
  it('D-31 lists Appearance, Units, AI meal reading, the fixed country and time zone, and the account', async () => {
    await renderInApp(<AccountScreen showDevTools={false} />);

    for (const heading of ['Appearance', 'Units', 'AI meal reading', 'Country and time zone', 'Account']) {
      expect(await screen.findByRole('header', { name: heading })).toBeOnTheScreen();
    }
    expect(screen.getByText('India · Kolkata')).toBeOnTheScreen();
    // The signed-in email is on the Profile card (6.1).
    expect(within(screen.getByLabelText('Profile')).getByText('user@example.test')).toBeOnTheScreen();
    for (const button of ['Edit profile', 'Your targets', 'Change password', 'Log out', 'Delete account']) {
      expect(screen.getByRole('button', { name: button })).toBeOnTheScreen();
    }
  });

  it('REQ-ACC-001 System is chosen at first, with its helper text; choosing Dark saves it and shows its text', async () => {
    const { db, server } = await renderInApp(<AccountScreen showDevTools={false} />);
    expect(await screen.findByRole('radio', { name: 'Appearance: System', checked: true })).toBeOnTheScreen();
    expect(screen.getByText("Matches your phone's light or dark setting.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Appearance: Dark' }));

    expect(await screen.findByRole('radio', { name: 'Appearance: Dark', checked: true })).toBeOnTheScreen();
    expect(screen.getByText('Always dark.')).toBeOnTheScreen();
    expect(await getEntry(db, 'setting', 'theme')).toMatchObject({ value: 'dark' });
    await waitFor(() => expect(server.entries('settings').get('theme')).toMatchObject({ value: 'dark' }));
  });

  it('ADR-0007 choices made quickly are all saved and synced, the last one kept (phone test, 2026-11-04)', async () => {
    // Each save starts before the one before it has finished, as with quick taps on the phone.
    function ChooseQuickly() {
      const { saveSetting } = useSettings();
      useEffect(() => {
        for (const theme of ['light', 'dark', 'system', 'dark'] as const) void saveSetting('theme', theme);
        for (const unit of ['lb', 'kg', 'lb'] as const) void saveSetting('body_weight_unit', unit);
      }, [saveSetting]);
      return null;
    }
    const { db, server } = await renderInApp(<ChooseQuickly />);

    await waitFor(async () => expect(await getEntry(db, 'setting', 'theme')).toMatchObject({ value: 'dark', syncState: 'synced' }));
    expect(await getEntry(db, 'setting', 'body_weight_unit')).toMatchObject({ value: 'lb' });
    await waitFor(() => expect(server.entries('settings').get('body_weight_unit')).toMatchObject({ value: 'lb' }));
    expect(server.entries('settings').get('theme')).toMatchObject({ value: 'dark' });
  });

  it('REQ-ACC-002 and REQ-ACC-003 the two units are chosen on their own', async () => {
    const { db } = await renderInApp(<AccountScreen showDevTools={false} />);

    await fireEvent.press(await screen.findByRole('radio', { name: 'Lifting weight unit: lb' }));

    expect(await screen.findByRole('radio', { name: 'Lifting weight unit: lb', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Body weight unit: kg', checked: true })).toBeOnTheScreen();
    expect(await getEntry(db, 'setting', 'lifting_weight_unit')).toMatchObject({ value: 'lb' });
    expect(await getEntry(db, 'setting', 'body_weight_unit')).toBeNull();
  });
});

describe('REQ-ACC-004 the AI meal-reading switch', () => {
  it('A-007 off until the user turns it on; on and off are recorded with the text version shown', async () => {
    const { server, db } = await renderInApp(<AccountScreen showDevTools={false} />);
    const toggle = await screen.findByLabelText('AI meal reading');
    expect(screen.getByText(AI_CONSENT_TEXT)).toBeOnTheScreen();
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle.props.value).toBe(false);

    await fireEvent(toggle, 'valueChange', true);
    await waitFor(() => expect(server.state.aiConsent).toMatchObject({ consented: true, textVersion: AI_CONSENT_TEXT_VERSION }));
    await waitFor(() => expect(screen.getByLabelText('AI meal reading').props.value).toBe(true));

    await fireEvent(screen.getByLabelText('AI meal reading'), 'valueChange', false);
    await waitFor(() => expect(server.state.aiConsent).toMatchObject({ consented: false }));
    expect(JSON.parse((await getMeta(db, 'ai_consent'))!)).toMatchObject({ consented: false });
    const puts = server.calls.filter((call) => call.method === 'PUT' && call.path === '/me/ai-consent');
    expect(puts.map((call) => call.body)).toEqual([
      { consented: true, textVersion: AI_CONSENT_TEXT_VERSION },
      { consented: false, textVersion: AI_CONSENT_TEXT_VERSION },
    ]);
  });

  it('D-31 offline, the last known choice is shown, disabled, with the reason', async () => {
    await renderInApp(<AccountScreen showDevTools={false} />, undefined, async (db, server) => {
      await setMeta(db, 'ai_consent', JSON.stringify({ consented: true, textVersion: AI_CONSENT_TEXT_VERSION, recordedAt: '2026-10-27T03:00:00.000Z' }));
      server.state.offline = true;
    });

    expect(await screen.findByText('Changing this needs an internet connection.')).toBeOnTheScreen();
    const toggle = screen.getByLabelText('AI meal reading');
    expect(toggle.props.value).toBe(true);
    expect(toggle).toBeDisabled();
  });
});

describe('REQ-ACC-007 change password', () => {
  async function fill(current: string, next: string) {
    await fireEvent.changeText(await screen.findByLabelText('Current password'), current);
    await fireEvent.changeText(screen.getByLabelText('New password'), next);
    await fireEvent.press(screen.getByRole('button', { name: 'Change password' }));
  }

  it('REQ-ACC-007 checks the current password, sets the new one and signs out the other devices only', async () => {
    const { client } = await renderInApp(<ChangePasswordScreen />);

    await fill('synthetic-old-pass', 'synthetic-new-pass');

    expect(await screen.findByText(TEXTS.passwordChanged)).toBeOnTheScreen();
    expect(client.signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.test', password: 'synthetic-old-pass' });
    expect(client.updateUser).toHaveBeenCalledWith({ password: 'synthetic-new-pass' });
    expect(client.signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(client.signOut).not.toHaveBeenCalledWith({ scope: 'local' });
  });

  it('REQ-ACC-007 a wrong current password is refused and nothing changes', async () => {
    const { client } = await renderInApp(<ChangePasswordScreen />);
    client.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { name: 'AuthApiError', status: 400 } });

    await fill('wrong-password', 'synthetic-new-pass');

    expect(await screen.findByText(TEXTS.wrongCurrentPassword)).toBeOnTheScreen();
    expect(client.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'synthetic-new-pass', TEXTS.currentPasswordRequired],
    ['synthetic-old-pass', 'short', TEXTS.passwordRule],
    ['synthetic-old-pass', 'x'.repeat(73), TEXTS.passwordRule],
  ])('REQ-ACC-007 refuses current "%s" with new "%s" before asking Supabase', async (current, next, text) => {
    const { client } = await renderInApp(<ChangePasswordScreen />);

    await fill(current, next);

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(client.signInWithPassword).not.toHaveBeenCalled();
  });

  it('6.3 each problem shows under its own field, the new password’s rule ticked once met', async () => {
    await renderInApp(<ChangePasswordScreen />);
    expect(await screen.findByLabelText(TEXTS.passwordRule)).toBeOnTheScreen();

    await fill('', 'short');

    const problems = await screen.findAllByRole('alert');
    expect(problems.map((problem) => problem.props.children)).toEqual([TEXTS.currentPasswordRequired, TEXTS.passwordRule]);
    await fireEvent.changeText(screen.getByLabelText('New password'), 'synthetic-new-pass');
    expect(screen.getByLabelText(`${TEXTS.passwordRule} Done.`)).toBeOnTheScreen();
  });

  it('REQ-ACC-007 the same password as now, and no connection, get their own texts', async () => {
    const { client } = await renderInApp(<ChangePasswordScreen />);
    client.updateUser.mockResolvedValueOnce({ error: { code: 'same_password', status: 422 } });
    await fill('synthetic-old-pass', 'synthetic-old-pass');
    expect(await screen.findByText(TEXTS.samePassword)).toBeOnTheScreen();

    client.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: OFFLINE });
    await fill('synthetic-old-pass', 'synthetic-new-pass');
    expect(await screen.findByText(TEXTS.needsInternet('Changing your password'))).toBeOnTheScreen();
    expect(client.signOut).not.toHaveBeenCalled();
  });
});

describe('REQ-ACC-009 delete account', () => {
  it('REQ-ACC-009 says what is deleted; "Keep my account" deletes nothing', async () => {
    const removeDatabase = jest.fn(async () => undefined);
    const { server } = await renderInApp(<DeleteAccountScreen />, undefined, undefined, removeDatabase);
    expect(await screen.findByText(/everything you logged: weights, steps, sleep, measurements, meals and their photos/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Keep my account' }));

    expect(server.state.deleted).toBe(false);
    expect(removeDatabase).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeOnTheScreen();
  });

  it('REQ-ACC-009 after confirming: the server deletes the account, then the phone deletes its database, signs out and says so', async () => {
    const removeDatabase = jest.fn(async () => undefined);
    const { server, client } = await renderInApp(<DeleteAccountScreen />, undefined, undefined, removeDatabase);

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText("Delete your account? This can't be undone.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/sign-in', params: { notice: 'accountDeleted' } }));
    expect(server.state.deleted).toBe(true);
    expect(server.calls.some((call) => call.method === 'DELETE' && call.path === '/me')).toBe(true);
    expect(removeDatabase).toHaveBeenCalled();
    expect(client.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it.each([
    ['the server cannot finish', 503, TEXTS.deleteFailed],
    ['no connection', null, TEXTS.needsInternet('Deleting your account')],
  ])('REQ-ACC-009 when %s, the user stays signed in with the phone data kept', async (_, status, text) => {
    const removeDatabase = jest.fn(async () => undefined);
    const { server, client } = await renderInApp(<DeleteAccountScreen />, undefined, undefined, removeDatabase);
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete my account' }));
    if (status) server.state.deleteFailsWith = status;
    else server.state.offline = true;

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(text)).toBeOnTheScreen();
    expect(removeDatabase).not.toHaveBeenCalled();
    expect(client.signOut).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('REQ-ACC-009 after the deletion', () => {
  it('D-31 the sign-in screen says the account has been deleted, and only then', async () => {
    mockParams.notice = 'accountDeleted';
    await renderInApp(<SignInScreen />);
    expect(await screen.findByText(TEXTS.accountDeleted)).toBeOnTheScreen();
  });

  it('D-31 an ordinary sign-in screen has no such notice', async () => {
    await renderInApp(<SignInScreen />);
    expect(await screen.findByRole('header', { name: 'Sign in' })).toBeOnTheScreen();
    expect(screen.queryByText(TEXTS.accountDeleted)).toBeNull();
  });
});
