import { formFromProfile, greetingName, heightRange, phoneDigits, readProfileForm } from './profile';

// The profile's rules on the phone (REQ-ACC-011). The screen's behaviour is in
// screens/profile.test.tsx; the server's checks in the shared contract's tests.

const TODAY = '2026-11-04';
const EMPTY = formFromProfile(null, 'cm');

describe('REQ-ACC-011 the profile on the phone', () => {
  it('invariant #6 heights from 50 to 300 cm, or 19.7 to 118.1 inches (D-100)', () => {
    expect(heightRange('cm')).toEqual({ min: 50, max: 300 });
    expect(heightRange('in')).toEqual({ min: 19.7, max: 118.1 });
  });

  it('invariant #5 reads a mobile number typed with spaces, +91, 91 or 0 in front', () => {
    for (const typed of ['98765 43210', '+91 98765 43210', '919876543210', '09876543210', '98765-43210']) {
      expect(phoneDigits(typed)).toBe('9876543210');
    }
  });

  it('an empty form is an empty profile: every field optional', () => {
    expect(readProfileForm(EMPTY, TODAY, 'cm')).toEqual({
      kind: 'ok',
      data: { name: null, dateOfBirth: null, sex: null, heightMm: null, phone: null, address: null },
    });
  });

  it('names every field with a problem at once', () => {
    const result = readProfileForm({ ...EMPTY, year: '2010', month: '1', day: '1', height: '301', phone: '123', city: 'Pune' }, TODAY, 'cm');

    expect(result.kind === 'problems' && Object.keys(result.problems).sort()).toEqual(['address', 'dateOfBirth', 'height', 'phone']);
  });

  it('REQ-HOME-001 greets by the first word of the name, or the email’s name without one', () => {
    expect(greetingName('Synthetic Person', 'user@example.test')).toBe('Synthetic');
    expect(greetingName(null, 'user@example.test')).toBe('user');
    expect(greetingName('   ', 'user@example.test')).toBe('user');
  });
});
