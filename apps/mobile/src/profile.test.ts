import { ADDRESS_PLACE_MAX, ADDRESS_PLACE_PATTERN } from '@fitsphere/shared';
import { formFromProfile, greetingName, heightRange, INDIAN_STATES, listedState, phoneDigits, readProfileForm, UNION_TERRITORIES } from './profile';

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

describe('D-109 the State list', () => {
  it('holds the 28 states and the 8 union territories, each once, in the order of the alphabet, each fitting the address rules', () => {
    expect(INDIAN_STATES).toHaveLength(28);
    expect(UNION_TERRITORIES).toHaveLength(8);
    for (const group of [INDIAN_STATES, UNION_TERRITORIES]) expect([...group]).toEqual([...group].sort((a, b) => a.localeCompare(b)));
    const all = [...INDIAN_STATES, ...UNION_TERRITORIES];
    expect(new Set(all).size).toBe(36);
    for (const state of all) {
      expect(state.length).toBeLessThanOrEqual(ADDRESS_PLACE_MAX);
      expect(state).toMatch(ADDRESS_PLACE_PATTERN);
    }
  });

  it('reads a state typed before the list, ignoring case, spaces and marks; null when it is not on the list', () => {
    expect(listedState('tamil  nadu')).toBe('Tamil Nadu');
    expect(listedState('Jammu & Kashmir')).toBe('Jammu and Kashmir');
    expect(listedState('NCT Delhi')).toBeNull();
    expect(listedState('Jammu-Kashmir')).toBeNull();
    expect(formFromProfile({ ...EMPTY_PROFILE, address: { line1: '12 Example Lane', line2: null, city: 'Pune', state: 'maharashtra', pinCode: '411001' } }, 'cm').state).toBe('Maharashtra');
    expect(formFromProfile({ ...EMPTY_PROFILE, address: { line1: '12 Example Lane', line2: null, city: 'Leh', state: 'Jammu-Kashmir', pinCode: '194101' } }, 'cm').state).toBe('Jammu-Kashmir');
  });
});

const EMPTY_PROFILE = { name: null, dateOfBirth: null, sex: null, heightMm: null, phone: null, address: null, photoMediaId: null };
