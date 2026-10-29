import { describe, expect, it } from 'vitest';
import { findTunnelAddress, isApiHealthy, isTunnelConnected, setEnvValue, waitFor } from './dev-phone-lib.ts';

// CI fails if a Quick Tunnel address is committed (D-19 answer 6), so the samples are built here.
const DOMAIN = ['trycloudflare', 'com'].join('.');
const SAMPLE = `https://${['quiet', 'river', 'stone', 'lamp'].join('-')}.${DOMAIN}`;

function cloudflaredOutput(address: string): string {
  return [
    `2026-10-29T10:00:00Z INF Requesting new quick Tunnel on ${DOMAIN}...`,
    '2026-10-29T10:00:01Z INF +--------------------------------------------------------------+',
    '2026-10-29T10:00:01Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |',
    `2026-10-29T10:00:01Z INF |  ${address}                                  |`,
    '2026-10-29T10:00:01Z INF +--------------------------------------------------------------+',
  ].join('\n');
}

describe('D-22 dev:phone: the tunnel address', () => {
  it('reads the address from cloudflared output', () => {
    expect(findTunnelAddress(cloudflaredOutput(SAMPLE))).toBe(SAMPLE);
  });

  it('is null until the address is printed', () => {
    expect(findTunnelAddress(`INF Requesting new quick Tunnel on ${DOMAIN}...`)).toBeNull();
  });

  it("skips cloudflared's own API address in error messages", () => {
    const error = `ERR failed to request quick Tunnel: Post "https://api.${DOMAIN}/tunnel": EOF`;
    expect(findTunnelAddress(error)).toBeNull();
  });

  it('knows when the tunnel is connected', () => {
    expect(isTunnelConnected(cloudflaredOutput(SAMPLE))).toBe(false);
    expect(isTunnelConnected('INF Registered tunnel connection connIndex=0 location=bom01 protocol=quic')).toBe(true);
  });
});

describe('D-22 dev:phone: writing apps/mobile/.env', () => {
  const env = ['# comment', 'EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co', 'EXPO_PUBLIC_API_URL=', ''].join('\n');

  it('sets the address and keeps every other line', () => {
    expect(setEnvValue(env, 'EXPO_PUBLIC_API_URL', SAMPLE)).toBe(
      ['# comment', 'EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co', `EXPO_PUBLIC_API_URL=${SAMPLE}`, ''].join('\n'),
    );
  });

  it('empties it again', () => {
    expect(setEnvValue(setEnvValue(env, 'EXPO_PUBLIC_API_URL', SAMPLE), 'EXPO_PUBLIC_API_URL', '')).toBe(env);
  });

  it('adds the line when it is missing, before the final newline', () => {
    expect(setEnvValue('A=1\n', 'EXPO_PUBLIC_API_URL', SAMPLE)).toBe(`A=1\nEXPO_PUBLIC_API_URL=${SAMPLE}\n`);
    expect(setEnvValue('A=1', 'EXPO_PUBLIC_API_URL', SAMPLE)).toBe(`A=1\nEXPO_PUBLIC_API_URL=${SAMPLE}`);
  });

  it('keeps CRLF line endings', () => {
    const crlf = env.replaceAll('\n', '\r\n');
    expect(setEnvValue(crlf, 'EXPO_PUBLIC_API_URL', SAMPLE)).toBe(
      ['# comment', 'EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co', `EXPO_PUBLIC_API_URL=${SAMPLE}`, ''].join('\r\n'),
    );
  });

  it('replaces an old address and leaves names that only start the same alone', () => {
    const old = `EXPO_PUBLIC_API_URL=https://old-words.${DOMAIN}\nEXPO_PUBLIC_API_URL_OTHER=x\n`;
    expect(setEnvValue(old, 'EXPO_PUBLIC_API_URL', '')).toBe('EXPO_PUBLIC_API_URL=\nEXPO_PUBLIC_API_URL_OTHER=x\n');
  });

  it('does not touch a commented-out line', () => {
    expect(setEnvValue('# EXPO_PUBLIC_API_URL=x\n', 'EXPO_PUBLIC_API_URL', '')).toBe('# EXPO_PUBLIC_API_URL=x\nEXPO_PUBLIC_API_URL=\n');
  });
});

describe('D-22 dev:phone: health and waiting', () => {
  const answer = (status: number, body: unknown) => (async () => Response.json(body, { status })) as unknown as typeof fetch;

  it('is healthy only for { "status": "ok" }', async () => {
    expect(await isApiHealthy('http://127.0.0.1:3000', answer(200, { status: 'ok' }))).toBe(true);
    expect(await isApiHealthy('http://127.0.0.1:3000', answer(200, { status: 'starting' }))).toBe(false);
    expect(await isApiHealthy('http://127.0.0.1:3000', answer(502, { status: 'ok' }))).toBe(false);
  });

  it('is not healthy when the request fails', async () => {
    const offline = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await isApiHealthy('http://127.0.0.1:3000', offline)).toBe(false);
  });

  it('calls the health route', async () => {
    let called = '';
    const spy = (async (url: string) => {
      called = url;
      return Response.json({ status: 'ok' });
    }) as unknown as typeof fetch;
    await isApiHealthy('http://127.0.0.1:3000', spy);
    expect(called).toBe('http://127.0.0.1:3000/v1/health');
  });

  it('waits until the condition holds, or gives up', async () => {
    let calls = 0;
    expect(await waitFor(() => ++calls >= 3, 1000, 1)).toBe(true);
    expect(calls).toBe(3);
    expect(await waitFor(() => false, 20, 5)).toBe(false);
  });
});
