import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { TEXTS } from '../auth/texts';
import { Screen, Text, TextButton } from '../components/ui';

export function CheckEmailScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Text style={styles.body}>{TEXTS.signUpSent}</Text>
      <TextButton title="Back to sign in" filled onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15 },
});
