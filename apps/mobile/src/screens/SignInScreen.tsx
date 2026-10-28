import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, Text } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount, signIn } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { Field, Message, Screen } from '../components/ui';
import { goAfterAccountCheck } from './navigation';

// REQ-ACC-010: sign in, then GET /v1/me and account setup if needed.
export function SignInScreen() {
  const { deps } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setMessage(TEXTS.signInFailed);
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await signIn(deps, email, password);
    if (result === 'signedIn') {
      setMessage(goAfterAccountCheck(router, await ensureAccount(deps), 'Signing in'));
    } else {
      setMessage(
        result === 'offline' ? TEXTS.needsInternet('Signing in') : result === 'unavailable' ? TEXTS.tryLater : TEXTS.signInFailed,
      );
    }
    setBusy(false);
  }

  return (
    <Screen>
      <Text accessibilityRole="header">Sign in</Text>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      <Message text={message} />
      <Button title="Sign in" disabled={busy} onPress={() => void submit()} />
      <Button title="Create an account" onPress={() => router.replace('/sign-up')} />
    </Screen>
  );
}
