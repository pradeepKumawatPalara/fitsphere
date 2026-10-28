// supabase-js needs a full URL implementation (Supabase's React Native guide).
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { API_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import type { AuthDeps } from './service';
import { createSessionStorage } from './storage';

/** The real Supabase client with the publishable key; null until apps/mobile/.env has both values. */
export function createAuthDeps(): AuthDeps | null {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: createSessionStorage(),
      storageKey: 'fitsphere-auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // Email links carry a one-time code, not tokens.
      flowType: 'pkce',
    },
  });
  // Refresh the session only while the app is in the foreground (Supabase's React Native guide).
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
  return { client: supabase.auth, apiUrl: API_URL };
}
