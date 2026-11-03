import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Screen, Text, TextButton } from '../components/ui';

// Opened by the link in the verify email (fitsphere://verified). The link confirms the address;
// the app then asks the user to sign in (api-conventions, "Sign-in flows"). Supabase adds
// `error` when the link has expired or was used.
export function VerifiedScreen() {
  const router = useRouter();
  const { error } = useLocalSearchParams<{ error?: string }>();
  return (
    <Screen>
      <Text style={styles.body}>
        {error
          ? 'This link has expired or was already used. Sign in, or sign up again for a new link.'
          : 'Your email is verified. Sign in to continue.'}
      </Text>
      <TextButton title="Sign in" filled onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15 },
});
