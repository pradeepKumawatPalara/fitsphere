import { useFonts } from 'expo-font';
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
import { FONT_FILES, TYPE } from '../typography';

const authDeps = createAuthDeps();

// The signed-in user's encrypted database opens when the app starts with a session.
function LocalDatabaseForUser({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  return <LocalDatabaseProvider owner={userId}>{children}</LocalDatabaseProvider>;
}

// App start and the sign-in screens draw their own heading, so they have no header.
const NO_HEADER = ['index', 'sign-in', 'sign-up', 'forgot-password', 'reset-password', 'check-email', 'verified', 'account-setup'];

// The screens. Their header as the tabs': the theme's colours, a flat edge, the back arrow in caramel;
// the title in condensed capitals (the redesign's 3.5, locked by the owner 2026-11-03).
function AppStack() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        title: 'FitSphere',
        headerTintColor: colors.accent,
        headerTitle: ({ children }) => (
          <Text numberOfLines={1} style={TYPE.screenHeader}>
            {children}
          </Text>
        ),
        headerShadowVisible: false,
      }}
    >
      {/* The tabs have their own header (REQ-NAV-002). */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {NO_HEADER.map((name) => (
        <Stack.Screen key={name} name={name} options={{ headerShown: false }} />
      ))}
      <Stack.Screen name="account" options={{ title: 'Settings' }} />
      <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
      <Stack.Screen name="targets" options={{ title: 'Your targets' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="log-meal" options={{ title: 'Log meal' }} />
      {/* A saved meal (D-69): made new from its name, or opened to change. */}
      <Stack.Screen
        name="saved-meal"
        options={({ route }) => ({ title: (route.params as { savedId?: string } | undefined)?.savedId ? 'Edit saved meal' : 'New saved meal' })}
      />
      {/* A meal's or the day's Insight (D-70), from a logged meal's Insight icon. */}
      <Stack.Screen name="insight" options={{ title: 'Insight' }} />
      <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
      <Stack.Screen name="weight-history" options={{ title: 'Weight history' }} />
    </Stack>
  );
}

export default function RootLayout() {
  // The design's fonts (D-35) load from the app's own files at start; if they fail, the phone's font
  // stands in.
  const [fontsLoaded, fontsFailed] = useFonts(FONT_FILES);
  if (!fontsLoaded && !fontsFailed) return null;
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
