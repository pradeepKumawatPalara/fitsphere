import { TARGET_RANGES } from '@fitsphere/shared';
import { deps, fakeAuthClient, fakeSession } from './testing/fakes';
import { fakeServer } from './testing/fakeServer';
import { memoryDb } from './testing/memoryDb';
import { getMeta, migrateLocal, setMeta } from './local/store';
import { startDestination } from './onboardingGate';
import {
  flowSteps,
  neighbour,
  nudgeWeightText,
  numberedSteps,
  resumeStep,
  startingTargetsToSave,
  STARTING_TARGETS,
  stepCounter,
} from './onboarding';

// First sign-in onboarding (D-124, REQ-ACC-013, docs/plans/onboarding.md): the pure rules and where app
// start goes. Synthetic values only.

describe('D-124 which steps apply', () => {
  it('has Health Connect only where the phone has it, and counts the numbered steps', () => {
    expect(numberedSteps(true)).toEqual(['about', 'weight', 'health']);
    expect(numberedSteps(false)).toEqual(['about', 'weight']);
    expect(flowSteps(false)).toEqual(['welcome', 'about', 'weight', 'done']);
    expect(stepCounter('about', true)).toEqual({ at: 1, of: 3 });
    expect(stepCounter('weight', false)).toEqual({ at: 2, of: 2 });
    expect(stepCounter('welcome', true)).toBeNull();
    expect(stepCounter('done', true)).toBeNull();
  });

  it('goes forward and back, and stops at the ends', () => {
    expect(neighbour('welcome', true, 1)).toBe('about');
    expect(neighbour('weight', false, 1)).toBe('done');
    expect(neighbour('weight', true, 1)).toBe('health');
    expect(neighbour('about', true, -1)).toBe('welcome');
    expect(neighbour('welcome', true, -1)).toBeNull();
    expect(neighbour('done', true, 1)).toBeNull();
  });

  it('resumes at the step left at, or Welcome when none or no longer there', () => {
    expect(resumeStep('weight', true)).toBe('weight');
    expect(resumeStep('health', false)).toBe('welcome');
    expect(resumeStep(null, true)).toBe('welcome');
    expect(resumeStep('nonsense', true)).toBe('welcome');
  });
});

describe('D-124 the starting targets', () => {
  it('every value is inside the approved range, and there is no target body weight', () => {
    for (const [kind, value] of Object.entries(STARTING_TARGETS)) {
      const range = TARGET_RANGES[kind as keyof typeof TARGET_RANGES];
      expect(value).toBeGreaterThanOrEqual(range.min);
      expect(value).toBeLessThanOrEqual(range.max);
    }
    expect(STARTING_TARGETS.body_weight).toBeUndefined();
  });

  it('saves a starting value only for a kind the user has not set', () => {
    expect(startingTargetsToSave([]).map((target) => target.kind)).toEqual([
      'calories',
      'protein',
      'carbs',
      'fat',
      'fibre',
      'steps',
      'weekly_workouts',
    ]);
    const kinds = startingTargetsToSave(['calories', 'steps']).map((target) => target.kind);
    expect(kinds).not.toContain('calories');
    expect(kinds).not.toContain('steps');
    expect(kinds).toContain('protein');
  });
});

describe('D-124 the weight stepper', () => {
  it('moves by 0.1 with one decimal, and leaves what is not a number alone', () => {
    expect(nudgeWeightText('72.4', 1)).toBe('72.5');
    expect(nudgeWeightText('72.4', -1)).toBe('72.3');
    expect(nudgeWeightText('72.9', 1)).toBe('73.0');
    expect(nudgeWeightText('0.0', -1)).toBe('0.0');
    expect(nudgeWeightText('abc', 1)).toBe('abc');
  });
});

describe('D-124 where app start goes', () => {
  const NOW = new Date('2026-10-28T03:30:00Z');
  async function setup() {
    const db = memoryDb();
    await migrateLocal(db);
    const server = fakeServer(NOW);
    const client = fakeAuthClient(fakeSession({ age_confirmed: true, age_confirmation_text_version: '2026-10-27' }));
    return { db, server, deps: deps(client, server.fetchImpl) };
  }

  it('uses the phone\'s own copy: not finished opens onboarding, finished opens Home, with no call to the server', async () => {
    const { db, server, deps: d } = await setup();
    await setMeta(db, 'onboarded', '0');
    expect(await startDestination(db, d)).toBe('/onboarding');
    await setMeta(db, 'onboarded', '1');
    expect(await startDestination(db, d)).toBe('/home');
    expect(server.calls.length).toBe(0);
  });

  it('asks the server once when the phone has no copy, and keeps the answer', async () => {
    const { db, server, deps: d } = await setup();
    server.state.onboardedAt = null;
    expect(await startDestination(db, d)).toBe('/onboarding');
    expect(await getMeta(db, 'onboarded')).toBe('0');

    const second = await setup();
    second.server.state.onboardedAt = '2026-10-01T00:00:00.000Z';
    expect(await startDestination(second.db, second.deps)).toBe('/home');
    expect(await getMeta(second.db, 'onboarded')).toBe('1');
  });

  it('an older server that sends no time, or no connection, opens Home and never blocks the app', async () => {
    const old = await setup();
    expect(await startDestination(old.db, old.deps)).toBe('/home');
    expect(await getMeta(old.db, 'onboarded')).toBe('1');

    const offline = await setup();
    offline.server.state.offline = true;
    expect(await startDestination(offline.db, offline.deps)).toBe('/home');
    expect(await getMeta(offline.db, 'onboarded')).toBeNull();
  });

  it('tells the server a finished flag it has not heard yet, and clears the reminder once told', async () => {
    const { db, server, deps: d } = await setup();
    server.state.onboardedAt = null;
    await setMeta(db, 'onboarded', '1');
    await setMeta(db, 'onboarding_flag_pending', '1');

    server.state.offline = true;
    expect(await startDestination(db, d)).toBe('/home');
    expect(await getMeta(db, 'onboarding_flag_pending')).toBe('1');

    server.state.offline = false;
    expect(await startDestination(db, d)).toBe('/home');
    expect(await getMeta(db, 'onboarding_flag_pending')).toBeNull();
    expect(server.state.onboardedAt).not.toBeNull();
  });
});
