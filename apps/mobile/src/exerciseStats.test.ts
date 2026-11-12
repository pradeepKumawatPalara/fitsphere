import type { CardioExercise, ExerciseSet, SetsExercise } from '@fitsphere/shared';
import {
  effortKindOf,
  exerciseBests,
  exerciseRecords,
  exerciseSessions,
  graphChange,
  graphPoints,
  historyCard,
  oneRepMax,
  oneRmText,
  rangeStart,
  sessionsSummary,
  type ExerciseWorkout,
} from './exerciseStats';

// An exercise's progress and history (D-82), with the canvas's synthetic workouts: a dumbbell shrug
// from 50 kg to 70 kg, and nine runs. Today is Wed 11 Nov 2026.

const TODAY = '2026-11-11';

function lift(name: string, sets: [reps: number, kg: number][]): SetsExercise {
  return {
    kind: 'sets',
    name,
    sets: sets.map(([reps, kg]): ExerciseSet => ({ reps, weightGrams: kg * 1000, seconds: null })),
    durationSeconds: null,
    calories: null,
    averageHeartRateBpm: null,
    highestHeartRateBpm: null,
    note: null,
  };
}

function run(km: number, seconds: number): CardioExercise {
  return {
    kind: 'cardio',
    name: 'Running',
    durationSeconds: seconds,
    distanceMetres: km * 1000,
    speedMetresPerHour: null,
    inclinePermille: null,
    level: null,
    calories: null,
    averageHeartRateBpm: null,
    highestHeartRateBpm: null,
    note: null,
  };
}

let n = 0;
function workout(day: string, ...exercises: ExerciseWorkout['exercises']): ExerciseWorkout {
  n += 1;
  return { id: `w${n}`, day, recordedAt: `${day}T06:00:0${n % 10}.000Z`, exercises };
}

const SHRUGS: ExerciseWorkout[] = [
  workout('2026-10-30', lift('Dumbbell shrug', [[10, 60], [8, 70], [8, 70]]), lift('Push-up', [[15, 0.1]])),
  workout('2026-10-16', lift('dumbbell-shrug', [[8, 65], [8, 65], [8, 65]])),
  workout('2026-10-09', lift('Dumbbell Shrugs', [[10, 60], [10, 60], [10, 60]])),
  workout('2026-10-02', lift('Dumbbell shrug', [[8, 60], [8, 60], [6, 60]])),
  workout('2026-09-21', lift('DB shrug', [[10, 55], [10, 55], [10, 55]])),
  workout('2026-09-14', lift('Dumbbell shrug', [[10, 50], [10, 50], [10, 50]])),
];
const NAMES = ['Dumbbell shrug', 'DB shrug'];

describe('D-82 an exercise’s workouts', () => {
  it('finds it by its name or another name, ignoring case, hyphens and doubled letters, newest first', () => {
    const sessions = exerciseSessions(SHRUGS, NAMES);
    // "Dumbbell Shrugs" is another name, not this one.
    expect(sessions.map((session) => session.day)).toEqual(['2026-10-30', '2026-10-16', '2026-10-02', '2026-09-21', '2026-09-14']);
    expect(exerciseSessions(SHRUGS, ['Push up']).map((session) => session.day)).toEqual(['2026-10-30']);
    expect(exerciseSessions(SHRUGS, ['Squat'])).toEqual([]);
  });

  it('numbers a workout only when its day has several with an exercise, in the order started', () => {
    const day = [
      { id: 'a', day: '2026-11-10', recordedAt: '2026-11-10T05:00:00.000Z', exercises: [lift('Squat', [[5, 100]])] },
      { id: 'b', day: '2026-11-10', recordedAt: '2026-11-10T04:00:00.000Z', exercises: [lift('Bench press', [[5, 60]])] },
      { id: 'c', day: '2026-11-10', recordedAt: '2026-11-10T03:00:00.000Z', exercises: [] },
      { id: 'd', day: '2026-11-09', recordedAt: '2026-11-09T05:00:00.000Z', exercises: [lift('Squat', [[5, 95]])] },
    ];
    expect(exerciseSessions(day, ['Squat']).map((session) => [session.day, session.workoutNumber])).toEqual([
      ['2026-11-10', 2],
      ['2026-11-09', null],
    ]);
  });
});

