import { gunzipSync } from 'node:zlib';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { acceptsGzip, packJson, sendLargeJson } from './largeJson.ts';

// D-102: the food list, 6 MB with the units of the owner's food database, goes gzipped to a client
// that accepts it, so the phone gets it through the tunnel before it stops waiting (2026-11-16).

describe('a large JSON body', () => {
  it('reads Accept-Encoding: gzip named or *, not with q=0', () => {
    for (const header of ['gzip', 'gzip, deflate', 'br, gzip;q=0.5', '*', ['deflate', 'gzip']]) expect(acceptsGzip(header)).toBe(true);
    for (const header of [undefined, '', 'identity', 'deflate, br', 'gzip;q=0', 'x-gzip2']) expect(acceptsGzip(header)).toBe(false);
  });

  it('is sent gzipped when the client accepts it, and as it is otherwise', async () => {
    const app = Fastify();
    const body = { version: 'v1', items: Array.from({ length: 500 }, (_, index) => ({ code: `T${index}`, name: 'Test food', portions: [{ label: 'Katori', grams: 129 }] })) };
    // Packed once (D-126), sent as often as asked.
    const packedBody = await packJson(body);
    app.get('/list', async (request, reply) => sendLargeJson(request, reply, packedBody));
    try {
      const packed = await app.inject({ method: 'GET', url: '/list', headers: { 'accept-encoding': 'gzip, deflate, br' } });
      expect(packed.statusCode).toBe(200);
      expect(packed.headers['content-encoding']).toBe('gzip');
      expect(packed.headers['content-type']).toMatch(/^application\/json/);
      expect(packed.headers.vary).toBe('accept-encoding');
      expect(packed.rawPayload.length).toBeLessThan(JSON.stringify(body).length / 5);
      expect(JSON.parse(gunzipSync(packed.rawPayload).toString('utf8'))).toEqual(body);

      const plain = await app.inject({ method: 'GET', url: '/list' });
      expect(plain.headers['content-encoding']).toBeUndefined();
      expect(plain.json()).toEqual(body);
    } finally {
      await app.close();
    }
  });
});
