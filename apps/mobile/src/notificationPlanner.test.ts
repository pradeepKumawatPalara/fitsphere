import { missedReminders, planReminders, type PlanInput } from './notificationPlanner';
import { DEFAULT_REMINDERS, parseReminders, shiftTime, timeLabel, type ReminderSettings } from './notificationSettings';

// Reminders (ADR-0014, REQ-NOT-002): which, and when, on a fake clock. Monday 23 November 2026, 12:00 IST.
// Synthetic data only.

const NOW = new Date('2026-11-23T06:30:00Z');
const TODAY = '2026-11-23';

const settings = (change: (s: ReminderSettings) => void): ReminderSettings => {
  const s = structuredClone(DEFAULT_REMINDERS);
  change(s);
  return s;
};

const input = (s: ReminderSettings, rest: Partial<PlanInput> = {}): PlanInput => ({
  settings: s,
  now: NOW,
  mealsByDay: {},
  workoutDays: [],
  lastMeasurementsDay: '2026-11-22',
  lastRemindedDay: null,
  lastActiveDay: '2026-11-23',
  lastNudgeDay: null,
  ...rest,
});

const at = (items: { at: Date; kind: string }[]) => items.map((item) => `${item.kind} ${item.at.toISOString().slice(0, 16)}`);

describe('nothing is on until the user turns it on', () => {
  it('plans nothing with the defaults', () => {
    expect(planReminders(input(DEFAULT_REMINDERS), TODAY)).toEqual([]);
    expect(missedReminders(input(DEFAULT_REMINDERS), TODAY)).toEqual([]);
  });
});

describe('meal reminders', () => {
  const lunch = settings((s) => (s.meals.lunch.enabled = true));

  it('one a day for the next 7 days, at IST time, only those still ahead', () => {
    const planned = planReminders(input(lunch), TODAY);

    expect(planned).toHaveLength(7);
    // 13:00 IST is 07:30 UTC, on each day from today.
    expect(at(planned)[0]).toBe('meal_lunch 2026-11-23T07:30');
    expect(at(planned)[6]).toBe('meal_lunch 2026-11-29T07:30');
  });

  it('leaves out today once the time has passed', () => {
    const late = new Date('2026-11-23T08:30:00Z'); // 14:00 IST

    const planned = planReminders({ ...input(lunch), now: late }, TODAY);

    expect(planned).toHaveLength(6);
    expect(at(planned)[0]).toBe('meal_lunch 2026-11-24T07:30');
  });

  it('skips a meal that already has food, only for that day', () => {
    const planned = planReminders(input(lunch, { mealsByDay: { [TODAY]: ['lunch'] } }), TODAY);

    expect(planned).toHaveLength(6);
    expect(at(planned)[0]).toBe('meal_lunch 2026-11-24T07:30');
  });

  it("another meal's food does not skip it", () => {
    expect(planReminders(input(lunch, { mealsByDay: { [TODAY]: ['breakfast'] } }), TODAY)).toHaveLength(7);
  });
});

describe('workout reminders', () => {
  const workout = settings((s) => (s.workout.enabled = true)); // Monday, Wednesday, Friday at 18:00

  it('on the chosen days only, within the 7 days', () => {
    expect(at(planReminders(input(workout), TODAY))).toEqual([
      'workout_reminder 2026-11-23T12:30',
      'workout_reminder 2026-11-25T12:30',
      'workout_reminder 2026-11-27T12:30',
    ]);
  });

  it('skips a day that already has a workout', () => {
    const planned = planReminders(input(workout, { workoutDays: [TODAY] }), TODAY);

    expect(at(planned)[0]).toBe('workout_reminder 2026-11-25T12:30');
  });
});

describe('measurements due', () => {
  const due = settings((s) => (s.measurements.enabled = true)); // 09:00

  it("is not made before they are due (Home's rule: more than 7 days since the last)", () => {
    // Logged today: due from 1 December, beyond the 7 days planned.
    expect(planReminders(input(due, { lastMeasurementsDay: TODAY }), TODAY)).toEqual([]);
  });

  it('is made on the day they fall due, when that is within the 7 days', () => {
    // Logged 20 November: more than 7 days on 28 November.
    expect(at(planReminders(input(due, { lastMeasurementsDay: '2026-11-20' }), TODAY))).toEqual(['measurements_due 2026-11-28T03:30']);
  });

  it('is made once, on the first day it is due and its time is ahead', () => {
    // Last logged 10 Nov: due now; 09:00 has passed today, so tomorrow.
    const planned = planReminders(input(due, { lastMeasurementsDay: '2026-11-10' }), TODAY);

    expect(at(planned)).toEqual(['measurements_due 2026-11-24T03:30']);
  });

  it('is made when none was ever logged', () => {
    expect(planReminders(input(due, { lastMeasurementsDay: null }), TODAY)).toHaveLength(1);
  });

  it('is not made again within a week of the last one, dismissed or not', () => {
    const planned = planReminders(input(due, { lastMeasurementsDay: '2026-11-10', lastRemindedDay: '2026-11-20' }), TODAY);

    expect(at(planned)).toEqual(['measurements_due 2026-11-27T03:30']);
  });
});