describe('D-82 a lift’s numbers', () => {
  const sessions = exerciseSessions(SHRUGS, ['Dumbbell shrug', 'DB shrug', 'Dumbbell Shrugs']);

  it('estimates a one-rep max from 1 to 12 reps, to 0.5 kg or 1 lb', () => {
    expect(oneRepMax({ reps: 8, weightGrams: 70_000, seconds: null })).toBeCloseTo(88_666.7, 0);
    expect(oneRepMax({ reps: 1, weightGrams: 100_000, seconds: null })).toBe(100_000);
    expect(oneRepMax({ reps: 13, weightGrams: 50_000, seconds: null })).toBeNull();
    expect(oneRepMax({ reps: 10, weightGrams: null, seconds: null })).toBeNull();
    expect(oneRmText(88_666.7, 'kg')).toBe('88.5');
    expect(oneRmText(88_666.7, 'lb')).toBe('195.0');
  });

  it('gives the records with the day each was made, and the workouts in a line', () => {
    expect(effortKindOf(sessions[0]!.exercise)).toBe('weight_reps');
    // The owner, 2026-11-12: the cards are History's three bests.
    expect(exerciseRecords(sessions, 'weight_reps', 'kg')).toEqual([
      { label: 'Estimated 1RM', value: '88.5', unit: 'kg', day: 'Fri 30 Oct' },
      { label: 'Heaviest', value: '70.0', unit: 'kg', day: 'Fri 30 Oct' },
      { label: 'Best volume', value: '1,800', unit: 'kg', day: 'Fri 9 Oct' },
    ]);
    expect(exerciseRecords(sessions, 'weight_reps', 'lb')[1]).toMatchObject({ value: '154.3', unit: 'lb' });
    expect(sessionsSummary(sessions)).toBe('6 workouts · first on Mon 14 Sep · last on Fri 30 Oct');
    expect(sessionsSummary(sessions.slice(0, 1))).toBe('1 workout · Fri 30 Oct');
    expect(exerciseBests(sessions, 'weight_reps', 'kg').map((best) => [best.label, best.short, best.value, best.day])).toEqual([
      ['Best 1RM', '1RM', '88.5', 'Fri 30 Oct'],
      ['Heaviest', 'Heaviest', '70.0', 'Fri 30 Oct'],
      ['Best volume', 'Volume', '1,800', 'Fri 9 Oct'],
    ]);
  });

  it('draws the graph from the range’s first day, with the change since then', () => {
    const points = graphPoints(sessions, 'weight_reps', 'oneRm', rangeStart('12W', TODAY), 'kg');
    expect(points).toEqual([
      { day: '2026-09-14', value: 66.5 },
      { day: '2026-09-21', value: 73.5 },
      { day: '2026-10-02', value: 76 },
      { day: '2026-10-09', value: 80 },
      { day: '2026-10-16', value: 82.5 },
      { day: '2026-10-30', value: 88.5 },
    ]);
    expect(graphChange(points, 'oneRm', 'kg')).toBe('up 22.0 kg since Mon 14 Sep');
    expect(graphPoints(sessions, 'weight_reps', 'oneRm', rangeStart('4W', TODAY), 'kg').map((point) => point.day)).toEqual(['2026-10-16', '2026-10-30']);
    expect(graphPoints(sessions, 'weight_reps', 'volume', null, 'kg').at(-1)).toEqual({ day: '2026-10-30', value: 1720 });
    expect(graphPoints(sessions, 'weight_reps', 'heaviest', null, 'kg').at(-1)).toEqual({ day: '2026-10-30', value: 70 });
    expect(graphChange([{ day: '2026-10-01', value: 50 }, { day: '2026-10-08', value: 50 }], 'heaviest', 'kg')).toBe('the same as on Thu 1 Oct');
  });

  it('cards each workout with the bests it holds as tags, its sets, the best in full, its volume and 1RM', () => {
    const bests = exerciseBests(sessions, 'weight_reps', 'kg');
    const card = historyCard(sessions[0]!, 'weight_reps', 'kg', bests);
    expect(card.tags.map((tag) => tag.short)).toEqual(['1RM', 'Heaviest']);
    expect({ ...card, tags: [] }).toEqual({
      title: 'Fri 30 Oct',
      tags: [],
      rows: [
        { label: 'Set 1', value: '10 × 60.0 kg', best: false },
        { label: 'Set 2', value: '8 × 70.0 kg', best: true },
        { label: 'Set 3', value: '8 × 70.0 kg', best: false },
      ],
      main: '',
      footer: 'Volume 1,720 kg · Est. 1RM 88.5 kg',
      aria: 'Fri 30 Oct: Set 1, 10 × 60.0 kg; Set 2, 8 × 70.0 kg; Set 3, 8 × 70.0 kg, Best 1RM, Heaviest',
    });
    const volume = historyCard(sessions[2]!, 'weight_reps', 'kg', bests);
    expect(volume.rows).toEqual([{ label: '3 sets', value: '10 × 60.0 kg', best: true }]);
    expect(volume.tags.map((tag) => tag.short)).toEqual(['Volume']);
    expect(historyCard(sessions[1]!, 'weight_reps', 'kg', bests).tags).toEqual([]);
  });
});

