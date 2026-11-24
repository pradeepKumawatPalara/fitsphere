import { readCardView, workoutBurn } from './homeCardView';

const burn = (kcal: number, estimated = false) => ({ calories: { kcal, estimated } });
const noCalories = { calories: null };
const workout = (id: string, recordedAt: string, exercises: { calories: { kcal: number; estimated: boolean } | null }[]) => ({
  id,
  recordedAt,
  exercises,
});

describe('readCardView', () => {
  it('opens on Calories when nothing, or something unknown, was kept', () => {
    expect(readCardView(null)).toBe('calories');
    expect(readCardView('')).toBe('calories');
    expect(readCardView('meals')).toBe('calories');
  });

  it('reads the kept choices', () => {
    expect(readCardView('calories')).toBe('calories');
    expect(readCardView('workout')).toBe('workout');
  });
});

describe('workoutBurn', () => {
  it('numbers the workouts in the order they were started, as Training does', () => {
    const result = workoutBurn([
      workout('b', '2026-10-28T10:00:00Z', [burn(220)]),
      workout('a', '2026-10-28T04:00:00Z', [burn(300), burn(50)]),
    ]);
    expect(result.rows.map((row) => [row.id, row.name, row.exercises])).toEqual([
      ['a', 'Workout 1', '2 exercises'],
      ['b', 'Workout 2', '1 exercise'],
    ]);
  });

  it('leaves out a workout with no exercise, so the numbers match Training', () => {
    const result = workoutBurn([workout('empty', '2026-10-28T03:00:00Z', []), workout('a', '2026-10-28T04:00:00Z', [burn(100)])]);
    expect(result.rows.map((row) => row.name)).toEqual(['Workout 1']);
    expect(result.rows.map((row) => row.id)).toEqual(['a']);
  });

  it('adds the day up and sizes each bar against the biggest workout', () => {
    const result = workoutBurn([workout('a', '2026-10-28T04:00:00Z', [burn(300)]), workout('b', '2026-10-28T10:00:00Z', [burn(150)])]);
    expect(result.kcal).toBe(450);
    expect(result.rows.map((row) => row.share)).toEqual([1, 0.5]);
  });

  it('shows a workout with no calories as nothing, and counts only what has calories', () => {
    const result = workoutBurn([workout('a', '2026-10-28T04:00:00Z', [noCalories]), workout('b', '2026-10-28T10:00:00Z', [burn(200)])]);
    expect(result.rows[0]).toMatchObject({ kcal: null, share: 0 });
    expect(result.rows[1]).toMatchObject({ kcal: 200, share: 1 });
    expect(result.kcal).toBe(200);
  });

  it('has no total when no workout has calories', () => {
    const result = workoutBurn([workout('a', '2026-10-28T04:00:00Z', [noCalories])]);
    expect(result.kcal).toBeNull();
    expect(result.estimated).toBe(false);
  });

  it('says when any of it is estimated', () => {
    expect(workoutBurn([workout('a', '2026-10-28T04:00:00Z', [burn(100, false), burn(50, true)])]).estimated).toBe(true);
    expect(workoutBurn([workout('a', '2026-10-28T04:00:00Z', [burn(100)])]).estimated).toBe(false);
  });

  it('has no rows on a day with no workout', () => {
    expect(workoutBurn([])).toEqual({ rows: [], kcal: null, estimated: false });
  });
});
