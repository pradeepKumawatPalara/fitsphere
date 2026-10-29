import { randomUUID } from 'node:crypto';
import { AGE_CONFIRMATION_TEXT_VERSION } from '@fitsphere/shared';
import { describe, expect, it } from 'vitest';
import { startTestApi } from './app.ts';

// ADR-0002 step 6, invariant #7: the log holds no token, email address, health value (weight,
// measurements and their notes, targets), query value or body.

describe('ADR-0002 step 6 log content', () => {
  it('ADR-0002 step 6 logs one line per request with the route pattern and no sensitive values', async () => {
    const lines: string[] = [];
    const api = await startTestApi({ log: { level: 'info', stream: { write: (line) => lines.push(line) } } });
    try {
      const user = await api.signUp();
      const auth = { authorization: `Bearer ${user.token}` };
      await api.app.inject({
        method: 'POST',
        url: '/v1/me?probe=query-value-7f3a',
        headers: auth,
        payload: { ageConfirmed: true, ageConfirmationTextVersion: AGE_CONFIRMATION_TEXT_VERSION },
      });
      const me = await api.app.inject({ method: 'GET', url: '/v1/me', headers: auth });
      const userId: string = me.json().user.id;
      await api.app.inject({
        method: 'POST',
        url: '/v1/sync',
        headers: auth,
        payload: {
          cursor: null,
          changes: [
            {
              changeId: randomUUID(),
              type: 'weighIn.set',
              data: { day: '2026-10-01', weightGrams: 73_456, recordedAt: '2026-10-01T02:00:00.000Z' },
            },
            {
              changeId: randomUUID(),
              type: 'measurements.set',
              data: {
                day: '2026-10-01',
                upperWaistMm: 1_234,
                lowerWaistMm: 1_235,
                chestMm: null,
                hipsMm: null,
                armMm: null,
                thighMm: null,
                notes: 'synthetic-note-5c1d',
                recordedAt: '2026-10-01T02:00:00.000Z',
              },
            },
            { changeId: randomUUID(), type: 'target.set', data: { kind: 'calories', value: 2_345, setAt: '2026-10-01T02:00:00.000Z' } },
          ],
        },
      });
      await api.app.inject({
        method: 'GET',
        url: `/v1/users/${userId}/weigh-ins?from=2026-09-17&to=2026-10-01`,
        headers: auth,
      });
      await api.app.inject({
        method: 'POST',
        url: '/v1/me',
        headers: auth,
        payload: { ageConfirmed: true, ageConfirmationTextVersion: 'x', email: 'body-value@example.test' },
      });

      const log = lines.join('');
      expect(log).not.toContain(user.token);
      expect(log).not.toContain(user.token.split('.')[1]);
      expect(log).not.toContain(user.email);
      expect(log).not.toContain('@example.test');
      expect(log).not.toContain('query-value-7f3a');
      expect(log).not.toContain('probe');
      expect(log.toLowerCase()).not.toContain('authorization');
      expect(log).not.toContain('73456');
      expect(log).not.toContain('1234');
      expect(log).not.toContain('synthetic-note-5c1d');
      expect(log).not.toContain('2345');
      expect(log).not.toContain('2026-09-17');
      expect(log).not.toContain('2026-10-01');

      const requests = lines.map((line) => JSON.parse(line)).filter((entry) => entry.msg === 'request');
      expect(requests).toHaveLength(5);
      expect(requests[2]).toMatchObject({ method: 'POST', route: '/v1/sync', status: 200, userId });
      expect(requests[3]).toMatchObject({ method: 'GET', route: '/v1/users/:userId/weigh-ins', status: 200 });
      expect(requests[0]).toMatchObject({ method: 'POST', route: '/v1/me', status: 201 });
      expect(requests[0].requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(requests[1]).toMatchObject({ method: 'GET', route: '/v1/me', status: 200 });
      expect(requests[1].userId).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      await api.close();
    }
  });
});
