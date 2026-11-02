import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { signUp } from '../auth/service';
import { emailProblem, passwordProblem, TEXTS } from '../auth/texts';
import { FormScreen } from '../components/FormScreen';
import { CheckBox, Field, Message, Text } from '../components/ui';

// REQ-ACC-010, D-18: sign-up needs "I am 18 or older"; the result is always the neutral text.
export function SignUpScreen() {
  const { deps } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    setBusy(false);
    if (result === 'offline') setMessage(TEXTS.needsInternet('Signing up'));
    else router.replace('/check-email');
  }

  // The form scrolls to the field being typed in; the footer, with Sign up, rides above the keyboard.
  return (
    <FormScreen
      contentStyle={styles.content}
      footer={
        <>
          <Message text={message} />
          <Button title="Sign up" disabled={!adult || busy} onPress={() => void submit()} />
          <Button title="I already have an account" onPress={() => router.replace('/sign-in')} />
        </>
      }
    >
      <Text accessibilityRole="header">Create an account</Text>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Text>{TEXTS.passwordRule}</Text>
      <CheckBox label={TEXTS.ageConfirmation} checked={adult} onChange={setAdult} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
});
