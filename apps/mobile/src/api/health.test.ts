import { checkApiHealth } from './health';

function fakeFetch(result: { ok: boolean; body?: unknown } | Error) {
  return jest.fn(async () => {
    if (result instanceof Error) throw result;
    return { ok: result.ok, json: async () => result.body } as unknown as Response;
  });
}

describe('ADR-0001 step 1: checkApiHealth', () => {
  it('calls GET /v1/health on the configured address and reports ok', async () => {
    const fetchImpl = fakeFetch({ ok: true, body: { status: 'ok' } });

    await expect(checkApiHealth('http://api.test', fetchImpl)).resolves.toBe('ok');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api.test/v1/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reports unreachable for an error status', async () => {
    const fetchImpl = fakeFetch({ ok: false, body: { status: 'ok' } });

    await expect(checkApiHealth('http://api.test', fetchImpl)).resolves.toBe('unreachable');
  });

  it('reports unreachable when the request fails', async () => {
    const fetchImpl = fakeFetch(new TypeError('Network request failed'));

    await expect(checkApiHealth('http://api.test', fetchImpl)).resolves.toBe('unreachable');
  });

  it('reports unreachable for an unexpected body', async () => {
    const fetchImpl = fakeFetch({ ok: true, body: { status: 'starting' } });

    await expect(checkApiHealth('http://api.test', fetchImpl)).resolves.toBe('unreachable');
  });
});
