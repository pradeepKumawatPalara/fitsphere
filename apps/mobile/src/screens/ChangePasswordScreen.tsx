import { useState } from 'react';
import { Button } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { changePassword } from '../auth/service';
import { passwordProblem, TEXTS } from '../auth/texts';
import { Field, Message, Screen, Text } from '../components/ui';

// Change password (REQ-ACC-007; MVP default, D-S1): the current password, then a new one of 8–72
// characters, as at sign-up. Online only. Afterwards the user's other devices are signed out.
export function ChangePasswordScreen() {
  const { deps, email } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  async function submit() {
    setChanged(false);
    if (!current) {
      setMessage(TEXTS.currentPasswordRequired);
      return;
    }
    const problem = passwordProblem(next);
    if (problem) {
      setMessage(problem);
      return;
    }
    if (!email) {
      setMessage(TEXTS.tryLater);
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await changePassword(deps, email, current, next);
    setBusy(false);
    if (result === 'changed') {
      setCurrent('');
      setNext('');
      setChanged(true);
    } else {
      setMessage(
        result === 'wrongPassword'
          ? TEXTS.wrongCurrentPassword
          : result === 'samePassword'
            ? TEXTS.samePassword
            : result === 'offline'
              ? TEXTS.needsInternet('Changing your password')
              : TEXTS.tryLater,
      );
    }
  }

  return (
    <Screen>
      <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
      <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" />
      <Text>{TEXTS.passwordRule}</Text>
      <Message text={message} />
      {changed ? <Text accessibilityRole="alert">{TEXTS.passwordChanged}</Text> : null}
      <Button title="Change password" disabled={busy} onPress={() => void submit()} />
    </Screen>
  );
}
