import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { stripStartFor, stripStarts } from '../navigation/SelectedDayProvider';
import { LIGHT_COLORS } from '../theme';
import { WeekStrip } from './WeekStrip';

// The date strip shows a week, Monday to Sunday, and swipes a week at a time (REQ-HOME-002, D-79),
// within the phone's 90 days (D-23); this week's days after today are greyed and cannot be picked
// (Q-017). The arrows still move it.

const TODAY = '2026-10-28'; // a Wednesday
const FIRST_DAY = '2026-10-07'; // a Wednesday too
const WIDTH = 300;

function strip(start: string, onShow: (start: string) => void, onSelect = jest.fn()) {
  return <WeekStrip today={TODAY} firstDay={FIRST_DAY} selected={TODAY} start={start} onSelect={onSelect} onShow={onShow} />;
}

/** Renders the strip and lays it out, so its weeks become pages. */
async function renderStrip(start = '2026-10-26', onSelect = jest.fn()) {
  const onShow = jest.fn();
  await render(strip(start, onShow, onSelect));
  await fireEvent(screen.getByTestId('week-pages'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 64 } } });
  return onShow;
}

async function swipeTo(x: number) {
  await fireEvent(screen.getByTestId('week-scroll'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x, y: 0 } } });
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

  it('a swipe shows the week it settles on', async () => {
    const onShow = await renderStrip();

    await swipeTo(2 * WIDTH);

    expect(onShow).toHaveBeenCalledWith('2026-10-19');
  });

  it('D-23 stops at the week holding the first day, and at this week', async () => {
    const onShow = await renderStrip('2026-10-12');

    await swipeTo(10 * WIDTH);
    expect(onShow).toHaveBeenLastCalledWith('2026-10-26');
    await swipeTo(-WIDTH);
    expect(onShow).toHaveBeenLastCalledWith('2026-10-05');
  });

  it('the arrows move a week; settling back on the week shown changes nothing', async () => {
    const onShow = await renderStrip('2026-10-19');

    await swipeTo(2 * WIDTH);
    expect(onShow).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Earlier days' }));
    expect(onShow).toHaveBeenLastCalledWith('2026-10-12');
    await fireEvent.press(screen.getByRole('button', { name: 'Later days' }));
    expect(onShow).toHaveBeenLastCalledWith('2026-10-26');
  });

  it('follows days shown another way; only the week shown is there for screen readers', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype as unknown as { scrollTo(options: object): void }, 'scrollTo');
    try {
      await renderStrip();
      // 7 days, not the other weeks' 21; the arrows are "Earlier days" and "Later days".
      expect(screen.getAllByRole('button', { name: /day \d/ })).toHaveLength(7);

      await screen.rerender(strip('2026-10-12', jest.fn()));

      expect(scrollTo).toHaveBeenLastCalledWith({ x: 1 * WIDTH, animated: true });
      expect(screen.getByRole('button', { name: 'Monday 12 Oct' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Wednesday 28 Oct, today' })).toBeNull();
    } finally {
      scrollTo.mockRestore();
    }
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
