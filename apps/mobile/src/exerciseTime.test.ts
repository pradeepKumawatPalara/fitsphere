import { spentSecondsOf, spentTexts, timeFromReps, timeHelp, totalReps, type SetText } from './workouts';

// The time worked out from the reps (docs/plans/exercise-time-per-rep.md): every rep of every set × the
// seconds one rep takes, rest not counted; and the time spent as minutes and seconds.

const set = (reps: string): SetText => ({ reps, weight: '', seconds: '' });

describe('totalReps', () => {
  it('adds the reps of every set, leaving out a set with none or with a number that cannot be used', () => {
    expect(totalReps([set('10'), set('8'), set('6')])).toBe(24);
    expect(totalReps([set('10'), set(''), set('x'), set('0'), set('201')])).toBe(10);
    expect(totalReps([set('')])).toBeNull();
  });
});

describe('timeFromReps', () => {
  it('is the total reps × the seconds one rep takes, rest not counted', () => {
    expect(timeFromReps([set('10'), set('10'), set('10')], 4)).toBe(120);
    expect(timeFromReps([set('15'), set('15'), set('15')], 3)).toBe(135);
  });

  it('is null with no reps, or no time for one rep (the types not done in reps, an exercise of the user’s own)', () => {
    expect(timeFromReps([set('')], 4)).toBeNull();
    expect(timeFromReps([set('10')], null)).toBeNull();
    expect(timeFromReps([set('10')], undefined)).toBeNull();
  });

  it('never goes past 24 hours', () => {
    expect(timeFromReps([set('200')], 30)).toBe(6000);
  });
});

describe('spentSecondsOf and spentTexts', () => {
  it('reads minutes and seconds, either empty, as one time; empty when neither is typed', () => {
    expect(spentSecondsOf({ spentMinutes: '2', spentSeconds: '05' })).toBe(125);
    expect(spentSecondsOf({ spentMinutes: '', spentSeconds: '40' })).toBe(40);
    expect(spentSecondsOf({ spentMinutes: '3', spentSeconds: '' })).toBe(180);
    expect(spentSecondsOf({ spentMinutes: '', spentSeconds: '' })).toBe('empty');
  });

  it('refuses seconds above 59, a time of 0, one past 24 hours, and what is not a number', () => {
    expect(spentSecondsOf({ spentMinutes: '1', spentSeconds: '75' })).toBe('invalid');
    expect(spentSecondsOf({ spentMinutes: '0', spentSeconds: '0' })).toBe('invalid');
    expect(spentSecondsOf({ spentMinutes: '1441', spentSeconds: '0' })).toBe('invalid');
    expect(spentSecondsOf({ spentMinutes: 'x', spentSeconds: '' })).toBe('invalid');
  });

  it('writes a time as the boxes show it', () => {
    expect(spentTexts(125)).toEqual({ spentMinutes: '2', spentSeconds: '05' });
    expect(spentTexts(40)).toEqual({ spentMinutes: '0', spentSeconds: '40' });
    expect(spentTexts(600)).toEqual({ spentMinutes: '10', spentSeconds: '00' });
  });
});

describe('timeHelp', () => {
  it('says how the time was worked out, or what the arrow brings back; nothing without a time from the reps', () => {
    expect(timeHelp(true, 30, 4, 120)).toBe('From 30 reps × 4 s = 2 min, rest not counted. Type your own time to replace it.');
    expect(timeHelp(false, 1, 3, 3)).toBe('Your own time. The arrow brings back 1 rep × 3 s = 0:03.');
    expect(timeHelp(true, null, 4, null)).toBeNull();
    expect(timeHelp(true, 10, null, null)).toBeNull();
  });
});