describe('what was missed while the app was closed', () => {
  it("yesterday's and today's reminders that passed and were not pointless, once each", () => {
    const s = settings((x) => {
      x.meals.breakfast.enabled = true;
      x.meals.lunch.enabled = true;
      x.measurements.enabled = true;
    });
    const missed = missedReminders(
      input(s, { lastMeasurementsDay: null, mealsByDay: { [TODAY]: ['breakfast'], '2026-11-22': [] } }),
      TODAY,
    );

    // Yesterday's breakfast and lunch; today's breakfast has food; today's lunch is still ahead.
    expect(at(missed)).toEqual([
      'meal_breakfast 2026-11-22T03:00',
      'measurements_due 2026-11-22T03:30',
      'meal_lunch 2026-11-22T07:30',
    ]);
  });
});

describe('settings', () => {
  it('read back, and a bad value falls back to its default', () => {
    expect(parseReminders(null)).toEqual(DEFAULT_REMINDERS);
    expect(parseReminders('not json')).toEqual(DEFAULT_REMINDERS);
    const read = parseReminders(JSON.stringify({ workout: { enabled: true, days: [5, 1, 1, 9], time: '25:00' }, meals: { lunch: { enabled: true, time: '12:15' } } }));
    expect(read.workout).toEqual({ enabled: true, days: [1, 5], time: '18:00' });
    expect(read.meals.lunch).toEqual({ enabled: true, time: '12:15' });
    expect(read.meals.dinner.enabled).toBe(false);
  });

  it('moves a time round the clock and says it in words', () => {
    expect(shiftTime('23:30', 30)).toBe('00:00');
    expect(shiftTime('00:00', -30)).toBe('23:30');
    expect(timeLabel('13:00')).toBe('1:00 pm');
    expect(timeLabel('00:30')).toBe('12:30 am');
  });
});

describe('step 4: quiet hours, the daily cap and the inactivity nudge', () => {
  it('quiet hours drop a reminder set between 22:00 and 07:00, and keep one at 07:00 or 21:30', () => {
    const on = settings((s) => {
      s.meals.breakfast = { enabled: true, time: '06:30' };
      s.meals.lunch = { enabled: true, time: '07:00' };
      s.meals.dinner = { enabled: true, time: '22:00' };
      s.meals.snack = { enabled: true, time: '21:30' };
    });
    const kinds = planReminders(input(on), TODAY).filter((item) => item.day === '2026-11-24').map((item) => item.kind);
    expect(kinds).toEqual(['meal_lunch', 'meal_snack']);
  });

  it('at most 4 a day, the earliest kept', () => {
    const on = settings((s) => {
      for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as const) s.meals[slot].enabled = true;
      s.workout = { enabled: true, days: [2], time: '19:00' };
      s.measurements = { enabled: true, time: '10:00' };
    });
    const tuesday = planReminders(input(on, { lastMeasurementsDay: null }), TODAY).filter((item) => item.day === '2026-11-24');
    expect(tuesday).toHaveLength(4);
    expect(tuesday.map((item) => item.kind)).not.toContain('meal_dinner'); // 20:00, the latest, is the one left out
  });

  it('the nudge is X days after the last open, at its time, once in a stretch', () => {
    const on = settings((s) => (s.nudge = { enabled: true, afterDays: 3, time: '18:30' }));
    expect(at(planReminders(input(on), TODAY))).toEqual(['inactive 2026-11-26T13:00']);
    // Nudged the day before it would fall: not again until 3 days have passed.
    expect(planReminders(input(on, { lastNudgeDay: '2026-11-25' }), TODAY)).toEqual([]);
  });

  it('a nudge that was due while the app was closed is listed once the user opens it again', () => {
    const on = settings((s) => (s.nudge = { enabled: true, afterDays: 3, time: '09:00' }));
    const missed = missedReminders(input(on, { lastActiveDay: '2026-11-19' }), TODAY);
    expect(missed.map((item) => item.kind)).toEqual(['inactive']);
    expect(missedReminders(input(on, { lastActiveDay: '2026-11-19', lastNudgeDay: TODAY }), TODAY)).toEqual([]);
  });

  it('reads the goals and nudge from saved text, with defaults off and 3 days', () => {
    const read = parseReminders(JSON.stringify({ nudge: { enabled: true, afterDays: 9 }, goals: { dailyTarget: true } }));
    expect(read.goals).toEqual({ dailyTarget: true, weeklyWorkouts: false });
    expect(read.nudge).toEqual({ enabled: true, afterDays: 3, time: '18:30' });
    expect(parseReminders(null).goals).toEqual({ dailyTarget: false, weeklyWorkouts: false });
  });
});
