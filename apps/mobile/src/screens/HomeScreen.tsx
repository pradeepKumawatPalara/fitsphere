import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { checkApiHealth } from '../api/health';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount } from '../auth/service';
import { ApiStatus } from '../components/ApiStatus';
import { ExpiredTokenTest } from '../components/ExpiredTokenTest';
import { LocalDatabaseCheck } from '../components/LocalDatabaseCheck';
import { TodayIst } from '../components/TodayIst';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { LogOut } from './LogOut';

export function HomeScreen() {
  const { deps, email } = useAuth();
  const local = useLocalDatabase();
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

  // Never run unencrypted (ADR-0007 rule 5): stop, and leave only Log out.
  if (local.state.status === 'failed') {
    return (
      <View style={styles.stopped}>
        <Text accessibilityRole="alert">
          {local.state.reason === 'sqlcipherMissing'
            ? 'FitSphere stopped: this phone’s database cannot be encrypted.'
            : 'FitSphere stopped: this phone’s database could not be opened.'}
        </Text>
        <LogOut />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <TodayIst />
      <Text>Signed in as {accountEmail ?? email}</Text>
      <LogOut />
      {__DEV__ ? (
        <View style={styles.dev}>
          <ApiStatus apiUrl={deps.apiUrl} check={checkApiHealth} />
          <LocalDatabaseCheck />
          <ExpiredTokenTest deps={deps} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  stopped: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  dev: { marginTop: 32, gap: 24, borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 16 },
});
