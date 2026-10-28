import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, Text } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount, signIn, signUp } from '../auth/service';
import { TEMPORARY_PASSWORD } from '../auth/temporary-password';
import { emailProblem, passwordProblem, TEXTS } from '../auth/texts';
import { CheckBox, Field, Message, Screen } from '../components/ui';
import { goAfterAccountCheck } from './navigation';

// REQ-ACC-010, D-18: sign-up needs "I am 18 or older"; the result is always the neutral text.
export function SignUpScreen() {
  const { deps } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  // const [password, setPassword] = useState('');
  const [password, setPassword] = useState(TEMPORARY_PASSWORD); // TESTING ONLY
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    const problem = emailProblem(email) ?? passwordProblem(password);
    if (problem) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await signUp(deps, email, password);
    // setBusy(false);
    // if (result === 'offline') setMessage(TEXTS.needsInternet('Signing up'));
    // else router.replace('/check-email');
    // TESTING ONLY: with Confirm email off, sign in straight away instead of "check your email";
    // if Supabase still refuses the sign-in, show that screen as before.
    if (result === 'offline') setMessage(TEXTS.needsInternet('Signing up'));
    else if ((await signIn(deps, email, password)) === 'signedIn')
      setMessage(goAfterAccountCheck(router, await ensureAccount(deps), 'Signing up'));
    else router.replace('/check-email');
    setBusy(false);
  }

  return (
    <Screen>
      <Text accessibilityRole="header">Create an account</Text>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Text>{TEXTS.passwordRule}</Text>
      <CheckBox label={TEXTS.ageConfirmation} checked={adult} onChange={setAdult} />
      <Message text={message} />
      <Button title="Sign up" disabled={!adult || busy} onPress={() => void submit()} />
      <Button title="I already have an account" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
