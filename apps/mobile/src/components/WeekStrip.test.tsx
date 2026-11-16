import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { stripStartFor, stripStarts } from '../navigation/SelectedDayProvider';
import { LIGHT_COLORS } from '../theme';
import { swipeStep, WeekStrip } from './WeekStrip';

// The date strip shows a week, Monday to Sunday, and a swipe moves it exactly one week, however long or
// fast (REQ-HOME-002, D-79; the owner, 2026-11-16), within the phone's 90 days (D-23); this week's days
// after today are greyed and cannot be picked (Q-017). The arrows move it a week too.

const TODAY = '2026-10-28'; // a Wednesday
const FIRST_DAY = '2026-10-07'; // a Wednesday too
const WIDTH = 300;

function strip(start: string, onShow: (start: string) => void, onSelect: (day: string) => void = jest.fn()) {
  return <WeekStrip today={TODAY} firstDay={FIRST_DAY} selected={TODAY} start={start} onSelect={onSelect} onShow={onShow} />;
}

/** The strip as the screens hold it: the week it shows moves to the week it asks for. */
function Screen({ first, onShow, onSelect }: { first: string; onShow: (start: string) => void; onSelect: (day: string) => void }) {
  const [start, setStart] = useState(first);
  return strip(
    start,
    (next) => {
      onShow(next);
      setStart(next);
    },
    onSelect,
  );
}

/** Renders the strip and lays it out, so its weeks become pages. */
async function renderStrip(start = '2026-10-26', onSelect = jest.fn()) {
  const onShow = jest.fn();
  await render(<Screen first={start} onShow={onShow} onSelect={onSelect} />);
  await fireEvent(screen.getByTestId('week-pages'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 64 } } });
  return onShow;
}

/** A finger on the strip at `x`, `ms` milliseconds into the swipe. */
function finger(x: number, ms: number, y = 30) {
  return { nativeEvent: { pageX: x, pageY: y, timestamp: ms, touches: [] } };
}

const pages = () => screen.getByTestId('week-pages');

/** A finger comes down at `fromX`, moves sideways to `toX` over `ms` milliseconds, and lifts at `liftMs`. */
async function swipe(fromX: number, toX: number, ms = 1000, liftMs = ms) {
  await act(async () => pages().props.onTouchStart(finger(fromX, 0)));
  const taken = fromX + Math.sign(toX - fromX) * 12;
  expect(pages().props.onMoveShouldSetResponder(finger(taken, 10))).toBe(true);
  await act(async () => pages().props.onResponderGrant(finger(taken, 10)));
  await act(async () => pages().props.onResponderMove(finger(toX, ms)));
  await act(async () => pages().props.onResponderRelease(finger(toX, liftMs)));
}

/** The week slides into place. */
async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
}

/** How far the row of weeks is moved. */
function rowOffset(): unknown {
  return StyleSheet.flatten(screen.getByTestId('week-row').props.style).transform?.[0];
}

