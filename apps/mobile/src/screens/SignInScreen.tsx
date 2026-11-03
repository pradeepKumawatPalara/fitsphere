import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount, signIn } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { FormScreen } from '../components/FormScreen';
import { Banner, Field, Message, Text, TextButton } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { goAfterAccountCheck } from './navigation';

// REQ-ACC-010: sign in, then GET /v1/me and account setup if needed. The redesign's screen 1.1
// (locked by the owner, 2026-11-03): an empty field is named under that field; any other problem
// shows above Sign in.
export function SignInScreen() {
  const styles = useStyles();
  const { deps } = useAuth();
  const router = useRouter();
  // After Delete account (REQ-ACC-009; MVP default, D-31).
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    // An empty field is named; wrong details stay one neutral text (D-11).
    setMessage(null);
    if (!email.trim()) {
      setMissing({ email: TEXTS.emailRule });
      return;
    }
    if (!password) {
      setMissing({ password: TEXTS.passwordRequired });
      return;
    }
    setMissing({});
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
          <TextButton title="Sign in" filled arrow busy={busy} onPress={() => void submit()} />
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
      {/* "SIGN" over "IN", the second line in caramel. */}
      <Text accessibilityRole="header" accessibilityLabel="Sign in" style={styles.heading}>
        Sign{'\n'}
        <Text style={styles.headingSecond}>in</Text>
      </Text>
      <View style={styles.fields}>
        <Field
          label="Email"
          error={missing.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Password"
          error={missing.password}
          value={password}
          onChangeText={setPassword}
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

// From the wordmark: 48 to the heading (32 to a notice first), 40 to the fields, 18 between them;
// Forgot password sits close under the password.
const useStyles = themedStyles((c) => ({
  content: { paddingTop: 24, gap: 0 },
  busy: { opacity: 0.6 },
  notice: { marginTop: 32 },
  heading: { ...TYPE.display, marginTop: 48 },
  headingSecond: { color: c.accent },
  fields: { marginTop: 40, gap: 18 },
  forgot: { marginTop: -10 },
}));
