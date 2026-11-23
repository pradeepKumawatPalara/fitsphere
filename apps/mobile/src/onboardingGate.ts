import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useLocalDatabase } from './local/LocalDatabaseProvider';
import { needsOnboarding } from './onboarding';
import { useSyncStatus } from './sync/SyncProvider';

/**
 * Sends a new user to "Set your targets" (REQ-ROLE-007), once, after the first sync that reached the
 * server: only then is it known that the user has no target on any phone. Offline at first, nothing
 * happens until a sync reaches the server.
 */
export function useOnboardingGate() {
  const router = useRouter();
  const local = useLocalDatabase();
  const status = useSyncStatus();
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current || local.state.status !== 'ready' || status !== 'synced') return;
    checked.current = true;
    void needsOnboarding(local.state.db).then((needed) => {
      if (needed) router.replace('/onboarding');
    });
  }, [local.state, status, router]);
}
