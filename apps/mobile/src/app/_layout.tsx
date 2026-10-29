import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { AuthProvider } from '../auth/AuthProvider';
import { createAuthDeps } from '../auth/supabase';

const authDeps = createAuthDeps();

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
      <Stack screenOptions={{ title: 'FitSphere' }} />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
