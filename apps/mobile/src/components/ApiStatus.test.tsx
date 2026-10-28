import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ApiHealth } from '../api/health';
import { ApiStatus } from './ApiStatus';

type Check = (apiUrl: string) => Promise<ApiHealth>;

describe('ADR-0001 step 1: ApiStatus', () => {
  it('shows "API: ok" when the health check succeeds', async () => {
    await render(<ApiStatus apiUrl="http://api.test" check={async () => 'ok'} />);

    expect(await screen.findByText('API: ok')).toBeOnTheScreen();
  });

  it('shows "API: unreachable" when the health check fails', async () => {
    await render(<ApiStatus apiUrl="http://api.test" check={async () => 'unreachable'} />);

    expect(await screen.findByText('API: unreachable')).toBeOnTheScreen();
  });

  it('checks again when "Check again" is pressed', async () => {
    const check = jest
      .fn<ReturnType<Check>, Parameters<Check>>()
      .mockResolvedValueOnce('unreachable')
      .mockResolvedValueOnce('ok');
    await render(<ApiStatus apiUrl="http://api.test" check={check} />);
    await screen.findByText('API: unreachable');

    await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));

    expect(await screen.findByText('API: ok')).toBeOnTheScreen();
    expect(check).toHaveBeenCalledTimes(2);
    expect(check).toHaveBeenLastCalledWith('http://api.test');
  });

  it('asks for EXPO_PUBLIC_API_URL when the address is not set', async () => {
    const check = jest.fn<ReturnType<Check>, Parameters<Check>>();
    await render(<ApiStatus apiUrl={undefined} check={check} />);

    expect(screen.getByText(/EXPO_PUBLIC_API_URL/)).toBeOnTheScreen();
    expect(check).not.toHaveBeenCalled();
  });
});
