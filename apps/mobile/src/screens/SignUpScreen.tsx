import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { signUp } from '../auth/service';
import { emailProblem, passwordProblem, TEXTS } from '../auth/texts';
import { FormScreen } from '../components/FormScreen';
import { DisplayHeading } from '../components/DisplayHeading';
import { ButtonHint, CheckBox, Field, Message, TextButton } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { useFieldChecks } from '../fieldChecks';
import { themedStyles } from '../theme';
import { backToSignIn } from './navigation';

// REQ-ACC-010, D-18: sign-up needs "I am 18 or older"; the result is always the neutral text. The
// redesign's screen 1.2 (locked by the owner, 2026-11-03): a problem with the email shows under it;
// the password's rule shows under the password, ticked once met and red when Sign up finds it
// broken. As before, Sign up names the first problem only.
export function SignUpScreen() {
  const styles = useStyles();
  const { deps } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const ruleMet = passwordProblem(password) === null;
  // Each problem shows once typing pauses or the field is left; Sign up waits meanwhile (D-99).
  const checks = useFieldChecks({ email, password });
  const emailIssue = emailProblem(email);
  const hint = emailIssue
    ? emailIssue === TEXTS.emailRule
      ? 'Enter your email address to sign up.'
      : 'Check your email address to sign up.'
    : !ruleMet
      ? 'Use 8 to 72 characters for the password to sign up.'
      : !adult
        ? TEXTS.ageHint
        : null;

  async function submit() {
    setMessage(null);
    if (emailIssue || !ruleMet || !adult) return;
    setBusy(true);
    const result = await signUp(deps, email, password);
    setBusy(false);
    if (result === 'offline') setMessage(TEXTS.needsInternet('Signing up'));
    else router.replace('/check-email');
  }

  // As Sign in: the form scrolls to the field being typed in; the footer, with Sign up, rides above
  // the keyboard. While signing up, a spinner takes Sign up's place and the form dims.
  return (
    <FormScreen
      contentStyle={[styles.content, busy && styles.busy]}
      footer={
        <>
          <Message text={message} offline={message === TEXTS.needsInternet('Signing up')} />
          <View style={styles.submit}>
            <TextButton title="Sign up" filled arrow disabled={hint !== null} busy={busy} onPress={() => void submit()} />
            {hint ? <ButtonHint text={hint} /> : null}
          </View>
          <TextButton title="I already have an account" outlined wide onPress={() => backToSignIn(router)} />
        </>
      }
    >
      <Wordmark />
      <DisplayHeading text="Create an account" style={styles.heading} />
      <View style={styles.fields}>
        <Field
          label="Email"
          error={checks.shows('email') ? emailIssue : null}
          value={email}
          onChangeText={setEmail}
          onFocus={() => checks.focus('email')}
          onBlur={() => checks.blur('email')}
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Password"
          error={checks.shows('password') && !ruleMet ? TEXTS.passwordRule : null}
          rule={{ text: TEXTS.passwordRule, met: ruleMet }}
          value={password}
          onChangeText={setPassword}
          onFocus={() => checks.focus('password')}
          onBlur={() => checks.blur('password')}
          secureTextEntry
          autoComplete="new-password"
        />
        <View style={styles.adult}>
          <CheckBox label={TEXTS.ageConfirmation} checked={adult} onChange={setAdult} />
        </View>
      </View>
    </FormScreen>
  );
}

// As Sign in: from the wordmark, 48 to the heading and 40 to the fields, 18 between them, 24 to the
// box; the hint close under Sign up.
const useStyles = themedStyles(() => ({
  content: { paddingTop: 24, gap: 0 },
  busy: { opacity: 0.6 },
  heading: { marginTop: 48 },
  fields: { marginTop: 40, gap: 18 },
  adult: { marginTop: 6 },
  submit: { gap: 8 },
}));
