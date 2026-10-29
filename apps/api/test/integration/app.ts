// The API on the test database, with test-signed tokens and a fake Supabase Auth user list.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { AGE_CONFIRMATION_TEXT_VERSION } from '@fitsphere/shared';
import { buildApp, type LogOptions } from '../../src/app.ts';
import type { BarcodeSource } from '../../src/foods/openFoodFacts.ts';
import { createTestAuth, signToken } from '../helpers/auth.ts';
import { testDatabaseUrl } from './database.ts';

export type TestUser = { subject: string; email: string; token: string };

export async function startTestApi(
  options: { log?: LogOptions; now?: () => Date; syncPageSize?: number; barcodes?: BarcodeSource } = {},
) {
  const { auth, keys, supabase } = await createTestAuth();
  const db = new pg.Pool({ connectionString: testDatabaseUrl(), max: 4 });
  const app = buildApp({ db, auth, ...options });
  await app.ready();

  /** A user who signed up with Supabase Auth; no FitSphere account yet. */
  async function signUp(confirmed = true): Promise<TestUser> {
    const subject = randomUUID();
    const email = `user-${subject}@example.test`;
    supabase.users.set(subject, { email, confirmed });
    return { subject, email, token: await signToken(keys, subject) };
  }

  /** A user with a FitSphere account set up through the API. */
  async function signUpWithAccount(): Promise<TestUser & { id: string }> {
    const user = await signUp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/me',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { ageConfirmed: true, ageConfirmationTextVersion: AGE_CONFIRMATION_TEXT_VERSION },
    });
    if (response.statusCode !== 201) throw new Error(`Account setup failed: ${response.statusCode}`);
    return { ...user, id: response.json().user.id };
  }

  return {
    app,
    db,
    keys,
    signUp,
    signUpWithAccount,
    async close() {
      await app.close();
      await db.end();
    },
  };
}
