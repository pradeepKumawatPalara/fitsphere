import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { changePassword } from '../auth/service';
import { passwordProblem, TEXTS } from '../auth/texts';
import { FormScreen } from '../components/FormScreen';
import { Banner, Field, Message, TextButton } from '../components/ui';
import { themedStyles } from '../theme';

// Change password (REQ-ACC-007; MVP default, D-31): the current password, then a new one of 8–72
// characters, as at sign-up. Online only. Afterwards the user's other devices are signed out. The
// redesign's 6.3 (locked by the owner, 2026-11-03): each problem shows under its field, the new
// password's rule under it, ticked once met; a missing connection and the change itself as banners.
export function ChangePasswordScreen() {
  const styles = useStyles();
  const { deps, email } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const offline = message === TEXTS.needsInternet('Changing your password');
  const ruleMet = passwordProblem(next) === null;

  async function submit() {
    setChanged(false);
    setMessage(null);
    const currentIssue = current ? null : TEXTS.currentPasswordRequired;
    const nextIssue = passwordProblem(next);
    setCurrentError(currentIssue);
    setNextError(nextIssue);
    if (currentIssue || nextIssue) return;
    if (!email) {
      setMessage(TEXTS.tryLater);
      return;
    }
    setBusy(true);
    const result = await changePassword(deps, email, current, next);
    setBusy(false);
    if (result === 'changed') {
      setCurrent('');
      setNext('');
      setChanged(true);
    } else if (result === 'wrongPassword') {
      setCurrentError(TEXTS.wrongCurrentPassword);
    } else if (result === 'samePassword') {
      setNextError(TEXTS.samePassword);
    } else {
      setMessage(result === 'offline' ? TEXTS.needsInternet('Changing your password') : TEXTS.tryLater);
    }
  }

  // As on Sign in: the form scrolls to the field being typed in; the footer, with the button and what
  // happened, rides above the keyboard.
  return (
    <FormScreen
      contentStyle={styles.content}
      footer={
        <>
          <Message text={message} offline={offline} />
          {changed ? <Banner tone="success" text={TEXTS.passwordChanged} /> : null}
          <TextButton title="Change password" filled busy={busy} onPress={() => void submit()} />
        </>
      }
    >
      <View style={styles.fields}>
        <Field
          label="Current password"
          error={currentError}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoComplete="current-password"
        />
        <Field
          label="New password"
          // A broken rule shows red only while it still is.
          error={nextError === TEXTS.passwordRule && ruleMet ? null : nextError}
          rule={{ text: TEXTS.passwordRule, met: ruleMet }}
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete="new-password"
        />
      </View>
    </FormScreen>
  );
}

// 20 between the fields.
const useStyles = themedStyles(() => ({
  content: { gap: 0 },
  fields: { gap: 20 },
}));