describe('REQ-HOME-002 the date strip, Monday to Sunday (D-79)', () => {
  it('D-23 has the weeks from the one holding the first of the 90 days to this week, by their Mondays', () => {
    expect(stripStarts(FIRST_DAY, TODAY)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  });

  it('D-79 on a Monday, this week is its only page', () => {
    expect(stripStarts('2026-10-26', '2026-10-26')).toEqual(['2026-10-26']);
  });

  it.each([
    ['2026-10-28', '2026-10-26'],
    ['2026-10-26', '2026-10-26'],
    ['2026-11-01', '2026-10-26'],
    ['2026-10-25', '2026-10-19'],
    ['2026-10-07', '2026-10-05'],
  ])('D-79 a day, %s, is shown in the week from Monday %s', (day, start) => {
    expect(stripStartFor(day)).toBe(start);
  });

  it('Q-017 shows this week to Sunday; the days after today are greyed and cannot be picked', async () => {
    const onSelect = jest.fn();
    await renderStrip('2026-10-26', onSelect);

    expect(screen.getByRole('button', { name: 'Monday 26 Oct' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Wednesday 28 Oct, today' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Thursday 29 Oct, not available' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sunday 1 Nov, not available' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Thursday 22 Oct/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Later days' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Earlier days' })).toBeEnabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Friday 30 Oct, not available' }));
    expect(onSelect).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Tuesday 27 Oct' }));
    expect(onSelect).toHaveBeenCalledWith('2026-10-27');
  });

  it('D-23 in the oldest week, the days before the first of the 90 are greyed, and "Earlier days" stops', async () => {
    await renderStrip('2026-10-05');

    expect(screen.getByRole('button', { name: 'Monday 5 Oct, not available' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tuesday 6 Oct, not available' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Wednesday 7 Oct' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Sunday 11 Oct' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Earlier days' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Later days' })).toBeEnabled();
  });

  it('follows days shown another way; only the week shown is there for screen readers', async () => {
    const onShow = jest.fn();
    await render(strip('2026-10-26', onShow));
    await fireEvent(pages(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 64 } } });
    // The row opens on this week, the fourth: 7 days, not the other weeks' 21; the arrows are "Earlier
    // days" and "Later days".
    expect(rowOffset()).toEqual({ translateX: -3 * WIDTH });
    expect(screen.getAllByRole('button', { name: /day \d/ })).toHaveLength(7);

    // The calendar, two weeks back: shown at once.
    await screen.rerender(strip('2026-10-12', onShow));

    expect(rowOffset()).toEqual({ translateX: -1 * WIDTH });
    expect(screen.getByRole('button', { name: 'Monday 12 Oct' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Wednesday 28 Oct, today' })).toBeNull();
    expect(onShow).not.toHaveBeenCalled();
  });
});

describe('D-79 a swipe moves the strip exactly one week (the owner, 2026-11-16)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([
    ['dragged past a quarter of the week, to the right', 100, 0, -1],
    ['dragged past a quarter of the week, to the left', -100, 0, 1],
    ['dragged less than a quarter, slowly', 60, 0.1, 0],
    ['flicked, however short', 20, 0.5, -1],
    ['flicked the other way at the end of a drag', 200, -0.5, 1],
    ['dragged three weeks', 900, 0, -1],
    ['flicked three weeks fast', -900, -5, 1],
  ])('%s: %d points at %d points a millisecond moves %d week', (_, dx, speed, week) => {
    expect(swipeStep(dx, speed, WIDTH)).toBe(week);
  });

  it('a swipe to the right shows the week before, once the week has slid into place', async () => {
    const onShow = await renderStrip();

    await swipe(150, 250);
    expect(rowOffset()).toEqual({ translateX: -3 * WIDTH + 100 });
    expect(onShow).not.toHaveBeenCalled();
    await settle();

    expect(onShow).toHaveBeenCalledTimes(1);
    expect(onShow).toHaveBeenCalledWith('2026-10-19');
    expect(rowOffset()).toEqual({ translateX: -2 * WIDTH });
    expect(screen.getByRole('button', { name: 'Monday 19 Oct' })).toBeOnTheScreen();
  });

  it('a long, fast swipe still moves one week; the week follows the finger no further than the next week', async () => {
    const onShow = await renderStrip();

    await swipe(0, 3 * WIDTH, 100);
    expect(rowOffset()).toEqual({ translateX: -2 * WIDTH });
    await settle();

    expect(onShow).toHaveBeenCalledTimes(1);
    expect(onShow).toHaveBeenCalledWith('2026-10-19');
  });

  it('a short, slow swipe slides back to the week shown; a finger that stops before it lifts does not flick', async () => {
    const onShow = await renderStrip('2026-10-19');

    await swipe(150, 200);
    await settle();
    await swipe(150, 190, 60, 400);
    await settle();

    expect(onShow).not.toHaveBeenCalled();
    expect(rowOffset()).toEqual({ translateX: -2 * WIDTH });
  });

  it('swiped left and right again and again, it moves a week each time and stays put between (the owner’s report)', async () => {
    const onShow = await renderStrip();

    for (const [from, to, week] of [
      [150, 250, '2026-10-19'],
      [250, 150, '2026-10-26'],
      [150, 250, '2026-10-19'],
      [150, 250, '2026-10-12'],
      [250, 150, '2026-10-19'],
      [250, 150, '2026-10-26'],
    ] as const) {
      await swipe(from, to, 80);
      await settle();
      expect(onShow).toHaveBeenLastCalledWith(week);
    }
    expect(onShow).toHaveBeenCalledTimes(6);
    expect(rowOffset()).toEqual({ translateX: -3 * WIDTH });
  });

  it('a swipe made while the week still slides moves one more week from it', async () => {
    const onShow = await renderStrip();

    await swipe(150, 250, 80);
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
    await swipe(150, 250, 80);
    await settle();

    expect(onShow).toHaveBeenCalledTimes(1);
    expect(onShow).toHaveBeenCalledWith('2026-10-12');
    expect(rowOffset()).toEqual({ translateX: -1 * WIDTH });
  });

  it('D-23 stops at this week, with a little give', async () => {
    const onShow = await renderStrip();

    await swipe(250, 100, 80);
    expect(rowOffset()).toEqual({ translateX: -3 * WIDTH - 50 });
    await settle();

    expect(onShow).not.toHaveBeenCalled();
    expect(rowOffset()).toEqual({ translateX: -3 * WIDTH });
  });

  it('D-23 stops at the week holding the first of the 90 days', async () => {
    const onShow = await renderStrip('2026-10-05');

    await swipe(100, 250, 80);
    expect(rowOffset()).toEqual({ translateX: 50 });
    await settle();

    expect(onShow).not.toHaveBeenCalled();
    expect(rowOffset()).toEqual({ translateX: 0 });
  });

  it('a tap stays the day’s: the strip takes only a finger moving sideways', async () => {
    const onSelect = jest.fn();
    await renderStrip('2026-10-26', onSelect);

    await act(async () => pages().props.onTouchStart(finger(150, 0)));
    expect(pages().props.onMoveShouldSetResponder(finger(155, 10))).toBe(false);
    expect(pages().props.onMoveShouldSetResponder(finger(160, 10, 60))).toBe(false);
    expect(pages().props.onMoveShouldSetResponder(finger(162, 10, 35))).toBe(true);
    expect(pages().props.onResponderTerminationRequest()).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: 'Tuesday 27 Oct' }));
    expect(onSelect).toHaveBeenCalledWith('2026-10-27');
  });

  it('a swipe taken away (the page scrolled) slides back', async () => {
    const onShow = await renderStrip();

    await act(async () => pages().props.onTouchStart(finger(150, 0)));
    await act(async () => pages().props.onResponderGrant(finger(162, 10)));
    await act(async () => pages().props.onResponderMove(finger(250, 80)));
    await act(async () => pages().props.onResponderTerminate(finger(250, 80)));
    await settle();

    expect(onShow).not.toHaveBeenCalled();
    expect(rowOffset()).toEqual({ translateX: -3 * WIDTH });
  });

  it('the arrows slide a week each', async () => {
    const onShow = await renderStrip('2026-10-19');

    await fireEvent.press(screen.getByRole('button', { name: 'Earlier days' }));
    await settle();
    expect(onShow).toHaveBeenLastCalledWith('2026-10-12');
    await fireEvent.press(screen.getByRole('button', { name: 'Later days' }));
    await settle();
    expect(onShow).toHaveBeenLastCalledWith('2026-10-19');
    await fireEvent.press(screen.getByRole('button', { name: 'Later days' }));
    await settle();

    expect(onShow).toHaveBeenLastCalledWith('2026-10-26');
    expect(onShow).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: 'Later days' })).toBeDisabled();
  });
});

