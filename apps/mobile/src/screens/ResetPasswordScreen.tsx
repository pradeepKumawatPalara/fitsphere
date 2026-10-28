import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Text } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { setNewPassword, startPasswordReset } from '../auth/service';
import { passwordProblem, TEXTS } from '../auth/texts';
import { Field, Message, Screen } from '../components/ui';

// "Set a new password", opened by the link in the reset email, fitsphere://reset-password
// (REQ-ACC-010, D-11).
export function ResetPasswordScreen() {
  const { deps } = useAuth();
  const router = useRouter();
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const [link, setLink] = useState<'checking' | 'ready' | 'invalid' | 'offline'>('checking');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void startPasswordReset(deps, error ? undefined : code).then((result) => {
      if (active) setLink(result);
    });
    return () => {
      active = false;
    };
  }, [deps, code, error]);

  async function submit() {
    const problem = passwordProblem(password);
    if (problem) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await setNewPassword(deps, password);
    setBusy(false);
    if (result === 'changed') router.replace('/home');
    else if (result === 'offline') setMessage(TEXTS.needsInternet('Setting a new password'));
    else if (result === 'samePassword') setMessage(TEXTS.samePassword);
    else setMessage(TEXTS.passwordRule);
  }

  if (link === 'checking') {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (link !== 'ready') {
    return (
      <Screen>
        <Text>{link === 'offline' ? TEXTS.needsInternet('Resetting a password') : TEXTS.resetLinkInvalid}</Text>
        <Button title="Forgot password" onPress={() => router.replace('/forgot-password')} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Text accessibilityRole="header">Set a new password</Text>
      <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Text>{TEXTS.passwordRule}</Text>
      <Message text={message} />
      <Button title="Set password" disabled={busy} onPress={() => void submit()} />
    </Screen>
  );
}
