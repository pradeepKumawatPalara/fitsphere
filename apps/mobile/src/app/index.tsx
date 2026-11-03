import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { StripeCorner } from '../components/StripeCorner';
import { Wordmark } from '../components/Wordmark';
import { useTheme } from '../theme';

// App start: while the session is read, the wordmark and a spinner (the redesign's 1.8, locked by
// the owner 2026-11-03); then Home, or Sign in.
export default function Start() {
  const { signedIn } = useAuth();
  const { colors } = useTheme();
  if (signedIn === null) {
    return (
      <View style={styles.start}>
        <StripeCorner />
        <Wordmark large />
        <ActivityIndicator color={colors.accent} accessibilityLabel="Opening FitSphere" />
      </View>
    );
  }
  return <Redirect href={signedIn ? '/home' : '/sign-in'} />;
}

const styles = StyleSheet.create({
  start: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
});
