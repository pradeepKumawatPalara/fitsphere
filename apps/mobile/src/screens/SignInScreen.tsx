import { useLocalSearchParams, useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount, signIn } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { Field, Message, Text, TextButton } from '../components/ui';
import { themedStyles } from '../theme';
import { goAfterAccountCheck } from './navigation';

// REQ-ACC-010: sign in, then GET /v1/me and account setup if needed.
export function SignInScreen() {
  const styles = useStyles();
  // The fixed footer clears the phone's navigation bar; none outside the app (tests).
  const insets = useContext(SafeAreaInsetsContext);
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
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: 16 + (insets?.bottom ?? 0) }]}>
        <Message text={message} />
        <TextButton title="Sign in" filled disabled={busy} onPress={() => void submit()} />
        <TextButton title="Create an account" onPress={() => router.replace('/sign-up')} />
      </View>
    </KeyboardAvoidingView>
  );
}

// Spacing as on Home and Log meal: 24 between groups, 12 within one, 8 in the footer.
const useStyles = themedStyles((c) => ({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24, gap: 24 },
  notice: { padding: 14, borderRadius: 12, backgroundColor: c.surface },
  heading: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  fields: { gap: 12 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: c.background,
  },
}));
