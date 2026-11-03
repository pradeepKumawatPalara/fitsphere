import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { requestPasswordReset } from '../auth/service';
import { emailProblem, TEXTS } from '../auth/texts';
import { FormScreen } from '../components/FormScreen';
import { Field, Message, Text, TextButton } from '../components/ui';
import { themedStyles } from '../theme';
import { backToSignIn } from './navigation';

// REQ-ACC-010, D-11: the same neutral text whether or not the address is registered.
export function ForgotPasswordScreen() {
  const styles = useStyles();
  const { deps } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    const problem = emailProblem(email);
    if (problem) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await requestPasswordReset(deps, email);
    setBusy(false);
    if (result === 'offline') setMessage(TEXTS.needsInternet('Resetting a password'));
    else setSent(true);
  }

  // As Sign in: the form scrolls to the field being typed in; the footer, with its button, rides
  // above the keyboard. Once the link is sent, going back to sign in is the step left.
  return (
    <FormScreen
      contentStyle={styles.content}
      footer={
        <>
          {sent ? null : (
            <>
              <Message text={message} />
              <TextButton title="Send reset link" filled disabled={busy} onPress={() => void submit()} />
            </>
          )}
          <TextButton title="Back to sign in" filled={sent} wide onPress={() => backToSignIn(router)} />
        </>
      }
    >
      <Text accessibilityRole="header" style={styles.heading}>
        Forgot password
      </Text>
      {sent ? (
        <View style={styles.notice}>
          <Text style={styles.body}>{TEXTS.resetSent}</Text>
        </View>
      ) : (
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      )}
    </FormScreen>
  );
}

// As Sign in: 24 between groups.
const useStyles = themedStyles((c) => ({
  content: { paddingTop: 32, gap: 24 },
  heading: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  notice: { padding: 14, borderRadius: 12, backgroundColor: c.surface },
  body: { fontSize: 15 },
}));
