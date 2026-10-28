import { useRouter } from 'expo-router';
import { Button, Text } from 'react-native';
import { TEXTS } from '../auth/texts';
import { Screen } from '../components/ui';

export function CheckEmailScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Text>{TEXTS.signUpSent}</Text>
      <Button title="Back to sign in" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
