import { callApi, LIST_TIMEOUT_MS } from './client';

// How long a call waits (D-102, 2026-11-16): 15 seconds, and the big lists 60, since the food list is
// 6 MB and can take longer than 15 seconds through the tunnel over a phone's hotspot.

/** A fetch that answers only when its signal aborts, as a slow network does. */
function slowFetch(): { fetchImpl: typeof fetch; aborted: () => boolean } {
  let aborted = false;
  const fetchImpl = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        aborted = true;
        reject(new Error('aborted'));
      });
    })) as unknown as typeof fetch;
  return { fetchImpl, aborted: () => aborted };
}

describe('callApi waits', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('15 seconds, then counts as offline', async () => {
    const { fetchImpl, aborted } = slowFetch();
    const result = callApi('https://api.test', '/sync', { fetchImpl });
    jest.advanceTimersByTime(14_999);
    expect(aborted()).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(result).resolves.toEqual({ kind: 'offline' });
  });

  it('the big lists 60 seconds', async () => {
    const { fetchImpl, aborted } = slowFetch();
    const result = callApi('https://api.test', '/foods', { fetchImpl, timeoutMs: LIST_TIMEOUT_MS });
    jest.advanceTimersByTime(59_999);
    expect(aborted()).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(result).resolves.toEqual({ kind: 'offline' });
    expect(LIST_TIMEOUT_MS).toBe(60_000);
  });
});
