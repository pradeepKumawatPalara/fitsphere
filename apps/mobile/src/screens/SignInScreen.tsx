import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount, signIn } from '../auth/service';
import { emailProblem, TEXTS } from '../auth/texts';
import { FormScreen } from '../components/FormScreen';
import { DisplayHeading } from '../components/DisplayHeading';
import { Banner, ButtonHint, Field, Message, TextButton } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { useFieldChecks } from '../fieldChecks';
import { themedStyles } from '../theme';
import { goAfterAccountCheck } from './navigation';

// REQ-ACC-010: sign in, then GET /v1/me and account setup if needed. The redesign's screen 1.1
// (locked by the owner, 2026-11-03): an empty field is named under that field; any other problem
// shows above Sign in. Since D-99 each field's problem shows once typing pauses or it is left, and Sign
// in waits, saying what is missing; wrong details still show after it, from the server (D-11).
export function SignInScreen() {
  const styles = useStyles();
  const { deps } = useAuth();
  const router = useRouter();
  // After Delete account (REQ-ACC-009; MVP default, D-31).
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const checks = useFieldChecks({ email, password });
  const emailIssue = emailProblem(email);
  const passwordIssue = password ? null : TEXTS.passwordRequired;

  async function submit() {
    // Wrong details stay one neutral text (D-11).
    setMessage(null);
    if (emailIssue || passwordIssue) return;
    setBusy(true);
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

  // The form scrolls to the field being typed in; the footer, with Sign in, rides above the keyboard.
  // While signing in, a spinner takes Sign in's place and the form dims.
  return (
    <FormScreen
      contentStyle={[styles.content, busy && styles.busy]}
      footer={
        <>
          <Message text={message} offline={message === TEXTS.needsInternet('Signing in')} />
          <TextButton title="Sign in" filled arrow busy={busy} disabled={!!emailIssue || !!passwordIssue} onPress={() => void submit()} />
          {emailIssue || passwordIssue ? <ButtonHint text={signInHint(emailIssue, passwordIssue)} /> : null}
          <TextButton title="Create an account" outlined wide onPress={() => router.push('/sign-up')} />
        </>
      }
    >
      <Wordmark />
      {notice === 'accountDeleted' ? (
        <View style={styles.notice}>
          <Banner tone="info" text={TEXTS.accountDeleted} />
        </View>
      ) : null}
      <DisplayHeading text="Sign in" style={styles.heading} />
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
          error={checks.shows('password') ? passwordIssue : null}
          value={password}
          onChangeText={setPassword}
          onFocus={() => checks.focus('password')}
          onBlur={() => checks.blur('password')}
          secureTextEntry
          autoComplete="current-password"
        />
        <View style={styles.forgot}>
          <TextButton title="Forgot password?" end onPress={() => router.push('/forgot-password')} />
        </View>
      </View>
    </FormScreen>
  );
}

/** Under Sign in while it waits (D-99): what is missing. */
function signInHint(emailIssue: string | null, passwordIssue: string | null): string {
  if (emailIssue === TEXTS.emailRule) return passwordIssue ? 'Enter your email address and password to sign in.' : 'Enter your email address to sign in.';
  if (emailIssue) return 'Check your email address to sign in.';
  return 'Enter your password to sign in.';
}

// From the wordmark: 48 to the heading (32 to a notice first), 40 to the fields, 18 between them;
// Forgot password sits close under the password.
const useStyles = themedStyles(() => ({
  content: { paddingTop: 24, gap: 0 },
  busy: { opacity: 0.6 },
  notice: { marginTop: 32 },
  heading: { marginTop: 48 },
  fields: { marginTop: 40, gap: 18 },
  forgot: { marginTop: -10 },
}));
