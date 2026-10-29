// Expo builds EXPO_PUBLIC_ values from apps/mobile/.env into the app (runbook, "Configuration names").
// They are publishable values only, never secrets.
export const API_URL = process.env.EXPO_PUBLIC_API_URL;
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
