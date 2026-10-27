import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';

describe('GET /v1/health', () => {
  const app = buildApp();
  afterAll(() => app.close());

  it('returns status ok without a token', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