describe('D-103 an apple and a dumbbell under each date, as the header calendar (D-84)', () => {
  // Meals on Monday and today, workouts on Monday and Tuesday; Thursday's, after today, are not shown.
  const activity = {
    meals: { '2026-10-26': 2, '2026-10-28': 1, '2026-10-29': 1 },
    workouts: { '2026-10-26': 1, '2026-10-27': 2, '2026-10-29': 1 },
  };

  /** The colour of the icon a mark holds (the icons themselves are hidden from screen readers). */
  function colour(testID: string): unknown {
    return (screen.getByTestId(testID).props.children as { props: { color: string } }).props.color;
  }

  async function renderMarked(selected = TODAY) {
    await render(
      <WeekStrip today={TODAY} firstDay={FIRST_DAY} selected={selected} start="2026-10-26" activity={activity} onSelect={jest.fn()} onShow={jest.fn()} />,
    );
  }

  it('a green apple on a day with a meal, a green dumbbell on a day with a workout, side by side; each day says what was logged', async () => {
    await renderMarked();

    const monday = screen.getByRole('button', { name: 'Monday 26 Oct, 2 meals logged, 1 workout logged' });
    expect(within(monday).getByTestId('meals-2026-10-26')).toBeOnTheScreen();
    expect(within(monday).getByTestId('workout-2026-10-26')).toBeOnTheScreen();
    expect(colour('meals-2026-10-26')).toBe(LIGHT_COLORS.success);
    expect(colour('workout-2026-10-26')).toBe(LIGHT_COLORS.success);
    const tuesday = screen.getByRole('button', { name: 'Tuesday 27 Oct, 2 workouts logged' });
    expect(within(tuesday).getByTestId('workout-2026-10-27')).toBeOnTheScreen();
    expect(within(tuesday).queryByTestId('meals-2026-10-27')).toBeNull();
  });

  it('the selected day’s marks take its ink; a day with nothing, or after today, has none', async () => {
    await renderMarked();

    const today = screen.getByRole('button', { name: 'Wednesday 28 Oct, today, 1 meal logged' });
    expect(within(today).getByTestId('meals-2026-10-28')).toBeOnTheScreen();
    expect(colour('meals-2026-10-28')).toBe(LIGHT_COLORS.onPrimary);
    expect(screen.getByRole('button', { name: 'Thursday 29 Oct, not available' })).toBeDisabled();
    expect(screen.queryByTestId('meals-2026-10-29')).toBeNull();
    expect(screen.queryByTestId('workout-2026-10-29')).toBeNull();

    await screen.rerender(
      <WeekStrip today={TODAY} firstDay={FIRST_DAY} selected="2026-10-26" start="2026-10-26" activity={activity} onSelect={jest.fn()} onShow={jest.fn()} />,
    );
    expect(colour('meals-2026-10-26')).toBe(LIGHT_COLORS.onPrimary);
    expect(colour('meals-2026-10-28')).toBe(LIGHT_COLORS.success);
  });

  it('nothing is marked while the week loads', async () => {
    await render(<WeekStrip today={TODAY} firstDay={FIRST_DAY} selected={TODAY} start="2026-10-26" activity={null} onSelect={jest.fn()} onShow={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Monday 26 Oct' })).toBeOnTheScreen();
    expect(screen.queryByTestId('meals-2026-10-26')).toBeNull();
  });
});

describe('D-106 back to 1 Jan 2000: only the weeks beside the one shown are drawn', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /** Every day button drawn, the hidden weeks' too. */
  function drawnDays() {
    return screen.queryAllByRole('button', { name: /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day \d/, includeHiddenElements: true });
  }

  it('over a thousand weeks, three drawn; a swipe still moves one week and draws its neighbours', async () => {
    const onShow = jest.fn();
    function Far() {
      const [start, setStart] = useState('2026-10-26');
      return (
        <WeekStrip
          today={TODAY}
          firstDay="2000-01-01"
          selected={TODAY}
          start={start}
          onSelect={jest.fn()}
          onShow={(next) => {
            onShow(next);
            setStart(next);
          }}
        />
      );
    }
    await render(<Far />);
    await fireEvent(pages(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 64 } } });

    expect(stripStarts('2000-01-01', TODAY).length).toBeGreaterThan(1_400);
    // This week and the one before it: there is none after.
    expect(drawnDays()).toHaveLength(14);

    await swipe(150, 250, 80);
    await settle();
    await swipe(150, 250, 80);
    await settle();

    expect(onShow).toHaveBeenLastCalledWith('2026-10-12');
    expect(onShow).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Monday 12 Oct' })).toBeOnTheScreen();
    expect(drawnDays().length).toBeLessThanOrEqual(35);
  });
});
