import type { WorkoutTimer } from '@fitsphere/shared';
import {
  finishTimer,
  listedWorkouts,
  pauseTimer,
  resumeTimer,
  spokenDuration,
  startTimer,
  timerLine,
  timerSeconds,
  timerState,
} from './workouts';

// The workout timer's sums (D-71): each step from the time given, pauses left out, a clock set back
// taking nothing away, and 24 hours at most.

const T0 = new Date('2026-10-28T03:30:00.000Z');
const after = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

describe('D-71 the workout timer', () => {
  it('starts running from the time given, at 0:00', () => {
    const timer = startTimer(T0);

    expect(timer).toEqual({ startedAt: T0.toISOString(), countedSeconds: 0, runningSince: T0.toISOString(), doneAt: null });
    expect(timerState(timer)).toBe('running');
    expect(timerSeconds(timer, T0)).toBe(0);
    expect(timerSeconds(timer, after(754.9))).toBe(754);
  });

  it('a pause stops the count; the time paused is not counted once it resumes', () => {
    const paused = pauseTimer(startTimer(T0), after(600));
    expect(paused).toMatchObject({ countedSeconds: 600, runningSince: null, doneAt: null });
    expect(timerState(paused)).toBe('paused');
    expect(timerSeconds(paused, after(5_000))).toBe(600);

    const resumed = resumeTimer(paused, after(900));
    expect(timerState(resumed)).toBe('running');
    expect(timerSeconds(resumed, after(1_054))).toBe(754);
  });

  it('Mark done stops it for good with the total; Resume after it counts on', () => {
    const done = finishTimer(resumeTimer(pauseTimer(startTimer(T0), after(600)), after(900)), after(1_054));
    expect(done).toEqual({
      startedAt: T0.toISOString(),
      countedSeconds: 754,
      runningSince: null,
      doneAt: after(1_054).toISOString(),
    });
    expect(timerState(done)).toBe('done');
    expect(timerSeconds(done, after(99_999))).toBe(754);

    const again = resumeTimer(done, after(2_000));
    expect(again).toMatchObject({ countedSeconds: 754, runningSince: after(2_000).toISOString(), doneAt: null });
    expect(timerSeconds(again, after(2_010))).toBe(764);
  });

  it('a clock set back takes nothing away, and it counts 24 hours at most', () => {
    const running: WorkoutTimer = { startedAt: T0.toISOString(), countedSeconds: 120, runningSince: T0.toISOString(), doneAt: null };
    expect(timerSeconds(running, after(-3_600))).toBe(120);
    expect(timerSeconds(running, after(3 * 24 * 3_600))).toBe(86_400);
    expect(pauseTimer(running, after(3 * 24 * 3_600)).countedSeconds).toBe(86_400);
  });

  it('a workout’s row says its timer, or nothing with none', () => {
    expect(timerLine(null, T0)).toBeNull();
    expect(timerLine(startTimer(after(-754)), T0)).toBe('Running · 12:34');
    expect(timerLine(pauseTimer(startTimer(T0), after(1_868)), after(9_000))).toBe('Paused · 31:08');
    expect(timerLine(finishTimer(startTimer(T0), after(3_855)), after(9_000))).toBe('Done · 1:04:15');
    expect(spokenDuration(754)).toBe('12 minutes 34 seconds');
    expect(spokenDuration(3_661)).toBe('1 hour 1 minute 1 second');
  });

  it('a workout whose timer has started is listed before its first exercise; one with neither is not', () => {
    const workouts = [
      { id: 'a', exercises: [], timer: null },
      { id: 'b', exercises: [], timer: startTimer(T0) },
      { id: 'c', exercises: [{}], timer: null },
    ];
    expect(listedWorkouts(workouts).map((workout) => workout.id)).toEqual(['b', 'c']);
    expect(listedWorkouts(workouts, 'a').map((workout) => workout.id)).toEqual(['a', 'b', 'c']);
  });
});
