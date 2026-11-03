import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { stripStartFor, stripStarts } from '../navigation/SelectedDayProvider';
import { WeekStrip } from './WeekStrip';

// The date strip shows 7 days ending today and swipes back 7 at a time (REQ-HOME-002, D-34), within
// the phone's 90 days (D-23); no day after today is shown (Q-017). The arrows still move it.

const TODAY = '2026-10-28';
const FIRST_DAY = '2026-10-07';
const WIDTH = 300;

function strip(start: string, onShow: (start: string) => void) {
  return <WeekStrip today={TODAY} firstDay={FIRST_DAY} selected={TODAY} start={start} onSelect={jest.fn()} onShow={onShow} />;
}

/** Renders the strip and lays it out, so its 7-day spans become pages. */
async function renderStrip(start = '2026-10-22') {
  const onShow = jest.fn();
  await render(strip(start, onShow));
  await fireEvent(screen.getByTestId('week-pages'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 64 } } });
  return onShow;
}

async function swipeTo(x: number) {
  await fireEvent(screen.getByTestId('week-scroll'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x, y: 0 } } });
}

describe('REQ-HOME-002 the date strip, 7 days ending today', () => {
  it('D-23 has the 7-day spans from the one holding the first of the 90 days to the one ending today', () => {
    expect(stripStarts(FIRST_DAY, TODAY)).toEqual(['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22']);
  });

  it.each([
    ['2026-10-28', '2026-10-22'],
    ['2026-10-22', '2026-10-22'],
    ['2026-10-21', '2026-10-15'],
    ['2026-10-08', '2026-10-08'],
    ['2026-10-07', '2026-10-01'],
  ])('D-34 a day, %s, is shown in the 7 days from %s', (day, start) => {
    expect(stripStartFor(TODAY, day)).toBe(start);
  });

  it('Q-017 shows no day after today: "Later days" waits until an earlier span is shown', async () => {
    await renderStrip();

    expect(screen.getByRole('button', { name: 'Wednesday 28 Oct, today' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Thursday 22 Oct' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Thursday 29 Oct/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Later days' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Earlier days' })).toBeEnabled();
  });

  it('a swipe shows the 7 days it settles on', async () => {
    const onShow = await renderStrip();

    await swipeTo(2 * WIDTH);

    expect(onShow).toHaveBeenCalledWith('2026-10-15');
  });

  it('D-23 stops at the span holding the first day, and at the one ending today', async () => {
    const onShow = await renderStrip('2026-10-08');

    await swipeTo(10 * WIDTH);
    expect(onShow).toHaveBeenLastCalledWith('2026-10-22');
    await swipeTo(-WIDTH);
    expect(onShow).toHaveBeenLastCalledWith('2026-10-01');
  });

  it('the arrows move 7 days; settling back on the days shown changes nothing', async () => {
    const onShow = await renderStrip('2026-10-15');

    await swipeTo(2 * WIDTH);
    expect(onShow).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Earlier days' }));
    expect(onShow).toHaveBeenLastCalledWith('2026-10-08');
    await fireEvent.press(screen.getByRole('button', { name: 'Later days' }));
    expect(onShow).toHaveBeenLastCalledWith('2026-10-22');
  });

  it('follows days shown another way; only those 7 are there for screen readers', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype as unknown as { scrollTo(options: object): void }, 'scrollTo');
    try {
      await renderStrip();
      // 7 days, not the other spans' 21; the arrows are "Earlier days" and "Later days".
      expect(screen.getAllByRole('button', { name: /day \d/ })).toHaveLength(7);

      await screen.rerender(strip('2026-10-08', jest.fn()));

      expect(scrollTo).toHaveBeenLastCalledWith({ x: 1 * WIDTH, animated: true });
      expect(screen.getByRole('button', { name: 'Thursday 8 Oct' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Wednesday 28 Oct, today' })).toBeNull();
    } finally {
      scrollTo.mockRestore();
    }
  });
});
