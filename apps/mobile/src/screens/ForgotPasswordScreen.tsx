import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { requestPasswordReset } from '../auth/service';
import { emailProblem, TEXTS } from '../auth/texts';
import { Field, Message, Screen, Text } from '../components/ui';

// REQ-ACC-010, D-11: the same neutral text whether or not the address is registered.
export function ForgotPasswordScreen() {
  const { deps } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    const problem = emailProblem(email);
    if (problem) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await requestPasswordReset(deps, email);
    setBusy(false);
    if (result === 'offline') setMessage(TEXTS.needsInternet('Resetting a password'));
    else setSent(true);
  }

  return (
    <Screen>
      <Text accessibilityRole="header">Forgot password</Text>
      {sent ? (
        <Text>{TEXTS.resetSent}</Text>
      ) : (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
          <Message text={message} />
          <Button title="Send reset link" disabled={busy} onPress={() => void submit()} />
        </>
      )}
      <Button title="Back to sign in" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
