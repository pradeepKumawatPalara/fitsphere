import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { stripWeeks, WeekStrip } from './WeekStrip';

// The week strip swipes a week at a time (REQ-HOME-002), within the phone's 90 days (D-23) and no
// further on than this week (Q-017); the arrows still move it.

const TODAY = '2026-10-28';
const FIRST_DAY = '2026-10-07';
const WIDTH = 300;

function strip(weekStart: string, onWeekChange: (week: string) => void) {
  return (
    <WeekStrip today={TODAY} firstDay={FIRST_DAY} selected={TODAY} weekStart={weekStart} onSelect={jest.fn()} onWeekChange={onWeekChange} />
  );
}

/** Renders the strip and lays it out, so its weeks become pages. */
async function renderStrip(weekStart = '2026-10-26') {
  const onWeekChange = jest.fn();
  await render(strip(weekStart, onWeekChange));
  await fireEvent(screen.getByTestId('week-pages'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 64 } } });
  return onWeekChange;
}

async function swipeTo(x: number) {
  await fireEvent(screen.getByTestId('week-scroll'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x, y: 0 } } });
}

describe('REQ-HOME-002 the week strip swipes a week at a time', () => {
  it('D-23 has the weeks from the one holding the first of the 90 days to this week', () => {
    expect(stripWeeks(FIRST_DAY, TODAY)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  });

  it('a swipe shows the week it settles on', async () => {
    const onWeekChange = await renderStrip();

    await swipeTo(2 * WIDTH);

    expect(onWeekChange).toHaveBeenCalledWith('2026-10-19');
  });

  it('Q-017 stops at this week, and D-23 at the week holding the first day', async () => {
    const onWeekChange = await renderStrip('2026-10-12');

    await swipeTo(10 * WIDTH);
    expect(onWeekChange).toHaveBeenLastCalledWith('2026-10-26');
    await swipeTo(-WIDTH);
    expect(onWeekChange).toHaveBeenLastCalledWith('2026-10-05');
  });

  it('settling back on the week shown changes nothing', async () => {
    const onWeekChange = await renderStrip();

    await swipeTo(3 * WIDTH);

    expect(onWeekChange).not.toHaveBeenCalled();
  });

  it('follows a week shown another way; only that week is there for screen readers', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype as unknown as { scrollTo(options: object): void }, 'scrollTo');
    try {
      await renderStrip();
      // The 7 days of this week, not the other weeks' 21; the arrows are "Previous week" and "Next week".
      expect(screen.getAllByRole('button', { name: /day \d/ })).toHaveLength(7);
      expect(screen.getByRole('button', { name: 'Wednesday 28 Oct, today' })).toBeOnTheScreen();

      await screen.rerender(strip('2026-10-12', jest.fn()));

      expect(scrollTo).toHaveBeenLastCalledWith({ x: 1 * WIDTH, animated: true });
      expect(screen.getByRole('button', { name: 'Monday 12 Oct' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Wednesday 28 Oct, today' })).toBeNull();
    } finally {
      scrollTo.mockRestore();
    }
  });
});
