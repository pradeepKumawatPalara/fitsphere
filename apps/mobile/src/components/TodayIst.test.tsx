import { render, screen } from '@testing-library/react-native';
import { TodayIst } from './TodayIst';

describe('REQ-DATE-004 TodayIst', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('REQ-DATE-004 shows the IST date while UTC is still on the day before', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-27T18:30:00Z') });

    await render(<TodayIst />);

    expect(screen.getByText('Today (IST): 2026-10-28')).toBeOnTheScreen();
  });

  it('REQ-DATE-004 shows the same IST date one second before midnight IST', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-27T18:29:59Z') });

    await render(<TodayIst />);

    expect(screen.getByText('Today (IST): 2026-10-27')).toBeOnTheScreen();
  });
});
