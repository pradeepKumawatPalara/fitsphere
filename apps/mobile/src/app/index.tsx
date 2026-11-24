import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { StripeCorner } from '../components/StripeCorner';
import { Wordmark } from '../components/Wordmark';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { startDestination, type StartDestination } from '../onboardingGate';
import { useTheme } from '../theme';

// App start: while the session is read, the wordmark and a spinner (the redesign's 1.8, locked by
// the owner 2026-11-03); then first sign-in onboarding if the account has not finished it (D-124), Home,
// or Sign in.
export default function Start() {
  const { signedIn, deps } = useAuth();
  const { colors } = useTheme();
  const local = useLocalDatabase();
  const db = local.state.status === 'ready' ? local.state.db : null;
  const [destination, setDestination] = useState<StartDestination | null>(null);
  // Without a usable phone database there is nothing to read the copy from: Home, as before.
  const noDatabase = local.state.status === 'failed';

  useEffect(() => {
    if (signedIn !== true || !db) return;
    let active = true;
    startDestination(db, deps)
      .then((next) => active && setDestination(next))
      .catch(() => active && setDestination('/home'));
    return () => {
      active = false;
    };
  }, [signedIn, db, deps]);

  if (signedIn === null || (signedIn && destination === null && !noDatabase)) {
    return (
      <View style={styles.start}>
        <StripeCorner />
        <Wordmark large />
        <ActivityIndicator color={colors.accent} accessibilityLabel="Opening FitSphere" />
      </View>
    );
  }
  return <Redirect href={signedIn ? (destination ?? '/home') : '/sign-in'} />;
}

const styles = StyleSheet.create({
  start: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
});
