import { randomUUID } from 'node:crypto';
import { AGE_CONFIRMATION_TEXT_VERSION } from '@fitsphere/shared';
import { describe, expect, it } from 'vitest';
import type { MediaStorage } from '../../src/storage/mediaStorage.ts';
import { startTestApi } from './app.ts';

// ADR-0002 step 6, invariant #7: the log holds no token, email address, health value (weight,
// measurements and their notes, targets, meals), media link, query value or body.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Fields the logger (time, process, host) and the API (request and user IDs, duration) fill in. */
const OWN_FIELDS = new Set(['time', 'pid', 'hostname', 'requestId', 'userId', 'durationMs']);

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
            {
              changeId: randomUUID(),
              type: 'meal.set',
              data: {
                id: randomUUID(),
                day: '2026-10-01',
                mealType: 'lunch',
                tags: [],
                items: [
                  {
                    source: 'own',
                    ref: null,
                    name: 'synthetic-food-9d2e',
                    amount: { unit: 'g', value: 123 },
                    kcal: 456.7,
                    proteinG: 8.9,
                    carbsG: null,
                    fatG: null,
                    fibreG: null,
                    estimated: false,
                  },
                ],
                recordedAt: '2026-10-01T02:00:00.000Z',
              },
            },
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
      expect(log).not.toContain('synthetic-note-5c1d');
      expect(log).not.toContain('synthetic-food-9d2e');
      expect(log).not.toContain('2026-09-17');
      expect(log).not.toContain('2026-10-01');

      // The short numbers are looked for outside the fields the logger and the API fill in
      // themselves. Those are random or depend on the machine (a request ID once held "2345"), so
      // they are checked by their form instead, and no value can hide in them.
      const entries: Record<string, unknown>[] = lines.map((line) => JSON.parse(line));
      for (const { time, pid, hostname, requestId, userId, durationMs } of entries) {
        expect(typeof time).toBe('number');
        if (pid !== undefined) expect(Number.isInteger(pid)).toBe(true);
        if (hostname !== undefined) expect(typeof hostname).toBe('string');
        if (requestId !== undefined) expect(requestId).toMatch(UUID);
        if (userId !== undefined && userId !== null) expect(userId).toMatch(UUID);
        if (durationMs !== undefined) expect(Number.isInteger(durationMs)).toBe(true);
      }
      const content = JSON.stringify(
        entries.map((entry) => Object.fromEntries(Object.entries(entry).filter(([field]) => !OWN_FIELDS.has(field)))),
      );
      expect(content).not.toContain('73456');
      expect(content).not.toContain('1234');
      expect(content).not.toContain('2345');
      expect(content).not.toContain('456.7');

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

  it('ADR-0002 step 6 logs no media link, photo ID or public image link', async () => {
    const lines: string[] = [];
    const storage: MediaStorage = {
      uploadLinks: async (keys) => keys.map((key) => `https://storage.test/${key}?X-Amz-Signature=upload-sig-4b7e`),
      viewLinks: async (keys) => keys.map((key) => `https://storage.test/${key}?X-Amz-Signature=view-sig-9a1c`),
      remove: async () => undefined,
    };
    const api = await startTestApi({ log: { level: 'info', stream: { write: (line) => lines.push(line) } }, storage });
    try {
      const user = await api.signUpWithAccount();
      const auth = { authorization: `Bearer ${user.token}` };
      const mediaId = randomUUID();
      const meal = (photo: unknown) => ({
        changeId: randomUUID(),
        type: 'meal.set',
        data: {
          id: randomUUID(),
          day: '2026-10-01',
          mealType: 'lunch',
          tags: [],
          items: [
            {
              source: 'own',
              ref: null,
              name: 'Synthetic bar',
              amount: { unit: 'g', value: 40 },
              kcal: 180,
              proteinG: 4,
              carbsG: null,
              fatG: null,
              fibreG: null,
              estimated: false,
            },
          ],
          photo,
          recordedAt: '2026-10-01T02:00:00.000Z',
        },
      });
      await api.app.inject({
        method: 'POST',
        url: '/v1/sync',
        headers: auth,
        payload: {
          cursor: null,
          changes: [meal({ kind: 'photo', mediaId }), meal({ kind: 'link', url: 'https://images.example.com/private-link-8c3f.jpg' })],
        },
      });
      const upload = await api.app.inject({ method: 'POST', url: `/v1/users/${user.id}/media/${mediaId}/upload`, headers: auth });
      const view = await api.app.inject({ method: 'GET', url: `/v1/users/${user.id}/media/${mediaId}`, headers: auth });
      expect([upload.statusCode, view.statusCode]).toEqual([200, 200]);

      const log = lines.join('');
      expect(log).not.toContain('storage.test');
      expect(log).not.toContain('upload-sig-4b7e');
      expect(log).not.toContain('view-sig-9a1c');
      expect(log).not.toContain(mediaId);
      expect(log).not.toContain('private-link-8c3f');
      const routes = lines.map((line) => JSON.parse(line)).filter((entry) => entry.msg === 'request').map((entry) => entry.route);
      expect(routes).toContain('/v1/users/:userId/media/:mediaId/upload');
      expect(routes).toContain('/v1/users/:userId/media/:mediaId');
    } finally {
      await api.close();
    }
  });
});
