import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { setNewPassword, startPasswordReset } from '../auth/service';
import { passwordProblem, TEXTS } from '../auth/texts';
import { FormScreen } from '../components/FormScreen';
import { Field, Message, Screen, Text, TextButton } from '../components/ui';
import { themedStyles, useTheme } from '../theme';

// "Set a new password", opened by the link in the reset email, fitsphere://reset-password
// (REQ-ACC-010, D-11).
export function ResetPasswordScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
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
    else setMessage(TEXTS.tryLater);
  }

  if (link === 'checking') {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  if (link !== 'ready') {
    return (
      <Screen>
        <Text style={styles.body}>{link === 'offline' ? TEXTS.needsInternet('Resetting a password') : TEXTS.resetLinkInvalid}</Text>
        <TextButton title="Forgot password" filled onPress={() => router.replace('/forgot-password')} />
      </Screen>
    );
  }
  // As Sign in: the form scrolls to the field being typed in; the footer, with its button, rides
  // above the keyboard.
  return (
    <FormScreen
      contentStyle={styles.content}
      footer={
        <>
          <Message text={message} />
          <TextButton title="Set password" filled disabled={busy} onPress={() => void submit()} />
        </>
      }
    >
      <Text accessibilityRole="header" style={styles.heading}>
        Set a new password
      </Text>
      <View style={styles.fields}>
        <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        <Text style={styles.rule}>{TEXTS.passwordRule}</Text>
      </View>
    </FormScreen>
  );
}

// As Sign in: 24 between groups, 12 within one.
const useStyles = themedStyles((c) => ({
  content: { paddingTop: 32, gap: 24 },
  heading: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  fields: { gap: 12 },
  // The rule belongs to the password: closer to it than to anything else.
  rule: { marginTop: -6, fontSize: 13, color: c.inkMuted },
  body: { fontSize: 15 },
}));