describe('D-82 running’s numbers', () => {
  const runs = [
    workout('2026-11-08', run(8, 2720)),
    workout('2026-11-01', run(7.5, 2520)),
    workout('2026-10-25', run(8, 2784)),
    workout('2026-10-18', run(5, 1620)),
    workout('2026-09-13', run(5, 1800)),
  ];
  const sessions = exerciseSessions(runs, ['Running', 'run']);

  it('gives the longest distance (the faster on a tie), the fastest pace and the workouts', () => {
    expect(effortKindOf(sessions[0]!.exercise)).toBe('distance');
    expect(exerciseRecords(sessions, 'distance', 'kg')).toEqual([
      { label: 'Longest distance', value: '8.00', unit: 'km', day: 'Sun 8 Nov' },
      { label: 'Fastest pace', value: '5:24', unit: '/km', day: 'Sun 18 Oct' },
      { label: 'Workouts', value: '5', unit: '', day: 'since Sun 13 Sep' },
    ]);
    expect(exerciseBests(sessions, 'distance', 'kg').map((best) => [best.short, best.value, best.unit, best.day])).toEqual([
      ['Longest', '8.00', 'km', 'Sun 8 Nov'],
      ['Fastest', '5:24', '/km', 'Sun 18 Oct'],
    ]);
  });

  it('cards a run with its time and distance, its speed and pace under them', () => {
    const card = historyCard(sessions[0]!, 'distance', 'kg', exerciseBests(sessions, 'distance', 'kg'));
    expect(card).toMatchObject({ rows: [], main: '45:20 · 8.00 km', footer: '10.6 km/h · 5:40 /km' });
    expect(card.tags.map((tag) => tag.short)).toEqual(['Longest']);
    expect(graphPoints(sessions, 'distance', 'distance', null, 'kg').map((point) => point.value)).toEqual([5, 5, 8, 7.5, 8]);
    expect(graphChange(graphPoints(sessions, 'distance', 'distance', null, 'kg'), 'distance', 'kg')).toBe('up 3.00 km since Sun 13 Sep');
  });
});

describe('D-82 the other kinds', () => {
  it('counts reps, holds and the time of a class', () => {
    const pushUps = exerciseSessions(
      [workout('2026-11-02', { ...lift('Push-up', []), sets: [{ reps: 15, weightGrams: null, seconds: null }, { reps: 12, weightGrams: null, seconds: null }] })],
      ['Push-up'],
    );
    expect(effortKindOf(pushUps[0]!.exercise)).toBe('reps');
    expect(exerciseRecords(pushUps, 'reps', 'kg').slice(0, 2)).toEqual([
      { label: 'Most reps', value: '15', unit: 'reps', day: 'Mon 2 Nov' },
      { label: 'Best session', value: '27', unit: 'reps', day: 'Mon 2 Nov' },
    ]);
    expect(historyCard(pushUps[0]!, 'reps', 'kg', []).footer).toBe('Total 27 reps');

    const planks = exerciseSessions(
      [workout('2026-11-03', { ...lift('Plank', []), sets: [{ reps: null, weightGrams: null, seconds: 60 }, { reps: null, weightGrams: null, seconds: 45 }] })],
      ['Plank'],
    );
    expect(effortKindOf(planks[0]!.exercise)).toBe('time');
    expect(exerciseRecords(planks, 'time', 'kg')[0]).toEqual({ label: 'Longest', value: '1:00', unit: '', day: 'Tue 3 Nov' });
    expect(historyCard(planks[0]!, 'time', 'kg', []).footer).toBe('Total 1:45');

    const yoga = exerciseSessions([workout('2026-11-04', { ...run(1, 1), name: 'Yoga', distanceMetres: null, durationSeconds: 3600 })], ['Yoga']);
    expect(effortKindOf(yoga[0]!.exercise)).toBe('duration');
    expect(exerciseRecords(yoga, 'duration', 'kg')[1]).toEqual({ label: 'Total time', value: '1:00:00', unit: '', day: 'since Wed 4 Nov' });
  });
});
