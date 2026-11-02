import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount, signIn } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { FormScreen } from '../components/FormScreen';
import { Field, Message, Text, TextButton } from '../components/ui';
import { themedStyles } from '../theme';
import { goAfterAccountCheck } from './navigation';

// REQ-ACC-010: sign in, then GET /v1/me and account setup if needed.
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

  // The form scrolls to the field being typed in; the footer, with Sign in, rides above the keyboard.
  return (
    <FormScreen
      contentStyle={styles.content}
      footer={
        <>
          <Message text={message} />
          <TextButton title="Sign in" filled disabled={busy} onPress={() => void submit()} />
          <TextButton title="Create an account" wide onPress={() => router.replace('/sign-up')} />
        </>
      }
    >
      {notice === 'accountDeleted' ? (
        <View style={styles.notice}>
          <Text accessibilityRole="alert">{TEXTS.accountDeleted}</Text>
        </View>
      ) : null}
      <Text accessibilityRole="header" style={styles.heading}>
        Sign in
      </Text>
      <View style={styles.fields}>
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
        <TextButton title="Forgot password?" onPress={() => router.replace('/forgot-password')} />
      </View>
    </FormScreen>
  );
}

// Spacing as on Home and Log meal: 24 between groups, 12 within one, 8 in the footer.
const useStyles = themedStyles((c) => ({
  content: { paddingTop: 32, gap: 24 },
  notice: { padding: 14, borderRadius: 12, backgroundColor: c.surface },
  heading: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  fields: { gap: 12 },
}));
