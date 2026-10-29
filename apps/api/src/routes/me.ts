// GET and POST /v1/me (api-conventions; REQ-ACC-010, REQ-ROLE-001, D-18).
import { API_BASE_PATH, meSetupRequestSchema, validationDetails } from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireIdentity } from '../access.ts';
import { createAccount, findAccount, meBody } from '../accounts.ts';
import type { Auth } from '../auth.ts';
import { ApiError } from '../errors.ts';

export function registerMeRoutes(app: FastifyInstance, deps: { auth: Auth; db: pg.Pool }) {
  app.get(`${API_BASE_PATH}/me`, { config: { access: 'signedIn' } }, async (request) => {
    const account = await findAccount(deps.db, requireIdentity(request).subject);
    if (!account) throw new ApiError('ACCOUNT_SETUP_REQUIRED');
    request.account = account;
    return meBody(account);
  });

  app.post(`${API_BASE_PATH}/me`, { config: { access: 'signedIn' } }, async (request, reply) => {
    const identity = requireIdentity(request);
    const body: unknown = request.body;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new ApiError('VALIDATION_FAILED');
    }
    // Without the 18+ confirmation no account is created (REQ-ACC-010).
    if ((body as { ageConfirmed?: unknown }).ageConfirmed !== true) {
      throw new ApiError('AGE_CONFIRMATION_REQUIRED');
    }
    const parsed = meSetupRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, body));
    }

    const existing = await findAccount(deps.db, identity.subject);
    if (existing) {
      request.account = existing;
      return reply.status(200).send(meBody(existing));
    }

    // The email comes from Supabase Auth, never from the request (data-model "users").
    const user = await deps.auth.readSignedInUser(identity);
    if (!user.emailConfirmed || !user.email) throw new ApiError('EMAIL_NOT_VERIFIED');

    const created = await createAccount(deps.db, {
      subject: identity.subject,
      email: user.email,
      ageConfirmationTextVersion: parsed.data.ageConfirmationTextVersion,
    });
    const account = await findAccount(deps.db, identity.subject);
    if (!account) throw new Error('Account missing after setup');
    request.account = account;
    return reply.status(created ? 201 : 200).send(meBody(account));
  });
}
