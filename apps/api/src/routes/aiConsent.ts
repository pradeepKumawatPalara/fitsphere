// GET and PUT /v1/me/ai-consent (api-conventions; REQ-ACC-004, C-004, A-007; MVP default, D-31).
// Only the caller's own record: the path names no user, so no one reads or changes another person's
// consent (invariant #1; the permission matrix says "never" for anyone else, D-13). Nothing here
// calls an AI service; the AI module checks the latest record immediately before each call
// (invariant #3, slice 7).
import { aiConsentRequestSchema, API_BASE_PATH, validationDetails, type AiConsentResponse } from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireAccount } from '../access.ts';
import { ApiError } from '../errors.ts';

type Queryable = Pick<pg.Pool, 'query'>;

export function registerAiConsentRoutes(app: FastifyInstance, deps: { db: pg.Pool; now: () => Date }) {
  app.get(`${API_BASE_PATH}/me/ai-consent`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    return { aiConsent: await latestAiConsent(deps.db, account.id) } satisfies AiConsentResponse;
  });

  // Each change is kept as its own row, with the server's time and the text version shown
  // (Q-065 MVP default). Online only: there is no sync change for consent.
  app.put(`${API_BASE_PATH}/me/ai-consent`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    const parsed = aiConsentRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.body));

    await deps.db.query(
      'insert into app.ai_consents (user_id, consented, text_version, recorded_at) values ($1, $2, $3, $4)',
      [account.id, parsed.data.consented, parsed.data.textVersion, deps.now()],
    );
    return { aiConsent: await latestAiConsent(deps.db, account.id) } satisfies AiConsentResponse;
  });
}

/** The user's current choice: the latest record, or null when they have never chosen (AI off). */
export async function latestAiConsent(db: Queryable, userId: string): Promise<AiConsentResponse['aiConsent']> {
  const { rows } = await db.query<{ consented: boolean; text_version: string; recorded_at: Date }>(
    `select consented, text_version, recorded_at from app.ai_consents
     where user_id = $1 order by recorded_at desc, id desc limit 1`,
    [userId],
  );
  const row = rows[0];
  return row ? { consented: row.consented, textVersion: row.text_version, recordedAt: row.recorded_at.toISOString() } : null;
}
