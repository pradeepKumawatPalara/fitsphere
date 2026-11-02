import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { createAuthDeps } from '../auth/supabase';
import { Text } from '../components/ui';
import { LocalDatabaseProvider } from '../local/LocalDatabaseProvider';
import { SettingsProvider } from '../settings/SettingsProvider';
import { SyncProvider } from '../sync/SyncProvider';
import { ThemeProvider, useTheme } from '../theme';

const authDeps = createAuthDeps();

// The signed-in user's encrypted database opens when the app starts with a session.
function LocalDatabaseForUser({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  return <LocalDatabaseProvider owner={userId}>{children}</LocalDatabaseProvider>;
}

// The screens. Their header as the tabs': the theme's colours, a flat edge, the title 17/600 as the
// tabs' date, and the back arrow in blue.
function AppStack() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        title: 'FitSphere',
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontSize: 17, fontWeight: '600' },
        headerShadowVisible: false,
      }}
    >
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
  );
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
              <AppStack />
            </ThemeProvider>
          </SettingsProvider>
        </SyncProvider>
      </LocalDatabaseForUser>
    </AuthProvider>
  );
}
