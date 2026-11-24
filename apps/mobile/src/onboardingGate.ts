import { ensureAccount, sendOnboardingFinished, type AuthDeps } from './auth/service';
import type { SqlDb } from './local/sql';
import { getMeta, setMeta } from './local/store';

// Where app start goes for a signed-in user (D-124, docs/plans/onboarding.md): first sign-in onboarding
// until it is finished, else Home. Decided from the phone's own copy of the server's flag, so it works
// without the internet; asked of the server only the first time on this phone (an account made before this
// existed is finished already, and the phone learns it once). Anything unclear opens Home: onboarding
// never blocks the app (invariant #4).

export type StartDestination = '/home' | '/onboarding';

export async function startDestination(db: SqlDb, deps: AuthDeps): Promise<StartDestination> {
  let copy = await getMeta(db, 'onboarded');
  if (copy === null) {
    const state = await ensureAccount(deps);
    if (state.kind !== 'ready') return '/home';
    copy = state.me.user.onboardedAt === null ? '0' : '1';
    await setMeta(db, 'onboarded', copy);
  }
  if (copy === '0') return '/onboarding';
  // Finished, but the server may not have been told yet (no connection at Go to Home): tell it now.
  if ((await getMeta(db, 'onboarding_flag_pending')) === '1' && (await sendOnboardingFinished(deps))) {
    await setMeta(db, 'onboarding_flag_pending', null);
  }
  return '/home';
}
