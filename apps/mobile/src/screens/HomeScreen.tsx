import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { checkApiHealth } from '../api/health';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount, signOutLocally } from '../auth/service';
import { ApiStatus } from '../components/ApiStatus';
import { ExpiredTokenTest } from '../components/ExpiredTokenTest';
import { TodayIst } from '../components/TodayIst';

export function HomeScreen() {
  const { deps, email } = useAuth();
  const router = useRouter();
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void ensureAccount(deps).then((state) => {
      if (!active) return;
      if (state.kind === 'ready') setAccountEmail(state.me.user.email);
      else if (state.kind === 'needsAgeConfirmation') router.replace('/account-setup');
      else if (state.kind === 'signedOut') router.replace('/sign-in');
      // Offline or unavailable: stay on Home with the session's email.
    });
    return () => {
      active = false;
    };
  }, [deps, router]);

  async function logOut() {
    await signOutLocally(deps);
    router.replace('/sign-in');
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TodayIst />
      <Text>Signed in as {accountEmail ?? email}</Text>
      <Button title="Log out" onPress={() => void logOut()} />
      {__DEV__ ? (
        <View style={styles.dev}>
          <ApiStatus apiUrl={deps.apiUrl} check={checkApiHealth} />
          <ExpiredTokenTest deps={deps} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  dev: { marginTop: 32, gap: 24, borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 16 },
});
