import { fakeHealthSource, fakeHealthWanted, fakeSteps, fakeWeights } from './fakeHealth';

// D-121: the made-up health store for development builds. Made-up values only.

describe('the made-up health store', () => {
  const original = process.env.EXPO_PUBLIC_FAKE_HEALTH;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_FAKE_HEALTH;
    else process.env.EXPO_PUBLIC_FAKE_HEALTH = original;
  });

  it('is used only when asked for by name, and never in a build for release', () => {
    delete process.env.EXPO_PUBLIC_FAKE_HEALTH;
    expect(fakeHealthWanted()).toBe(false);
    process.env.EXPO_PUBLIC_FAKE_HEALTH = '1';
    expect(fakeHealthWanted()).toBe(true);
    process.env.EXPO_PUBLIC_FAKE_HEALTH = 'true';
    expect(fakeHealthWanted()).toBe(false);
    const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_FAKE_HEALTH = '1';
    expect(fakeHealthWanted()).toBe(false);
    (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
  });

  it('gives a week of steps up to the last day, never before the first, and a weigh-in on three days', () => {
    const steps = fakeSteps('2026-10-26', '2026-10-28');
    expect(steps.map((day) => day.day)).toEqual(['2026-10-28', '2026-10-27', '2026-10-26']);
    expect(steps[0]?.steps).toBe(2_400);
    expect(fakeWeights('2026-10-28').map((reading) => reading.at)).toEqual([
      '2026-10-23T02:00:00.000Z',
      '2026-10-26T02:00:00.000Z',
      '2026-10-28T02:00:00.000Z',
    ]);
  });

  it('asks nothing until Connect, then has access', async () => {
    const source = fakeHealthSource();
    expect(await source.availability()).toBe('available');
    expect(await source.hasAccess()).toBe(false);
    expect(await source.requestAccess()).toBe(true);
    expect(await source.hasAccess()).toBe(true);
  });
});
