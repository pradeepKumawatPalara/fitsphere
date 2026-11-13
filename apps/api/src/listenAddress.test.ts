import { describe, expect, it } from 'vitest';
import { DEFAULT_HOST, DEFAULT_PORT, listenAddress } from './listenAddress.ts';

// HOST and PORT (D-101): the PC keeps loopback and port 3000; Cloud Run gives 0.0.0.0 and its port.

describe('listenAddress', () => {
  it('keeps the PC on loopback and port 3000 when nothing is set', () => {
    expect(listenAddress({})).toEqual({ host: '127.0.0.1', port: 3000 });
    expect(DEFAULT_HOST).toBe('127.0.0.1');
    expect(DEFAULT_PORT).toBe(3000);
  });

  it('treats an empty HOST or PORT, as in .env.example, as not set', () => {
    expect(listenAddress({ HOST: '', PORT: '' })).toEqual({ host: '127.0.0.1', port: 3000 });
    expect(listenAddress({ HOST: '  ', PORT: ' ' })).toEqual({ host: '127.0.0.1', port: 3000 });
  });

  it("listens on every address and Cloud Run's port when they are set", () => {
    expect(listenAddress({ HOST: '0.0.0.0', PORT: '8080' })).toEqual({ host: '0.0.0.0', port: 8080 });
  });

  it('keeps the port dev:phone sets', () => {
    expect(listenAddress({ PORT: '3000' })).toEqual({ host: '127.0.0.1', port: 3000 });
  });

  it('refuses a port that is not a whole number from 1 to 65535', () => {
    for (const port of ['0', '65536', '80.5', '-1', 'eighty', '3000abc', '1e3']) {
      expect(() => listenAddress({ PORT: port }), port).toThrow(
        `PORT must be a whole number from 1 to 65535, not "${port}".`,
      );
    }
  });
});
