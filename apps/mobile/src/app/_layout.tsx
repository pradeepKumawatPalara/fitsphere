import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { createAuthDeps } from '../auth/supabase';
import { Text } from '../components/ui';
import { LocalDatabaseProvider } from '../local/LocalDatabaseProvider';
import { SettingsProvider } from '../settings/SettingsProvider';
import { SyncProvider } from '../sync/SyncProvider';
import { ThemeProvider } from '../theme';

const authDeps = createAuthDeps();

// The signed-in user's encrypted database opens when the app starts with a session.
function LocalDatabaseForUser({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  return <LocalDatabaseProvider owner={userId}>{children}</LocalDatabaseProvider>;
}

export default function RootLayout() {
  if (!authDeps) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text>
          Supabase settings not set: add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to apps/mobile/.env
        </Text>
      </View>
    );
  }
  return (
    <AuthProvider deps={authDeps}>
      <LocalDatabaseForUser>
        <SyncProvider>
          <SettingsProvider>
            <ThemeProvider>
              <Stack screenOptions={{ title: 'FitSphere' }}>
                {/* The tabs have their own header (REQ-NAV-002). */}
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="account" options={{ title: 'Settings' }} />
                <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
                <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
                <Stack.Screen name="targets" options={{ title: 'Your targets' }} />
                <Stack.Screen name="log-meal" options={{ title: 'Log meal' }} />
                <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
                <Stack.Screen name="weight-history" options={{ title: 'Weight history' }} />
              </Stack>
            </ThemeProvider>
          </SettingsProvider>
        </SyncProvider>
      </LocalDatabaseForUser>
    </AuthProvider>
  );
}
