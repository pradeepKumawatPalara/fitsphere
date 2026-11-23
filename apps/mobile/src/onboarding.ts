import { getMeta, listTargets, setMeta } from './local/store';
import type { SqlDb } from './local/sql';

// The first sign-in's "Set your targets" (REQ-ROLE-007): shown once to a user who has set no target, and
// who has not already finished or skipped it on this phone. A user who signs in on a new phone has the
// targets set before come down with the first sync, so the form is not shown to them. No server change:
// the choice is kept on the phone (`onboarding_done`), and the targets themselves are what the server
// holds.

/** True while this phone has not finished or skipped the form and the user has no target of any kind. */
export async function needsOnboarding(db: SqlDb): Promise<boolean> {
  if ((await getMeta(db, 'onboarding_done')) !== null) return false;
  return (await listTargets(db)).length === 0;
}

/** Finished or skipped: it is not shown again on this phone. */
export async function finishOnboarding(db: SqlDb): Promise<void> {
  await setMeta(db, 'onboarding_done', '1');
}
