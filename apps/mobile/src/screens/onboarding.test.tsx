import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { applyServerEntries, getMeta, listTargets, setMeta } from '../local/store';
import { needsOnboarding } from '../onboarding';
import { useOnboardingGate } from '../onboardingGate';
import { NOW, renderInApp } from '../testing/appHarness';
import { OnboardingScreen } from './OnboardingScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// "Set your targets" on a new user's first sign-in (REQ-ROLE-007; the canvas "First-time goals form",
// B · Two steps): the same eight targets as Your targets in two steps, every box optional, Skip saving
// nothing, and shown once, only to a user with no target. Made-up numbers.

beforeEach(() => {
  mockRouter.replace.mockClear();
  mockRouter.push.mockClear();
});

const type = (label: RegExp, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

describe('REQ-ROLE-007 Set your targets, step 1 of 2', () => {
  it('shows the Food step: its five targets, Skip and Next, and no Back', async () => {
    await renderInApp(<OnboardingScreen />);

    expect(await screen.findByRole('header', { name: 'Your food targets' })).toBeOnTheScreen();
    for (const label of ['Daily calories', 'Daily protein', 'Daily carbs', 'Daily fat', 'Daily fibre']) {
      expect(screen.getByLabelText(new RegExp(`^${label} in `))).toBeOnTheScreen();
    }
    expect(screen.queryByLabelText(/^Daily steps in /)).toBeNull();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByText(/Step 1 of 2/)).toBeOnTheScreen();
  });

  it('a value Your targets would refuse shows its rule and keeps Next waiting; every box may be empty', async () => {
    await renderInApp(<OnboardingScreen />);
    await screen.findByRole('header', { name: 'Your food targets' });

    await type(/^Daily calories in /, '99999');
    expect(await screen.findByText(/Enter a whole number from 0 to 10,000/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await type(/^Daily calories in /, '');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
  });
});

describe('REQ-ROLE-007 Set your targets, step 2 of 2', () => {
  async function toStepTwo() {
    const app = await renderInApp(<OnboardingScreen />);
    await screen.findByRole('header', { name: 'Your food targets' });
    return app;
  }

  it('Next shows Activity and body: steps, workouts and target weight, with Back and Save and finish', async () => {
    await toStepTwo();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('header', { name: 'Activity and body' })).toBeOnTheScreen();
    for (const label of ['Daily steps', 'Weekly workouts', 'Target body weight']) {
      expect(screen.getByLabelText(new RegExp(`^${label} in `))).toBeOnTheScreen();
    }
    expect(screen.queryByLabelText(/^Daily calories in /)).toBeNull();
    expect(screen.getByRole('button', { name: 'Save and finish' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeOnTheScreen();
    expect(screen.getByText(/Step 2 of 2/)).toBeOnTheScreen();
  });

  it('Back keeps what was typed on the Food step', async () => {
    await toStepTwo();
    await type(/^Daily calories in /, '2000');
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));

    expect(await screen.findByLabelText(/^Daily calories in /)).toHaveDisplayValue('2000');
  });

  it('Save and finish saves the targets typed, each from today, leaves the empty ones unset, and goes Home', async () => {
    const { db, server } = await toStepTwo();
    await type(/^Daily calories in /, '2000');
    await type(/^Daily protein in /, '120');
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await type(/^Daily steps in /, '8000');
    await type(/^Target body weight in /, '68');
    await fireEvent.press(screen.getByRole('button', { name: 'Save and finish' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'));
    const saved = await listTargets(db);
    expect(saved.map((target) => [target.kind, target.value, target.day]).sort()).toEqual(
      [
        ['body_weight', 68_000, '2026-10-28'],
        ['calories', 2_000, '2026-10-28'],
        ['protein', 120, '2026-10-28'],
        ['steps', 8_000, '2026-10-28'],
      ].sort(),
    );
    await waitFor(() => expect(server.entries('targets').get('calories')).toMatchObject({ value: 2_000 }));
    expect(server.entries('targets').get('carbs')).toBeUndefined();
    expect(await getMeta(db, 'onboarding_done')).toBe('1');
  });

  it('a target weight too small keeps Save and finish waiting, with the weight rule', async () => {
    await toStepTwo();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    await type(/^Target body weight in /, '5');

    expect(await screen.findByText(/Enter a weight/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save and finish' })).toBeDisabled();
  });
});

describe('REQ-ROLE-007 Skip', () => {
  it('saves nothing, goes Home and is not asked again on this phone', async () => {
    const { db } = await renderInApp(<OnboardingScreen />);
    await screen.findByLabelText(/^Daily calories in /);
    await type(/^Daily calories in /, '2000');
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'));
    expect(await listTargets(db)).toEqual([]);
    expect(await getMeta(db, 'onboarding_done')).toBe('1');
    expect(await needsOnboarding(db)).toBe(false);
  });
});

describe('REQ-ROLE-007 who is sent to it', () => {
  function Gate() {
    useOnboardingGate();
    return null;
  }

  it('a user with no target and no choice made is sent to it, once, after the first sync', async () => {
    await renderInApp(<Gate />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding'));
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it('a user whose targets came down with the sync (a new phone) is not', async () => {
    await renderInApp(<Gate />, () => NOW, async (db) => {
      await applyServerEntries(db, 'target', [{ kind: 'calories', day: '2026-10-20', value: 1_800, setAt: '2026-10-20T03:00:00.000Z', setByUserId: null }]);
    });
    // Give the check time to run.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('a user who finished or skipped it on this phone is not', async () => {
    const { db } = await renderInApp(<Gate />, () => NOW, async (db) => {
      await setMeta(db, 'onboarding_done', '1');
    });
    expect(await needsOnboarding(db)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
